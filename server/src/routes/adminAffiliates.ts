import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db.js";
import { requireSuperAdmin } from "../lib/adminSession.js";
import { writeAudit } from "../lib/adminAudit.js";
import { maskPhone, maskBusinessName, maskPan, maskAccountNumber, maskUpi } from "../lib/adminMask.js";
import { parseRange } from "../lib/adminTime.js";
import * as metrics from "../lib/adminMetrics.js";
import { PARTNER_PROGRAM } from "../lib/partnerProgram.js";
import { evaluateBonus, reverseCommission, reverseBonus } from "../lib/partnerJobs.js";
import { notifyPartner } from "../lib/partnerNotify.js";

export const adminAffiliatesRouter = Router();
adminAffiliatesRouter.use(requireSuperAdmin);

function includeTestFlag(q: Record<string, unknown>): boolean {
  return q.includeTest === "true" || q.includeTest === "1";
}
function sumBigint(rows: { amount: bigint }[]): bigint {
  return rows.reduce((a, r) => a + r.amount, 0n);
}
function serializeMethod(m: { type: string; upiId: string | null; accountNumber: string | null; pan: string; verifiedAt: Date | null } | null) {
  if (!m) return { hasMethod: false as const, verified: false };
  return {
    hasMethod: true as const,
    type: m.type,
    upiId: maskUpi(m.upiId),
    accountNumberMasked: maskAccountNumber(m.accountNumber),
    panMasked: maskPan(m.pan),
    verified: Boolean(m.verifiedAt),
  };
}

/* ============================================================
   Overview
   ============================================================ */

adminAffiliatesRouter.get("/metrics/affiliates", async (req, res) => {
  const q = req.query as Record<string, unknown>;
  const range = parseRange(q);
  const includeTest = includeTestFlag(q);

  const [active, newP, refSignups, refPaying, refRevenue, earned, liab, paid, effRate] = await Promise.all([
    metrics.activePartners(range, includeTest),
    metrics.newPartners(range, includeTest),
    metrics.referredSignups(range, includeTest),
    metrics.referredPayingCustomers(range, includeTest),
    metrics.referredNetRevenue(range, includeTest),
    metrics.commissionEarned(range, includeTest),
    metrics.liability(range.to, includeTest),
    metrics.paidOut(range, includeTest),
    metrics.effectivePayoutRate(range, includeTest),
  ]);
  const totalNet = await metrics.netRevenue(range, includeTest);

  const partners = await db.partner.findMany({
    where: includeTest ? {} : { isTest: false },
    include: { referrals: true, commissions: true, bonuses: true, referralEvents: true },
  });

  const topPartners = partners
    .map((p) => {
      const clicks = p.referralEvents.filter((e) => e.type === "link_opened" && e.createdAt >= range.from && e.createdAt < range.to).length;
      const signups = p.referrals.filter((r) => r.attributedAt >= range.from && r.attributedAt < range.to).length;
      const paidCustomers = p.referrals.filter((r) => r.status === "converted").length;
      const commissionSum = sumBigint(p.commissions.filter((c) => c.status !== "reversed" && c.paidAt >= range.from && c.paidAt < range.to));
      const bonusSum = sumBigint(p.bonuses.filter((b) => b.status !== "reversed" && b.earnedAt >= range.from && b.earnedAt < range.to));
      const liabilitySum =
        sumBigint(p.commissions.filter((c) => ["on_hold", "approved"].includes(c.status))) + sumBigint(p.bonuses.filter((b) => ["on_hold", "approved"].includes(b.status)));
      return {
        id: p.id,
        name: p.name,
        code: p.code,
        clicks,
        signups,
        paidCustomers,
        conversionRate: signups === 0 ? 0 : (paidCustomers / signups) * 100,
        commissionEarned: Number(commissionSum + bonusSum),
        liability: Number(liabilitySum),
      };
    })
    .filter((p) => p.clicks > 0 || p.signups > 0)
    .sort((a, b) => b.commissionEarned - a.commissionEarned)
    .slice(0, 20);

  const funnel = {
    clicks: partners.reduce((a, p) => a + p.referralEvents.filter((e) => e.type === "link_opened" && e.createdAt >= range.from && e.createdAt < range.to).length, 0),
    signups: partners.reduce((a, p) => a + p.referrals.filter((r) => r.attributedAt >= range.from && r.attributedAt < range.to).length, 0),
    checkoutsStarted: partners.reduce((a, p) => a + p.referralEvents.filter((e) => e.type === "checkout_started" && e.createdAt >= range.from && e.createdAt < range.to).length, 0),
    completed: partners.reduce((a, p) => a + p.commissions.filter((c) => c.paidAt >= range.from && c.paidAt < range.to).length, 0),
  };

  const bonusesInRange = partners.flatMap((p) => p.bonuses.filter((b) => b.earnedAt >= range.from && b.earnedAt < range.to));

  const midSprint: { partnerId: string; name: string; code: string; count: number; windowEndsAt: Date }[] = [];
  for (const p of partners) {
    const unconsumed = p.commissions.filter((c) => !c.bonusId && c.status !== "reversed").sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());
    if (unconsumed.length === 0) continue;
    const windowStart = unconsumed[0].paidAt;
    const windowEnd = new Date(windowStart.getTime() + PARTNER_PROGRAM.bonus.withinDays * 86_400_000);
    const count = unconsumed.filter((c) => c.paidAt <= windowEnd).length;
    if (count >= 7 && count < PARTNER_PROGRAM.bonus.every && windowEnd > new Date()) {
      midSprint.push({ partnerId: p.id, name: p.name, code: p.code, count, windowEndsAt: windowEnd });
    }
  }

  const now = Date.now();
  const ageingBuckets = [
    { label: "0-7 days", min: 0, max: 7 },
    { label: "8-14 days", min: 8, max: 14 },
    { label: "15-30 days", min: 15, max: 30 },
    { label: "30+ days", min: 31, max: Infinity },
  ];
  const onHoldItems = partners.flatMap((p) => [
    ...p.commissions.filter((c) => c.status === "on_hold").map((c) => ({ amount: c.amount, holdUntil: c.holdUntil })),
    ...p.bonuses.filter((b) => b.status === "on_hold").map((b) => ({ amount: b.amount, holdUntil: b.holdUntil })),
  ]);
  const liabilityAgeing = ageingBuckets.map((b) => {
    const items = onHoldItems.filter((i) => {
      const daysLeft = (i.holdUntil.getTime() - now) / 86_400_000;
      return daysLeft >= b.min && daysLeft <= b.max;
    });
    return { label: b.label, amount: Number(sumBigint(items)) };
  });

  res.json({
    kpis: {
      activePartners: active,
      newPartners: newP,
      referredSignups: refSignups,
      referredPayingCustomers: refPaying,
      referredNetRevenue: refRevenue,
      referredNetRevenuePctOfTotal: totalNet === 0 ? 0 : (refRevenue / totalNet) * 100,
      commissionEarned: earned,
      liability: liab,
      paidOut: paid,
      effectivePayoutRate: effRate,
    },
    topPartners,
    funnel,
    bonusActivity: { earnedInPeriod: bonusesInRange.length, midSprint },
    liabilityAgeing,
  });
});

