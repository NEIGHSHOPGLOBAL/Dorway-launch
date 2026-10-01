import { useEffect, useState } from "react";
import { api } from "./api";

export type TermMonths = 1 | 6 | 12;

export interface PlanData {
  code: string;
  name: string;
  normalPaiseMonth: number;
  ratePaiseMonth: number;
  discountPercent: number;
  seatCap: number | null;
  numberCap: number;
  features: string[];
  sortOrder: number;
}

export interface TermData {
  termMonths: TermMonths;
  discountPercent: number;
  monthlyRatePaise: number;
  subtotalPaise: number;
  savingsPaise: number;
  gstPaise: number;
  totalPaise: number;
  badge: string | null;
}

interface PlansResponse {
  gstPercent: number;
  terms: TermData[];
  plans: PlanData[];
  accessStartsAt: string;
}

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

export function formatRupeesExact(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
