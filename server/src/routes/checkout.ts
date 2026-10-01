import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { db } from "../lib/db.js";
import { config } from "../lib/config.js";
import { readSession } from "../lib/session.js";
import { addMonths, computeTermPricing, type TermMonths } from "../lib/pricing.js";
import { cfCreateOrder, cfGetOrder } from "../lib/cashfree.js";
import { rateLimit } from "../lib/rateLimit.js";
import { sendReceiptEmail } from "../lib/email.js";
import { computeGst, GSTIN_RE, stateFromGstin } from "../lib/gst.js";
import { attributeReferral, logReferralEvent, resolveActivePartnerByCode } from "../lib/partnerAttribution.js";
import { evaluateBonus, reverseCommission } from "../lib/partnerJobs.js";
import { PARTNER_PROGRAM } from "../lib/partnerProgram.js";
import { notifyPartner } from "../lib/partnerNotify.js";
import { logOnboardingEvent } from "../lib/onboardingEvents.js";
import { logFunnelEvent } from "../lib/funnelEvents.js";
import { renderInvoicePdf } from "../lib/invoice.js";

export const checkoutRouter = Router();

const checkoutSchema = z.object({
  planCode: z.string().min(1),
  termMonths: z.union([z.literal(1), z.literal(6), z.literal(12)]),
  stateCode: z.string().length(2),
  gstin: z.string().regex(GSTIN_RE).optional().or(z.literal("")),
  // userchanges.md C-2 — required so receipts and the GST invoice always
  // have somewhere to go, even for phone-only accounts.
  invoiceEmail: z.string().email(),
  referralCode: z.string().optional(), // partners.md §7.1: a typed code overrides the cookie
});

// userchanges.md X-6 — reuse an unpaid order for the same plan+term created
// in the last 24h instead of creating a new row every time someone returns
// to Checkout. Keeps admin order lists clean.
const ABANDONED_REUSE_WINDOW_MS = 24 * 60 * 60_000;

