import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db.js";
import { requireSuperAdmin } from "../lib/adminSession.js";
import { writeAudit } from "../lib/adminAudit.js";
import { maskPhone, maskBusinessName } from "../lib/adminMask.js";
import { parseRange, istDateKey } from "../lib/adminTime.js";

export const adminOnboardingRouter = Router();
adminOnboardingRouter.use(requireSuperAdmin);

// superadmin.md §5.1 — the real product's OnboardingStep enum, not the doc's
// hypothetical 6-step list (see §13 Q1, unresolved). PAYING/PROVISIONED/ACTIVE
// are defined but never actually assigned anywhere in the app today, so
// they'll simply read 0 until that changes — that's accurate, not a bug.
const STEP_ORDER = ["IDENTIFIED", "PROFILED", "PLAN_SELECTED", "PAYING", "PAID", "SETUP_STARTED", "SETUP_SUBMITTED", "PROVISIONED", "ACTIVE"] as const;
const STEP_LABEL: Record<string, string> = {
  IDENTIFIED: "Signed up",
  PROFILED: "Workspace created",
  PLAN_SELECTED: "Plan selected",
  PAYING: "Paying",
  PAID: "Purchased",
  SETUP_STARTED: "Setup started",
  SETUP_SUBMITTED: "Setup submitted",
  PROVISIONED: "Provisioned",
  ACTIVE: "Active",
};

function includeTestFlag(query: Record<string, unknown>): boolean {
  return query.includeTest === "true" || query.includeTest === "1";
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function sourceLabel(u: { source: string | null; referral?: { partnerId: string } | null }): string {
  if (u.referral) return "Partner referral";
  if (u.source === "utm") return "UTM";
  return "Direct";
}

/* ============================================================
   Funnel
   ============================================================ */

adminOnboardingRouter.get("/metrics/onboarding/funnel", async (req, res) => {
  const range = parseRange(req.query as Record<string, unknown>);
  const includeTest = includeTestFlag(req.query as Record<string, unknown>);
  const breakdown = typeof req.query.breakdown === "string" ? req.query.breakdown : null; // "source" | "device" | "cohort_week"

  const cohort = await db.user.findMany({
    where: { createdAt: { gte: range.from, lt: range.to }, ...(includeTest ? {} : { isTest: false }) },
    select: { id: true, source: true, device: true, createdAt: true, referral: { select: { partnerId: true } } },
  });
  const userIds = cohort.map((u) => u.id);
  const events = userIds.length
    ? await db.onboardingEvent.findMany({ where: { userId: { in: userIds } }, select: { userId: true, step: true, createdAt: true } })
    : [];
  const eventsByUser = new Map<string, Map<string, Date>>();
  for (const e of events) {
    if (!eventsByUser.has(e.userId)) eventsByUser.set(e.userId, new Map());
    eventsByUser.get(e.userId)!.set(e.step, e.createdAt);
  }

  function computeSteps(users: typeof cohort) {
    const total = users.length;
    return STEP_ORDER.map((step, i) => {
      const reached = users.filter((u) => eventsByUser.get(u.id)?.has(step)).length;
      const prevStep = i > 0 ? STEP_ORDER[i - 1] : null;
      const prevReached = prevStep ? users.filter((u) => eventsByUser.get(u.id)?.has(prevStep)).length : total;
      return {
        step,
        label: STEP_LABEL[step],
        count: reached,
        conversionFromPrevious: prevReached === 0 ? 0 : (reached / prevReached) * 100,
        conversionFromStart: total === 0 ? 0 : (reached / total) * 100,
      };
    });
  }

  const medianTimes: { from: string; to: string; medianHours: number | null }[] = [];
  for (let i = 0; i < STEP_ORDER.length - 1; i++) {
    const a = STEP_ORDER[i];
    const b = STEP_ORDER[i + 1];
    const diffs: number[] = [];
    for (const u of cohort) {
      const ea = eventsByUser.get(u.id)?.get(a);
      const eb = eventsByUser.get(u.id)?.get(b);
      if (ea && eb && eb >= ea) diffs.push((eb.getTime() - ea.getTime()) / 3_600_000);
    }
    medianTimes.push({ from: a, to: b, medianHours: median(diffs) });
  }

  let breakdownGroups: { group: string; steps: ReturnType<typeof computeSteps> }[] | null = null;
  if (breakdown === "source") {
    const groups = new Map<string, typeof cohort>();
    for (const u of cohort) {
      const key = sourceLabel(u);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(u);
    }
    breakdownGroups = [...groups.entries()].map(([group, users]) => ({ group, steps: computeSteps(users) }));
  } else if (breakdown === "device") {
    const groups = new Map<string, typeof cohort>();
    for (const u of cohort) {
      const key = u.device ?? "Unknown";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(u);
    }
    breakdownGroups = [...groups.entries()].map(([group, users]) => ({ group, steps: computeSteps(users) }));
  } else if (breakdown === "cohort_week") {
    const groups = new Map<string, typeof cohort>();
    for (const u of cohort) {
      const weekStart = new Date(u.createdAt);
      weekStart.setUTCHours(0, 0, 0, 0);
      weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
      const key = istDateKey(weekStart);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(u);
    }
    breakdownGroups = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([group, users]) => ({ group, steps: computeSteps(users) }));
  }

  res.json({ steps: computeSteps(cohort), medianTimes, breakdown: breakdownGroups });
});

