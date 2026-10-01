import { Router } from "express";
import { db } from "../lib/db.js";
import { requireSuperAdmin } from "../lib/adminSession.js";
import { parseRange, comparePeriod, pctChange, istDateKey } from "../lib/adminTime.js";
import * as metrics from "../lib/adminMetrics.js";

export const adminHomeRouter = Router();
adminHomeRouter.use(requireSuperAdmin);

function includeTestFlag(q: Record<string, unknown>): boolean {
  return q.includeTest === "true" || q.includeTest === "1";
}

function tile(current: number, previous: number) {
  return { value: current, previousValue: previous, pctChange: pctChange(current, previous) };
}

adminHomeRouter.get("/metrics/home", async (req, res) => {
  const q = req.query as Record<string, unknown>;
  const range = parseRange(q);
  const includeTest = includeTestFlag(q);
  const compareTo = q.compare === "none" ? null : comparePeriod(range);

  const [signups, onboardingRate, newPaying, netRevenue, signupToPaid, referredRevenue, totalNet] = await Promise.all([
    metrics.signups(range, includeTest),
    metrics.onboardingCompletionRate(range, includeTest),
    metrics.newPayingCustomers(range, includeTest),
    metrics.netRevenue(range, includeTest),
    metrics.signupToPaidRate(range, includeTest),
    metrics.referredNetRevenue(range, includeTest),
    metrics.netRevenue(range, includeTest),
  ]);

  let prev = { signups: 0, onboardingRate: 0, newPaying: 0, netRevenue: 0, signupToPaid: 0, referredRevenue: 0 };
  if (compareTo) {
    const [s, o, n, r, sp, rr] = await Promise.all([
      metrics.signups(compareTo, includeTest),
      metrics.onboardingCompletionRate(compareTo, includeTest),
      metrics.newPayingCustomers(compareTo, includeTest),
      metrics.netRevenue(compareTo, includeTest),
      metrics.signupToPaidRate(compareTo, includeTest),
      metrics.referredNetRevenue(compareTo, includeTest),
    ]);
    prev = { signups: s, onboardingRate: o, newPaying: n, netRevenue: r, signupToPaid: sp, referredRevenue: rr };
  }

  // Daily trend chart: signups, onboarding_completed (SETUP_SUBMITTED+),
  // new paying customers — three lines sharing one time axis.
  const [dailyUsers, dailyOnboardingDone, dailyPaidOrders] = await Promise.all([
    db.user.findMany({ where: { createdAt: { gte: range.from, lt: range.to }, ...(includeTest ? {} : { isTest: false }) }, select: { createdAt: true } }),
    db.onboardingEvent.findMany({ where: { step: "SETUP_SUBMITTED", createdAt: { gte: range.from, lt: range.to } }, select: { createdAt: true } }),
    db.order.findMany({ where: { status: "PAID", paidAt: { gte: range.from, lt: range.to }, ...(includeTest ? {} : { user: { isTest: false } }) }, select: { paidAt: true, userId: true } }),
  ]);
  const dayMap = new Map<string, { signups: number; onboardingCompleted: number; newPaying: number }>();
  const bump = (key: string, field: "signups" | "onboardingCompleted" | "newPaying") => {
    const row = dayMap.get(key) ?? { signups: 0, onboardingCompleted: 0, newPaying: 0 };
    row[field]++;
    dayMap.set(key, row);
  };
  for (const u of dailyUsers) bump(istDateKey(u.createdAt), "signups");
  for (const e of dailyOnboardingDone) bump(istDateKey(e.createdAt), "onboardingCompleted");
  const seenPayingUsers = new Set<string>();
  for (const o of dailyPaidOrders.sort((a, b) => a.paidAt!.getTime() - b.paidAt!.getTime())) {
    if (seenPayingUsers.has(o.userId)) continue;
    seenPayingUsers.add(o.userId);
    bump(istDateKey(o.paidAt!), "newPaying");
  }
  const dailyTrend = [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date, ...v }));

  const revenueByPlan = await db.order.groupBy({
    by: ["planCode"],
    where: { status: "PAID", paidAt: { gte: range.from, lt: range.to }, ...(includeTest ? {} : { user: { isTest: false } }) },
    _sum: { subtotalPaise: true },
  });
  const plans = await db.plan.findMany({ where: { code: { in: revenueByPlan.map((r) => r.planCode) } } });
  const revenueByPlanNamed = revenueByPlan.map((r) => ({ plan: plans.find((p) => p.code === r.planCode)?.name ?? r.planCode, amount: Number(r._sum.subtotalPaise ?? 0n) }));

  // Needs attention
  const [openFlags, webhookFailures, stalePayouts, latestRun, approvalWaiting] = await Promise.all([
    db.fraudFlag.count({ where: { status: "open" } }),
    db.webhookEvent.count({ where: { error: { not: null }, receivedAt: { gte: new Date(Date.now() - 24 * 3_600_000) } } }),
    db.partnerPayout.count({ where: { status: "requested", requestedAt: { lte: new Date(Date.now() - 3 * 86_400_000) } } }),
    db.reconciliationRun.findFirst({ orderBy: { runDate: "desc" } }),
    // userchanges.md AD-3 — pending-review entitlements past the 1-working-day
    // SLA (simplified to a 24h threshold rather than a full business-day calendar).
    db.entitlement.count({ where: { approvalStatus: "PENDING_REVIEW", createdAt: { lte: new Date(Date.now() - 24 * 3_600_000) } } }),
  ]);
  const reconciliationIssues = latestRun?.issues as { missingInGateway?: unknown[]; missingInDorway?: unknown[] } | null;

  res.json({
    kpis: {
      signups: tile(signups, prev.signups),
      onboardingCompletionRate: tile(onboardingRate, prev.onboardingRate),
      newPayingCustomers: tile(newPaying, prev.newPaying),
      netRevenue: tile(netRevenue, prev.netRevenue),
      signupToPaidRate: tile(signupToPaid, prev.signupToPaid),
      referredNetRevenue: { ...tile(referredRevenue, prev.referredRevenue), pctOfTotal: totalNet === 0 ? 0 : (referredRevenue / totalNet) * 100 },
    },
    dailyTrend,
    revenueByPlan: revenueByPlanNamed,
    needsAttention: {
      payoutsOverSla: stalePayouts,
      openFraudFlags: openFlags,
      webhookFailures24h: webhookFailures,
      reconciliationMissingInGateway: reconciliationIssues?.missingInGateway?.length ?? 0,
      reconciliationMissingInDorway: reconciliationIssues?.missingInDorway?.length ?? 0,
      approvalWaiting,
    },
  });
});