/* ============================================================
   Partners
   ============================================================ */

adminAffiliatesRouter.get("/partners", async (req, res) => {
  const q = req.query as Record<string, unknown>;
  const includeTest = includeTestFlag(q);
  const cursor = typeof q.cursor === "string" ? q.cursor : undefined;
  const status = typeof q.status === "string" ? q.status.toUpperCase() : undefined;
  const hasMethod = q.hasMethod === "true" ? true : q.hasMethod === "false" ? false : undefined;

  const where: Record<string, unknown> = { ...(includeTest ? {} : { isTest: false }) };
  if (status) where.status = status;
  if (q.from || q.to) {
    const range = parseRange(q);
    where.createdAt = { gte: range.from, lt: range.to };
  }

  const partners = await db.partner.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { payoutMethod: true, referrals: true, commissions: true, bonuses: true, referralEvents: true, fraudFlags: { where: { status: "open" } } },
  });
  const nextCursor = partners.length === 51 ? partners[50].id : null;
  let page = partners.slice(0, 50);
  if (hasMethod !== undefined) page = page.filter((p) => Boolean(p.payoutMethod) === hasMethod);
  if (q.flagged === "true") page = page.filter((p) => p.fraudFlags.length > 0);
  if (q.earnedMoreThan) {
    const min = Number(q.earnedMoreThan);
    page = page.filter((p) => Number(sumBigint(p.commissions) + sumBigint(p.bonuses)) > min);
  }

  res.json({
    items: page.map((p) => ({
      id: p.id,
      name: p.name,
      phoneMasked: maskPhone(p.phone),
      code: p.code,
      status: p.status,
      joinedAt: p.createdAt,
      clicks: p.referralEvents.filter((e) => e.type === "link_opened").length,
      signups: p.referrals.length,
      paidCustomers: p.referrals.filter((r) => r.status === "converted").length,
      referredRevenuePaise: null,
      onHold: Number(sumBigint(p.commissions.filter((c) => c.status === "on_hold")) + sumBigint(p.bonuses.filter((b) => b.status === "on_hold"))),
      approved: Number(sumBigint(p.commissions.filter((c) => c.status === "approved")) + sumBigint(p.bonuses.filter((b) => b.status === "approved"))),
      paid: Number(sumBigint(p.commissions.filter((c) => c.status === "paid")) + sumBigint(p.bonuses.filter((b) => b.status === "paid"))),
      hasPayoutMethod: Boolean(p.payoutMethod),
      hasPan: Boolean(p.payoutMethod?.pan),
      openFlags: p.fraudFlags.length,
      isTest: p.isTest,
    })),
    nextCursor,
  });
});