checkoutRouter.post("/", async (req, res) => {
  const session = await readSession(req);
  if (!session) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }

  if (!rateLimit(`checkout:${session.sub}`, 30, 10 * 60_000)) {
    res.status(429).json({ error: "rate_limited" });
    return;
  }

  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input" });
    return;
  }

  const [plan, cfg, user] = await Promise.all([
    db.plan.findUnique({ where: { code: parsed.data.planCode } }),
    db.launchConfig.findUnique({ where: { id: 1 } }),
    db.user.findUnique({ where: { id: session.sub } }),
  ]);

  if (!plan?.isActive || !cfg || !cfg.checkoutEnabled || !user) {
    res.status(400).json({ error: "checkout_unavailable" });
    return;
  }

  if (!config.cashfree.isConfigured) {
    // Real keys arrive later. Fail loudly and clearly instead of a broken redirect.
    res.status(503).json({ error: "payments_not_configured" });
    return;
  }

  const termMonths = parsed.data.termMonths as TermMonths;
  const pricing = computeTermPricing(plan.normalPaiseMonth, termMonths);

  // onboarding.md §7.2: a valid GSTIN's state prefix wins over a
  // manually-picked billing state, quietly — never a hard error.
  const stateCode =
    parsed.data.gstin && GSTIN_RE.test(parsed.data.gstin) ? stateFromGstin(parsed.data.gstin) : parsed.data.stateCode;

  const gstBreakdown = computeGst(pricing.subtotalPaise, stateCode, config.supplierStateCode);

  if (parsed.data.referralCode) {
    await attributeReferral({
      accountId: user.id,
      partnerCode: parsed.data.referralCode,
      via: "code",
      accountPhone: user.phone,
      accountEmail: user.email,
    });
  }
  const referral = await db.referral.findUnique({ where: { accountId: user.id } });
  const linkedReferralId = referral && referral.status === "signed_up" ? referral.id : null;

  const orderData = {
    userId: user.id,
    planCode: plan.code,
    termMonths,
    isEarlyBird: false,
    discountPercent: pricing.discountPercent,
    savingsPaise: pricing.savingsPaise,
    invoiceEmail: parsed.data.invoiceEmail,
    ratePaiseMonth: pricing.monthlyRatePaise,
    subtotalPaise: pricing.subtotalPaise,
    cgstPaise: gstBreakdown.cgstPaise,
    sgstPaise: gstBreakdown.sgstPaise,
    igstPaise: gstBreakdown.igstPaise,
    placeOfSupply: gstBreakdown.placeOfSupply,
    totalPaise: gstBreakdown.totalPaise,
    referralId: linkedReferralId,
  };

  const reusable = await db.order.findFirst({
    where: {
      userId: user.id,
      planCode: plan.code,
      termMonths,
      status: "CREATED",
      createdAt: { gte: new Date(Date.now() - ABANDONED_REUSE_WINDOW_MS) },
    },
    orderBy: { createdAt: "desc" },
  });

  const order = reusable
    ? await db.order.update({
        where: { id: reusable.id },
        data: {
          ...orderData,
          idempotencyKey: crypto.randomUUID(),
          expiresAt: new Date(Date.now() + 30 * 60_000),
          cfOrderId: null,
          cfPaymentSessionId: null,
        },
      })
    : await db.order.create({
        data: {
          ...orderData,
          idempotencyKey: crypto.randomUUID(),
          expiresAt: new Date(Date.now() + 30 * 60_000),
        },
      });

  if (linkedReferralId) {
    await logReferralEvent(referral!.partnerId, "checkout_started", { source: referral!.attributedVia as "link" | "code", accountId: user.id });
  }
  await logOnboardingEvent(user.id, "PLAN_SELECTED");
  await logFunnelEvent({ userId: user.id, event: "checkout_started", referralPartnerId: linkedReferralId ? referral!.partnerId : null, meta: { termMonths, planCode: plan.code } });

  const userUpdates: Record<string, unknown> = {};
  if (parsed.data.gstin || stateCode !== user.billingStateCode) {
    userUpdates.gstin = parsed.data.gstin || user.gstin;
    userUpdates.billingStateCode = stateCode;
  }
  if (!user.email) userUpdates.email = parsed.data.invoiceEmail;
  if (user.onboardingStep === "IDENTIFIED" || user.onboardingStep === "PROFILED") userUpdates.onboardingStep = "PLAN_SELECTED";
  if (Object.keys(userUpdates).length > 0) {
    await db.user.update({ where: { id: user.id }, data: userUpdates });
  }

  try {
    const cf = await cfCreateOrder({
      orderId: order.id,
      orderAmountRupees: Number(gstBreakdown.totalPaise) / 100,
      idempotencyKey: order.idempotencyKey,
      customer: {
        id: user.id,
        email: parsed.data.invoiceEmail,
        phone: user.phone ?? "",
        name: user.fullName ?? parsed.data.invoiceEmail,
      },
      returnUrl: `${config.appUrl}/checkout/return?order_id={order_id}`,
      notifyUrl: `${config.apiPublicUrl}/api/webhooks/cashfree`,
      expiresAt: order.expiresAt.toISOString(),
      note: `${plan.name} · ${termMonths} months`,
    });

    await db.order.update({
      where: { id: order.id },
      data: { cfOrderId: cf.cf_order_id, cfPaymentSessionId: cf.payment_session_id },
    });

    res.json({
      paymentSessionId: cf.payment_session_id,
      orderId: order.id,
      cashfreeMode: config.cashfree.env,
      subtotalPaise: Number(order.subtotalPaise),
      discountPercent: order.discountPercent,
      savingsPaise: Number(order.savingsPaise),
      cgstPaise: Number(order.cgstPaise),
      sgstPaise: Number(order.sgstPaise),
      igstPaise: Number(order.igstPaise),
      totalPaise: Number(order.totalPaise),
    });
  } catch (err) {
    console.error("Cashfree create-order error:", err);
    res.status(502).json({ error: "gateway_error" });
  }
});

const quoteSchema = z.object({
  planCode: z.string().min(1),
  termMonths: z.coerce.number().pipe(z.union([z.literal(1), z.literal(6), z.literal(12)])),
  stateCode: z.string().length(2),
  gstin: z.string().regex(GSTIN_RE).optional().or(z.literal("")),
});

// Live preview for the checkout page — no order is created, nothing is
// charged. The real order (and the number actually billed) is always
// computed again, server-side, in POST / above.
checkoutRouter.get("/quote", async (req, res) => {
  const parsed = quoteSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input" });
    return;
  }

  const plan = await db.plan.findUnique({ where: { code: parsed.data.planCode } });
  if (!plan?.isActive) {
    res.status(400).json({ error: "checkout_unavailable" });
    return;
  }

  const termMonths = parsed.data.termMonths as TermMonths;
  const pricing = computeTermPricing(plan.normalPaiseMonth, termMonths);

  const stateCode =
    parsed.data.gstin && GSTIN_RE.test(parsed.data.gstin) ? stateFromGstin(parsed.data.gstin) : parsed.data.stateCode;
  const g = computeGst(pricing.subtotalPaise, stateCode, config.supplierStateCode);

  res.json({
    discountPercent: pricing.discountPercent,
    ratePaiseMonth: Number(pricing.monthlyRatePaise),
    savingsPaise: Number(pricing.savingsPaise),
    subtotalPaise: Number(g.netPaise),
    cgstPaise: Number(g.cgstPaise),
    sgstPaise: Number(g.sgstPaise),
    igstPaise: Number(g.igstPaise),
    totalPaise: Number(g.totalPaise),
    placeOfSupply: g.placeOfSupply,
    resolvedFromGstin: Boolean(parsed.data.gstin && GSTIN_RE.test(parsed.data.gstin)),
  });
});

