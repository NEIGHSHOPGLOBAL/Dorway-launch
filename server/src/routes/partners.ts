import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "../lib/db.js";
import { config } from "../lib/config.js";
import { rateLimit } from "../lib/rateLimit.js";
import { normalizePhone, sendOtpWhatsApp } from "../lib/whatsapp.js";
import { issuePartnerSession, clearPartnerSession, readPartnerSession, requirePartner } from "../lib/partnerSession.js";
import { generateUniquePartnerCode, normalizeCode } from "../lib/partnerCode.js";
import { PARTNER_PROGRAM } from "../lib/partnerProgram.js";
import { resolveActivePartnerByCode, logReferralEvent } from "../lib/partnerAttribution.js";
import { maskAccountNumber, maskBusinessName, maskPan, maskPhoneE164, maskUpi } from "../lib/partnerMask.js";
import { notifyPartner } from "../lib/partnerNotify.js";

export const partnersRouter = Router();

function getPartnerId(req: import("express").Request): string {
  return (req as any).partnerSession.sub;
}

function genOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendPartnerOtp(phone: string, code: string) {
  if (config.whatsapp.otpEnabled && config.whatsapp.isConfigured) {
    await sendOtpWhatsApp(phone, code);
  } else {
    console.log(`\n[dev whatsapp] Partner OTP for +${phone}: ${code}  (expires in ${PARTNER_PROGRAM.otp.expiresMinutes} min)\n`);
  }
}

/** WhatsApp credentials aren't set locally, so the code never leaves this process.
 *  Hand it back only outside production so registration can be finished. */
function devOtp(code: string): { devCode?: string } {
  if (process.env.NODE_ENV === "production") return {};
  if (config.whatsapp.otpEnabled && config.whatsapp.isConfigured) return {};
  return { devCode: code };
}

function apiError(res: import("express").Response, status: number, code: string, message: string, extra?: Record<string, unknown>) {
  res.status(status).json({ error: { code, message, ...extra } });
}

function sumBigint(rows: { amount: bigint }[]): bigint {
  return rows.reduce((a, r) => a + r.amount, 0n);
}

/* ============================================================
   Public — referral tracking + code resolution (no session)
   ============================================================ */

const trackSchema = z.object({
  code: z.string().min(1),
  visitorId: z.string().min(1).max(200),
});

// Fired by the main site on any page load with ?ref=<code>. Deduped per
// visitor per day at the DB level would need a unique constraint with a
// date() expression; a simple existence check is enough at this scale.
partnersRouter.post("/track", async (req, res) => {
  const parsed = trackSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 422, "VALIDATION_FAILED", "Missing code or visitor id.");

  const partner = await resolveActivePartnerByCode(parsed.data.code);
  if (!partner) return res.status(204).end(); // unknown/inactive code — fail silently, it's just tracking

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const already = await db.referralEvent.findFirst({
    where: { partnerId: partner.id, type: "link_opened", visitorId: parsed.data.visitorId, createdAt: { gte: since } },
  });
  if (!already) {
    await logReferralEvent(partner.id, "link_opened", { source: "link", visitorId: parsed.data.visitorId });
  }
  res.status(204).end();
});

partnersRouter.get("/resolve", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const partner = await resolveActivePartnerByCode(code);
  res.json({ valid: Boolean(partner) });
});

/* ============================================================
   Auth — register / login (WhatsApp OTP, same shape as routes/auth.ts)
   ============================================================ */

const registerStartSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().min(6),
  email: z.string().email(),
});

