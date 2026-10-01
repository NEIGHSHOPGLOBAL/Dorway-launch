import type { OnboardingStep, Prisma } from "@prisma/client";
import { db } from "./db.js";

/**
 * superadmin.md §5.1/§12 — first occurrence per (user, step) only, so the
 * funnel and "median time between steps" aren't skewed by a user bouncing
 * back and forth. Safe to call unconditionally at every transition point.
 */
export async function logOnboardingEvent(
  userId: string,
  step: OnboardingStep,
  meta?: Record<string, unknown>,
  client: Prisma.TransactionClient | typeof db = db,
) {
  await client.onboardingEvent.upsert({
    where: { userId_step: { userId, step } },
    update: {},
    create: { userId, step, meta: (meta ?? undefined) as never },
  });
}
