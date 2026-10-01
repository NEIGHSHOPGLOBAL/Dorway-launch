// userchanges.md §8.1 — the single source of truth for which Dashboard state
// a logged-in customer sees. Computed once, server-side, in
// GET /api/onboarding/state so no client ever re-derives it.

export type AccountState =
  | "PREVIEW"
  | "PAYMENT_PENDING"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "SETUP_SCHEDULED"
  | "LIVE"
  | "REJECTED";

export interface DeriveAccountStateInput {
  latestOrderStatus: "CREATED" | "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED" | null;
  entitlement: {
    approvalStatus: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
    setupCallAt: Date | null;
    accessStartsAt: Date;
  } | null;
  now: Date;
}

export function deriveAccountState({ latestOrderStatus, entitlement, now }: DeriveAccountStateInput): AccountState {
  if (!entitlement) {
    if (latestOrderStatus === "CREATED" || latestOrderStatus === "PENDING") return "PAYMENT_PENDING";
    return "PREVIEW";
  }
  if (entitlement.approvalStatus === "REJECTED") return "REJECTED";
  if (entitlement.approvalStatus === "PENDING_REVIEW") return "AWAITING_APPROVAL";
  // APPROVED from here on.
  if (now >= entitlement.accessStartsAt) return "LIVE";
  if (entitlement.setupCallAt) return "SETUP_SCHEDULED";
  return "APPROVED";
}
