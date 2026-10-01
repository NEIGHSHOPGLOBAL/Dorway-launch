import type { Request } from "express";
import { db } from "./db.js";
import { writeAudit } from "./adminAudit.js";

// superadmin.md §1.6 / §10 — masked by default everywhere, revealed per
// record on click, every reveal logged as its own audit row.

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const local = phone.replace(/^91/, "");
  if (local.length < 5) return "•••";
  return `+91 ${local.slice(0, 2)}XXX XX${local.slice(-3)}`;
}

export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.slice(0, 2)}***@${domain}`;
}

export function maskPan(pan: string | null | undefined): string | null {
  if (!pan) return null;
  return `${pan.slice(0, 2)}XXXXX${pan.slice(-3)}`;
}

export function maskAccountNumber(accountNumber: string | null | undefined): string | null {
  if (!accountNumber) return null;
  return `XXXX${accountNumber.slice(-4)}`;
}

export function maskUpi(upiId: string | null | undefined): string | null {
  if (!upiId) return null;
  const [local, domain] = upiId.split("@");
  if (!domain) return upiId;
  return `${local.slice(0, 3)}***@${domain}`;
}

export function maskBusinessName(name: string | null | undefined): string {
  if (!name || !name.trim()) return "—";
  const [first, ...rest] = name.trim().split(/\s+/);
  if (rest.length === 0) return first;
  return `${first} ${rest.map((w) => `${w[0]?.toUpperCase() ?? ""}.`).join(" ")}`;
}

const REVEALABLE_FIELDS: Record<string, string[]> = {
  user: ["phone", "email", "gstin", "fullName", "businessName"],
  partner: ["phone", "email", "name"],
  partnerPayoutMethod: ["upiId", "accountNumber", "accountName", "ifsc", "pan"],
};

export async function revealField(req: Request, entityType: string, entityId: string, field: string): Promise<string | null> {
  const allowed = REVEALABLE_FIELDS[entityType];
  if (!allowed?.includes(field)) return null;

  let value: string | null = null;
  if (entityType === "user") {
    const u = await db.user.findUnique({ where: { id: entityId } });
    value = u ? ((u as unknown as Record<string, string | null>)[field] ?? null) : null;
  } else if (entityType === "partner") {
    const p = await db.partner.findUnique({ where: { id: entityId } });
    value = p ? ((p as unknown as Record<string, string | null>)[field] ?? null) : null;
  } else if (entityType === "partnerPayoutMethod") {
    const m = await db.partnerPayoutMethod.findUnique({ where: { partnerId: entityId } });
    value = m ? ((m as unknown as Record<string, string | null>)[field] ?? null) : null;
  }

  await writeAudit(req, { action: "pii_reveal", entityType, entityId, reason: `field:${field}` });
  return value;
}