// userchanges.md C-7 — live-validate a typed referral code without
// attaching it. Attachment still only happens at POST / via attributeReferral.
checkoutRouter.get("/referral", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  if (!code.trim()) {
    res.json({ valid: false });
    return;
  }
  const partner = await resolveActivePartnerByCode(code);
  res.json({ valid: Boolean(partner) });
});

export const ordersRouter = Router();

// userchanges.md X-5 — the Billing page's order list.
ordersRouter.get("/", async (req, res) => {
  const session = await readSession(req);
  if (!session) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }
  const orders = await db.order.findMany({
    where: { userId: session.sub },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({
    orders: orders.map((o) => ({
      id: o.id,
      planName: o.plan.name,
      termMonths: o.termMonths,
      status: o.status,
      totalPaise: Number(o.totalPaise),
      createdAt: o.createdAt.toISOString(),
      paidAt: o.paidAt?.toISOString() ?? null,
    })),
  });
});

ordersRouter.get("/:id", async (req, res) => {
  const session = await readSession(req);
  if (!session) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }
  const order = await db.order.findUnique({ where: { id: req.params.id } });
  if (!order || order.userId !== session.sub) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  // Reconcile against Cashfree if still pending and we have a gateway ref.
  if (["CREATED", "PENDING"].includes(order.status) && order.cfOrderId && config.cashfree.isConfigured) {
    try {
      const cf = await cfGetOrder(order.cfOrderId);
      if (cf.order_status === "PAID" && order.status !== "PAID") {
        // Webhook may not have landed yet; return current DB status and let
        // the webhook (source of truth) perform the actual fulfilment.
      }
    } catch (err) {
      console.error("Cashfree reconcile error:", err);
    }
  }

  res.json({
    id: order.id,
    status: order.status,
    planCode: order.planCode,
    termMonths: order.termMonths,
    discountPercent: order.discountPercent,
    subtotalPaise: Number(order.subtotalPaise),
    savingsPaise: Number(order.savingsPaise),
    cgstPaise: Number(order.cgstPaise),
    sgstPaise: Number(order.sgstPaise),
    igstPaise: Number(order.igstPaise),
    totalPaise: Number(order.totalPaise),
    invoiceEmail: order.invoiceEmail,
  });
});

