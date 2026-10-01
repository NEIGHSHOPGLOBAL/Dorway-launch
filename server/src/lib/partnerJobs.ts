import type { Prisma } from "@prisma/client";
import { db } from "./db.js";
import { PARTNER_PROGRAM } from "./partnerProgram.js";
import { notifyPartner } from "./partnerNotify.js";

type Tx = Prisma.TransactionClient;

const DAY_MS = 86_400_000;

/**
 * partners.md §7.4. Called after every new commission is created (and again
 * after a reversal, since freeing up bonusId slots can complete a new
 * window). Slides a window starting at the oldest un-consumed commission;
 * if it doesn't fill within `bonus.withinDays`, those commissions are
 * permanently stale for bonus purposes — the doc calls this out explicitly
 * (§7.4 point 3) rather than treating it as a bug.
 */
export async function evaluateBonus(tx: Tx, partnerId: string) {
  const { every, withinDays, amountPaise } = PARTNER_PROGRAM.bonus;
  const windowMs = withinDays * DAY_MS;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const unconsumed = await tx.commission.findMany({
      where: { partnerId, bonusId: null, status: { not: "reversed" } },
      orderBy: { paidAt: "asc" },
    });
    if (unconsumed.length < every) return;

    const windowStart = unconsumed[0].paidAt;
    const windowEnd = new Date(windowStart.getTime() + windowMs);
    const inWindow = unconsumed.filter((c) => c.paidAt <= windowEnd);
    if (inWindow.length < every) return;

    const chosen = inWindow.slice(0, every);
    const holdUntil = new Date(Math.max(...chosen.map((c) => c.holdUntil.getTime())));

    const bonus = await tx.bonus.create({
      data: { partnerId, amount: amountPaise, status: "on_hold", earnedAt: new Date(), holdUntil },
    });
    await tx.commission.updateMany({
      where: { id: { in: chosen.map((c) => c.id) } },
      data: { bonusId: bonus.id },
    });

    const partner = await tx.partner.findUniqueOrThrow({ where: { id: partnerId } });
    notifyPartner(
      partner.phone,
      "bonus_earned",
      `You landed ${every} checkouts in ${withinDays} days. ₹${Number(amountPaise) / 100} bonus added, on hold until ${holdUntil.toDateString()}.`,
    );
    // loop again — freeing these 10 might immediately complete another window
  }
}

/** partners.md §7.6 "release_holds" — hourly. */
export async function releaseHolds() {
  const now = new Date();

  const commissions = await db.commission.findMany({
    where: { status: "on_hold", holdUntil: { lte: now } },
    include: { partner: true, order: { include: { plan: true } } },
  });
  for (const c of commissions) {
    await db.commission.update({ where: { id: c.id }, data: { status: "approved", approvedAt: now } });
    notifyPartner(c.partner.phone, "commission_approved", `₹${Number(c.amount) / 100} from ${c.order.plan.name} is now approved.`);
  }

  const bonuses = await db.bonus.findMany({
    where: { status: "on_hold", holdUntil: { lte: now } },
    include: { partner: true },
  });
  for (const b of bonuses) {
    await db.bonus.update({ where: { id: b.id }, data: { status: "approved", approvedAt: now } });
    notifyPartner(b.partner.phone, "bonus_approved", `₹${Number(b.amount) / 100} bonus is now approved.`);
  }

  return { commissionsApproved: commissions.length, bonusesApproved: bonuses.length };
}

/**
 * partners.md §7.5 "mark_abandoned" — every 15 min. Reuses the existing
 * OrderStatus.EXPIRED state (nothing previously flipped stale CREATED/PENDING
 * orders to it) rather than inventing a parallel "abandoned" flag.
 */
export async function markAbandoned() {
  const cutoff = new Date(Date.now() - PARTNER_PROGRAM.abandonedAfterHours * 60 * 60_000);
  const stale = await db.order.findMany({
    where: { status: { in: ["CREATED", "PENDING"] }, createdAt: { lte: cutoff } },
    select: { id: true, userId: true },
  });
  if (stale.length === 0) return { expired: 0 };

  const usersWithPaidOrder = new Set(
    (
      await db.order.findMany({
        where: { userId: { in: stale.map((o) => o.userId) }, status: "PAID" },
        select: { userId: true },
      })
    ).map((o) => o.userId),
  );

  const toExpire = stale.filter((o) => !usersWithPaidOrder.has(o.userId));
  if (toExpire.length > 0) {
    await db.order.updateMany({ where: { id: { in: toExpire.map((o) => o.id) } }, data: { status: "EXPIRED" } });
  }
  return { expired: toExpire.length };
}

/** partners.md §7.6 "expire_otps" — daily. */
export async function expirePartnerOtps() {
  const cutoff = new Date(Date.now() - 7 * DAY_MS);
  const result = await db.partnerOtp.deleteMany({
    where: { OR: [{ expiresAt: { lte: cutoff } }, { consumedAt: { not: null, lte: cutoff } }] },
  });
  return result.count;
}

/**
 * superadmin.md §7.5 reverse action, and the referral-reject / refund-webhook
 * paths that need the same "reverse it, free its bonus slot, re-evaluate"
 * sequence. Only on_hold/approved items can be reversed; paid ones can't
 * (that needs a finance process — §13 Q6).
 */
export async function reverseCommission(commissionId: string, reason: string) {
  const commission = await db.commission.findUnique({ where: { id: commissionId } });
  if (!commission || !["on_hold", "approved"].includes(commission.status)) return null;

  await db.commission.update({ where: { id: commissionId }, data: { status: "reversed", reversedAt: new Date(), reversalReason: reason } });
  if (commission.bonusId) await unwindBonus(commission.bonusId);
  return commission;
}

export async function reverseBonus(bonusId: string) {
  const bonus = await db.bonus.findUnique({ where: { id: bonusId } });
  if (!bonus || !["on_hold", "approved"].includes(bonus.status)) return null;
  await unwindBonus(bonusId);
  return bonus;
}

async function unwindBonus(bonusId: string) {
  const bonus = await db.bonus.update({ where: { id: bonusId }, data: { status: "reversed" } });
  await db.commission.updateMany({ where: { bonusId }, data: { bonusId: null } });
  // Freeing these commissions' bonusId might immediately complete a new window.
  await db.$transaction((tx) => evaluateBonus(tx, bonus.partnerId));
}

export function startPartnerJobs() {
  setInterval(() => releaseHolds().catch((err) => console.error("releaseHolds job failed:", err)), 60 * 60_000).unref();
  setInterval(() => markAbandoned().catch((err) => console.error("markAbandoned job failed:", err)), 15 * 60_000).unref();
  setInterval(() => expirePartnerOtps().catch((err) => console.error("expirePartnerOtps job failed:", err)), 24 * 60 * 60_000).unref();
}
