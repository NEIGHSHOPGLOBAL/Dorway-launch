import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "../lib/db.js";
import { config } from "../lib/config.js";
import { sendOtpEmail } from "../lib/email.js";
import { sendOtpWhatsApp, normalizePhone } from "../lib/whatsapp.js";
import { rateLimit } from "../lib/rateLimit.js";
import { issueSession, clearSession, readSession } from "../lib/session.js";

export const authRouter = Router();

function genCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

authRouter.get("/otp-channels", (_req, res) => {
  res.json({ email: true, whatsapp: config.whatsapp.otpEnabled && config.whatsapp.isConfigured });
});

const requestOtpSchema = z.union([
  z.object({ email: z.string().email() }),
  z.object({ phone: z.string().min(6) }),
]);

authRouter.post("/request-otp", async (req, res) => {
  const parsed = requestOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input" });
    return;
  }

  const ip = req.ip ?? "unknown";
  const code = genCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + config.otpExpiryMinutes * 60_000);

  if ("email" in parsed.data) {
    const email = parsed.data.email.toLowerCase();
    if (!rateLimit(`otp:email:${email}`, 3, 15 * 60_000) || !rateLimit(`otp:ip:${ip}`, 10, 60 * 60_000)) {
      // Always 200 regardless — never let this endpoint be an enumeration/limit oracle.
      res.status(200).json({ ok: true });
      return;
    }
    await db.loginOtp.create({ data: { email, channel: "email", codeHash, expiresAt } });
    await sendOtpEmail(email, code);
    res.status(200).json({ ok: true, channel: "email" });
    return;
  }

  // WhatsApp channel
  if (!config.whatsapp.otpEnabled || !config.whatsapp.isConfigured) {
    res.status(503).json({ error: "whatsapp_otp_disabled" });
    return;
  }
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    res.status(400).json({ error: "invalid_phone" });
    return;
  }
  if (!rateLimit(`otp:phone:${phone}`, 3, 15 * 60_000) || !rateLimit(`otp:ip:${ip}`, 10, 60 * 60_000)) {
    res.status(200).json({ ok: true });
    return;
  }

  await db.loginOtp.create({ data: { phone, channel: "whatsapp", codeHash, expiresAt } });

  try {
    await sendOtpWhatsApp(phone, code);
  } catch (err) {
    console.error("WhatsApp OTP send failed:", err);
    res.status(502).json({ error: "whatsapp_send_failed" });
    return;
  }

  res.status(200).json({ ok: true, channel: "whatsapp" });
});

const verifyOtpSchema = z.union([
  z.object({ email: z.string().email(), code: z.string().length(6) }),
  z.object({ phone: z.string().min(6), code: z.string().length(6) }),
]);

authRouter.post("/verify-otp", async (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input" });
    return;
  }

  const data = parsed.data;
  let isEmail: boolean;
  let email: string | null = null;
  let phone: string | null = null;
  if ("email" in data) {
    isEmail = true;
    email = data.email.toLowerCase();
  } else {
    isEmail = false;
    phone = normalizePhone(data.phone);
    if (!phone) {
      res.status(400).json({ error: "invalid_phone" });
      return;
    }
  }

  const otp = await db.loginOtp.findFirst({
    where: isEmail
      ? { email, channel: "email", consumedAt: null, expiresAt: { gt: new Date() } }
      : { phone, channel: "whatsapp", consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    res.status(400).json({ error: "expired_or_missing" });
    return;
  }
  if (otp.attempts >= 5) {
    await db.loginOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    res.status(400).json({ error: "too_many_attempts" });
    return;
  }

  const ok = await bcrypt.compare(parsed.data.code, otp.codeHash);
  if (!ok) {
    await db.loginOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    res.status(400).json({ error: "wrong_code" });
    return;
  }

  await db.loginOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

  const user = isEmail
    ? await db.user.upsert({
        where: { email: email! },
        update: { emailVerified: true, lastLoginAt: new Date() },
        create: { email, emailVerified: true, lastLoginAt: new Date() },
      })
    : await db.user.upsert({
        where: { phone: phone! },
        update: { phoneVerified: true, lastLoginAt: new Date() },
        create: { phone, phoneVerified: true, lastLoginAt: new Date() },
      });

  await issueSession(res, { sub: user.id, email: user.email });
  res.status(200).json({ ok: true, user: { id: user.id, email: user.email, phone: user.phone } });
});

authRouter.post("/logout", (_req, res) => {
  clearSession(res);
  res.status(200).json({ ok: true });
});

authRouter.get("/me", async (req, res) => {
  const session = await readSession(req);
  if (!session) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }
  const user = await db.user.findUnique({ where: { id: session.sub } });
  if (!user) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    phone: user.phone,
    fullName: user.fullName,
    businessName: user.businessName,
    businessCity: user.businessCity,
    gstin: user.gstin,
  });
});

const updateProfileSchema = z.object({
  fullName: z.string().min(1).optional(),
  businessName: z.string().min(1).optional(),
  businessCity: z.string().min(1).optional(),
  gstin: z.string().optional(),
  phone: z.string().optional(),
});

authRouter.patch("/me", async (req, res) => {
  const session = await readSession(req);
  if (!session) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input" });
    return;
  }
  const user = await db.user.update({ where: { id: session.sub }, data: parsed.data });
  res.json({ ok: true, user: { id: user.id, email: user.email } });
});
