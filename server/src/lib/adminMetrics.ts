/**
 * superadmin.md §8 — each metric lives here exactly once. Every admin route
 * that shows a number (Home, section overviews) calls into this module
 * instead of recomputing it, so the same range always shows the same value
 * on every screen.
 *
 * All functions exclude is_test rows unless includeTest is true.
 */
import { db } from "./db.js";
import type { DateRange } from "./adminTime.js";

function userWhere(includeTest: boolean) {
  return includeTest ? {} : { isTest: false };
}
function partnerWhere(includeTest: boolean) {
  return includeTest ? {} : { isTest: false };
}

export async function signups(range: DateRange, includeTest: boolean): Promise<number> {
  return db.user.count({ where: { ...userWhere(includeTest), createdAt: { gte: range.from, lt: range.to } } });
}

/**
 * superadmin.md §13 Q1 is unresolved: the doc's hypothetical 6-step funnel
 * (workspace_created / whatsapp_connected / team_invited / onboarding_completed)
 * doesn't match the product's real OnboardingStep enum. Closest real analog to
 * "onboarding completed" is SETUP_SUBMITTED — the user has done everything we
 * need from them (paid + filled the setup form) before provisioning. Revisit
 * once question 1 is answered.
 */
const ONBOARDING_COMPLETE_STEPS = ["SETUP_SUBMITTED", "PROVISIONED", "ACTIVE"] as const;

export async function onboardingCompletionRate(range: DateRange, includeTest: boolean): Promise<number> {
  const cohort = await db.user.findMany({
    where: { ...userWhere(includeTest), createdAt: { gte: range.from, lt: range.to } },
    select: { onboardingStep: true },
  });
  if (cohort.length === 0) return 0;
  const done = cohort.filter((u) => (ONBOARDING_COMPLETE_STEPS as readonly string[]).includes(u.onboardingStep)).length;
  return (done / cohort.length) * 100;
}

async function firstPaidOrderByUser(includeTest: boolean): Promise<Map<string, Date>> {
  const paid = await db.order.findMany({
    where: { status: "PAID", paidAt: { not: null }, ...(includeTest ? {} : { user: { isTest: false } }) },
    select: { userId: true, paidAt: true },
    orderBy: { paidAt: "asc" },
  });
  const map = new Map<string, Date>();
  for (const o of paid) {
    if (!map.has(o.userId)) map.set(o.userId, o.paidAt!);
  }
  return map;
}

export async function newPayingCustomers(range: DateRange, includeTest: boolean): Promise<number> {
  const firstPaid = await firstPaidOrderByUser(includeTest);
  let count = 0;
  for (const at of firstPaid.values()) if (at >= range.from && at < range.to) count++;
  return count;
}

export async function signupToPaidRate(range: DateRange, includeTest: boolean): Promise<number> {
  const cohort = await db.user.findMany({
    where: { ...userWhere(includeTest), createdAt: { gte: range.from, lt: range.to } },
    select: { id: true, createdAt: true },
  });
  if (cohort.length === 0) return 0;
  const firstPaid = await firstPaidOrderByUser(includeTest);
  let converted = 0;
  for (const u of cohort) {
    const paidAt = firstPaid.get(u.id);
    if (paidAt && paidAt.getTime() - u.createdAt.getTime() <= 30 * 86_400_000) converted++;
  }
  return (converted / cohort.length) * 100;
}

// Revenue excludes GST (§8) — Order.subtotalPaise, not totalPaise.
export async function grossRevenue(range: DateRange, includeTest: boolean): Promise<number> {
  const agg = await db.order.aggregate({
    where: { status: { in: ["PAID", "REFUNDED"] }, paidAt: { gte: range.from, lt: range.to }, ...(includeTest ? {} : { user: { isTest: false } }) },
    _sum: { subtotalPaise: true },
  });
  return Number(agg._sum.subtotalPaise ?? 0n);
}

export async function refunds(range: DateRange, includeTest: boolean): Promise<number> {
  const agg = await db.order.aggregate({
    where: { status: "REFUNDED", refundedAt: { gte: range.from, lt: range.to }, ...(includeTest ? {} : { user: { isTest: false } }) },
    _sum: { subtotalPaise: true },
  });
  return Number(agg._sum.subtotalPaise ?? 0n);
}

export async function netRevenue(range: DateRange, includeTest: boolean): Promise<number> {
  const [gross, refunded] = await Promise.all([grossRevenue(range, includeTest), refunds(range, includeTest)]);
  return gross - refunded;
}

export async function averageOrderValue(range: DateRange, includeTest: boolean): Promise<number> {
  const where = { status: "PAID" as const, paidAt: { gte: range.from, lt: range.to }, ...(includeTest ? {} : { user: { isTest: false } }) };
  const [agg, count] = await Promise.all([
    db.order.aggregate({ where, _sum: { subtotalPaise: true } }),
    db.order.count({ where }),
  ]);
  if (count === 0) return 0;
  return Number(agg._sum.subtotalPaise ?? 0n) / count;
}

export async function checkoutConversionRate(range: DateRange, includeTest: boolean): Promise<number> {
  const where = includeTest ? {} : { user: { isTest: false } };
  const [started, completed] = await Promise.all([
    db.order.count({ where: { ...where, createdAt: { gte: range.from, lt: range.to } } }),
    db.order.count({ where: { ...where, status: "PAID", createdAt: { gte: range.from, lt: range.to } } }),
  ]);
  if (started === 0) return 0;
  return (completed / started) * 100;
}

