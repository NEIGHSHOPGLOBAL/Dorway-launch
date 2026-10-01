import { db } from "./db.js";
import { config } from "./config.js";
import { cfGetOrder } from "./cashfree.js";
import { istDateKey } from "./adminTime.js";
import { notifyAdmins } from "./adminAlerts.js";
import { maskAccountNumber } from "./adminMask.js";

/** superadmin.md §6.4 / §12 "reconcile_payments" — daily, 06:00 IST. */
export async function reconcilePayments() {
  const runDate = new Date(`${istDateKey(new Date())}T00:00:00.000Z`);

  // "In Dorway, missing in gateway": a completed checkout with no captured
  // payment row. Should be structurally impossible (both are written in the
  // same webhook transaction) — any row here is critical.
  const paidWithoutPayment = await db.order.findMany({
    where: { status: "PAID", payments: { none: {} } },
    select: { id: true, totalPaise: true },
  });

  // "In gateway, missing in Dorway": an order still stuck started/pending
  // for over an hour whose Cashfree order actually succeeded — a lost
  // webhook. Only checkable while Cashfree credentials are configured.
  const missingInDorway: { orderId: string; totalPaise: number }[] = [];
  if (config.cashfree.isConfigured) {
    const staleOrders = await db.order.findMany({
      where: { status: { in: ["CREATED", "PENDING"] }, createdAt: { lte: new Date(Date.now() - 60 * 60_000) }, cfOrderId: { not: null } },
      select: { id: true, cfOrderId: true, totalPaise: true },
    });
    for (const o of staleOrders) {
      try {
        const cfOrder = await cfGetOrder(o.cfOrderId!);
        if (cfOrder.order_status === "PAID") missingInDorway.push({ orderId: o.id, totalPaise: Number(o.totalPaise) });
      } catch (err) {
        console.error(`reconcile: couldn't check order ${o.id}:`, err);
      }
    }
  }

  const [matchedCount, matchedAmountAgg] = await Promise.all([
    db.order.count({ where: { status: "PAID", payments: { some: {} } } }),
    db.order.aggregate({ where: { status: "PAID", payments: { some: {} } }, _sum: { totalPaise: true } }),
  ]);

  const issues = { missingInGateway: paidWithoutPayment.map((o) => ({ orderId: o.id, totalPaise: Number(o.totalPaise) })), missingInDorway };

  await db.reconciliationRun.upsert({
    where: { runDate },
    update: { matchedCount, matchedAmount: matchedAmountAgg._sum.totalPaise ?? 0n, issues },
    create: { runDate, matchedCount, matchedAmount: matchedAmountAgg._sum.totalPaise ?? 0n, issues },
  });

  if (paidWithoutPayment.length > 0 || missingInDorway.length > 0) {
    notifyAdmins("reconciliation_critical", `${paidWithoutPayment.length} paid order(s) missing a payment record; ${missingInDorway.length} order(s) paid at the gateway but not reflected locally.`);
  }

  return { matchedCount, missingInGateway: paidWithoutPayment.length, missingInDorway: missingInDorway.length };
}

async function ensureFlag(partnerId: string, rule: string, evidence: unknown) {
  const existing = await db.fraudFlag.findFirst({ where: { partnerId, rule, status: "open" } });
  if (existing) return; // superadmin.md §12 "never duplicates an open flag for the same rule and partner"
  await db.fraudFlag.create({ data: { partnerId, rule, evidence: evidence as never, status: "open" } });
  const partner = await db.partner.findUnique({ where: { id: partnerId } });
  if (partner) notifyAdmins("fraud_flag", `${rule} on partner ${partner.code}`);
}