partnersRouter.post("/register/start", async (req, res) => {
  const parsed = registerStartSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 422, "VALIDATION_FAILED", "Check your name, phone and email.", { fields: parsed.error.flatten().fieldErrors });

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return apiError(res, 422, "VALIDATION_FAILED", "That doesn't look like a valid phone number.", { fields: { phone: "Enter a 10-digit mobile number." } });

  const existing = await db.partner.findUnique({ where: { phone } });
  if (existing) return apiError(res, 409, "PHONE_ALREADY_REGISTERED", "That number is already a partner. Try logging in instead.");

  if (!rateLimit(`partner-otp:phone:${phone}`, 3, 10 * 60_000) || !rateLimit(`partner-otp:ip:${req.ip}`, 10, 60 * 60_000)) {
    return apiError(res, 429, "OTP_RATE_LIMITED", "Too many attempts. Wait a bit and try again.", { retryAfterSeconds: 30 });
  }

  const code = genOtp();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + PARTNER_PROGRAM.otp.expiresMinutes * 60_000);
  await db.partnerOtp.create({ data: { phone, purpose: "register", codeHash, expiresAt } });

  try {
    await sendPartnerOtp(phone, code);
  } catch (err) {
    console.error("Partner OTP send failed:", err);
    return apiError(res, 502, "OTP_SEND_FAILED", "Couldn't send the code. Try again in a moment.");
  }
  res.status(200).json({ ok: true, expiresIn: PARTNER_PROGRAM.otp.expiresMinutes * 60, ...devOtp(code) });
});

const registerVerifySchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().min(6),
  email: z.string().email(),
  code: z.string().length(6),
  acceptedTerms: z.literal(true),
});

partnersRouter.post("/register/verify", async (req, res) => {
  const parsed = registerVerifySchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 422, "VALIDATION_FAILED", "Check the form and try again.");

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return apiError(res, 422, "VALIDATION_FAILED", "That doesn't look like a valid phone number.");

  const otp = await db.partnerOtp.findFirst({
    where: { phone, purpose: "register", consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return apiError(res, 400, "OTP_EXPIRED", "That code has expired. Request a new one.");
  if (otp.attempts >= 5) {
    await db.partnerOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    return apiError(res, 429, "OTP_TOO_MANY_ATTEMPTS", "Too many wrong attempts. Request a new code.");
  }
  const ok = await bcrypt.compare(parsed.data.code, otp.codeHash);
  if (!ok) {
    await db.partnerOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return apiError(res, 400, "OTP_INVALID", "That code doesn't match. Check the latest WhatsApp message and try again.");
  }
  await db.partnerOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

  const alreadyRegistered = await db.partner.findUnique({ where: { phone } });
  if (alreadyRegistered) return apiError(res, 409, "PHONE_ALREADY_REGISTERED", "That number is already a partner. Try logging in instead.");

  const partnerCode = await generateUniquePartnerCode();
  const partner = await db.partner.create({
    data: {
      name: parsed.data.name,
      phone,
      email: parsed.data.email.toLowerCase(),
      code: partnerCode,
      termsVersion: "2026-10-01",
      termsAcceptedAt: new Date(),
      whatsappOptIn: true,
    },
  });

  await issuePartnerSession(res, { sub: partner.id });
  notifyPartner(partner.phone, "registration_complete", `Welcome! Your referral code is ${partner.code}.`);
  res.status(201).json({ id: partner.id, name: partner.name, phone: partner.phone, email: partner.email, code: partner.code, joinedAt: partner.createdAt });
});

const loginStartSchema = z.object({ phone: z.string().min(6) });

partnersRouter.post("/login/start", async (req, res) => {
  const parsed = loginStartSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 422, "VALIDATION_FAILED", "Enter a valid phone number.");
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return apiError(res, 422, "VALIDATION_FAILED", "That doesn't look like a valid phone number.");

  const partner = await db.partner.findUnique({ where: { phone } });
  if (!partner) return apiError(res, 404, "PARTNER_NOT_FOUND", "No partner account uses this number. Join the program instead.");
  if (partner.status === "SUSPENDED") return apiError(res, 403, "PARTNER_SUSPENDED", "This partner account is suspended. Contact support.");

  if (!rateLimit(`partner-otp:phone:${phone}`, 3, 10 * 60_000) || !rateLimit(`partner-otp:ip:${req.ip}`, 10, 60 * 60_000)) {
    return apiError(res, 429, "OTP_RATE_LIMITED", "Too many attempts. Wait a bit and try again.", { retryAfterSeconds: 30 });
  }

  const code = genOtp();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + PARTNER_PROGRAM.otp.expiresMinutes * 60_000);
  await db.partnerOtp.create({ data: { phone, purpose: "login", codeHash, expiresAt } });

  try {
    await sendPartnerOtp(phone, code);
  } catch (err) {
    console.error("Partner OTP send failed:", err);
    return apiError(res, 502, "OTP_SEND_FAILED", "Couldn't send the code. Try again in a moment.");
  }
  res.status(200).json({ ok: true, expiresIn: PARTNER_PROGRAM.otp.expiresMinutes * 60, ...devOtp(code) });
});

