import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { db } from "../lib/db.js";
import { config } from "../lib/config.js";
import { requireSuperAdmin } from "../lib/adminSession.js";
import { writeAudit } from "../lib/adminAudit.js";
import { maskBusinessName, maskPhone } from "../lib/adminMask.js";
import { hoursBetween } from "../lib/adminTime.js";
import { cfCreateRefund } from "../lib/cashfree.js";
import { reverseCommission } from "../lib/partnerJobs.js";
import { sendUtilityTemplate } from "../lib/whatsapp.js";
import { sendApprovalEmail, sendRejectionEmail, sendSetupScheduledEmail } from "../lib/email.js";
import { logFunnelEvent } from "../lib/funnelEvents.js";

export const adminApprovalsRouter = Router();
adminApprovalsRouter.use(requireSuperAdmin);

function serializeRow(e: {
  id: string;
  plan: { name: string };
  order: { paidAt: Date | null; termMonths: number };
  user: {
    businessName: string | null;
    fullName: string | null;
    phone: string | null;
    onboardingProfile: { sectionADone: boolean; sectionBDone: boolean; sectionCDone: boolean } | null;
    referral: { partner: { code: string } } | null;
  };
}) {
  const sectionsDone = [
    e.user.onboardingProfile?.sectionADone,
    e.user.onboardingProfile?.sectionBDone,
    e.user.onboardingProfile?.sectionCDone,
  ].filter(Boolean).length;
  return {
    entitlementId: e.id,
    businessName: maskBusinessName(e.user.businessName ?? e.user.fullName),
    phoneMasked: maskPhone(e.user.phone),
    plan: e.plan.name,
    termMonths: e.order.termMonths,
    paidAt: e.order.paidAt,
    waitingHours: e.order.paidAt ? hoursBetween(e.order.paidAt, new Date()) : null,
    setupFormProgress: `${sectionsDone} of 3`,
    partnerCode: e.user.referral?.partner?.code ?? null,
  };
}

const approvalsInclude = {
  plan: { select: { name: true } },
  order: { select: { paidAt: true, termMonths: true } },
  user: {
    include: {
      onboardingProfile: { select: { sectionADone: true, sectionBDone: true, sectionCDone: true } },
      referral: { include: { partner: { select: { code: true } } } },
    },
  },
} as const;

// userchanges.md §8.4 AD-1 — the approvals queue, oldest-paid-first, plus a
// second list of already-approved accounts still waiting on a setup call
// booked (AD-2 "Log setup call" needs somewhere to act from).
adminApprovalsRouter.get("/approvals", async (_req, res) => {
  const [pendingReview, awaitingScheduling] = await Promise.all([
    db.entitlement.findMany({ where: { approvalStatus: "PENDING_REVIEW" }, orderBy: { createdAt: "asc" }, include: approvalsInclude }),
    db.entitlement.findMany({ where: { approvalStatus: "APPROVED", setupCallAt: null }, orderBy: { approvedAt: "asc" }, include: approvalsInclude }),
  ]);

  res.json({
    items: pendingReview.map(serializeRow),
    awaitingScheduling: awaitingScheduling.map(serializeRow),
  });
});

async function findPendingOrApproved(entitlementId: string) {
  return db.entitlement.findUnique({
    where: { id: entitlementId },
    include: { user: true, order: { include: { plan: true } }, plan: true },
  });
}

const approveSchema = z.object({
  setupOwnerName: z.string().min(1),
  setupOwnerPhone: z.string().min(6),
  reason: z.string().min(1),
});

// userchanges.md AD-2 "Approve"
adminApprovalsRouter.post("/approvals/:entitlementId/approve", async (req, res) => {
  const parsed = approveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: { code: "VALIDATION_FAILED", message: "setupOwnerName, setupOwnerPhone and reason are required." } });
    return;
  }
  const entitlement = await findPendingOrApproved(req.params.entitlementId);
  if (!entitlement || entitlement.approvalStatus !== "PENDING_REVIEW") {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "No pending-review entitlement with that id." } });
    return;
  }

  const updated = await db.entitlement.update({
    where: { id: entitlement.id },
    data: {
      approvalStatus: "APPROVED",
      approvedAt: new Date(),
      approvedBy: "admin:superadmin",
      setupOwnerName: parsed.data.setupOwnerName,
      setupOwnerPhone: parsed.data.setupOwnerPhone,
    },
  });

  await writeAudit(req, {
    action: "approve_entitlement",
    entityType: "entitlement",
    entityId: entitlement.id,
    reason: parsed.data.reason,
    before: { approvalStatus: entitlement.approvalStatus },
    after: { approvalStatus: "APPROVED", setupOwnerName: parsed.data.setupOwnerName },
  });
  await logFunnelEvent({ userId: entitlement.userId, event: "approved", meta: { entitlementId: entitlement.id } });

  if (entitlement.user.phone) {
    sendUtilityTemplate(entitlement.user.phone, "dorway_approved", [parsed.data.setupOwnerName]).catch((err) =>
      console.error("sendUtilityTemplate(approved) failed:", err),
    );
  }
  const invoiceEmail = entitlement.order.invoiceEmail ?? entitlement.user.email;
  if (invoiceEmail) {
    sendApprovalEmail(invoiceEmail, parsed.data.setupOwnerName).catch((err) => console.error("sendApprovalEmail failed:", err));
  }

  res.json({ id: updated.id, approvalStatus: updated.approvalStatus });
});

