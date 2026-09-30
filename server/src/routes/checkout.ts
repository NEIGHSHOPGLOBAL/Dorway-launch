import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { db } from "../lib/db.js";
import { config } from "../lib/config.js";
import { readSession } from "../lib/session.js";
import { isEarlyBirdOpen, addMonths, effectiveRatePaise } from "../lib/pricing.js";
import { cfCreateOrder, cfGetOrder } from "../lib/cashfree.js";
import { rateLimit } from "../lib/rateLimit.js";
import { sendReceiptEmail } from "../lib/email.js";
import { computeGst, GSTIN_RE, stateFromGstin } from "../lib/gst.js";

export const checkoutRouter = Router();

const checkoutSchema = z.object({
  planCode: z.string().min(1),
  termMonths: z.union([z.literal(1), z.literal(6), z.literal(12)]),
  stateCode: z.string().length(2),
  gstin: z.string().regex(GSTIN_RE).optional().or(z.literal("")),
});

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

  const sold = await db.order.count({ where: { isEarlyBird: true, status: "PAID" } });
  const early = isEarlyBirdOpen(new Date(), cfg, sold);

  const ratePaise = effectiveRatePaise(plan, parsed.data.termMonths, early);
  const subtotal = ratePaise * BigInt(parsed.data.termMonths);
  const isEarlyBirdRate = ratePaise === plan.earlyPaiseMonth;

  // onboarding.md §7.2: a valid GSTIN's state prefix wins over a
  // manually-picked billing state, quietly — never a hard error.
  const stateCode =
    parsed.data.gstin && GSTIN_RE.test(parsed.data.gstin) ? stateFromGstin(parsed.data.gstin) : parsed.data.stateCode;

  const gstBreakdown = computeGst(subtotal, stateCode, config.supplierStateCode);

  const order = await db.order.create({
    data: {
      userId: user.id,
      planCode: plan.code,
      termMonths: parsed.data.termMonths,
      isEarlyBird: isEarlyBirdRate,
      ratePaiseMonth: ratePaise,
      subtotalPaise: subtotal,
      cgstPaise: gstBreakdown.cgstPaise,
      sgstPaise: gstBreakdown.sgstPaise,
      igstPaise: gstBreakdown.igstPaise,
      placeOfSupply: gstBreakdown.placeOfSupply,
      totalPaise: gstBreakdown.totalPaise,
      idempotencyKey: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 30 * 60_000),
    },
  });

  if (parsed.data.gstin || stateCode !== user.billingStateCode) {
    await db.user.update({
      where: { id: user.id },
      data: {
        gstin: parsed.data.gstin || user.gstin,
        billingStateCode: stateCode,
        onboardingStep: user.onboardingStep === "IDENTIFIED" || user.onboardingStep === "PROFILED" ? "PLAN_SELECTED" : undefined,
      },
    });
  }

  try {
    const cf = await cfCreateOrder({
      orderId: order.id,
      orderAmountRupees: Number(gstBreakdown.totalPaise) / 100,
      idempotencyKey: order.idempotencyKey,
      customer: {
        id: user.id,
        email: user.email ?? "",
        phone: user.phone ?? "",
        name: user.fullName ?? user.email ?? "Customer",
      },
      returnUrl: `${config.appUrl}/checkout/return?order_id={order_id}`,
      notifyUrl: `${config.apiPublicUrl}/api/webhooks/cashfree`,
      expiresAt: order.expiresAt.toISOString(),
      note: `${plan.name} · ${parsed.data.termMonths} months`,
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

  const [plan, cfg] = await Promise.all([
    db.plan.findUnique({ where: { code: parsed.data.planCode } }),
    db.launchConfig.findUnique({ where: { id: 1 } }),
  ]);
  if (!plan?.isActive || !cfg) {
    res.status(400).json({ error: "checkout_unavailable" });
    return;
  }

  const sold = await db.order.count({ where: { isEarlyBird: true, status: "PAID" } });
  const early = isEarlyBirdOpen(new Date(), cfg, sold);
  const ratePaise = effectiveRatePaise(plan, parsed.data.termMonths, early);
  const subtotal = ratePaise * BigInt(parsed.data.termMonths);

  const stateCode =
    parsed.data.gstin && GSTIN_RE.test(parsed.data.gstin) ? stateFromGstin(parsed.data.gstin) : parsed.data.stateCode;
  const g = computeGst(subtotal, stateCode, config.supplierStateCode);

  res.json({
    isEarlyBird: ratePaise === plan.earlyPaiseMonth,
    ratePaiseMonth: Number(ratePaise),
    subtotalPaise: Number(g.netPaise),
    cgstPaise: Number(g.cgstPaise),
    sgstPaise: Number(g.sgstPaise),
    igstPaise: Number(g.igstPaise),
    totalPaise: Number(g.totalPaise),
    placeOfSupply: g.placeOfSupply,
    resolvedFromGstin: Boolean(parsed.data.gstin && GSTIN_RE.test(parsed.data.gstin)),
  });
});

export const ordersRouter = Router();

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
    subtotalPaise: Number(order.subtotalPaise),
    cgstPaise: Number(order.cgstPaise),
    sgstPaise: Number(order.sgstPaise),
    igstPaise: Number(order.igstPaise),
    totalPaise: Number(order.totalPaise),
    isEarlyBird: order.isEarlyBird,
  });
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

async function processWebhookEvent(evt: any) {
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

      await tx.order.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date() } });
      await tx.user.update({ where: { id: order.userId }, data: { onboardingStep: "PAID" } });

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
        },
      });
    });

    const order = await db.order.findUnique({ where: { id: orderId }, include: { user: true, plan: true } });
    if (order?.user.email) {
      await sendReceiptEmail(
        order.user.email,
        `${order.plan.name} · ${order.termMonths} months · ₹${(Number(order.totalPaise) / 100).toFixed(2)} paid.`,
      );
    }
  } else if (type === "PAYMENT_FAILED_WEBHOOK") {
    await db.order.updateMany({ where: { id: orderId, status: { in: ["CREATED", "PENDING"] } }, data: { status: "FAILED" } });
  } else if (type === "PAYMENT_USER_DROPPED_WEBHOOK") {
    await db.order.updateMany({ where: { id: orderId, status: { in: ["CREATED", "PENDING"] } }, data: { status: "FAILED" } });
  } else if (type === "REFUND_STATUS_WEBHOOK") {
    await db.order.updateMany({ where: { id: orderId }, data: { status: "REFUNDED" } });
    await db.entitlement.updateMany({ where: { orderId }, data: { status: "REFUNDED" } });
  }
}
