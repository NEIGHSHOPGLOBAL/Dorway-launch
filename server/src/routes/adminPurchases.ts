import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db.js";
import { config } from "../lib/config.js";
import { requireSuperAdmin } from "../lib/adminSession.js";
import { writeAudit } from "../lib/adminAudit.js";
import { maskBusinessName } from "../lib/adminMask.js";
import { parseRange, istDateKey } from "../lib/adminTime.js";
import * as metrics from "../lib/adminMetrics.js";
import { cfGetOrder, cfGetOrderPayments } from "../lib/cashfree.js";
import { processWebhookEvent } from "./checkout.js";

export const adminPurchasesRouter = Router();
adminPurchasesRouter.use(requireSuperAdmin);

function includeTestFlag(q: Record<string, unknown>): boolean {
  return q.includeTest === "true" || q.includeTest === "1";
}

/** superadmin.md §6.2 "furthest step" — derived, no new column needed. */
function furthestStep(order: { status: string; cfPaymentSessionId: string | null }): string {
  if (order.status === "PAID" || order.status === "REFUNDED") return "completed";
  if (order.status === "FAILED") return "payment_failed";
  return order.cfPaymentSessionId ? "payment_page" : "plan_selected";
}

function uiStatus(status: string): string {
  if (status === "CREATED" || status === "PENDING") return "started";
  if (status === "EXPIRED") return "abandoned";
  if (status === "PAID") return "completed";
  if (status === "FAILED") return "failed";
  if (status === "REFUNDED") return "refunded";
  return status.toLowerCase();
}

function extractFailureReason(raw: unknown): string {
  const r = raw as Record<string, any> | null;
  return (
    r?.data?.error_details?.error_reason ??
    r?.data?.payment?.payment_message ??
    r?.data?.payment?.error_details?.error_reason ??
    "Unknown"
  );
}

/* ============================================================
   Overview
   ============================================================ */

adminPurchasesRouter.get("/metrics/purchases", async (req, res) => {
  const range = parseRange(req.query as Record<string, unknown>);
  const includeTest = includeTestFlag(req.query as Record<string, unknown>);

  const [gross, refundsAmt, net, newPaying, checkoutConv, aov, failureRate] = await Promise.all([
    metrics.grossRevenue(range, includeTest),
    metrics.refunds(range, includeTest),
    metrics.netRevenue(range, includeTest),
    metrics.newPayingCustomers(range, includeTest),
    metrics.checkoutConversionRate(range, includeTest),
    metrics.averageOrderValue(range, includeTest),
    metrics.paymentFailureRate(range, includeTest),
  ]);

  const paidOrders = await db.order.findMany({
    where: { status: "PAID", paidAt: { gte: range.from, lt: range.to }, ...(includeTest ? {} : { user: { isTest: false } }) },
    select: { plan: { select: { name: true } }, termMonths: true, subtotalPaise: true, paidAt: true },
  });

  const byDay = new Map<string, number>();
  for (const o of paidOrders) {
    const key = istDateKey(o.paidAt!);
    byDay.set(key, (byDay.get(key) ?? 0) + Number(o.subtotalPaise));
  }
  const netRevenuePerDay = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, amount]) => ({ date, amount }));

  const byPlanBilling = new Map<string, { monthly: number; annual: number }>();
  for (const o of paidOrders) {
    const bucket = byPlanBilling.get(o.plan.name) ?? { monthly: 0, annual: 0 };
    if (o.termMonths === 1) bucket.monthly += Number(o.subtotalPaise);
    else bucket.annual += Number(o.subtotalPaise);
    byPlanBilling.set(o.plan.name, bucket);
  }
  const revenueByPlanBilling = [...byPlanBilling.entries()].map(([plan, b]) => ({ plan, monthly: b.monthly, annual: b.annual, total: b.monthly + b.annual }));

  const ordersByPlan = new Map<string, number>();
  for (const o of paidOrders) ordersByPlan.set(o.plan.name, (ordersByPlan.get(o.plan.name) ?? 0) + 1);

  const failedEvents = await db.webhookEvent.findMany({
    where: { eventType: "PAYMENT_FAILED_WEBHOOK", receivedAt: { gte: range.from, lt: range.to } },
    select: { raw: true },
    take: 500,
  });
  const reasonCounts = new Map<string, number>();
  for (const e of failedEvents) {
    const reason = extractFailureReason(e.raw);
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }
  const topFailureReasons = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([reason, count]) => ({ reason, count }));

  res.json({
    kpis: { grossRevenue: gross, refunds: refundsAmt, netRevenue: net, newPayingCustomers: newPaying, checkoutConversionRate: checkoutConv, averageOrderValue: aov, paymentFailureRate: failureRate },
    charts: { netRevenuePerDay, ordersByPlan: [...ordersByPlan.entries()].map(([plan, count]) => ({ plan, count })), topFailureReasons },
    revenueByPlanBilling,
  });
});

/* ============================================================
   Checkouts
   ============================================================ */