adminAffiliatesRouter.get("/partners/:id", async (req, res) => {
  const partner = await db.partner.findUnique({ where: { id: req.params.id }, include: { payoutMethod: true } });
  if (!partner) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Partner not found." } });

  const [commissions, bonuses, payouts, referralEvents, referrals, notes, flags] = await Promise.all([
    db.commission.findMany({ where: { partnerId: partner.id }, orderBy: { paidAt: "desc" } }),
    db.bonus.findMany({ where: { partnerId: partner.id }, orderBy: { earnedAt: "desc" } }),
    db.partnerPayout.findMany({ where: { partnerId: partner.id }, orderBy: { requestedAt: "desc" } }),
    db.referralEvent.findMany({ where: { partnerId: partner.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.referral.findMany({ where: { partnerId: partner.id }, include: { account: { select: { businessName: true, fullName: true } } } }),
    db.adminNote.findMany({ where: { entityType: "partner", entityId: partner.id }, orderBy: { createdAt: "desc" } }),
    db.fraudFlag.findMany({ where: { partnerId: partner.id }, orderBy: { createdAt: "desc" } }),
  ]);

  const onHold = sumBigint(commissions.filter((c) => c.status === "on_hold")) + sumBigint(bonuses.filter((b) => b.status === "on_hold"));
  const approved = sumBigint(commissions.filter((c) => c.status === "approved")) + sumBigint(bonuses.filter((b) => b.status === "approved"));
  const inProcess = sumBigint(payouts.filter((p) => ["requested", "processing"].includes(p.status)));
  const paid = sumBigint(commissions.filter((c) => c.status === "paid")) + sumBigint(bonuses.filter((b) => b.status === "paid"));
  const reversed = sumBigint(commissions.filter((c) => c.status === "reversed")) + sumBigint(bonuses.filter((b) => b.status === "reversed"));

  // Ledger — synthesized from timestamped state on each row (no separate
  // ledger_entries table; see partners.md §5 note on keeping the derived
  // model instead of duplicating data).
  const ledger = [
    ...commissions.map((c) => ({ at: c.paidAt, kind: "commission_hold", amount: Number(c.amount) })),
    ...commissions.filter((c) => c.approvedAt).map((c) => ({ at: c.approvedAt!, kind: "commission_approved", amount: Number(c.amount) })),
    ...commissions.filter((c) => c.reversedAt).map((c) => ({ at: c.reversedAt!, kind: "commission_reversed", amount: -Number(c.amount) })),
    ...bonuses.map((b) => ({ at: b.earnedAt, kind: "bonus_hold", amount: Number(b.amount) })),
    ...bonuses.filter((b) => b.approvedAt).map((b) => ({ at: b.approvedAt!, kind: "bonus_approved", amount: Number(b.amount) })),
    ...payouts.map((p) => ({ at: p.requestedAt, kind: "payout_requested", amount: -Number(p.amount) })),
    ...payouts.filter((p) => p.status === "paid" && p.paidAt).map((p) => ({ at: p.paidAt!, kind: "payout_paid", amount: 0 })),
    ...payouts.filter((p) => p.status === "rejected").map((p) => ({ at: p.requestedAt, kind: "payout_rejected", amount: Number(p.amount) })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  res.json({
    partner: {
      id: partner.id,
      name: partner.name,
      phoneMasked: maskPhone(partner.phone),
      emailMasked: `${partner.email.slice(0, 2)}***@${partner.email.split("@")[1] ?? ""}`,
      code: partner.code,
      status: partner.status,
      joinedAt: partner.createdAt,
      termsVersion: partner.termsVersion,
      termsAcceptedAt: partner.termsAcceptedAt,
      whatsappOptIn: partner.whatsappOptIn,
      isTest: partner.isTest,
    },
    balances: { onHold: Number(onHold), approved: Number(approved), inProcess: Number(inProcess), paid: Number(paid), reversed: Number(reversed) },
    payoutMethod: serializeMethod(partner.payoutMethod),
    activity: referralEvents,
    referrals: referrals.map((r) => ({ id: r.id, accountId: r.accountId, businessMasked: maskBusinessName(r.account.businessName ?? r.account.fullName), attributedVia: r.attributedVia, attributedAt: r.attributedAt, status: r.status, rejectionReason: r.rejectionReason })),
    commissions: commissions.map((c) => ({ id: c.id, orderId: c.orderId, amount: Number(c.amount), status: c.status, holdUntil: c.holdUntil, paidAt: c.paidAt, bonusId: c.bonusId })),
    bonuses: bonuses.map((b) => ({ id: b.id, amount: Number(b.amount), status: b.status, earnedAt: b.earnedAt, holdUntil: b.holdUntil, commissionIds: [] })),
    payouts: payouts.map((p) => ({ id: p.id, amount: Number(p.amount), status: p.status, requestedAt: p.requestedAt, paidAt: p.paidAt, reference: p.reference })),
    ledger,
    notes: notes.map((n) => ({ id: n.id, text: n.text, adminId: n.adminId, createdAt: n.createdAt })),
    flags: flags.map((f) => ({ id: f.id, rule: f.rule, status: f.status, evidence: f.evidence, createdAt: f.createdAt, resolvedAt: f.resolvedAt, resolvedReason: f.resolvedReason })),
  });
});

const statusSchema = z.object({ status: z.enum(["active", "suspended", "closed"]), reason: z.string().min(1) });

adminAffiliatesRouter.post("/partners/:id/status", async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: { code: "VALIDATION_FAILED", message: "status and reason are required." } });

  const partner = await db.partner.findUnique({ where: { id: req.params.id }, include: { payoutMethod: true } });
  if (!partner) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Partner not found." } });

  const nextStatus = parsed.data.status.toUpperCase() as "ACTIVE" | "SUSPENDED" | "CLOSED";
  const updated = await db.partner.update({ where: { id: partner.id }, data: { status: nextStatus } });

  let autoPayout: { id: string; amount: number } | null = null;
  if (nextStatus === "CLOSED" && partner.payoutMethod) {
    const [commissions, bonuses, payouts] = await Promise.all([
      db.commission.findMany({ where: { partnerId: partner.id, status: "approved" } }),
      db.bonus.findMany({ where: { partnerId: partner.id, status: "approved" } }),
      db.partnerPayout.findMany({ where: { partnerId: partner.id, status: { in: ["requested", "processing"] } } }),
    ]);
    const available = sumBigint(commissions) + sumBigint(bonuses) - sumBigint(payouts);
    if (available > 0n) {
      const payout = await db.partnerPayout.create({
        data: {
          partnerId: partner.id,
          amount: available,
          netAmount: available,
          methodSnapshot: { type: partner.payoutMethod.type, upiId: maskUpi(partner.payoutMethod.upiId), accountNumberMasked: maskAccountNumber(partner.payoutMethod.accountNumber) } as never,
          status: "requested",
        },
      });
      autoPayout = { id: payout.id, amount: Number(available) };
    }
  }

  await writeAudit(req, {
    action: "partner_status_change",
    entityType: "partner",
    entityId: partner.id,
    reason: parsed.data.reason,
    before: { status: partner.status },
    after: { status: updated.status, autoPayout },
  });
  res.json({ id: updated.id, status: updated.status, autoPayout });
});

const partnerNoteSchema = z.object({ text: z.string().min(1) });

adminAffiliatesRouter.post("/partners/:id/notes", async (req, res) => {
  const parsed = partnerNoteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: { code: "VALIDATION_FAILED", message: "Note text is required." } });
  const note = await db.adminNote.create({ data: { entityType: "partner", entityId: req.params.id, adminId: "superadmin", text: parsed.data.text } });
  await writeAudit(req, { action: "add_note", entityType: "partner", entityId: req.params.id, after: { text: parsed.data.text } });
  res.status(201).json({ id: note.id, text: note.text, createdAt: note.createdAt });
});

