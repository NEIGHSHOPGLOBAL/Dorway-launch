import { db } from "./db.js";

// userchanges.md §9/AD-4 — append-every-time funnel events, separate from
// the first-occurrence-per-step OnboardingEvent model (see schema.prisma).
export async function logFunnelEvent(opts: {
  userId?: string | null;
  sessionId?: string | null;
  event: string;
  meta?: Record<string, unknown>;
  referralPartnerId?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  device?: string | null;
}) {
  await db.funnelEvent.create({
    data: {
      userId: opts.userId ?? null,
      sessionId: opts.sessionId ?? null,
      event: opts.event,
      meta: (opts.meta ?? undefined) as never,
      referralPartnerId: opts.referralPartnerId ?? null,
      utmSource: opts.utmSource ?? null,
      utmMedium: opts.utmMedium ?? null,
      utmCampaign: opts.utmCampaign ?? null,
      device: opts.device ?? null,
    },
  });
}
