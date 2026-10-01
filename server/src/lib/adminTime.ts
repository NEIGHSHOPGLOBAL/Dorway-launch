// superadmin.md §1.3 — IST (Asia/Kolkata) for all date grouping and "today".
// Everything is stored UTC; these helpers only affect bucketing/labels.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export interface DateRange {
  from: Date;
  to: Date;
}

export function parseRange(query: { from?: unknown; to?: unknown }): DateRange {
  const to = typeof query.to === "string" && query.to ? new Date(query.to) : new Date();
  const from = typeof query.from === "string" && query.from ? new Date(query.from) : new Date(to.getTime() - 30 * 86_400_000);
  return { from, to };
}

/** The immediately preceding period of equal length — the default "Compare". */
export function comparePeriod(range: DateRange): DateRange {
  const ms = range.to.getTime() - range.from.getTime();
  return { from: new Date(range.from.getTime() - ms), to: new Date(range.from.getTime()) };
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

/** UTC instant of IST midnight for the day containing `d`. */
export function istDayStart(d: Date): Date {
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS);
}

/** YYYY-MM-DD bucket key in IST, for grouping daily series. */
export function istDateKey(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

export function hoursBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 3_600_000;
}