// userchanges.md X-5 — GST invoice PDF, built only from the stored Order
// columns (never recomputed) so it always matches the quote/order/admin totals.
ordersRouter.get("/:id/invoice", async (req, res) => {
  const session = await readSession(req);
  if (!session) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }
  const order = await db.order.findUnique({ where: { id: req.params.id }, include: { plan: true, user: true } });
  if (!order || order.userId !== session.sub || order.status !== "PAID") {
    res.status(404).json({ error: "not_found" });
    return;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="dorway-invoice-${order.id.slice(0, 8)}.pdf"`);
  renderInvoicePdf(order).pipe(res);
});

export const webhookRouter = Router();

webhookRouter.post("/cashfree", async (req, res) => {
  const rawBody: Buffer = req.body;
  const signature = req.headers["x-webhook-signature"] as string | undefined;
  const timestamp = req.headers["x-webhook-timestamp"] as string | undefined;

  if (!signature || !timestamp || !config.cashfree.hmacSecret) {
    res.status(401).send("invalid signature");
    return;
  }

  const expected = crypto
    .createHmac("sha256", config.cashfree.hmacSecret)
    .update(timestamp + rawBody.toString("utf8"))
    .digest("base64");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  const ok = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);

  if (!ok) {
    res.status(401).send("invalid signature");
    return;
  }

  if (Math.abs(Date.now() - Number(timestamp) * 1000) > 5 * 60_000) {
    res.status(400).send("stale");
    return;
  }

  const evt = JSON.parse(rawBody.toString("utf8"));
  const dedupeKey = [evt.type, evt.data?.payment?.cf_payment_id, evt.data?.order?.order_id].join(":");

  try {
    await db.webhookEvent.create({
      data: { dedupeKey, eventType: evt.type, signatureOk: true, raw: evt },
    });
  } catch {
    res.status(200).send("ok"); // duplicate — already processed
    return;
  }

  try {
    await processWebhookEvent(evt);
  } catch (err) {
    console.error("Webhook processing error:", err);
  }

  res.status(200).send("ok");
});

// Exported so routes/adminPurchases.ts's payment resync can replay the exact
// same PAID-transition side effects (referral, commission, entitlement) a
// live webhook would have caused — superadmin.md §6.4.
export async function processWebhookEvent(evt: any) {
  const type = evt.type as string;
  const orderId = evt.data?.order?.order_id as string | undefined;
  if (!orderId) return;

  if (type === "PAYMENT_SUCCESS_WEBHOOK") {
    await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.status === "PAID") return;

      const paidPaise = BigInt(Math.round(Number(evt.data.payment.payment_amount) * 100));
      if (paidPaise !== order.totalPaise) {
        console.error(`Amount mismatch on order ${order.id}: paid ${paidPaise}, expected ${order.totalPaise}`);
        return;
      }

      await tx.payment.create({
        data: {
          orderId: order.id,
          cfPaymentId: evt.data.payment.cf_payment_id,
          status: evt.data.payment.payment_status ?? "SUCCESS",
          method: evt.data.payment.payment_method ? Object.keys(evt.data.payment.payment_method)[0] : null,
          amountPaise: paidPaise,
          raw: evt,
        },
      });

      // partners.md §7.2/§7.3: commission on the referred account's FIRST paid
      // order only (§12.2 open decision — this is the doc's stated default).
      // userchanges.md P-4: the base is the post-discount subtotal, excluding
      // GST — not the GST-inclusive total.
      if (order.referralId) {
        const priorPaidOrders = await tx.order.count({ where: { userId: order.userId, status: "PAID" } });
        if (priorPaidOrders === 0) {
          const referral = await tx.referral.findUnique({ where: { id: order.referralId } });
          if (referral && referral.status === "signed_up") {
            const paidAt = new Date();
            const holdUntil = new Date(paidAt.getTime() + PARTNER_PROGRAM.holdDays * 86_400_000);
            const amount = BigInt(Math.floor(Number(order.subtotalPaise) * PARTNER_PROGRAM.commissionRate));
            await tx.commission.create({
              data: { partnerId: referral.partnerId, orderId: order.id, amount, status: "on_hold", paidAt, holdUntil },
            });
            await tx.referral.update({ where: { id: referral.id }, data: { status: "converted" } });
            await evaluateBonus(tx, referral.partnerId);
          }
        }
      }

      await tx.order.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date() } });
      await tx.user.update({ where: { id: order.userId }, data: { onboardingStep: "PAID" } });
      await logOnboardingEvent(order.userId, "PAID", undefined, tx);
      await tx.funnelEvent.create({ data: { userId: order.userId, event: "paid", meta: { orderId: order.id, totalPaise: order.totalPaise.toString() } as never } });

      const cfg = await tx.launchConfig.findUnique({ where: { id: 1 } });
      const starts = cfg?.launchAt ?? new Date();
      await tx.entitlement.create({
        data: {
          userId: order.userId,
          orderId: order.id,
          planCode: order.planCode,
          ratePaiseMonth: order.ratePaiseMonth,
          termMonths: order.termMonths,
          accessStartsAt: starts,
          accessEndsAt: addMonths(starts, order.termMonths),
          status: "PENDING_LAUNCH",
          approvalStatus: "PENDING_REVIEW",
        },
      });
    });

    const order = await db.order.findUnique({ where: { id: orderId }, include: { user: true, plan: true } });
    const invoiceEmail = order?.invoiceEmail ?? order?.user.email;
    if (order && invoiceEmail) {
      await sendReceiptEmail(
        invoiceEmail,
        `${order.plan.name} · ${order.termMonths} months · ₹${(Number(order.totalPaise) / 100).toFixed(2)} paid.`,
      );
    }
    if (order) {
      const commission = await db.commission.findUnique({ where: { orderId: order.id }, include: { partner: true } });
      if (commission) {
        notifyPartner(
          commission.partner.phone,
          "checkout_completed",
          `${order.plan.name} completed checkout. ₹${Number(commission.amount) / 100} commission is on hold until ${commission.holdUntil.toDateString()}.`,
        );
      }
    }
  } else if (type === "PAYMENT_FAILED_WEBHOOK") {
    await db.order.updateMany({ where: { id: orderId, status: { in: ["CREATED", "PENDING"] } }, data: { status: "FAILED" } });
  } else if (type === "PAYMENT_USER_DROPPED_WEBHOOK") {
    await db.order.updateMany({ where: { id: orderId, status: { in: ["CREATED", "PENDING"] } }, data: { status: "FAILED" } });
  } else if (type === "REFUND_STATUS_WEBHOOK") {
    // partners.md §7.2: reverse an on-hold commission on refund; after the
    // hold has already released, no clawback (§12.6 open decision, doc default).
    const commissionToReverse = await db.commission.findUnique({ where: { orderId } });
    if (commissionToReverse && commissionToReverse.status === "on_hold") {
      await reverseCommission(commissionToReverse.id, "order_refunded");
    }
    await db.order.updateMany({ where: { id: orderId }, data: { status: "REFUNDED", refundedAt: new Date() } });
    await db.entitlement.updateMany({ where: { orderId }, data: { status: "REFUNDED" } });
  }
}