const loginVerifySchema = z.object({ phone: z.string().min(6), code: z.string().length(6) });

partnersRouter.post("/login/verify", async (req, res) => {
  const parsed = loginVerifySchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 422, "VALIDATION_FAILED", "Enter the 6-digit code.");
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return apiError(res, 422, "VALIDATION_FAILED", "That doesn't look like a valid phone number.");

  const otp = await db.partnerOtp.findFirst({
    where: { phone, purpose: "login", consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return apiError(res, 400, "OTP_EXPIRED", "That code has expired. Request a new one.");
  if (otp.attempts >= 5) {
    await db.partnerOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    return apiError(res, 429, "OTP_TOO_MANY_ATTEMPTS", "Too many wrong attempts. Request a new code.");
  }
  const ok = await bcrypt.compare(parsed.data.code, otp.codeHash);
  if (!ok) {
    await db.partnerOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return apiError(res, 400, "OTP_INVALID", "That code doesn't match. Check the latest WhatsApp message and try again.");
  }
  await db.partnerOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

  const partner = await db.partner.findUnique({ where: { phone } });
  if (!partner) return apiError(res, 404, "PARTNER_NOT_FOUND", "No partner account uses this number.");
  if (partner.status === "SUSPENDED") return apiError(res, 403, "PARTNER_SUSPENDED", "This partner account is suspended. Contact support.");

  await issuePartnerSession(res, { sub: partner.id });
  res.status(200).json({ id: partner.id, name: partner.name, phone: partner.phone, email: partner.email, code: partner.code, joinedAt: partner.createdAt });
});

partnersRouter.post("/logout", (_req, res) => {
  clearPartnerSession(res);
  res.status(204).end();
});

partnersRouter.get("/me", async (req, res) => {
  const session = await readPartnerSession(req);
  if (!session) return apiError(res, 401, "UNAUTHENTICATED", "Log in to continue.");
  const partner = await db.partner.findUnique({ where: { id: session.sub } });
  if (!partner) return apiError(res, 401, "UNAUTHENTICATED", "Log in to continue.");
  res.json({ id: partner.id, name: partner.name, phone: partner.phone, email: partner.email, code: partner.code, joinedAt: partner.createdAt });
});

/* ============================================================
   Settings
   ============================================================ */

const payoutMethodSchema = z.union([
  z.object({
    type: z.literal("upi"),
    upiId: z.string().regex(/^[\w.-]{2,}@[a-zA-Z]{2,}$/),
    pan: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/),
  }),
  z.object({
    type: z.literal("bank"),
    accountName: z.string().min(2),
    accountNumber: z.string().regex(/^\d{9,18}$/),
    ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/),
    pan: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/),
  }),
]);

partnersRouter.put("/me/payout-method", requirePartner, async (req, res) => {
  const parsed = payoutMethodSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 422, "VALIDATION_FAILED", "Check the payout details.", { fields: parsed.error.flatten() });

  const partnerId = getPartnerId(req);
  const data = parsed.data;
  const method = await db.partnerPayoutMethod.upsert({
    where: { partnerId },
    create: {
      partnerId,
      type: data.type,
      upiId: data.type === "upi" ? data.upiId : null,
      accountName: data.type === "bank" ? data.accountName : null,
      accountNumber: data.type === "bank" ? data.accountNumber : null,
      ifsc: data.type === "bank" ? data.ifsc : null,
      pan: data.pan,
    },
    update: {
      type: data.type,
      upiId: data.type === "upi" ? data.upiId : null,
      accountName: data.type === "bank" ? data.accountName : null,
      accountNumber: data.type === "bank" ? data.accountNumber : null,
      ifsc: data.type === "bank" ? data.ifsc : null,
      pan: data.pan,
    },
  });
  res.json(serializePayoutMethod(method));
});