/* ============================================================
   Referrals
   ============================================================ */

adminAffiliatesRouter.get("/referrals", async (req, res) => {
  const q = req.query as Record<string, unknown>;
  const cursor = typeof q.cursor === "string" ? q.cursor : undefined;
  const status = typeof q.status === "string" ? q.status : undefined;
  const partnerId = typeof q.partnerId === "string" ? q.partnerId : undefined;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (partnerId) where.partnerId = partnerId;

  const referrals = await db.referral.findMany({
    where,
    orderBy: { attributedAt: "desc" },
    take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { partner: { select: { name: true, code: true } }, account: { select: { businessName: true, fullName: true } } },
  });
  const nextCursor = referrals.length === 51 ? referrals[50].id : null;
  const page = referrals.slice(0, 50);

  res.json({
    items: page.map((r) => ({
      id: r.id,
      accountId: r.accountId,
      customerMasked: maskBusinessName(r.account.businessName ?? r.account.fullName),
      partnerId: r.partnerId,
      partnerName: r.partner.name,
      partnerCode: r.partner.code,
      via: r.attributedVia,
      attributedAt: r.attributedAt,
      status: r.status,
      rejectionReason: r.rejectionReason,
    })),
    nextCursor,
  });
});

const rejectReferralSchema = z.object({ reason: z.string().min(1) });