/* ============================================================
   Cohorts table
   ============================================================ */

adminOnboardingRouter.get("/metrics/onboarding/cohorts", async (req, res) => {
  const range = parseRange(req.query as Record<string, unknown>);
  const includeTest = includeTestFlag(req.query as Record<string, unknown>);

  const users = await db.user.findMany({
    where: { createdAt: { gte: range.from, lt: range.to }, ...(includeTest ? {} : { isTest: false }) },
    select: { id: true, createdAt: true },
  });
  const userIds = users.map((u) => u.id);
  const events = userIds.length
    ? await db.onboardingEvent.findMany({ where: { userId: { in: userIds } }, select: { userId: true, step: true, createdAt: true } })
    : [];
  const eventsByUser = new Map<string, { step: string; createdAt: Date }[]>();
  for (const e of events) {
    if (!eventsByUser.has(e.userId)) eventsByUser.set(e.userId, []);
    eventsByUser.get(e.userId)!.push(e);
  }

  const weeks = new Map<string, typeof users>();
  for (const u of users) {
    const weekStart = new Date(u.createdAt);
    weekStart.setUTCHours(0, 0, 0, 0);
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
    const key = istDateKey(weekStart);
    if (!weeks.has(key)) weeks.set(key, []);
    weeks.get(key)!.push(u);
  }

  const trackedSteps = ["PROFILED", "PLAN_SELECTED", "PAID", "SETUP_SUBMITTED"] as const;
  const windows = [1, 7, 30];

  const rows = [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([week, cohortUsers]) => {
    const cells: Record<string, number> = {};
    for (const step of trackedSteps) {
      for (const w of windows) {
        const reached = cohortUsers.filter((u) => {
          const ev = eventsByUser.get(u.id)?.find((e) => e.step === step);
          return ev && ev.createdAt.getTime() - u.createdAt.getTime() <= w * 86_400_000;
        }).length;
        cells[`${step}_d${w}`] = cohortUsers.length === 0 ? 0 : (reached / cohortUsers.length) * 100;
      }
    }
    return { week, size: cohortUsers.length, cells };
  });

  res.json({ steps: trackedSteps, windows, rows });
});

/* ============================================================
   Users list + detail
   ============================================================ */

adminOnboardingRouter.get("/users", async (req, res) => {
  const q = req.query as Record<string, unknown>;
  const includeTest = includeTestFlag(q);
  const cursor = typeof q.cursor === "string" ? q.cursor : undefined;
  const step = typeof q.step === "string" ? q.step : undefined;
  const purchased = q.purchased === "true" ? true : q.purchased === "false" ? false : undefined;
  const stuckHours = typeof q.stuckHours === "string" ? Number(q.stuckHours) : undefined;

  const where: Record<string, unknown> = { ...(includeTest ? {} : { isTest: false }) };
  if (step) where.onboardingStep = step;
  if (q.from || q.to) {
    const range = parseRange(q);
    where.createdAt = { gte: range.from, lt: range.to };
  }
  if (stuckHours) {
    where.onboardingUpdatedAt = { lte: new Date(Date.now() - stuckHours * 3_600_000) };
  }

  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      referral: { include: { partner: { select: { code: true } } } },
      entitlements: { orderBy: { createdAt: "desc" }, take: 1 },
      orders: { where: { status: "PAID" }, select: { totalPaise: true } },
    },
  });

  const filtered = purchased === undefined ? users : users.filter((u) => (u.orders.length > 0) === purchased);
  const nextCursor = users.length === 51 ? users[50].id : null;
  const page = filtered.slice(0, 50);

  res.json({
    items: page.map((u) => ({
      id: u.id,
      businessName: maskBusinessName(u.businessName ?? u.fullName),
      phoneMasked: maskPhone(u.phone),
      createdAt: u.createdAt,
      onboardingStep: u.onboardingStep,
      stuckSince: u.onboardingUpdatedAt,
      source: sourceLabel({ source: u.source, referral: u.referral }),
      partnerCode: u.referral?.partner?.code ?? null,
      plan: u.entitlements[0]?.planCode ?? null,
      lifetimePaise: u.orders.reduce((a, o) => a + Number(o.totalPaise), 0),
      isTest: u.isTest,
    })),
    nextCursor,
  });
});