const notificationsSchema = z.object({ whatsapp: z.boolean(), email: z.boolean() });

partnersRouter.put("/me/notifications", requirePartner, async (req, res) => {
  const parsed = notificationsSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 422, "VALIDATION_FAILED", "Invalid notification settings.");
  const partner = await db.partner.update({
    where: { id: getPartnerId(req) },
    data: { notifyWhatsapp: parsed.data.whatsapp, notifyEmail: parsed.data.email },
  });
  res.json({ whatsapp: partner.notifyWhatsapp, email: partner.notifyEmail });
});

function serializePayoutMethod(method: { type: string; upiId: string | null; pan: string; accountNumber: string | null } | null) {
  if (!method) return { hasMethod: false as const };
  return {
    hasMethod: true as const,
    type: method.type,
    upiId: method.upiId ? maskUpi(method.upiId) : undefined,
    accountNumberMasked: method.accountNumber ? maskAccountNumber(method.accountNumber) : undefined,
    panMasked: maskPan(method.pan),
  };
}

/* ============================================================
   Dashboard
   ============================================================ */

partnersRouter.get("/me/dashboard", requirePartner, async (req, res) => {
  const partnerId = getPartnerId(req);
  const partner = await db.partner.findUnique({ where: { id: partnerId } });
  if (!partner) return apiError(res, 401, "UNAUTHENTICATED", "Log in to continue.");

  const [clicks, codeApplied, signups, checkoutsStarted, commissions, bonuses, payouts, payoutMethod] = await Promise.all([
    db.referralEvent.count({ where: { partnerId, type: "link_opened" } }),
    db.referralEvent.count({ where: { partnerId, type: "code_applied" } }),
    db.referral.count({ where: { partnerId, status: { not: "rejected" } } }),
    db.referralEvent.count({ where: { partnerId, type: "checkout_started" } }),
    db.commission.findMany({ where: { partnerId } }),
    db.bonus.findMany({ where: { partnerId } }),
    db.partnerPayout.findMany({ where: { partnerId } }),
    db.partnerPayoutMethod.findUnique({ where: { partnerId } }),
  ]);

  const onHold = sumBigint(commissions.filter((c) => c.status === "on_hold")) + sumBigint(bonuses.filter((b) => b.status === "on_hold"));
  const approved = sumBigint(commissions.filter((c) => c.status === "approved")) + sumBigint(bonuses.filter((b) => b.status === "approved"));
  const paid = sumBigint(commissions.filter((c) => c.status === "paid")) + sumBigint(bonuses.filter((b) => b.status === "paid"));
  const inProcess = sumBigint(payouts.filter((p) => p.status === "requested" || p.status === "processing"));
  const paidOut = sumBigint(payouts.filter((p) => p.status === "paid"));
  const available = approved - inProcess > 0n ? approved - inProcess : 0n;

  let payoutBlockedReason: string | null = null;
  if (!payoutMethod) payoutBlockedReason = "METHOD_MISSING";
  else if (!payoutMethod.pan) payoutBlockedReason = "PAN_REQUIRED";
  else if (available < PARTNER_PROGRAM.minPayoutPaise) payoutBlockedReason = "BELOW_MINIMUM";

  // Sprint: unconsumed, non-reversed commissions within 7 days of the oldest of them.
  const unconsumed = commissions.filter((c) => !c.bonusId && c.status !== "reversed").sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());
  let sprintCount = 0;
  let windowEndsAt: Date | null = null;
  if (unconsumed.length > 0) {
    const windowStart = unconsumed[0].paidAt;
    windowEndsAt = new Date(windowStart.getTime() + PARTNER_PROGRAM.bonus.withinDays * 86_400_000);
    sprintCount = unconsumed.filter((c) => c.paidAt <= windowEndsAt!).length;
  }

  const onHoldItems = [...commissions.filter((c) => c.status === "on_hold").map((c) => c.holdUntil), ...bonuses.filter((b) => b.status === "on_hold").map((b) => b.holdUntil)];
  const nextApprovalAt = onHoldItems.length > 0 ? new Date(Math.min(...onHoldItems.map((d) => d.getTime()))) : null;

  const referredAccountIds = (await db.referral.findMany({ where: { partnerId }, select: { accountId: true } })).map((r) => r.accountId);
  const referredOrders = referredAccountIds.length
    ? await db.order.findMany({ where: { userId: { in: referredAccountIds } }, select: { userId: true, status: true, totalPaise: true } })
    : [];
  const paidUserIds = new Set(referredOrders.filter((o) => o.status === "PAID").map((o) => o.userId));
  const completedOrders = referredOrders.filter((o) => o.status === "PAID");
  const abandonedOrders = referredOrders.filter((o) => (o.status === "EXPIRED" || o.status === "FAILED") && !paidUserIds.has(o.userId));

  const recentEvents = await db.referralEvent.findMany({ where: { partnerId }, orderBy: { createdAt: "desc" }, take: 6 });
  const accountIds = recentEvents.map((e) => e.accountId).filter((id): id is string => Boolean(id));
  const accounts = accountIds.length ? await db.user.findMany({ where: { id: { in: accountIds } }, select: { id: true, businessName: true, fullName: true } }) : [];
  const accountsById = new Map(accounts.map((a) => [a.id, a]));

  res.json({
    partner: { id: partner.id, name: partner.name, phone: partner.phone, email: partner.email, code: partner.code },
    usage: { clicks, codeApplied, signups, checkoutsStarted },
    balances: {
      onHold: Number(onHold),
      available: Number(available),
      inProcess: Number(inProcess),
      paidOut: Number(paidOut),
      lifetime: Number(onHold + approved + paid),
    },
    canRequestPayout: payoutBlockedReason === null,
    payoutBlockedReason,
    sprint: { count: sprintCount, target: PARTNER_PROGRAM.bonus.every, windowEndsAt, bonusesEarned: bonuses.length },
    nextApprovalAt,
    counts: {
      completed: completedOrders.length,
      abandoned: abandonedOrders.length,
      completedValue: completedOrders.reduce((a, o) => a + Number(o.totalPaise), 0),
      abandonedValue: abandonedOrders.reduce((a, o) => a + Number(o.totalPaise), 0),
    },
    payoutMethod: serializePayoutMethod(payoutMethod),
    notifications: { whatsapp: partner.notifyWhatsapp, email: partner.notifyEmail },
    recentActivity: recentEvents.map((e) => ({
      id: e.id,
      at: e.createdAt,
      event: e.type,
      source: e.source,
      businessMasked: e.accountId ? maskBusinessName(accountsById.get(e.accountId)?.businessName ?? accountsById.get(e.accountId)?.fullName ?? null) : null,
    })),
  });
});