adminAffiliatesRouter.post("/referrals/:id/reject", async (req, res) => {
  const parsed = rejectReferralSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: { code: "VALIDATION_FAILED", message: "Reason is required." } });

  const referral = await db.referral.findUnique({ where: { id: req.params.id } });
  if (!referral) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Referral not found." } });

  const before = { status: referral.status };
  await db.referral.update({ where: { id: referral.id }, data: { status: "rejected", rejectionReason: "manual" } });

  // partners.md §7.4: any on_hold commission on this referral's orders is reversed.
  const onHoldCommissions = await db.commission.findMany({ where: { order: { referralId: referral.id }, status: "on_hold" } });
  for (const c of onHoldCommissions) await reverseCommission(c.id, `Referral rejected: ${parsed.data.reason}`);

  await writeAudit(req, {
    action: "reject_referral",
    entityType: "referral",
    entityId: referral.id,
    reason: parsed.data.reason,
    before,
    after: { status: "rejected", reversedCommissions: onHoldCommissions.map((c) => c.id) },
  });
  res.json({ id: referral.id, status: "rejected" });
});

const manualAttributionSchema = z.object({ accountId: z.string().min(1), partnerId: z.string().min(1), reason: z.string().min(1) });

adminAffiliatesRouter.post("/referrals/manual", async (req, res) => {
  const parsed = manualAttributionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: { code: "VALIDATION_FAILED", message: "accountId, partnerId and reason are required." } });

  const existing = await db.referral.findUnique({ where: { accountId: parsed.data.accountId } });
  if (existing) return res.status(409).json({ error: { code: "ALREADY_ATTRIBUTED", message: "This account is already attributed to a partner. Reassignment needs an engineering request." } });

  const [account, partner] = await Promise.all([
    db.user.findUnique({ where: { id: parsed.data.accountId } }),
    db.partner.findUnique({ where: { id: parsed.data.partnerId } }),
  ]);
  if (!account) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Account not found." } });
  if (!partner) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Partner not found." } });

  const firstPaidOrder = await db.order.findFirst({ where: { userId: account.id, status: "PAID" }, orderBy: { paidAt: "asc" } });

  const referral = await db.referral.create({
    data: {
      partnerId: partner.id,
      accountId: account.id,
      attributedVia: "manual",
      attributedAt: new Date(),
      status: firstPaidOrder ? "converted" : "signed_up",
    },
  });

  let commissionId: string | null = null;
  if (firstPaidOrder && firstPaidOrder.paidAt) {
    const existingCommission = await db.commission.findUnique({ where: { orderId: firstPaidOrder.id } });
    if (!existingCommission) {
      await db.order.update({ where: { id: firstPaidOrder.id }, data: { referralId: referral.id } });
      const amount = BigInt(Math.floor(Number(firstPaidOrder.totalPaise) * PARTNER_PROGRAM.commissionRate));
      const holdUntil = new Date(firstPaidOrder.paidAt.getTime() + PARTNER_PROGRAM.holdDays * 86_400_000);
      const commission = await db.commission.create({
        data: { partnerId: partner.id, orderId: firstPaidOrder.id, amount, status: "on_hold", paidAt: firstPaidOrder.paidAt, holdUntil },
      });
      commissionId = commission.id;
      await db.$transaction((tx) => evaluateBonus(tx, partner.id));
    }
  }

  await writeAudit(req, {
    action: "manual_attribution",
    entityType: "referral",
    entityId: referral.id,
    reason: parsed.data.reason,
    after: { partnerId: partner.id, accountId: account.id, commissionId },
  });
  res.status(201).json({ id: referral.id, status: referral.status, commissionId });
});

/* ============================================================
   Commissions & bonuses
   ============================================================ */

adminAffiliatesRouter.get("/commissions", async (req, res) => {
  const q = req.query as Record<string, unknown>;
  const type = q.type === "bonus" ? "bonus" : "commission";
  const cursor = typeof q.cursor === "string" ? q.cursor : undefined;
  const status = typeof q.status === "string" ? q.status : undefined;
  const partnerId = typeof q.partnerId === "string" ? q.partnerId : undefined;

  if (type === "bonus") {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (partnerId) where.partnerId = partnerId;
    const bonuses = await db.bonus.findMany({
      where,
      orderBy: { earnedAt: "desc" },
      take: 51,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { partner: { select: { name: true, code: true } }, commissions: { select: { id: true } } },
    });
    const nextCursor = bonuses.length === 51 ? bonuses[50].id : null;
    return res.json({
      items: bonuses.slice(0, 50).map((b) => ({
        id: b.id, type: "bonus", partnerId: b.partnerId, partnerName: b.partner.name, partnerCode: b.partner.code,
        amount: Number(b.amount), status: b.status, holdUntil: b.holdUntil, payoutId: b.payoutId, commissionIds: b.commissions.map((c) => c.id),
      })),
      nextCursor,
    });
  }

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (partnerId) where.partnerId = partnerId;
  const commissions = await db.commission.findMany({
    where,
    orderBy: { paidAt: "desc" },
    take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { partner: { select: { name: true, code: true } }, order: { include: { user: { select: { businessName: true, fullName: true } } } } },
  });
  const nextCursor = commissions.length === 51 ? commissions[50].id : null;
  res.json({
    items: commissions.slice(0, 50).map((c) => ({
      id: c.id, type: "commission", partnerId: c.partnerId, partnerName: c.partner.name, partnerCode: c.partner.code,
      customerMasked: maskBusinessName(c.order.user.businessName ?? c.order.user.fullName), checkoutId: c.orderId,
      amount: Number(c.amount), status: c.status, holdUntil: c.holdUntil, payoutId: c.payoutId,
    })),
    nextCursor,
  });
});