// Payment rows are only ever created on a SUCCESSFUL capture (see
// routes/checkout.ts's webhook handler) — failed/dropped attempts just flip
// the Order to FAILED with no Payment row. So "attempts" has to be read off
// Order, not Payment, or this would always read 0%.
export async function paymentFailureRate(range: DateRange, includeTest: boolean): Promise<number> {
  const where = includeTest ? {} : { user: { isTest: false } };
  const [resolved, failed] = await Promise.all([
    db.order.count({ where: { ...where, status: { in: ["PAID", "FAILED"] }, createdAt: { gte: range.from, lt: range.to } } }),
    db.order.count({ where: { ...where, status: "FAILED", createdAt: { gte: range.from, lt: range.to } } }),
  ]);
  if (resolved === 0) return 0;
  return (failed / resolved) * 100;
}

export async function referredNetRevenue(range: DateRange, includeTest: boolean): Promise<number> {
  const referredUserIds = (
    await db.referral.findMany({ where: { status: "converted" }, select: { accountId: true } })
  ).map((r) => r.accountId);
  if (referredUserIds.length === 0) return 0;
  const agg = await db.order.aggregate({
    where: {
      status: { in: ["PAID", "REFUNDED"] },
      paidAt: { gte: range.from, lt: range.to },
      userId: { in: referredUserIds },
      ...(includeTest ? {} : { user: { isTest: false } }),
    },
    _sum: { subtotalPaise: true },
  });
  const refundedAgg = await db.order.aggregate({
    where: { status: "REFUNDED", refundedAt: { gte: range.from, lt: range.to }, userId: { in: referredUserIds }, ...(includeTest ? {} : { user: { isTest: false } }) },
    _sum: { subtotalPaise: true },
  });
  return Number(agg._sum.subtotalPaise ?? 0n) - Number(refundedAgg._sum.subtotalPaise ?? 0n);
}

export async function activePartners(range: DateRange, includeTest: boolean): Promise<number> {
  const rows = await db.referralEvent.findMany({
    where: {
      type: { in: ["link_opened", "code_applied"] },
      createdAt: { gte: range.from, lt: range.to },
      ...(includeTest ? {} : { partner: { isTest: false } }),
    },
    select: { partnerId: true },
    distinct: ["partnerId"],
  });
  return rows.length;
}

export async function newPartners(range: DateRange, includeTest: boolean): Promise<number> {
  return db.partner.count({ where: { ...partnerWhere(includeTest), createdAt: { gte: range.from, lt: range.to } } });
}

export async function referredSignups(range: DateRange, includeTest: boolean): Promise<number> {
  return db.referral.count({ where: { attributedAt: { gte: range.from, lt: range.to }, ...(includeTest ? {} : { account: { isTest: false } }) } });
}

export async function referredPayingCustomers(range: DateRange, includeTest: boolean): Promise<number> {
  return db.referral.count({ where: { status: "converted", attributedAt: { gte: range.from, lt: range.to }, ...(includeTest ? {} : { account: { isTest: false } }) } });
}

export async function commissionEarned(range: DateRange, includeTest: boolean): Promise<number> {
  const where = includeTest ? {} : { partner: { isTest: false } };
  const [c, b] = await Promise.all([
    db.commission.aggregate({ where: { ...where, status: { not: "reversed" }, paidAt: { gte: range.from, lt: range.to } }, _sum: { amount: true } }),
    db.bonus.aggregate({ where: { ...where, status: { not: "reversed" }, earnedAt: { gte: range.from, lt: range.to } }, _sum: { amount: true } }),
  ]);
  return Number(c._sum.amount ?? 0n) + Number(b._sum.amount ?? 0n);
}

/** Money Dorway currently owes partners — a point-in-time snapshot at `range.to`, not a period sum. */
export async function liability(asOf: Date, includeTest: boolean): Promise<number> {
  const where = includeTest ? {} : { partner: { isTest: false } };
  const [c, b] = await Promise.all([
    db.commission.aggregate({ where: { ...where, status: { in: ["on_hold", "approved"] }, paidAt: { lte: asOf } }, _sum: { amount: true } }),
    db.bonus.aggregate({ where: { ...where, status: { in: ["on_hold", "approved"] }, earnedAt: { lte: asOf } }, _sum: { amount: true } }),
  ]);
  return Number(c._sum.amount ?? 0n) + Number(b._sum.amount ?? 0n);
}

export async function paidOut(range: DateRange, includeTest: boolean): Promise<number> {
  const agg = await db.partnerPayout.aggregate({
    where: { status: "paid", paidAt: { gte: range.from, lt: range.to }, ...(includeTest ? {} : { partner: { isTest: false } }) },
    _sum: { amount: true },
  });
  return Number(agg._sum.amount ?? 0n);
}

export async function effectivePayoutRate(range: DateRange, includeTest: boolean): Promise<number> {
  const [earned, referred] = await Promise.all([commissionEarned(range, includeTest), referredNetRevenue(range, includeTest)]);
  if (referred === 0) return 0;
  return (earned / referred) * 100;
}
