import { useEffect, useState } from "react";
import { api } from "./api";

export type OnboardingStep =
  | "IDENTIFIED"
  | "PROFILED"
  | "PLAN_SELECTED"
  | "PAYING"
  | "PAID"
  | "SETUP_STARTED"
  | "SETUP_SUBMITTED"
  | "PROVISIONED"
  | "ACTIVE";

// userchanges.md §8.1 — the single derived state the Dashboard branches on.
export type AccountState =
  | "PREVIEW"
  | "PAYMENT_PENDING"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "SETUP_SCHEDULED"
  | "LIVE"
  | "REJECTED";

export interface EntitlementState {
  planCode: string;
  planName: string;
  status: string;
  termMonths: number;
  accessStartsAt: string;
  accessEndsAt: string;
  approvalStatus: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  approvedAt: string | null;
  rejectionReason: string | null;
  setupOwnerName: string | null;
  setupOwnerPhone: string | null;
  setupCallAt: string | null;
  paidAt: string | null;
  totalPaise: number;
  invoiceEmail: string | null;
  orderId: string;
}

export interface OnboardingState {
  onboardingStep: OnboardingStep;
  accountState: AccountState;
  profile: { fullName: string | null; businessName: string | null; businessCity: string | null; teamSize: string | null };
  entitlement: EntitlementState | null;
  setup: { sectionADone: boolean; sectionBDone: boolean; sectionCDone: boolean; submittedAt: string | null };
  launch: { launchAt: string } | null;
}

export function useOnboardingState() {
  const [data, setData] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<OnboardingState>("/onboarding/state")
      .then((r) => !cancelled && setData(r))
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