/** superadmin.md §7.7 — six rules, evaluated hourly, flags reviewed by hand. */
export async function fraudRules() {
  const since24h = new Date(Date.now() - 24 * 3_600_000);
  const since30d = new Date(Date.now() - 30 * 86_400_000);

  // 1. Self-referral match — safety net; attributeReferral() already rejects
  // these at write time, so this should normally find nothing.
  const activeReferrals = await db.referral.findMany({ where: { status: { not: "rejected" } }, include: { partner: true, account: true } });
  for (const r of activeReferrals) {
    const selfMatch =
      (r.account.phone && r.account.phone === r.partner.phone) || (r.account.email && r.account.email.toLowerCase() === r.partner.email.toLowerCase());
    if (selfMatch) await ensureFlag(r.partnerId, "self_referral_match", { referralId: r.id, accountId: r.accountId });
  }

  // 2. Signup burst — more than 5 referred signups from one IP in 24h.
  const recentReferrals = await db.referral.findMany({ where: { attributedAt: { gte: since24h } }, include: { account: { select: { signupIp: true } } } });
  const byPartnerIp = new Map<string, number>();
  for (const r of recentReferrals) {
    if (!r.account.signupIp) continue;
    const key = `${r.partnerId}:${r.account.signupIp}`;
    byPartnerIp.set(key, (byPartnerIp.get(key) ?? 0) + 1);
  }
  for (const [key, count] of byPartnerIp) {
    if (count > 5) {
      const [partnerId, ip] = key.split(":");
      await ensureFlag(partnerId, "signup_burst", { ip, count });
    }
  }

  // 3. Fast conversion cluster — more than 3 referred checkouts completed
  // under 10 minutes after signup, in 24h.
  const convertedOrders = await db.order.findMany({
    where: { status: "PAID", paidAt: { gte: since24h }, referralId: { not: null } },
    include: { referral: true, user: { select: { createdAt: true } } },
  });
  const byPartnerFast = new Map<string, number>();
  for (const o of convertedOrders) {
    if (!o.referral || !o.paidAt) continue;
    const minutes = (o.paidAt.getTime() - o.user.createdAt.getTime()) / 60_000;
    if (minutes < 10) byPartnerFast.set(o.referral.partnerId, (byPartnerFast.get(o.referral.partnerId) ?? 0) + 1);
  }
  for (const [partnerId, count] of byPartnerFast) {
    if (count > 3) await ensureFlag(partnerId, "fast_conversion_cluster", { count });
  }

  // 4. Refund cluster — more than 30% of a partner's referred checkouts
  // refunded in 30 days.
  const partners = await db.partner.findMany({ select: { id: true } });
  for (const p of partners) {
    const referredUserIds = (await db.referral.findMany({ where: { partnerId: p.id }, select: { accountId: true } })).map((r) => r.accountId);
    if (referredUserIds.length === 0) continue;
    const [total, refunded] = await Promise.all([
      db.order.count({ where: { userId: { in: referredUserIds }, status: { in: ["PAID", "REFUNDED"] }, paidAt: { gte: since30d } } }),
      db.order.count({ where: { userId: { in: referredUserIds }, status: "REFUNDED", refundedAt: { gte: since30d } } }),
    ]);
    if (total >= 3 && refunded / total > 0.3) await ensureFlag(p.id, "refund_cluster", { total, refunded });
  }

  // 5. Bonus edge — hit exactly 10 in 7 days with more than half later refunded.
  const bonuses = await db.bonus.findMany({ where: { earnedAt: { gte: since30d } }, include: { commissions: true } });
  for (const b of bonuses) {
    if (b.commissions.length !== 10) continue;
    const reversedCount = b.commissions.filter((c) => c.status === "reversed").length;
    if (reversedCount / 10 > 0.5) await ensureFlag(b.partnerId, "bonus_edge", { bonusId: b.id, reversedCount });
  }

  // 6. Shared payout method — same UPI ID or bank account on more than one partner.
  const methods = await db.partnerPayoutMethod.findMany();
  const byUpi = new Map<string, string[]>();
  const byAccount = new Map<string, string[]>();
  for (const m of methods) {
    if (m.upiId) byUpi.set(m.upiId, [...(byUpi.get(m.upiId) ?? []), m.partnerId]);
    if (m.accountNumber) byAccount.set(m.accountNumber, [...(byAccount.get(m.accountNumber) ?? []), m.partnerId]);
  }
  for (const [upiId, partnerIds] of byUpi) {
    if (partnerIds.length > 1) for (const pid of partnerIds) await ensureFlag(pid, "shared_payout_method", { upiId, partnerIds });
  }
  for (const [accountNumber, partnerIds] of byAccount) {
    if (partnerIds.length > 1) for (const pid of partnerIds) await ensureFlag(pid, "shared_payout_method", { accountNumberMasked: maskAccountNumber(accountNumber), partnerIds });
  }
}

function msUntilNextIst(hour: number): number {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const next = new Date(ist);
  next.setUTCHours(hour, 0, 0, 0);
  if (next <= ist) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - ist.getTime();
}

export function startAdminJobs() {
  const scheduleDaily = () => {
    setTimeout(() => {
      reconcilePayments().catch((err) => console.error("reconcilePayments job failed:", err));
      setInterval(() => reconcilePayments().catch((err) => console.error("reconcilePayments job failed:", err)), 24 * 60 * 60_000).unref();
    }, msUntilNextIst(6)).unref();
  };
  scheduleDaily();

  setInterval(() => fraudRules().catch((err) => console.error("fraudRules job failed:", err)), 60 * 60_000).unref();
}
