import { useEffect, useState } from "react";
import { api } from "./api";

export interface PlanData {
  code: string;
  name: string;
  normalPaiseMonth: number;
  earlyPaiseMonth: number;
  ratePaiseMonth: number;
  isEarlyBirdRate: boolean;
  seatCap: number | null;
  numberCap: number;
  features: string[];
  sortOrder: number;
}

interface PlansResponse {
  earlyBirdOpen: boolean;
  gstPercent: number;
  plans: PlanData[];
}

export type TermMonths = 1 | 6 | 12;

export function usePlans(termMonths: TermMonths = 12) {
  const [data, setData] = useState<PlansResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<PlansResponse>(`/plans?termMonths=${termMonths}`)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Failed to load plans");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [termMonths]);

  return { data, loading, error };
}

export function formatRupees(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
