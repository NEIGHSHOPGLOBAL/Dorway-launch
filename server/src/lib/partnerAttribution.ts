import { db } from "./db.js";
import { normalizeCode } from "./partnerCode.js";

export async function resolveActivePartnerByCode(rawCode: string) {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  const partner = await db.partner.findUnique({ where: { code } });
  if (!partner || partner.status !== "ACTIVE") return null;
  return partner;
}

export async function logReferralEvent(
  partnerId: string,
  type: "link_opened" | "code_applied" | "signed_up" | "checkout_started",
  opts: { source: "link" | "code"; visitorId?: string | null; accountId?: string | null },
) {
  await db.referralEvent.create({
    data: { partnerId, type, source: opts.source, visitorId: opts.visitorId ?? null, accountId: opts.accountId ?? null },
  });
}

/**
 * partners.md §7.1: first attribution wins for life, self-referral and
 * pre-existing customers are rejected. Called from both the signup path
 * (auth.ts, via="link" from the ?ref cookie) and the checkout path
 * (checkout.ts, via="code" — "a typed code overrides the cookie" only in
 * the sense that it's the one used when no attribution exists yet).
 */
export async function attributeReferral(opts: {
  accountId: string;
  partnerCode: string;
  via: "link" | "code";
  accountPhone?: string | null;
  accountEmail?: string | null;
  visitorId?: string | null;
}): Promise<{ attributed: boolean; rejected?: "self_referral" | "existing_customer" }> {
  const partner = await resolveActivePartnerByCode(opts.partnerCode);
  if (!partner) return { attributed: false };

  const existing = await db.referral.findUnique({ where: { accountId: opts.accountId } });
  if (existing) return { attributed: false }; // one partner for life — first write wins

  const isSelfReferral =
    (opts.accountPhone && opts.accountPhone === partner.phone) ||
    (opts.accountEmail && opts.accountEmail.toLowerCase() === partner.email.toLowerCase());

  const priorPaidOrders = await db.order.count({ where: { userId: opts.accountId, status: "PAID" } });

  const rejectionReason = isSelfReferral ? "self_referral" : priorPaidOrders > 0 ? "existing_customer" : null;

  await db.referral.create({
    data: {
      partnerId: partner.id,
      accountId: opts.accountId,
      attributedVia: opts.via,
      attributedAt: new Date(),
      status: rejectionReason ? "rejected" : "signed_up",
      rejectionReason,
    },
  });
  await logReferralEvent(partner.id, opts.via === "code" ? "code_applied" : "signed_up", {
    source: opts.via,
    accountId: opts.accountId,
    visitorId: opts.visitorId,
  });

  return rejectionReason ? { attributed: false, rejected: rejectionReason as "self_referral" | "existing_customer" } : { attributed: true };
}
