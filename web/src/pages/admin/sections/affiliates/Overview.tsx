import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../lib/api";
import { useAdminRange, formatMoney, formatPct, formatDateTime } from "../../../../lib/adminApi";
import { adminHref } from "../../../../lib/adminHost";

interface AffiliatesData {
  kpis: {
    activePartners: number; newPartners: number; referredSignups: number; referredPayingCustomers: number;
    referredNetRevenue: number; referredNetRevenuePctOfTotal: number; commissionEarned: number; liability: number; paidOut: number; effectivePayoutRate: number;
  };
  topPartners: { id: string; name: string; code: string; clicks: number; signups: number; paidCustomers: number; conversionRate: number; commissionEarned: number; liability: number }[];
  funnel: { clicks: number; signups: number; checkoutsStarted: number; completed: number };
  bonusActivity: { earnedInPeriod: number; midSprint: { partnerId: string; name: string; code: string; count: number; windowEndsAt: string }[] };
  liabilityAgeing: { label: string; amount: number }[];
}

export function AffiliatesOverview() {
  const range = useAdminRange();
  const navigate = useNavigate();
  const [data, setData] = useState<AffiliatesData | null>(null);

  useEffect(() => {
    api.get<AffiliatesData>(`/admin/metrics/affiliates${range.query()}`).then(setData);
  }, [range.from, range.to, range.includeTest]);

  if (!data) return <p className="admin-sub">Loading…</p>;

  return (
    <div>
      <h2 className="admin-h2">Affiliates</h2>
      <div className="admin-kpi-row">
        <div className="admin-kpi"><div className="label">Active partners</div><div className="value">{data.kpis.activePartners}</div></div>
        <div className="admin-kpi"><div className="label">New partners</div><div className="value">{data.kpis.newPartners}</div></div>
        <div className="admin-kpi"><div className="label">Referred signups</div><div className="value">{data.kpis.referredSignups}</div></div>
        <div className="admin-kpi"><div className="label">Referred paying</div><div className="value">{data.kpis.referredPayingCustomers}</div></div>
        <div className="admin-kpi"><div className="label">Referred revenue</div><div className="value">{formatMoney(data.kpis.referredNetRevenue)} ({formatPct(data.kpis.referredNetRevenuePctOfTotal)})</div></div>
        <div className="admin-kpi"><div className="label">Commission earned</div><div className="value">{formatMoney(data.kpis.commissionEarned)}</div></div>
        <div className="admin-kpi"><div className="label">Liability — Dorway owes</div><div className="value">{formatMoney(data.kpis.liability)}</div></div>
        <div className="admin-kpi"><div className="label">Paid out</div><div className="value">{formatMoney(data.kpis.paidOut)}</div></div>
        <div className="admin-kpi"><div className="label">Effective payout rate</div><div className="value">{formatPct(data.kpis.effectivePayoutRate)}</div></div>
      </div>

      <div className="admin-card">
        <h3>Top partners</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Partner</th><th>Clicks</th><th>Signups</th><th>Paid</th><th>Conv.</th><th>Referred revenue</th><th>Commission</th><th>Liability</th></tr></thead>
            <tbody>
              {data.topPartners.map((p) => (
                <tr key={p.id} className="admin-row-link" onClick={() => navigate(adminHref(`/affiliates/partners/${p.id}`))}>
                  <td><Link to={adminHref(`/affiliates/partners/${p.id}`)} className="admin-link-btn">{p.name} ({p.code})</Link></td>
                  <td>{p.clicks}</td><td>{p.signups}</td><td>{p.paidCustomers}</td><td>{formatPct(p.conversionRate)}</td>
                  <td>—</td><td>{formatMoney(p.commissionEarned)}</td><td>{formatMoney(p.liability)}</td>
                </tr>
              ))}
              {data.topPartners.length === 0 && <tr><td colSpan={8} className="admin-empty">No partner activity in this range.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-grid-2">
        <div className="admin-card">
          <h3>Funnel</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <tbody>
                <tr><td>Clicks</td><td>{data.funnel.clicks}</td></tr>
                <tr><td>Signups</td><td>{data.funnel.signups}</td></tr>
                <tr><td>Checkouts started</td><td>{data.funnel.checkoutsStarted}</td></tr>
                <tr><td>Completed</td><td>{data.funnel.completed}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="admin-card">
          <h3>Bonus activity</h3>
          <p style={{ fontSize: 13.5, margin: "0 0 12px" }}>{data.bonusActivity.earnedInPeriod} bonus(es) earned in this range.</p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Partner</th><th>Count</th><th>Window ends</th></tr></thead>
              <tbody>
                {data.bonusActivity.midSprint.map((m) => (
                  <tr key={m.partnerId} className="admin-row-link" onClick={() => navigate(adminHref(`/affiliates/partners/${m.partnerId}`))}><td><Link to={adminHref(`/affiliates/partners/${m.partnerId}`)} className="admin-link-btn">{m.name} ({m.code})</Link></td><td>{m.count} of 10</td><td>{formatDateTime(m.windowEndsAt)}</td></tr>
                ))}
                {data.bonusActivity.midSprint.length === 0 && <tr><td colSpan={3} className="admin-empty">No partner is mid-sprint.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h3>Liability ageing</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr>{data.liabilityAgeing.map((b) => <th key={b.label}>{b.label}</th>)}</tr></thead>
            <tbody><tr>{data.liabilityAgeing.map((b) => <td key={b.label}>{formatMoney(b.amount)}</td>)}</tr></tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
