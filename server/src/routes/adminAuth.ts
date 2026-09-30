import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db.js";
import { rateLimit } from "../lib/rateLimit.js";
import {
  verifySuperadminCredentials,
  issueAdminSession,
  clearAdminSession,
  readAdminSession,
  requireSuperAdmin,
} from "../lib/adminSession.js";

export const adminAuthRouter = Router();

const loginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });

adminAuthRouter.post("/login", async (req, res) => {
  const ip = req.ip ?? "unknown";
  if (!rateLimit(`admin-login:${ip}`, 10, 15 * 60_000)) {
    res.status(429).json({ error: "rate_limited" });
    return;
  }

  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input" });
    return;
  }

  if (!verifySuperadminCredentials(parsed.data.username, parsed.data.password)) {
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }

  await issueAdminSession(res);
  res.json({ ok: true });
});

adminAuthRouter.post("/logout", (_req, res) => {
  clearAdminSession(res);
  res.json({ ok: true });
});

adminAuthRouter.get("/me", async (req, res) => {
  const ok = await readAdminSession(req);
  if (!ok) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }
  res.json({ ok: true, username: "admin" });
});

// ---- Monitoring: users --------------------------------------------------

adminAuthRouter.get("/users", requireSuperAdmin, async (_req, res) => {
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { entitlements: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  res.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      phone: u.phone,
      fullName: u.fullName,
      businessName: u.businessName,
      businessCity: u.businessCity,
      onboardingStep: u.onboardingStep,
      plan: u.entitlements[0]?.planCode ?? null,
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    })),
  });
});

adminAuthRouter.get("/waitlist", requireSuperAdmin, async (_req, res) => {
  const rows = await db.waitlist.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  res.json({
    waitlist: rows.map((w) => ({
      id: w.id,
      email: w.email,
      source: w.source,
      planIntent: w.planIntent,
      createdAt: w.createdAt.toISOString(),
    })),
  });
});

// ---- Monitoring: transactions (actual gateway payments, not just orders) --

adminAuthRouter.get("/transactions", requireSuperAdmin, async (_req, res) => {
  const payments = await db.payment.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { order: { include: { user: true, plan: true } } },
  });

  res.json({
    transactions: payments.map((p) => ({
      id: p.id,
      cfPaymentId: p.cfPaymentId,
      status: p.status,
      method: p.method,
      amountPaise: Number(p.amountPaise),
      bankRef: p.bankRef,
      createdAt: p.createdAt.toISOString(),
      orderId: p.orderId,
      planName: p.order.plan.name,
      termMonths: p.order.termMonths,
      userPhone: p.order.user.phone,
      userEmail: p.order.user.email,
    })),
  });
});

adminAuthRouter.get("/stats", requireSuperAdmin, async (_req, res) => {
  const [totalUsers, paidOrders, pendingOrders, waitlistCount] = await Promise.all([
    db.user.count(),
    db.order.count({ where: { status: "PAID" } }),
    db.order.count({ where: { status: { in: ["CREATED", "PENDING"] } } }),
    db.waitlist.count(),
  ]);
  res.json({ totalUsers, paidOrders, pendingOrders, waitlistCount });
});
