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

export interface OnboardingState {
  onboardingStep: OnboardingStep;
  profile: { fullName: string | null; businessName: string | null; businessCity: string | null };
  entitlement: { planCode: string; status: string; accessStartsAt: string } | null;
  setup: { sectionADone: boolean; sectionBDone: boolean; sectionCDone: boolean; submittedAt: string | null };
  launch: { launchAt: string; earlyBirdSeatsLeft: number | null } | null;
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
