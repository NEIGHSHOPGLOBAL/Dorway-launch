import { Router } from "express";
import { db } from "../lib/db.js";
import { requireAuth, type SessionPayload } from "../lib/session.js";

export const accountRouter = Router();

accountRouter.get("/entitlement", requireAuth, async (req, res) => {
  const session = (req as any).session as SessionPayload;
  const entitlement = await db.entitlement.findFirst({
    where: { userId: session.sub, status: { in: ["PENDING_LAUNCH", "ACTIVE"] } },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
  if (!entitlement) {
    res.json({ entitlement: null });
    return;
  }
  res.json({
    entitlement: {
      planCode: entitlement.planCode,
      planName: entitlement.plan.name,
      ratePaiseMonth: Number(entitlement.ratePaiseMonth),
      termMonths: entitlement.termMonths,
      accessStartsAt: entitlement.accessStartsAt.toISOString(),
      accessEndsAt: entitlement.accessEndsAt.toISOString(),
      status: entitlement.status,
    },
  });
});

accountRouter.get("/orders", requireAuth, async (req, res) => {
  const session = (req as any).session as SessionPayload;
  const orders = await db.order.findMany({
    where: { userId: session.sub },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({
    orders: orders.map((o) => ({
      id: o.id,
      planName: o.plan.name,
      termMonths: o.termMonths,
      totalPaise: Number(o.totalPaise),
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    })),
  });
});
