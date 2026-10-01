import { Router } from "express";
import { z } from "zod";
import { readSession } from "../lib/session.js";
import { db } from "../lib/db.js";
import { logFunnelEvent } from "../lib/funnelEvents.js";

export const funnelRouter = Router();

const trackSchema = z.object({
  event: z.string().min(1),
  sessionId: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

// userchanges.md §9 — client-triggered funnel events (PREVIEW_VIEWED,
// PAYWALL_OPENED, TERM_SELECTED, PROFILE_SKIPPED, PAYMENT_NOTIFY_REQUESTED, ...).
// Session required: every one of these fires after login in this flow.
funnelRouter.post("/track", async (req, res) => {
  const session = await readSession(req);
  if (!session) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }
  const parsed = trackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input" });
    return;
  }

  const user = await db.user.findUnique({ where: { id: session.sub }, include: { referral: true } });
  await logFunnelEvent({
    userId: session.sub,
    sessionId: parsed.data.sessionId,
    event: parsed.data.event,
    meta: parsed.data.meta,
    referralPartnerId: user?.referral?.partnerId ?? null,
    utmSource: user?.utmSource ?? null,
    utmMedium: user?.utmMedium ?? null,
    utmCampaign: user?.utmCampaign ?? null,
    device: user?.device ?? null,
  });

  res.status(200).json({ ok: true });
});