adminOnboardingRouter.get("/users/:id", async (req, res) => {
  const user = await db.user.findUnique({
    where: { id: req.params.id },
    include: {
      referral: { include: { partner: { select: { id: true, name: true, code: true } } } },
      orders: { include: { plan: true, payments: true }, orderBy: { createdAt: "desc" } },
      onboardingEvents: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!user) return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found." } });

  const notes = await db.adminNote.findMany({ where: { entityType: "user", entityId: user.id }, orderBy: { createdAt: "desc" } });

  const timeline = [
    ...user.onboardingEvents.map((e) => ({ at: e.createdAt, kind: "onboarding" as const, label: STEP_LABEL[e.step] ?? e.step })),
    ...user.orders.flatMap((o) => [
      { at: o.createdAt, kind: "checkout" as const, label: `Checkout started — ${o.plan.name} · ₹${(Number(o.totalPaise) / 100).toFixed(0)}` },
      ...(o.status === "PAID" && o.paidAt ? [{ at: o.paidAt, kind: "payment" as const, label: `Payment succeeded — ₹${(Number(o.totalPaise) / 100).toFixed(0)}` }] : []),
      ...(o.status === "FAILED" ? [{ at: o.createdAt, kind: "payment_failed" as const, label: "Payment failed" }] : []),
      ...(o.status === "REFUNDED" && o.refundedAt ? [{ at: o.refundedAt, kind: "refund" as const, label: `Refund — ₹${(Number(o.totalPaise) / 100).toFixed(0)}` }] : []),
    ]),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  res.json({
    id: user.id,
    businessName: maskBusinessName(user.businessName ?? user.fullName),
    phoneMasked: maskPhone(user.phone),
    emailMasked: user.email ? `${user.email.slice(0, 2)}***@${user.email.split("@")[1] ?? ""}` : null,
    createdAt: user.createdAt,
    source: sourceLabel({ source: user.source, referral: user.referral }),
    onboardingStep: user.onboardingStep,
    isTest: user.isTest,
    referral: user.referral
      ? { partnerId: user.referral.partner.id, partnerName: user.referral.partner.name, partnerCode: user.referral.partner.code, via: user.referral.attributedVia, at: user.referral.attributedAt, status: user.referral.status }
      : null,
    purchases: user.orders.map((o) => ({
      id: o.id,
      plan: o.plan.name,
      termMonths: o.termMonths,
      totalPaise: Number(o.totalPaise),
      status: o.status,
      createdAt: o.createdAt,
      paidAt: o.paidAt,
    })),
    timeline,
    notes: notes.map((n) => ({ id: n.id, text: n.text, adminId: n.adminId, createdAt: n.createdAt })),
  });
});

const noteSchema = z.object({ text: z.string().min(1) });

adminOnboardingRouter.post("/users/:id/notes", async (req, res) => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: { code: "VALIDATION_FAILED", message: "Note text is required." } });
  const note = await db.adminNote.create({ data: { entityType: "user", entityId: req.params.id, adminId: "superadmin", text: parsed.data.text } });
  await writeAudit(req, { action: "add_note", entityType: "user", entityId: req.params.id, after: { text: parsed.data.text } });
  res.status(201).json({ id: note.id, text: note.text, createdAt: note.createdAt });
});

const testFlagSchema = z.object({ isTest: z.boolean(), reason: z.string().min(1) });

adminOnboardingRouter.post("/users/:id/test-flag", async (req, res) => {
  const parsed = testFlagSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: { code: "VALIDATION_FAILED", message: "isTest and reason are required." } });
  const before = await db.user.findUnique({ where: { id: req.params.id }, select: { isTest: true } });
  if (!before) return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found." } });
  const user = await db.user.update({ where: { id: req.params.id }, data: { isTest: parsed.data.isTest } });
  await writeAudit(req, {
    action: "set_test_flag",
    entityType: "user",
    entityId: user.id,
    reason: parsed.data.reason,
    before: { isTest: before.isTest },
    after: { isTest: user.isTest },
  });
  res.json({ id: user.id, isTest: user.isTest });
});