const reverseSchema = z.object({ reason: z.string().min(1) });

adminAffiliatesRouter.post("/commissions/:id/reverse", async (req, res) => {
  const parsed = reverseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: { code: "VALIDATION_FAILED", message: "Reason is required." } });
  const before = await db.commission.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Commission not found." } });
  if (!["on_hold", "approved"].includes(before.status)) {
    return res.status(422).json({ error: { code: "CANNOT_REVERSE", message: "Only on-hold or approved commissions can be reversed here. A paid one needs a finance process." } });
  }
  const commission = await reverseCommission(before.id, parsed.data.reason);
  await writeAudit(req, { action: "reverse_commission", entityType: "commission", entityId: before.id, reason: parsed.data.reason, before: { status: before.status }, after: { status: commission?.status } });
  res.json({ id: before.id, status: "reversed" });
});

adminAffiliatesRouter.post("/bonuses/:id/reverse", async (req, res) => {
  const parsed = reverseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: { code: "VALIDATION_FAILED", message: "Reason is required." } });
  const before = await db.bonus.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Bonus not found." } });
  if (!["on_hold", "approved"].includes(before.status)) {
    return res.status(422).json({ error: { code: "CANNOT_REVERSE", message: "Only on-hold or approved bonuses can be reversed here." } });
  }
  await reverseBonus(before.id);
  await writeAudit(req, { action: "reverse_bonus", entityType: "bonus", entityId: before.id, reason: parsed.data.reason, before: { status: before.status }, after: { status: "reversed" } });
  res.json({ id: before.id, status: "reversed" });
});

/* ============================================================
   Payouts queue
   ============================================================ */

adminAffiliatesRouter.get("/payouts", async (req, res) => {
  const q = req.query as Record<string, unknown>;
  const cursor = typeof q.cursor === "string" ? q.cursor : undefined;
  const status = typeof q.status === "string" ? q.status : "requested";
  const partnerId = typeof q.partnerId === "string" ? q.partnerId : undefined;

  const where: Record<string, unknown> = {};
  if (status !== "all") where.status = status;
  if (partnerId) where.partnerId = partnerId;

  const payouts = await db.partnerPayout.findMany({
    where,
    orderBy: { requestedAt: "asc" },
    take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { partner: { include: { payoutMethod: true, fraudFlags: { where: { status: "open" } } } } },
  });
  const nextCursor = payouts.length === 51 ? payouts[50].id : null;
  const page = payouts.slice(0, 50);

  const items = await Promise.all(
    page.map(async (p) => {
      const [approvedC, approvedB, inProcess] = await Promise.all([
        db.commission.aggregate({ where: { partnerId: p.partnerId, status: "approved" }, _sum: { amount: true } }),
        db.bonus.aggregate({ where: { partnerId: p.partnerId, status: "approved" }, _sum: { amount: true } }),
        db.partnerPayout.aggregate({ where: { partnerId: p.partnerId, status: { in: ["requested", "processing"] }, id: { not: p.id } }, _sum: { amount: true } }),
      ]);
      const available = Number(approvedC._sum.amount ?? 0n) + Number(approvedB._sum.amount ?? 0n) - Number(inProcess._sum.amount ?? 0n);
      const ageHours = (Date.now() - p.requestedAt.getTime()) / 3_600_000;
      const checks = {
        balanceCovers: available >= Number(p.amount),
        panPresent: Boolean(p.partner.payoutMethod?.pan),
        methodPresent: Boolean(p.partner.payoutMethod),
        methodVerified: Boolean(p.partner.payoutMethod?.verifiedAt),
        partnerActive: p.partner.status === "ACTIVE",
        noOpenFlag: p.partner.fraudFlags.length === 0,
      };
      return {
        id: p.id,
        partnerId: p.partnerId,
        partnerName: p.partner.name,
        partnerCode: p.partner.code,
        requestedAt: p.requestedAt,
        ageHours,
        overSla: ageHours > 7 * 24,
        amount: Number(p.amount),
        tds: Number(p.tdsAmount),
        net: Number(p.netAmount),
        method: p.partner.payoutMethod
          ? { type: p.partner.payoutMethod.type, upiId: maskUpi(p.partner.payoutMethod.upiId), accountNumberMasked: maskAccountNumber(p.partner.payoutMethod.accountNumber) }
          : null,
        checks,
        allChecksPass: Object.values(checks).every(Boolean),
        status: p.status,
        reference: p.reference,
      };
    }),
  );

  res.json({ items, nextCursor });
});

const processingSchema = z.object({ reason: z.string().min(1), override: z.boolean().optional() });

