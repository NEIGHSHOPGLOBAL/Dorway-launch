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
// superadmin.md §11 GET /users lives in routes/adminOnboarding.ts now — it
// needs filters, cursor pagination and masking this simple version didn't have.

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

// superadmin.md §6.3 GET /payments lives in routes/adminPurchases.ts now.

adminAuthRouter.get("/stats", requireSuperAdmin, async (_req, res) => {
  const [totalUsers, paidOrders, pendingOrders, waitlistCount] = await Promise.all([
    db.user.count(),
    db.order.count({ where: { status: "PAID" } }),
    db.order.count({ where: { status: { in: ["CREATED", "PENDING"] } } }),
    db.waitlist.count(),
  ]);
  res.json({ totalUsers, paidOrders, pendingOrders, waitlistCount });
});
