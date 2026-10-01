import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../lib/api";
import { useAdminRange, formatMoney, formatPct } from "../../../lib/adminApi";
import { adminHref } from "../../../lib/adminHost";
import { KpiRow } from "../components/Kpi";

interface HomeData {
  kpis: Record<string, { value: number; previousValue: number; pctChange: number | null; pctOfTotal?: number }>;
  dailyTrend: { date: string; signups: number; onboardingCompleted: number; newPaying: number }[];
  revenueByPlan: { plan: string; amount: number }[];
  needsAttention: { payoutsOverSla: number; openFraudFlags: number; webhookFailures24h: number; reconciliationMissingInGateway: number; reconciliationMissingInDorway: number; approvalWaiting: number };
}

export function Home() {
  const range = useAdminRange();
  const [data, setData] = useState<HomeData | null>(null);

  useEffect(() => {
    api.get<HomeData>(`/admin/metrics/home${range.query({ compare: range.compare })}`).then(setData);
  }, [range.from, range.to, range.compare, range.includeTest]);

  if (!data) return <p className="admin-sub">Loading…</p>;

  const attention = [
    { label: "Accounts waiting more than 1 working day for approval", value: data.needsAttention.approvalWaiting, to: "/onboarding/approvals" },
    { label: "Payouts waiting more than 3 working days", value: data.needsAttention.payoutsOverSla, to: "/affiliates/payouts" },
    { label: "Open fraud flags", value: data.needsAttention.openFraudFlags, to: "/affiliates/flags" },
    { label: "Payment webhook failures in last 24h", value: data.needsAttention.webhookFailures24h, to: "/purchases/reconciliation" },
    { label: "Paid at gateway, missing in Dorway", value: data.needsAttention.reconciliationMissingInDorway, to: "/purchases/reconciliation" },
    { label: "Completed with no payment record", value: data.needsAttention.reconciliationMissingInGateway, to: "/purchases/reconciliation" },
  ].filter((a) => a.value > 0);

  return (
    <div>
      <h2 className="admin-h2">Home</h2>
      <p className="admin-sub">Are people signing up, finishing onboarding, paying, and is the partner program healthy.</p>

      <KpiRow
        tiles={[
          { label: "Signups", tile: data.kpis.signups },
          { label: "Onboarding completion", tile: data.kpis.onboardingCompletionRate, format: (n) => formatPct(n) },
          { label: "New paying customers", tile: data.kpis.newPayingCustomers },
          { label: "Revenue (net)", tile: data.kpis.netRevenue, format: (n) => formatMoney(n) },
          { label: "Signup → paid", tile: data.kpis.signupToPaidRate, format: (n) => formatPct(n) },
          { label: "Referred revenue", tile: data.kpis.referredNetRevenue, format: (n) => `${formatMoney(n)} (${formatPct(data.kpis.referredNetRevenue.pctOfTotal)})` },
        ]}
      />

      <div className="admin-grid-2">
        <div className="admin-card">
          <h3>Daily trend</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Date</th><th>Signups</th><th>Onboarding done</th><th>New paying</th></tr></thead>
              <tbody>
                {data.dailyTrend.map((d) => (
                  <tr key={d.date}><td>{d.date}</td><td>{d.signups}</td><td>{d.onboardingCompleted}</td><td>{d.newPaying}</td></tr>
                ))}
                {data.dailyTrend.length === 0 && <tr><td colSpan={4} className="admin-empty">No activity in this range.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="admin-card">
          <h3>Revenue by plan</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Plan</th><th>Net revenue</th></tr></thead>
              <tbody>
                {data.revenueByPlan.map((p) => <tr key={p.plan}><td>{p.plan}</td><td>{formatMoney(p.amount)}</td></tr>)}
                {data.revenueByPlan.length === 0 && <tr><td colSpan={2} className="admin-empty">No paid orders in this range.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h3>Needs attention</h3>
        {attention.length === 0 && <p className="admin-sub" style={{ margin: 0 }}>Nothing needs attention right now.</p>}
        {attention.map((a) => (
          <div key={a.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--a-line)" }}>
            <Link to={adminHref(a.to)} className="admin-link-btn">{a.label}</Link>
            <span className="admin-badge amber">{a.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