adminAffiliatesRouter.post("/payouts/:id/processing", async (req, res) => {
  const parsed = processingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: { code: "VALIDATION_FAILED", message: "Reason is required." } });
  const payout = await db.partnerPayout.findUnique({ where: { id: req.params.id }, include: { partner: { include: { payoutMethod: true, fraudFlags: { where: { status: "open" } } } } } });
  if (!payout) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Payout not found." } });
  if (payout.status !== "requested") return res.status(422).json({ error: { code: "INVALID_TRANSITION", message: "Only a requested payout can move to processing." } });

  const [approvedC, approvedB, otherInProcess] = await Promise.all([
    db.commission.aggregate({ where: { partnerId: payout.partnerId, status: "approved" }, _sum: { amount: true } }),
    db.bonus.aggregate({ where: { partnerId: payout.partnerId, status: "approved" }, _sum: { amount: true } }),
    db.partnerPayout.aggregate({ where: { partnerId: payout.partnerId, status: { in: ["requested", "processing"] }, id: { not: payout.id } }, _sum: { amount: true } }),
  ]);
  const available = Number(approvedC._sum.amount ?? 0n) + Number(approvedB._sum.amount ?? 0n) - Number(otherInProcess._sum.amount ?? 0n);
  const checksPass =
    available >= Number(payout.amount) &&
    Boolean(payout.partner.payoutMethod?.pan) &&
    Boolean(payout.partner.payoutMethod?.verifiedAt) &&
    payout.partner.status === "ACTIVE" &&
    payout.partner.fraudFlags.length === 0;

  if (!checksPass && !parsed.data.override) {
    return res.status(422).json({ error: { code: "CHECKS_FAILED", message: "One or more pre-payout checks failed. A Super admin can override with a reason." } });
  }

  const updated = await db.partnerPayout.update({ where: { id: payout.id }, data: { status: "processing" } });
  await writeAudit(req, { action: "payout_processing", entityType: "payout", entityId: payout.id, reason: parsed.data.reason, before: { status: "requested" }, after: { status: "processing", overridden: !checksPass } });
  res.json({ id: updated.id, status: updated.status });
});

const paidSchema = z.object({ reference: z.string().min(1), paidAt: z.string().optional(), reason: z.string().min(1) });

adminAffiliatesRouter.post("/payouts/:id/paid", async (req, res) => {
  const parsed = paidSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: { code: "VALIDATION_FAILED", message: "Reference and reason are required." } });
  const payout = await db.partnerPayout.findUnique({ where: { id: req.params.id }, include: { partner: true } });
  if (!payout) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Payout not found." } });
  if (payout.status !== "processing") return res.status(422).json({ error: { code: "INVALID_TRANSITION", message: "Only a processing payout can be marked paid." } });

  const paidAt = parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date();
  const updated = await db.partnerPayout.update({ where: { id: payout.id }, data: { status: "paid", reference: parsed.data.reference, paidAt } });

  // Settle enough approved commissions/bonuses (oldest first) to cover the
  // amount — there's no per-payout commission earmarking at request time
  // (see partners.md), so this is where that link is made, at completion.
  let remaining = payout.amount;
  const [commissions, bonuses] = await Promise.all([
    db.commission.findMany({ where: { partnerId: payout.partnerId, status: "approved" }, orderBy: { paidAt: "asc" } }),
    db.bonus.findMany({ where: { partnerId: payout.partnerId, status: "approved" }, orderBy: { earnedAt: "asc" } }),
  ]);
  const settled: { commissions: string[]; bonuses: string[] } = { commissions: [], bonuses: [] };
  for (const c of commissions) {
    if (remaining <= 0n) break;
    await db.commission.update({ where: { id: c.id }, data: { status: "paid", payoutId: payout.id } });
    settled.commissions.push(c.id);
    remaining -= c.amount;
  }
  for (const b of bonuses) {
    if (remaining <= 0n) break;
    await db.bonus.update({ where: { id: b.id }, data: { status: "paid", payoutId: payout.id } });
    settled.bonuses.push(b.id);
    remaining -= b.amount;
  }

  notifyPartner(payout.partner.phone, "payout_paid", `₹${Number(payout.amount) / 100} sent to your ${payout.partner.name ? "account" : "method"}. Ref ${parsed.data.reference}.`);
  await writeAudit(req, { action: "payout_paid", entityType: "payout", entityId: payout.id, reason: parsed.data.reason, after: { reference: parsed.data.reference, paidAt, settled } });
  res.json({ id: updated.id, status: updated.status, reference: updated.reference });
});

const rejectPayoutSchema = z.object({ reason: z.string().min(1) });

