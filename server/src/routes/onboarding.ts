import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { z } from "zod";
import { OnboardingStep } from "@prisma/client";
import { db } from "../lib/db.js";
import { config } from "../lib/config.js";
import { readSession } from "../lib/session.js";

export const onboardingRouter = Router();

function advance(current: OnboardingStep, target: OnboardingStep, order: OnboardingStep[]): OnboardingStep {
  return order.indexOf(target) > order.indexOf(current) ? target : current;
}
const STEP_ORDER: OnboardingStep[] = [
  "IDENTIFIED",
  "PROFILED",
  "PLAN_SELECTED",
  "PAYING",
  "PAID",
  "SETUP_STARTED",
  "SETUP_SUBMITTED",
  "PROVISIONED",
  "ACTIVE",
];

// ---- Step 2: who are you -------------------------------------------------

const profileSchema = z.object({
  fullName: z.string().min(1),
  businessName: z.string().min(1),
  businessCity: z.string().min(1),
  fallbackEmail: z.string().email().optional(),
  fallbackPhone: z.string().min(6).optional(),
});

onboardingRouter.post("/profile", async (req, res) => {
  const session = await readSession(req);
  if (!session) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input" });
    return;
  }

  const user = await db.user.findUnique({ where: { id: session.sub } });
  if (!user) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }

  const data: Record<string, unknown> = {
    fullName: parsed.data.fullName,
    businessName: parsed.data.businessName,
    businessCity: parsed.data.businessCity,
    onboardingStep: advance(user.onboardingStep, "PROFILED", STEP_ORDER),
  };
  if (parsed.data.fallbackEmail && !user.email) data.email = parsed.data.fallbackEmail;
  if (parsed.data.fallbackPhone && !user.phone) data.phone = parsed.data.fallbackPhone;

  await db.user.update({ where: { id: user.id }, data });
  res.json({ ok: true });
});

// ---- Step 3: dashboard state ---------------------------------------------

onboardingRouter.get("/state", async (req, res) => {
  const session = await readSession(req);
  if (!session) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }

  const user = await db.user.findUnique({
    where: { id: session.sub },
    include: { entitlements: { orderBy: { createdAt: "desc" }, take: 1 }, onboardingProfile: true },
  });
  if (!user) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }

  const cfg = await db.launchConfig.findUnique({ where: { id: 1 } });
  const sold = await db.order.count({ where: { isEarlyBird: true, status: "PAID" } });

  res.json({
    onboardingStep: user.onboardingStep,
    profile: {
      fullName: user.fullName,
      businessName: user.businessName,
      businessCity: user.businessCity,
    },
    entitlement: user.entitlements[0]
      ? {
          planCode: user.entitlements[0].planCode,
          status: user.entitlements[0].status,
          accessStartsAt: user.entitlements[0].accessStartsAt.toISOString(),
        }
      : null,
    setup: {
      sectionADone: user.onboardingProfile?.sectionADone ?? false,
      sectionBDone: user.onboardingProfile?.sectionBDone ?? false,
      sectionCDone: user.onboardingProfile?.sectionCDone ?? false,
      submittedAt: user.onboardingProfile?.submittedAt?.toISOString() ?? null,
    },
    launch: cfg
      ? {
          launchAt: cfg.launchAt.toISOString(),
          earlyBirdSeatsLeft: cfg.earlyBirdSeatCap === null ? null : Math.max(0, cfg.earlyBirdSeatCap - sold),
        }
      : null,
  });
});

// ---- Step 8: setup ---------------------------------------------------------

const sectionASchema = z.object({
  waNumber: z.string().min(6),
  waOnConsumerApp: z.boolean(),
  waCurrentPlatform: z.string().optional(),
  waOtpReachable: z.string().min(6),
});

const sectionBSchema = z.object({
  legalName: z.string().min(1),
  registeredAddress: z.string().min(1),
  billingStateCode: z.string().length(2),
  website: z.string().optional(),
  businessEmail: z.string().email().optional(),
  metaBusinessId: z.string().optional(),
  facebookPage: z.string().optional(),
  waDisplayName: z.string().min(1),
});

const sectionDSchema = z.object({
  hasExistingWaba: z.boolean(),
  existingWabaId: z.string().optional(),
  existingPhoneId: z.string().optional(),
  existingPlatform: z.string().optional(),
});

