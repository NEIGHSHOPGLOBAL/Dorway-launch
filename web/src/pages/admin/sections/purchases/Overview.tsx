import { useEffect, useState } from "react";
import { api } from "../../../../lib/api";
import { useAdminRange, formatMoney, formatPct } from "../../../../lib/adminApi";

interface PurchasesData {
  kpis: { grossRevenue: number; refunds: number; netRevenue: number; newPayingCustomers: number; checkoutConversionRate: number; averageOrderValue: number; paymentFailureRate: number };
  charts: { netRevenuePerDay: { date: string; amount: number }[]; ordersByPlan: { plan: string; count: number }[]; topFailureReasons: { reason: string; count: number }[] };
  revenueByPlanBilling: { plan: string; monthly: number; annual: number; total: number }[];
}

export function PurchasesOverview() {
  const range = useAdminRange();
  const [data, setData] = useState<PurchasesData | null>(null);

  useEffect(() => {
    api.get<PurchasesData>(`/admin/metrics/purchases${range.query()}`).then(setData);
  }, [range.from, range.to, range.includeTest]);

  if (!data) return <p className="admin-sub">Loading…</p>;

  return (
    <div>
      <h2 className="admin-h2">Purchases</h2>
      <div className="admin-kpi-row">
        <div className="admin-kpi"><div className="label">Gross revenue</div><div className="value">{formatMoney(data.kpis.grossRevenue)}</div></div>
        <div className="admin-kpi"><div className="label">Refunds</div><div className="value">{formatMoney(data.kpis.refunds)}</div></div>
        <div className="admin-kpi"><div className="label">Net revenue</div><div className="value">{formatMoney(data.kpis.netRevenue)}</div></div>
        <div className="admin-kpi"><div className="label">New paying customers</div><div className="value">{data.kpis.newPayingCustomers}</div></div>
        <div className="admin-kpi"><div className="label">Checkout conversion</div><div className="value">{formatPct(data.kpis.checkoutConversionRate)}</div></div>
        <div className="admin-kpi"><div className="label">Avg order value</div><div className="value">{formatMoney(data.kpis.averageOrderValue)}</div></div>
        <div className="admin-kpi"><div className="label">Payment failure rate</div><div className="value">{formatPct(data.kpis.paymentFailureRate)}</div></div>
      </div>

      <div className="admin-grid-2">
        <div className="admin-card">
          <h3>Net revenue per day</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Date</th><th>Amount</th></tr></thead>
              <tbody>
                {data.charts.netRevenuePerDay.map((d) => <tr key={d.date}><td>{d.date}</td><td>{formatMoney(d.amount)}</td></tr>)}
                {data.charts.netRevenuePerDay.length === 0 && <tr><td colSpan={2} className="admin-empty">No revenue in this range.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="admin-card">
          <h3>Top failure reasons</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Reason</th><th>Count</th></tr></thead>
              <tbody>
                {data.charts.topFailureReasons.map((r) => <tr key={r.reason}><td>{r.reason}</td><td>{r.count}</td></tr>)}
                {data.charts.topFailureReasons.length === 0 && <tr><td colSpan={2} className="admin-empty">No failed payments in this range.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h3>Revenue by plan × billing</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Plan</th><th>Monthly</th><th>Annual</th><th>Total</th></tr></thead>
            <tbody>
              {data.revenueByPlanBilling.map((r) => <tr key={r.plan}><td>{r.plan}</td><td>{formatMoney(r.monthly)}</td><td>{formatMoney(r.annual)}</td><td>{formatMoney(r.total)}</td></tr>)}
              {data.revenueByPlanBilling.length === 0 && <tr><td colSpan={4} className="admin-empty">No paid orders in this range.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
