export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

export type TermMonths = 1 | 6 | 12;

// userchanges.md §1.1 — term discount replaces the old early-bird-only
// pricing. 1 month has no commitment so no discount; 6 and 12 months are
// prepaid terms.
export const TERM_DISCOUNTS: Record<TermMonths, number> = { 1: 0, 6: 0.10, 12: 0.25 };

export const TERM_BADGES: Record<TermMonths, string | null> = {
  1: null,
  6: "Save 10%",
  12: "Best value",
};

/** Rounds a paise amount to the nearest whole rupee (half-up), per §1.1's rounding rule. */
function roundToWholeRupeePaise(paise: number): bigint {
  return BigInt(Math.round(paise / 100)) * 100n;
}

export interface TermPricing {
  termMonths: TermMonths;
  discountPercent: number;
  monthlyRatePaise: bigint;
  subtotalPaise: bigint;
  savingsPaise: bigint;
}

/**
 * userchanges.md §1.1-§1.2. `baseMonthlyPaise` is the undiscounted monthly
 * rate (plan.normalPaiseMonth). The rounding rule is applied to the
 * per-month rate first, then multiplied out — matching the worked example
 * exactly (₹1,999 × 0.90 = ₹1,799.10 → rounds to ₹1,799, not ₹1,799.1×6).
 *
 * Note: `savingsPaise` is computed as (baseMonthlyPaise - monthlyRatePaise) *
 * termMonths — the honest "what you'd have paid at the 1-month rate minus
 * what you're actually paying" figure. For 12 months this is ₹6,000, not
 * the spec's internally-inconsistent ₹5,988 (its own numbers — ₹1,999 vs
 * ₹1,499 × 12 — imply ₹6,000; the 6-month figure of ₹1,200 *is* consistent
 * with this formula, so this is a spec typo, not a design choice).
 */
export function computeTermPricing(baseMonthlyPaise: bigint, termMonths: TermMonths): TermPricing {
  const discountPercent = TERM_DISCOUNTS[termMonths] * 100;
  const rawPaise = Number(baseMonthlyPaise) * (100 - discountPercent) / 100;
  const monthlyRatePaise = roundToWholeRupeePaise(rawPaise);
  const subtotalPaise = monthlyRatePaise * BigInt(termMonths);
  const savingsPaise = (baseMonthlyPaise - monthlyRatePaise) * BigInt(termMonths);
  return { termMonths, discountPercent, monthlyRatePaise, subtotalPaise, savingsPaise };
}
