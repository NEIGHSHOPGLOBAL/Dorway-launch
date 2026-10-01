import { useSearchParams } from "react-router-dom";

// superadmin.md §3 — the URL holds every filter, so any view can be shared as a link.
export function useAdminRange() {
  const [params, setParams] = useSearchParams();
  const now = new Date();
  const to = params.get("to") ?? now.toISOString();
  const from = params.get("from") ?? new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const compare = params.get("compare") ?? "previous";
  const includeTest = params.get("includeTest") === "1";

  function setPreset(days: number | "month" | "lastMonth") {
    const t = new Date();
    let f: Date;
    if (days === "month") {
      f = new Date(t.getFullYear(), t.getMonth(), 1);
    } else if (days === "lastMonth") {
      f = new Date(t.getFullYear(), t.getMonth() - 1, 1);
      const end = new Date(t.getFullYear(), t.getMonth(), 1);
      setParams((p) => {
        p.set("from", f.toISOString());
        p.set("to", end.toISOString());
        return p;
      });
      return;
    } else {
      f = new Date(t.getTime() - days * 86_400_000);
    }
    setParams((p) => {
      p.set("from", f.toISOString());
      p.set("to", t.toISOString());
      return p;
    });
  }

  function setIncludeTest(v: boolean) {
    setParams((p) => {
      if (v) p.set("includeTest", "1");
      else p.delete("includeTest");
      return p;
    });
  }

  function setCompare(v: string) {
    setParams((p) => {
      p.set("compare", v);
      return p;
    });
  }

  function query(extra: Record<string, string | undefined> = {}): string {
    const q = new URLSearchParams();
    q.set("from", from);
    q.set("to", to);
    if (includeTest) q.set("includeTest", "1");
    for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== "") q.set(k, v);
    return `?${q.toString()}`;
  }

  return { from, to, compare, includeTest, setPreset, setIncludeTest, setCompare, query };
}

export function formatMoney(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

export function formatPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(digits)}%`;
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function timeAgo(d: string | Date): string {
  const s = Math.max(1, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
