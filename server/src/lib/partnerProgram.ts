/**
 * Single source of truth for partner-program money rules.
 * Mirrors PROGRAM in web/src/pages/partners/DorwayPartners.jsx, which only
 * drives copy/display — this object is what every route actually enforces.
 *
 * partners.md §12 lists these as open business decisions. Defaults below are
 * the doc's own recommended defaults; revisit before real payouts go out.
 */
export const PARTNER_PROGRAM = {
  commissionRate: 0.10, // 10% of each completed checkout
  // commissionOn: referred account's FIRST paid order only (partners.md §12.2)
  minPayoutPaise: 200000n, // ₹2,000 approved balance before a payout can be requested
  bonus: { amountPaise: 100000n, every: 10, withinDays: 7 }, // ₹1,000 per 10 completed checkouts within 7 days
  holdDays: 30, // refund window before commission/bonus becomes approved
  attributionDays: 60, // a link click counts for this long
  abandonedAfterHours: 1, // an unpaid checkout is "abandoned" after this long
  otp: { length: 6, expiresMinutes: 5 },
};
