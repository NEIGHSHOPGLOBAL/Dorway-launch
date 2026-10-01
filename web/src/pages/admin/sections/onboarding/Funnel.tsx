import { useEffect, useState } from "react";
import { api } from "../../../../lib/api";
import { useAdminRange, formatPct } from "../../../../lib/adminApi";

interface FunnelStep { step: string; label: string; count: number; conversionFromPrevious: number; conversionFromStart: number }
interface FunnelData {
  steps: FunnelStep[];
  medianTimes: { from: string; to: string; medianHours: number | null }[];
  breakdown: { group: string; steps: FunnelStep[] }[] | null;
}
interface CohortData { steps: string[]; windows: number[]; rows: { week: string; size: number; cells: Record<string, number> }[] }
interface ConversionFunnelData { steps: { step: string; count: number }[] }
interface PaywallTriggerData { triggers: { trigger: string; count: number }[] }

const CONVERSION_STEP_LABEL: Record<string, string> = {
  profile_completed: "Profile completed",
  preview_viewed: "Preview viewed",
  paywall_opened: "Paywall opened",
  checkout_started: "Checkout started",
  paid: "Paid",
  approved: "Approved",
  setup_scheduled: "Setup scheduled",
  setup_submitted: "Setup submitted",
  live: "Live",
};

function fmtHours(h: number | null): string {
  if (h === null) return "—";
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export function Funnel() {
  const range = useAdminRange();
  const [data, setData] = useState<FunnelData | null>(null);
  const [cohorts, setCohorts] = useState<CohortData | null>(null);
  const [breakdown, setBreakdown] = useState<string>("");
  const [conversion, setConversion] = useState<ConversionFunnelData | null>(null);
  const [triggers, setTriggers] = useState<PaywallTriggerData | null>(null);

  useEffect(() => {
    api.get<FunnelData>(`/admin/metrics/onboarding/funnel${range.query({ breakdown: breakdown || undefined })}`).then(setData);
  }, [range.from, range.to, range.includeTest, breakdown]);

  useEffect(() => {
    api.get<CohortData>(`/admin/metrics/onboarding/cohorts${range.query()}`).then(setCohorts);
  }, [range.from, range.to, range.includeTest]);

  useEffect(() => {
    api.get<ConversionFunnelData>(`/admin/metrics/conversion-funnel${range.query()}`).then(setConversion);
    api.get<PaywallTriggerData>(`/admin/metrics/paywall-triggers${range.query()}`).then(setTriggers);
  }, [range.from, range.to]);

  return (
    <div>
      <h2 className="admin-h2">Onboarding funnel</h2>
      <p className="admin-sub">Cohort = accounts signed up in the selected range.</p>

      <div className="admin-card">
        <div className="admin-filters">
          <select value={breakdown} onChange={(e) => setBreakdown(e.target.value)}>
            <option value="">No breakdown</option>
            <option value="source">By source</option>
            <option value="device">By device</option>
            <option value="cohort_week">By signup week</option>
          </select>
        </div>
        {!data ? (
          <p className="admin-sub">Loading…</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Step</th><th>Count</th><th>Conv. from previous</th><th>Conv. from start</th></tr></thead>
              <tbody>
                {data.steps.map((s) => (
                  <tr key={s.step}>
                    <td>{s.label}</td>
                    <td>{s.count}</td>
                    <td>{formatPct(s.conversionFromPrevious)}</td>
                    <td>{formatPct(s.conversionFromStart)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data?.breakdown && (
        <div className="admin-card">
          <h3>Breakdown</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Group</th>{data.steps.map((s) => <th key={s.step}>{s.label}</th>)}</tr></thead>
              <tbody>
                {data.breakdown.map((g) => (
                  <tr key={g.group}>
                    <td>{g.group}</td>
                    {g.steps.map((s) => <td key={s.step}>{s.count} ({formatPct(s.conversionFromStart)})</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="admin-card">
        <h3>Median time between steps</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>From</th><th>To</th><th>Median</th></tr></thead>
            <tbody>
              {data?.medianTimes.map((m) => <tr key={`${m.from}-${m.to}`}><td>{m.from}</td><td>{m.to}</td><td>{fmtHours(m.medianHours)}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-card">
        <h3>Preview → paid conversion funnel</h3>
        <p className="admin-sub" style={{ marginTop: -8 }}>userchanges.md AD-4 — distinct accounts reaching each step in the preview/paywall/approval journey.</p>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Step</th><th>Accounts</th></tr></thead>
            <tbody>
              {conversion?.steps.map((s) => <tr key={s.step}><td>{CONVERSION_STEP_LABEL[s.step] ?? s.step}</td><td>{s.count}</td></tr>)}
              {!conversion && <tr><td colSpan={2} className="admin-empty">Loading…</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-card">
        <h3>Paywall trigger breakdown</h3>
        <p className="admin-sub" style={{ marginTop: -8 }}>§9 — which locked action opens the paywall most.</p>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Trigger</th><th>Opens</th></tr></thead>
            <tbody>
              {triggers?.triggers.map((t) => <tr key={t.trigger}><td>{t.trigger}</td><td>{t.count}</td></tr>)}
              {triggers && triggers.triggers.length === 0 && <tr><td colSpan={2} className="admin-empty">No paywall opens in this range.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-card">
        <h3>Cohort table</h3>
        <p className="admin-sub" style={{ marginTop: -8 }}>% of each signup week's cohort reaching a step within 1 / 7 / 30 days.</p>
        {!cohorts ? (
          <p className="admin-sub">Loading…</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Week</th><th>Size</th>
                  {cohorts.steps.map((s) => cohorts.windows.map((w) => <th key={`${s}_d${w}`}>{s} d{w}</th>))}
                </tr>
              </thead>
              <tbody>
                {cohorts.rows.map((r) => (
                  <tr key={r.week}>
                    <td>{r.week}</td>
                    <td>{r.size}</td>
                    {cohorts.steps.map((s) => cohorts.windows.map((w) => <td key={`${s}_d${w}`}>{formatPct(r.cells[`${s}_d${w}`])}</td>))}
                  </tr>
                ))}
                {cohorts.rows.length === 0 && <tr><td colSpan={2 + cohorts.steps.length * cohorts.windows.length} className="admin-empty">No cohorts in this range.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