adminPurchasesRouter.get("/checkouts", async (req, res) => {
  const q = req.query as Record<string, unknown>;
  const includeTest = includeTestFlag(q);
  const cursor = typeof q.cursor === "string" ? q.cursor : undefined;
  const status = typeof q.status === "string" ? q.status : undefined;
  const plan = typeof q.plan === "string" ? q.plan : undefined;
  const hasPartner = q.hasPartner === "true" ? true : q.hasPartner === "false" ? false : undefined;

  const where: Record<string, unknown> = { ...(includeTest ? {} : { user: { isTest: false } }) };
  if (plan) where.planCode = plan;
  if (hasPartner === true) where.referralId = { not: null };
  if (hasPartner === false) where.referralId = null;
  if (status === "started") where.status = { in: ["CREATED", "PENDING"] };
  else if (status === "abandoned") where.status = "EXPIRED";
  else if (status === "completed") where.status = "PAID";
  else if (status === "failed") where.status = "FAILED";
  else if (status === "refunded") where.status = "REFUNDED";
  if (q.from || q.to) {
    const range = parseRange(q);
    where.createdAt = { gte: range.from, lt: range.to };
  }

  const orders = await db.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { user: true, plan: true, referral: { include: { partner: { select: { code: true } } } } },
  });
  const nextCursor = orders.length === 51 ? orders[50].id : null;
  const page = orders.slice(0, 50);

  res.json({
    items: page.map((o) => ({
      id: o.id,
      business: maskBusinessName(o.user.businessName ?? o.user.fullName),
      plan: o.plan.name,
      billing: o.termMonths === 1 ? "monthly" : "annual",
      subtotalPaise: Number(o.subtotalPaise),
      gstPaise: Number(o.cgstPaise) + Number(o.sgstPaise) + Number(o.igstPaise),
      totalPaise: Number(o.totalPaise),
      status: uiStatus(o.status),
      furthestStep: furthestStep(o),
      partnerCode: o.referral?.partner?.code ?? null,
      startedAt: o.createdAt,
      completedAt: o.paidAt,
    })),
    nextCursor,
  });
});

/* ============================================================
   Payments
   ============================================================ */

adminPurchasesRouter.get("/payments", async (req, res) => {
  const q = req.query as Record<string, unknown>;
  const includeTest = includeTestFlag(q);
  const cursor = typeof q.cursor === "string" ? q.cursor : undefined;
  const method = typeof q.method === "string" ? q.method : undefined;

  const where: Record<string, unknown> = { ...(includeTest ? {} : { order: { user: { isTest: false } } }) };
  if (method) where.method = method;
  if (q.from || q.to) {
    const range = parseRange(q);
    where.createdAt = { gte: range.from, lt: range.to };
  }

  const payments = await db.payment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { order: true },
  });
  const nextCursor = payments.length === 51 ? payments[50].id : null;
  const page = payments.slice(0, 50);

  res.json({
    items: page.map((p) => ({
      id: p.id,
      gatewayPaymentId: p.cfPaymentId,
      checkoutId: p.orderId,
      method: p.method,
      amountPaise: Number(p.amountPaise),
      status: p.status,
      webhookReceivedAt: p.createdAt,
    })),
    nextCursor,
  });
});

/* ============================================================
   Reconciliation
   ============================================================ */

adminPurchasesRouter.get("/reconciliation", async (req, res) => {
  const dateStr = typeof req.query.date === "string" ? req.query.date : istDateKey(new Date());
  const run = await db.reconciliationRun.findFirst({ where: { runDate: new Date(`${dateStr}T00:00:00.000Z`) } });
  if (run) {
    return res.json({ runDate: dateStr, matchedCount: run.matchedCount, matchedAmount: Number(run.matchedAmount), issues: run.issues });
  }
  res.json({ runDate: dateStr, matchedCount: null, matchedAmount: null, issues: null, notRunYet: true });
});

const resyncSchema = z.object({ reason: z.string().min(1) });

adminPurchasesRouter.post("/payments/:id/resync", async (req, res) => {
  const parsed = resyncSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: { code: "VALIDATION_FAILED", message: "Reason is required." } });

  // :id is the checkout/order id — this app's Payment rows exist only after
  // a successful capture, so "resync a payment" means "re-check this order".
  const order = await db.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Checkout not found." } });
  if (!config.cashfree.isConfigured) {
    return res.status(503).json({ error: { code: "GATEWAY_NOT_CONFIGURED", message: "Cashfree isn't configured in this environment." } });
  }

  try {
    const cfOrder = await cfGetOrder(order.cfOrderId ?? order.id);
    if (cfOrder.order_status !== "PAID") {
      await writeAudit(req, { action: "payment_resync", entityType: "order", entityId: order.id, reason: parsed.data.reason, after: { cfStatus: cfOrder.order_status, changed: false } });
      return res.json({ ok: true, changed: false, cfStatus: cfOrder.order_status });
    }
    if (order.status === "PAID") {
      await writeAudit(req, { action: "payment_resync", entityType: "order", entityId: order.id, reason: parsed.data.reason, after: { cfStatus: cfOrder.order_status, changed: false, alreadyPaid: true } });
      return res.json({ ok: true, changed: false, alreadyPaid: true });
    }

    const attempts = await cfGetOrderPayments(order.cfOrderId ?? order.id);
    const success = attempts.find((a) => a.payment_status === "SUCCESS");
    if (!success) {
      return res.status(409).json({ error: { code: "NO_SUCCESSFUL_PAYMENT", message: "Cashfree shows the order as paid but no successful payment attempt was found." } });
    }

    // Replays the same handler a live webhook would hit — idempotent by
    // construction (it no-ops once order.status is already PAID).
    await processWebhookEvent({
      type: "PAYMENT_SUCCESS_WEBHOOK",
      data: { order: { order_id: order.id }, payment: { cf_payment_id: success.cf_payment_id, payment_status: "SUCCESS", payment_amount: success.payment_amount, payment_method: success.payment_method } },
    });

    await writeAudit(req, { action: "payment_resync", entityType: "order", entityId: order.id, reason: parsed.data.reason, before: { status: "unresolved" }, after: { status: "PAID", changed: true } });
    res.json({ ok: true, changed: true });
  } catch (err) {
    console.error("Payment resync failed:", err);
    res.status(502).json({ error: { code: "GATEWAY_ERROR", message: "Couldn't reach Cashfree. Try again shortly." } });
  }
});
