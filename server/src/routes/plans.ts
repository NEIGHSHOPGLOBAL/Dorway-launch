import { Router } from "express";
import { db } from "../lib/db.js";
import { config } from "../lib/config.js";
import { isEarlyBirdOpen, effectiveRatePaise } from "../lib/pricing.js";

export const plansRouter = Router();

function serializePlan(plan: Awaited<ReturnType<typeof db.plan.findMany>>[number], termMonths: number, early: boolean) {
  const rate = effectiveRatePaise(plan, termMonths, early);
  return {
    code: plan.code,
    name: plan.name,
    normalPaiseMonth: Number(plan.normalPaiseMonth),
    earlyPaiseMonth: Number(plan.earlyPaiseMonth),
    ratePaiseMonth: Number(rate),
    isEarlyBirdRate: rate === plan.earlyPaiseMonth,
    seatCap: plan.seatCap,
    numberCap: plan.numberCap,
    features: plan.features,
    sortOrder: plan.sortOrder,
  };
}

plansRouter.get("/", async (req, res) => {
  const termMonths = [1, 6, 12].includes(Number(req.query.termMonths)) ? Number(req.query.termMonths) : 12;

  const [plans, cfg] = await Promise.all([
    db.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.launchConfig.findUnique({ where: { id: 1 } }),
  ]);

  if (!cfg) {
    res.status(500).json({ error: "launch_config_missing" });
    return;
  }

  const sold = await db.order.count({ where: { isEarlyBird: true, status: "PAID" } });
  const early = isEarlyBirdOpen(new Date(), cfg, sold);

  res.json({
    earlyBirdOpen: early,
    gstPercent: Number(cfg.gstPercent),
    plans: plans.map((p) => serializePlan(p, termMonths, early)),
  });
});

export const launchStateRouter = Router();

launchStateRouter.get("/", async (_req, res) => {
  const cfg = await db.launchConfig.findUnique({ where: { id: 1 } });
  if (!cfg) {
    res.status(500).json({ error: "launch_config_missing" });
    return;
  }
  const sold = await db.order.count({ where: { isEarlyBird: true, status: "PAID" } });
  const now = new Date();
  const early = isEarlyBirdOpen(now, cfg, sold);

  const graceEndsAt = new Date(cfg.launchAt.getTime() + 48 * 60 * 60_000);
  let phase: "PRE_LAUNCH" | "LAUNCH_DAY" | "LIVE" = "PRE_LAUNCH";
  if (now >= cfg.launchAt && now < graceEndsAt) phase = "LAUNCH_DAY";
  else if (now >= graceEndsAt) phase = "LIVE";

  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=30");
  res.json({
    serverTime: now.toISOString(),
    launchAt: cfg.launchAt.toISOString(),
    earlyBirdEndsAt: cfg.earlyBirdEndsAt.toISOString(),
    earlyBirdOpen: early,
    earlyBirdRemaining: cfg.earlyBirdSeatCap === null ? null : Math.max(0, cfg.earlyBirdSeatCap - sold),
    checkoutEnabled: cfg.checkoutEnabled,
    cashfreeConfigured: config.cashfree.isConfigured,
    cashfreeMode: config.cashfree.env,
    phase,
  });
});
