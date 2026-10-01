import type { Request } from "express";
import { db } from "./db.js";

// superadmin.md §13 Q7 / this session: kept to one shared admin login today,
// no admin_users table yet — every audit row is attributed to this actor
// until real multi-admin accounts exist.
const ACTOR = "admin:superadmin";

export async function writeAudit(
  req: Request,
  opts: { action: string; entityType: string; entityId: string; reason?: string | null; before?: unknown; after?: unknown },
) {
  await db.auditLog.create({
    data: {
      actor: ACTOR,
      action: opts.action,
      subject: opts.entityId,
      entityType: opts.entityType,
      reason: opts.reason ?? null,
      before: (opts.before ?? null) as never,
      after: (opts.after ?? null) as never,
      ip: req.ip ?? null,
      userAgent: req.headers["user-agent"] ?? null,
    },
  });
}