/* ============================================================
   Lists — cursor-paginated
   ============================================================ */

partnersRouter.get("/me/activity", requirePartner, async (req, res) => {
  const partnerId = getPartnerId(req);
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
  const type = typeof req.query.type === "string" ? req.query.type : undefined;

  const events = await db.referralEvent.findMany({
    where: { partnerId, ...(type ? { type } : {}) },
    orderBy: { createdAt: "desc" },
    take: 21,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const nextCursor = events.length === 21 ? events[20].id : null;
  const page = events.slice(0, 20);
  const accountIds = page.map((e) => e.accountId).filter((id): id is string => Boolean(id));
  const accounts = accountIds.length ? await db.user.findMany({ where: { id: { in: accountIds } }, select: { id: true, businessName: true, fullName: true } }) : [];
  const accountsById = new Map(accounts.map((a) => [a.id, a]));

  res.json({
    items: page.map((e) => ({
      id: e.id,
      at: e.createdAt,
      event: e.type,
      source: e.source,
      businessMasked: e.accountId ? maskBusinessName(accountsById.get(e.accountId)?.businessName ?? accountsById.get(e.accountId)?.fullName ?? null) : null,
    })),
    nextCursor,
  });
});

partnersRouter.get("/me/checkouts", requirePartner, async (req, res) => {
  const partnerId = getPartnerId(req);
  const status = req.query.status === "abandoned" ? "abandoned" : "completed";
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

  const referrals = await db.referral.findMany({ where: { partnerId }, select: { accountId: true } });
  const accountIds = referrals.map((r) => r.accountId);
  if (accountIds.length === 0) return res.json({ items: [], nextCursor: null });

  if (status === "completed") {
    const orders = await db.order.findMany({
      where: { userId: { in: accountIds }, status: "PAID" },
      orderBy: { paidAt: "desc" },
      take: 21,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { plan: true, user: true, commission: true },
    });
    const nextCursor = orders.length === 21 ? orders[20].id : null;
    const page = orders.slice(0, 20);
    return res.json({
      items: page.map((o) => ({
        id: o.id,
        businessMasked: maskBusinessName(o.user.businessName ?? o.user.fullName),
        phoneMasked: o.user.phone ? maskPhoneE164(o.user.phone) : null,
        plan: o.plan.name,
        billing: o.termMonths === 1 ? "monthly" : "annual",
        amount: Number(o.totalPaise),
        paidAt: o.paidAt,
        commission: o.commission ? Number(o.commission.amount) : 0,
        status: o.commission?.status ?? "on_hold",
        holdUntil: o.commission?.holdUntil ?? null,
      })),
      nextCursor,
    });
  }

  const paidUserIds = new Set((await db.order.findMany({ where: { userId: { in: accountIds }, status: "PAID" }, select: { userId: true } })).map((o) => o.userId));
  const abandonedCandidates = await db.order.findMany({
    where: { userId: { in: accountIds.filter((id) => !paidUserIds.has(id)) }, status: { in: ["EXPIRED", "FAILED"] } },
    orderBy: { createdAt: "desc" },
    take: 21,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { plan: true, user: true },
  });
  const nextCursor = abandonedCandidates.length === 21 ? abandonedCandidates[20].id : null;
  const page = abandonedCandidates.slice(0, 20);
  res.json({
    items: page.map((o) => ({
      id: o.id,
      businessMasked: maskBusinessName(o.user.businessName ?? o.user.fullName),
      phoneMasked: o.user.phone ? maskPhoneE164(o.user.phone) : null,
      plan: o.plan.name,
      billing: o.termMonths === 1 ? "monthly" : "annual",
      amount: Number(o.totalPaise),
      startedAt: o.createdAt,
      stoppedAt: o.status === "FAILED" ? "payment_failed" : "payment_page",
      potentialCommission: Math.floor(Number(o.totalPaise) * PARTNER_PROGRAM.commissionRate),
    })),
    nextCursor,
  });
});

partnersRouter.get("/me/payouts", requirePartner, async (req, res) => {
  const partnerId = getPartnerId(req);
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
  const payouts = await db.partnerPayout.findMany({
    where: { partnerId },
    orderBy: { requestedAt: "desc" },
    take: 21,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const nextCursor = payouts.length === 21 ? payouts[20].id : null;
  const page = payouts.slice(0, 20);
  res.json({
    items: page.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      method: (p.methodSnapshot as { type?: string })?.type === "bank" ? "Bank" : "UPI",
      status: p.status,
      requestedAt: p.requestedAt,
      paidAt: p.paidAt,
      reference: p.reference,
      tdsDeducted: Number(p.tdsAmount),
      netAmount: Number(p.netAmount),
    })),
    nextCursor,
  });
});

partnersRouter.get("/me/bonuses", requirePartner, async (req, res) => {
  const partnerId = getPartnerId(req);
  const bonuses = await db.bonus.findMany({
    where: { partnerId },
    orderBy: { earnedAt: "desc" },
    include: { commissions: { select: { id: true } } },
  });
  res.json({
    items: bonuses.map((b) => ({ id: b.id, amount: Number(b.amount), earnedAt: b.earnedAt, status: b.status, checkoutIds: b.commissions.map((c) => c.id) })),
  });
});

/* ============================================================
   Payouts
   ============================================================ */

const requestPayoutSchema = z.object({ amount: z.number().int().positive() });

partnersRouter.post("/me/payouts", requirePartner, async (req, res) => {
  const parsed = requestPayoutSchema.safeParse(req.body);
  if (!parsed.success) return apiError(res, 422, "VALIDATION_FAILED", "Enter an amount in paise.");
  const partnerId = getPartnerId(req);
  const amount = BigInt(parsed.data.amount);
  const idempotencyKey = (req.header("Idempotency-Key") || undefined) as string | undefined;

  if (idempotencyKey) {
    const existing = await db.partnerPayout.findUnique({ where: { idempotencyKey } });
    if (existing) return res.status(201).json(serializePayoutRow(existing));
  }

  const method = await db.partnerPayoutMethod.findUnique({ where: { partnerId } });
  if (!method) return apiError(res, 422, "PAYOUT_METHOD_MISSING", "Add a payout method before requesting a withdrawal.");
  if (!method.pan) return apiError(res, 422, "PAN_REQUIRED", "Add your PAN before requesting a withdrawal.");
  if (amount < PARTNER_PROGRAM.minPayoutPaise) {
    return apiError(res, 422, "PAYOUT_BELOW_MINIMUM", `Minimum payout is ₹${Number(PARTNER_PROGRAM.minPayoutPaise) / 100}.`);
  }

  const result = await db.$transaction(async (tx) => {
    const [commissions, bonuses, payouts] = await Promise.all([
      tx.commission.findMany({ where: { partnerId, status: "approved" } }),
      tx.bonus.findMany({ where: { partnerId, status: "approved" } }),
      tx.partnerPayout.findMany({ where: { partnerId, status: { in: ["requested", "processing"] } } }),
    ]);
    const approved = sumBigint(commissions) + sumBigint(bonuses);
    const inProcess = sumBigint(payouts);
    const available = approved - inProcess > 0n ? approved - inProcess : 0n;
    if (amount > available) return { error: "PAYOUT_EXCEEDS_BALANCE", payout: null };

    const tdsAmount = 0n; // TODO(partners.md §12.8): confirm 194H TDS rate with a CA before real payouts
    const payout = await tx.partnerPayout.create({
      data: {
        partnerId,
        amount,
        tdsAmount,
        netAmount: amount - tdsAmount,
        methodSnapshot: { type: method.type, upiId: method.upiId ? maskUpi(method.upiId) : undefined, accountNumberMasked: method.accountNumber ? maskAccountNumber(method.accountNumber) : undefined },
        status: "requested",
        idempotencyKey,
      },
    });
    return { error: null, payout };
  });

  if (result.error || !result.payout) return apiError(res, 422, result.error ?? "PAYOUT_EXCEEDS_BALANCE", "That's more than your available balance.");
  const partner = await db.partner.findUniqueOrThrow({ where: { id: partnerId } });
  notifyPartner(partner.phone, "payout_requested", `₹${Number(result.payout.amount) / 100} payout requested. SLA is 7 working days.`);
  res.status(201).json(serializePayoutRow(result.payout));
});

function serializePayoutRow(p: { id: string; amount: bigint; status: string; requestedAt: Date; paidAt: Date | null; reference: string | null; tdsAmount: bigint; netAmount: bigint; methodSnapshot: unknown }) {
  return {
    id: p.id,
    amount: Number(p.amount),
    status: p.status,
    requestedAt: p.requestedAt,
    paidAt: p.paidAt,
    reference: p.reference,
    tdsDeducted: Number(p.tdsAmount),
    netAmount: Number(p.netAmount),
    method: (p.methodSnapshot as { type?: string })?.type === "bank" ? "Bank" : "UPI",
  };
}
