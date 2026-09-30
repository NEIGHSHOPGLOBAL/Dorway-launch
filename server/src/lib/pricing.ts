import type { LaunchConfig } from "@prisma/client";

export function isEarlyBirdOpen(now: Date, cfg: LaunchConfig, sold: number): boolean {
  if (cfg.earlyBirdForceClose) return false;
  if (now >= cfg.earlyBirdEndsAt) return false;
  if (cfg.earlyBirdSeatCap !== null && sold >= cfg.earlyBirdSeatCap) return false;
  return true;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/**
 * The 1-month term is month-to-month with no commitment, so it never gets
 * the early-bird rate — only the prepaid 6/12-month terms do, and only
 * while the early-bird window is open.
 */
export function effectiveRatePaise(
  plan: { normalPaiseMonth: bigint; earlyPaiseMonth: bigint },
  termMonths: number,
  earlyBirdOpen: boolean,
): bigint {
  if (termMonths === 1) return plan.normalPaiseMonth;
  return earlyBirdOpen ? plan.earlyPaiseMonth : plan.normalPaiseMonth;
}
