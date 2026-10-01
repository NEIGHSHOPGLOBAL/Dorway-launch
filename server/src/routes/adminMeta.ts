import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db.js";
import { requireSuperAdmin } from "../lib/adminSession.js";
import { revealField, maskBusinessName, maskPhone } from "../lib/adminMask.js";
import { PARTNER_PROGRAM } from "../lib/partnerProgram.js";

export const adminMetaRouter = Router();
adminMetaRouter.use(requireSuperAdmin);

/* ============================================================
   Audit log
   ============================================================ */

adminMetaRouter.get("/audit-log", async (req, res) => {
  const q = req.query as Record<string, unknown>;
  const cursor = typeof q.cursor === "string" ? q.cursor : undefined;
  const where: Record<string, unknown> = {};
  if (typeof q.adminId === "string") where.actor = q.adminId;
  if (typeof q.action === "string") where.action = q.action;
  if (typeof q.entityType === "string") where.entityType = q.entityType;
  if (q.from || q.to) {
    where.createdAt = { gte: q.from ? new Date(String(q.from)) : undefined, lt: q.to ? new Date(String(q.to)) : undefined };
  }

  const rows = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const nextCursor = rows.length === 51 ? rows[50].id : null;
  res.json({
    items: rows.slice(0, 50).map((r) => ({
      id: r.id, actor: r.actor, action: r.action, entityType: r.entityType, entityId: r.subject,
      reason: r.reason, before: r.before, after: r.after, ip: r.ip, userAgent: r.userAgent, createdAt: r.createdAt,
    })),
    nextCursor,
  });
});

/* ============================================================
   Global search — superadmin.md §3
   ============================================================ */

adminMetaRouter.get("/search", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (query.length < 2) return res.json({ users: [], checkouts: [], partners: [], payouts: [] });

  const [users, partners, orders, payouts] = await Promise.all([
    db.user.findMany({
      where: { OR: [{ phone: { contains: query } }, { email: { contains: query, mode: "insensitive" } }, { businessName: { contains: query, mode: "insensitive" } }] },
      take: 5,
    }),
    db.partner.findMany({
      where: { OR: [{ code: { contains: query, mode: "insensitive" } }, { phone: { contains: query } }, { name: { contains: query, mode: "insensitive" } }] },
      take: 5,
    }),
    db.order.findMany({ where: { id: { contains: query } }, take: 5, include: { user: true } }),
    db.partnerPayout.findMany({ where: { OR: [{ id: { contains: query } }, { reference: { contains: query, mode: "insensitive" } }] }, take: 5, include: { partner: true } }),
  ]);

  res.json({
    users: users.map((u) => ({ id: u.id, label: maskBusinessName(u.businessName ?? u.fullName), sub: maskPhone(u.phone) })),
    partners: partners.map((p) => ({ id: p.id, label: p.name, sub: p.code })),
    checkouts: orders.map((o) => ({ id: o.id, label: maskBusinessName(o.user.businessName ?? o.user.fullName), sub: `₹${(Number(o.totalPaise) / 100).toFixed(0)} · ${o.status}` })),
    payouts: payouts.map((p) => ({ id: p.id, label: p.partner.name, sub: p.reference ?? p.status })),
  });
});

/* ============================================================
   Settings (read-only)
   ============================================================ */

adminMetaRouter.get("/settings/program-config", async (_req, res) => {
  res.json({
    version: "2026-10-01",
    commissionRate: PARTNER_PROGRAM.commissionRate,
    bonus: PARTNER_PROGRAM.bonus,
    minPayoutPaise: PARTNER_PROGRAM.minPayoutPaise,
    holdDays: PARTNER_PROGRAM.holdDays,
    attributionDays: PARTNER_PROGRAM.attributionDays,
    note: "Changes happen in code/config deploys, not from this screen (superadmin.md §9).",
  });
});

/* ============================================================
   PII reveal
   ============================================================ */

const revealSchema = z.object({ entityType: z.string().min(1), entityId: z.string().min(1), field: z.string().min(1) });

adminMetaRouter.post("/pii/reveal", async (req, res) => {
  const parsed = revealSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: { code: "VALIDATION_FAILED", message: "entityType, entityId and field are required." } });
  const value = await revealField(req, parsed.data.entityType, parsed.data.entityId, parsed.data.field);
  if (value === null) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Nothing to reveal for that field." } });
  res.json({ value });
});