adminAffiliatesRouter.post("/payouts/:id/reject", async (req, res) => {
  const parsed = rejectPayoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: { code: "VALIDATION_FAILED", message: "Reason is required." } });
  const payout = await db.partnerPayout.findUnique({ where: { id: req.params.id }, include: { partner: true } });
  if (!payout) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Payout not found." } });
  if (!["requested", "processing"].includes(payout.status)) {
    return res.status(422).json({ error: { code: "INVALID_TRANSITION", message: "Only a requested or processing payout can be rejected." } });
  }
  const updated = await db.partnerPayout.update({ where: { id: payout.id }, data: { status: "rejected", rejectionReason: parsed.data.reason } });
  notifyPartner(payout.partner.phone, "payout_rejected", `Your ₹${Number(payout.amount) / 100} payout request was rejected: ${parsed.data.reason}`);
  await writeAudit(req, { action: "payout_reject", entityType: "payout", entityId: payout.id, reason: parsed.data.reason, before: { status: payout.status }, after: { status: "rejected" } });
  res.json({ id: updated.id, status: updated.status });
});

const exportSchema = z.object({ ids: z.array(z.string()).min(1) });

adminAffiliatesRouter.post("/payouts/export", async (req, res) => {
  const parsed = exportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: { code: "VALIDATION_FAILED", message: "ids is required." } });

  const payouts = await db.partnerPayout.findMany({
    where: { id: { in: parsed.data.ids }, status: "processing" },
    include: { partner: { include: { payoutMethod: true } } },
  });

  const header = [`# Exported by admin:superadmin at ${new Date().toISOString()}`, "partner_name,partner_code,method,upi_id,account_name,account_number,ifsc,amount_inr,net_inr,payout_id"].join("\n");
  const rows = payouts.map((p) => {
    const m = p.partner.payoutMethod;
    return [
      p.partner.name,
      p.partner.code,
      m?.type ?? "",
      m?.type === "upi" ? m.upiId ?? "" : "",
      m?.type === "bank" ? m.accountName ?? "" : "",
      m?.type === "bank" ? m.accountNumber ?? "" : "",
      m?.type === "bank" ? m.ifsc ?? "" : "",
      (Number(p.amount) / 100).toFixed(2),
      (Number(p.netAmount) / 100).toFixed(2),
      p.id,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",");
  });

  await writeAudit(req, { action: "export_payouts", entityType: "payout", entityId: parsed.data.ids.join(","), after: { count: payouts.length } });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="payouts-${istKeyForFilename()}.csv"`);
  res.send([header, ...rows].join("\n"));
});

function istKeyForFilename(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ============================================================
   Fraud flags
   ============================================================ */

adminAffiliatesRouter.get("/flags", async (req, res) => {
  const q = req.query as Record<string, unknown>;
  const cursor = typeof q.cursor === "string" ? q.cursor : undefined;
  const status = typeof q.status === "string" ? q.status : "open";
  const rule = typeof q.rule === "string" ? q.rule : undefined;

  const where: Record<string, unknown> = {};
  if (status !== "all") where.status = status;
  if (rule) where.rule = rule;

  const flags = await db.fraudFlag.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { partner: { select: { name: true, code: true } } },
  });
  const nextCursor = flags.length === 51 ? flags[50].id : null;

  res.json({
    items: flags.slice(0, 50).map((f) => ({
      id: f.id, partnerId: f.partnerId, partnerName: f.partner.name, partnerCode: f.partner.code,
      rule: f.rule, evidence: f.evidence, status: f.status, createdAt: f.createdAt, resolvedAt: f.resolvedAt, resolvedReason: f.resolvedReason,
    })),
    nextCursor,
  });
});

const flagActionSchema = z.object({ reason: z.string().min(1) });

adminAffiliatesRouter.post("/flags/:id/dismiss", async (req, res) => {
  const parsed = flagActionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: { code: "VALIDATION_FAILED", message: "Reason is required." } });
  const flag = await db.fraudFlag.findUnique({ where: { id: req.params.id } });
  if (!flag) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Flag not found." } });
  const updated = await db.fraudFlag.update({ where: { id: flag.id }, data: { status: "dismissed", resolvedBy: "superadmin", resolvedReason: parsed.data.reason, resolvedAt: new Date() } });
  await writeAudit(req, { action: "flag_dismiss", entityType: "fraud_flag", entityId: flag.id, reason: parsed.data.reason, before: { status: flag.status }, after: { status: "dismissed" } });
  res.json({ id: updated.id, status: updated.status });
});

adminAffiliatesRouter.post("/flags/:id/actioned", async (req, res) => {
  const parsed = flagActionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: { code: "VALIDATION_FAILED", message: "Reason is required." } });
  const flag = await db.fraudFlag.findUnique({ where: { id: req.params.id } });
  if (!flag) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Flag not found." } });
  const updated = await db.fraudFlag.update({ where: { id: flag.id }, data: { status: "actioned", resolvedBy: "superadmin", resolvedReason: parsed.data.reason, resolvedAt: new Date() } });
  await writeAudit(req, { action: "flag_actioned", entityType: "fraud_flag", entityId: flag.id, reason: parsed.data.reason, before: { status: flag.status }, after: { status: "actioned" } });
  res.json({ id: updated.id, status: updated.status });
});