async function ensureProfileRow(userId: string) {
  await db.onboardingProfile.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

onboardingRouter.get("/setup", async (req, res) => {
  const session = await readSession(req);
  if (!session) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }
  const [profile, documents] = await Promise.all([
    db.onboardingProfile.findUnique({ where: { userId: session.sub } }),
    db.onboardingDocument.findMany({ where: { userId: session.sub }, orderBy: { uploadedAt: "desc" } }),
  ]);
  res.json({
    profile,
    documents: documents.map((d) => ({
      id: d.id,
      kind: d.kind,
      filename: d.filename,
      sizeBytes: d.sizeBytes,
      uploadedAt: d.uploadedAt.toISOString(),
    })),
  });
});

onboardingRouter.post("/setup/section-a", async (req, res) => {
  const session = await readSession(req);
  if (!session) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }
  const parsed = sectionASchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input" });
    return;
  }
  await ensureProfileRow(session.sub);
  await db.onboardingProfile.update({
    where: { userId: session.sub },
    data: { ...parsed.data, sectionADone: true },
  });
  const user = await db.user.findUnique({ where: { id: session.sub } });
  if (user) {
    await db.user.update({
      where: { id: session.sub },
      data: { onboardingStep: advance(user.onboardingStep, "SETUP_STARTED", STEP_ORDER) },
    });
  }
  res.json({ ok: true });
});

onboardingRouter.post("/setup/section-b", async (req, res) => {
  const session = await readSession(req);
  if (!session) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }
  const parsed = sectionBSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input" });
    return;
  }
  await ensureProfileRow(session.sub);
  await db.onboardingProfile.update({
    where: { userId: session.sub },
    data: { ...parsed.data, sectionBDone: true },
  });
  res.json({ ok: true });
});

onboardingRouter.post("/setup/section-d", async (req, res) => {
  const session = await readSession(req);
  if (!session) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }
  const parsed = sectionDSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input" });
    return;
  }
  await ensureProfileRow(session.sub);
  await db.onboardingProfile.update({ where: { userId: session.sub }, data: parsed.data });
  res.json({ ok: true });
});

onboardingRouter.post("/setup/submit", async (req, res) => {
  const session = await readSession(req);
  if (!session) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }
  await ensureProfileRow(session.sub);
  await db.onboardingProfile.update({ where: { userId: session.sub }, data: { submittedAt: new Date() } });
  const user = await db.user.findUnique({ where: { id: session.sub } });
  if (user) {
    await db.user.update({
      where: { id: session.sub },
      data: { onboardingStep: advance(user.onboardingStep, "SETUP_SUBMITTED", STEP_ORDER) },
    });
  }
  res.json({ ok: true });
});

// ---- Documents (section C) -------------------------------------------------
// Local disk for now — onboarding.md O4 flags S3/R2/Supabase as the real
// answer. Storage is tenant-scoped by user id and never served publicly;
// swapping the backing store later is a change to this file only.

fs.mkdirSync(config.uploadsDir, { recursive: true });

const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ["application/pdf", "image/jpeg", "image/png"].includes(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error("unsupported_file_type"));
  },
  storage: multer.memoryStorage(),
});

const DOCUMENT_KINDS = ["incorporation", "address_proof", "pan", "other"] as const;

onboardingRouter.post("/documents", upload.single("file"), async (req, res) => {
  const session = await readSession(req);
  if (!session) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }
  const kind = String(req.body?.kind ?? "");
  if (!DOCUMENT_KINDS.includes(kind as (typeof DOCUMENT_KINDS)[number])) {
    res.status(400).json({ error: "invalid_kind" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "no_file" });
    return;
  }

  const userDir = path.join(config.uploadsDir, session.sub);
  fs.mkdirSync(userDir, { recursive: true });
  const storageKey = `${session.sub}/${crypto.randomUUID()}-${req.file.originalname}`;
  fs.writeFileSync(path.join(config.uploadsDir, storageKey), req.file.buffer);

  const doc = await db.onboardingDocument.create({
    data: {
      userId: session.sub,
      kind,
      storageKey,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
    },
  });

  res.json({ ok: true, document: { id: doc.id, kind: doc.kind, filename: doc.filename } });
});

onboardingRouter.delete("/documents/:id", async (req, res) => {
  const session = await readSession(req);
  if (!session) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }
  const doc = await db.onboardingDocument.findUnique({ where: { id: req.params.id } });
  if (!doc || doc.userId !== session.sub) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  fs.rmSync(path.join(config.uploadsDir, doc.storageKey), { force: true });
  await db.onboardingDocument.delete({ where: { id: doc.id } });
  res.json({ ok: true });
});