const scheduleSchema = z.object({ setupCallAt: z.string().datetime(), reason: z.string().min(1) });

// userchanges.md AD-2 "Log setup call"
adminApprovalsRouter.post("/approvals/:entitlementId/schedule-call", async (req, res) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: { code: "VALIDATION_FAILED", message: "setupCallAt and reason are required." } });
    return;
  }
  const entitlement = await findPendingOrApproved(req.params.entitlementId);
  if (!entitlement || entitlement.approvalStatus !== "APPROVED") {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "No approved entitlement with that id." } });
    return;
  }

  const setupCallAt = new Date(parsed.data.setupCallAt);
  const updated = await db.entitlement.update({ where: { id: entitlement.id }, data: { setupCallAt } });

  await writeAudit(req, {
    action: "schedule_setup_call",
    entityType: "entitlement",
    entityId: entitlement.id,
    reason: parsed.data.reason,
    after: { setupCallAt: setupCallAt.toISOString() },
  });
  await logFunnelEvent({ userId: entitlement.userId, event: "setup_scheduled", meta: { entitlementId: entitlement.id } });

  const whenLabel = setupCallAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
  if (entitlement.user.phone) {
    sendUtilityTemplate(entitlement.user.phone, "dorway_setup_scheduled", [whenLabel]).catch((err) =>
      console.error("sendUtilityTemplate(setup_scheduled) failed:", err),
    );
  }
  const invoiceEmail = entitlement.order.invoiceEmail ?? entitlement.user.email;
  if (invoiceEmail) {
    sendSetupScheduledEmail(invoiceEmail, whenLabel).catch((err) => console.error("sendSetupScheduledEmail failed:", err));
  }

  res.json({ id: updated.id, setupCallAt: updated.setupCallAt });
});

const rejectSchema = z.object({ reason: z.string().min(1) });

// userchanges.md AD-2 "Reject" — full refund + commission clawback.
adminApprovalsRouter.post("/approvals/:entitlementId/reject", async (req, res) => {
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: { code: "VALIDATION_FAILED", message: "A reason is required." } });
    return;
  }
  const entitlement = await findPendingOrApproved(req.params.entitlementId);
  if (!entitlement || entitlement.approvalStatus === "REJECTED") {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "No rejectable entitlement with that id." } });
    return;
  }

  const updated = await db.entitlement.update({
    where: { id: entitlement.id },
    data: { approvalStatus: "REJECTED", rejectionReason: parsed.data.reason },
  });

  if (entitlement.order.cfOrderId && config.cashfree.isConfigured) {
    try {
      await cfCreateRefund({
        cfOrderId: entitlement.order.cfOrderId,
        refundId: crypto.randomUUID(),
        amountRupees: Number(entitlement.order.totalPaise) / 100,
        note: `Dorway account rejected: ${parsed.data.reason}`,
      });
    } catch (err) {
      // REFUND_STATUS_WEBHOOK is the source of truth for the refund actually
      // landing; a failed initiation here is logged for manual follow-up
      // rather than blocking the rejection itself.
      console.error(`cfCreateRefund failed for order ${entitlement.orderId}:`, err);
    }
  }

  const commission = await db.commission.findUnique({ where: { orderId: entitlement.orderId } });
  if (commission && commission.status === "on_hold") {
    await reverseCommission(commission.id, "entitlement_rejected");
  }

  await writeAudit(req, {
    action: "reject_entitlement",
    entityType: "entitlement",
    entityId: entitlement.id,
    reason: parsed.data.reason,
    before: { approvalStatus: entitlement.approvalStatus },
    after: { approvalStatus: "REJECTED" },
  });
  await logFunnelEvent({ userId: entitlement.userId, event: "rejected", meta: { entitlementId: entitlement.id, reason: parsed.data.reason } });

  if (entitlement.user.phone) {
    sendUtilityTemplate(entitlement.user.phone, "dorway_rejected", [parsed.data.reason]).catch((err) =>
      console.error("sendUtilityTemplate(rejected) failed:", err),
    );
  }
  const invoiceEmail = entitlement.order.invoiceEmail ?? entitlement.user.email;
  if (invoiceEmail) {
    sendRejectionEmail(invoiceEmail, parsed.data.reason, Number(entitlement.order.totalPaise) / 100).catch((err) =>
      console.error("sendRejectionEmail failed:", err),
    );
  }

  res.json({ id: updated.id, approvalStatus: updated.approvalStatus });
});
