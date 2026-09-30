import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db.js";
import { requireSuperAdmin } from "../lib/adminSession.js";

export const adminRouter = Router();

adminRouter.get("/orders", requireSuperAdmin, async (_req, res) => {
  const orders = await db.order.findMany({
    include: { user: true, plan: true, entitlement: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json({
    orders: orders.map((o) => ({
      id: o.id,
      email: o.user.email,
      planName: o.plan.name,
      termMonths: o.termMonths,
      totalPaise: Number(o.totalPaise),
      status: o.status,
      isEarlyBird: o.isEarlyBird,
      hasEntitlement: Boolean(o.entitlement),
      crmTenantId: o.entitlement?.crmTenantId ?? null,
      createdAt: o.createdAt.toISOString(),
    })),
  });
});

const provisionSchema = z.object({ crmTenantId: z.string().min(1) });

adminRouter.post("/provision/:entitlementId", requireSuperAdmin, async (req, res) => {
  const parsed = provisionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input" });
    return;
  }
  const entitlement = await db.entitlement.update({
    where: { id: String(req.params.entitlementId) },
    data: { crmTenantId: parsed.data.crmTenantId, provisionedAt: new Date() },
  });
  await db.auditLog.create({
    data: {
      actor: "admin:superadmin",
      action: "provision_tenant",
      subject: entitlement.id,
      meta: { crmTenantId: parsed.data.crmTenantId },
    },
  });
  res.json({ ok: true });
});

const launchConfigSchema = z.object({
  launchAt: z.string().datetime().optional(),
  earlyBirdEndsAt: z.string().datetime().optional(),
  earlyBirdSeatCap: z.number().nullable().optional(),
  earlyBirdForceClose: z.boolean().optional(),
  checkoutEnabled: z.boolean().optional(),
});

adminRouter.post("/launch-config", requireSuperAdmin, async (req, res) => {
  const parsed = launchConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input" });
    return;
  }
  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.launchAt) data.launchAt = new Date(parsed.data.launchAt);
  if (parsed.data.earlyBirdEndsAt) data.earlyBirdEndsAt = new Date(parsed.data.earlyBirdEndsAt);

  const cfg = await db.launchConfig.update({ where: { id: 1 }, data });

  // Launch date moved — every PENDING_LAUNCH entitlement's access_starts_at
  // moves with it, so nobody loses a day they paid for.
  if (parsed.data.launchAt) {
    const pending = await db.entitlement.findMany({ where: { status: "PENDING_LAUNCH" } });
    for (const ent of pending) {
      const newStart = cfg.launchAt;
      const newEnd = new Date(newStart);
      newEnd.setUTCMonth(newEnd.getUTCMonth() + ent.termMonths);
      await db.entitlement.update({
        where: { id: ent.id },
        data: { accessStartsAt: newStart, accessEndsAt: newEnd },
      });
    }
  }

  await db.auditLog.create({
    data: { actor: "admin:superadmin", action: "update_launch_config", meta: parsed.data },
  });

  res.json({ ok: true });
});
