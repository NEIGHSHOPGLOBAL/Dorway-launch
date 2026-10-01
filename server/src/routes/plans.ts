import { Router } from "express";
import { db } from "../lib/db.js";
import { config } from "../lib/config.js";
import { computeTermPricing, TERM_BADGES, type TermPricing, type TermMonths } from "../lib/pricing.js";

export const plansRouter = Router();

function serializePlan(plan: Awaited<ReturnType<typeof db.plan.findMany>>[number], pricing: TermPricing) {
  return {
    code: plan.code,
    name: plan.name,
    normalPaiseMonth: Number(plan.normalPaiseMonth),
    ratePaiseMonth: Number(pricing.monthlyRatePaise),
    discountPercent: pricing.discountPercent,
    seatCap: plan.seatCap,
    numberCap: plan.numberCap,
    features: plan.features,
    sortOrder: plan.sortOrder,
  };
}

function serializeTerm(termMonths: TermMonths, pricing: TermPricing, gstPaise: bigint) {
  return {
    termMonths,
    discountPercent: pricing.discountPercent,
    monthlyRatePaise: Number(pricing.monthlyRatePaise),
    subtotalPaise: Number(pricing.subtotalPaise),
    savingsPaise: Number(pricing.savingsPaise),
    gstPaise: Number(gstPaise),
    totalPaise: Number(pricing.subtotalPaise + gstPaise),
    badge: TERM_BADGES[termMonths],
  };
}

// userchanges.md P-2 — the UI never does pricing maths; everything it needs
// (per-term totals, GST, savings, the launch access-start date) comes from here.
plansRouter.get("/", async (req, res) => {
  const requestedTerm = Number(req.query.termMonths);
  const termMonths: TermMonths = requestedTerm === 1 || requestedTerm === 6 ? requestedTerm : 12;

  const [plans, cfg] = await Promise.all([
    db.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.launchConfig.findUnique({ where: { id: 1 } }),
  ]);

  if (!cfg || plans.length === 0) {
    res.status(500).json({ error: "launch_config_missing" });
    return;
  }

  const gstPercent = Number(cfg.gstPercent);
  const primaryPlan = plans[0];

  const terms: TermMonths[] = [1, 6, 12];
  const termRows = terms.map((t) => {
    const pricing = computeTermPricing(primaryPlan.normalPaiseMonth, t);
    // §1.2: gstPaise here assumes the default supplier state (intra-state
    // CGST+SGST split); the checkout quote recalculates CGST/SGST vs IGST
    // for the customer's actual state — the total GST amount is the same.
    const gstPaise = BigInt(Math.round((Number(pricing.subtotalPaise) * gstPercent) / 100));
    return serializeTerm(t, pricing, gstPaise);
  });

  const selectedPricing = computeTermPricing(primaryPlan.normalPaiseMonth, termMonths);

  res.json({
    gstPercent,
    terms: termRows,
    plans: plans.map((p) => serializePlan(p, p.code === primaryPlan.code ? selectedPricing : computeTermPricing(p.normalPaiseMonth, termMonths))),
    accessStartsAt: cfg.launchAt.toISOString(),
  });
});

export const launchStateRouter = Router();

launchStateRouter.get("/", async (_req, res) => {
  const cfg = await db.launchConfig.findUnique({ where: { id: 1 } });
  if (!cfg) {
    res.status(500).json({ error: "launch_config_missing" });
    return;
  }
  const now = new Date();

  const graceEndsAt = new Date(cfg.launchAt.getTime() + 48 * 60 * 60_000);
  let phase: "PRE_LAUNCH" | "LAUNCH_DAY" | "LIVE" = "PRE_LAUNCH";
  if (now >= cfg.launchAt && now < graceEndsAt) phase = "LAUNCH_DAY";
  else if (now >= graceEndsAt) phase = "LIVE";

  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=30");
  res.json({
    serverTime: now.toISOString(),
    launchAt: cfg.launchAt.toISOString(),
    checkoutEnabled: cfg.checkoutEnabled,
    cashfreeConfigured: config.cashfree.isConfigured,
    cashfreeMode: config.cashfree.env,
    phase,
  });
});
