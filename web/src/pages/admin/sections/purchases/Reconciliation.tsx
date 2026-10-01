import { useEffect, useState } from "react";
import { api } from "../../../../lib/api";
import { formatMoney } from "../../../../lib/adminApi";
import { ReasonModal } from "../../components/ReasonModal";

interface Issue { orderId: string; totalPaise: number }
interface ReconData { runDate: string; matchedCount: number | null; matchedAmount: number | null; issues: { missingInGateway: Issue[]; missingInDorway: Issue[] } | null; notRunYet?: boolean }

export function Reconciliation() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<ReconData | null>(null);
  const [resyncOrderId, setResyncOrderId] = useState<string | null>(null);

  function load() {
    api.get<ReconData>(`/admin/reconciliation?date=${date}`).then(setData);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [date]);

  return (
    <div>
      <h2 className="admin-h2">Reconciliation</h2>
      <div className="admin-filters">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {data?.notRunYet && <p className="admin-sub">No reconciliation run recorded for this date yet — the daily job runs at 06:00 IST.</p>}

      {data && !data.notRunYet && (
        <>
          <div className="admin-kpi-row">
            <div className="admin-kpi"><div className="label">Matched</div><div className="value">{data.matchedCount}</div></div>
            <div className="admin-kpi"><div className="label">Matched amount</div><div className="value">{formatMoney(data.matchedAmount ?? 0)}</div></div>
            <div className="admin-kpi"><div className="label">In gateway, missing in Dorway</div><div className="value">{data.issues?.missingInDorway.length ?? 0}</div></div>
            <div className="admin-kpi"><div className="label">In Dorway, missing in gateway</div><div className="value">{data.issues?.missingInGateway.length ?? 0}</div></div>
          </div>

          <div className="admin-card">
            <h3>In gateway, missing in Dorway — a webhook was likely lost</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Order id</th><th>Amount</th><th></th></tr></thead>
                <tbody>
                  {data.issues?.missingInDorway.map((i) => (
                    <tr key={i.orderId}>
                      <td className="admin-mono">{i.orderId}</td>
                      <td>{formatMoney(i.totalPaise)}</td>
                      <td><button className="admin-btn sm" onClick={() => setResyncOrderId(i.orderId)}>Re-sync</button></td>
                    </tr>
                  ))}
                  {(data.issues?.missingInDorway.length ?? 0) === 0 && <tr><td colSpan={3} className="admin-empty">None.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin-card">
            <h3>In Dorway, missing in gateway — critical, should be 0</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Order id</th><th>Amount</th></tr></thead>
                <tbody>
                  {data.issues?.missingInGateway.map((i) => <tr key={i.orderId}><td className="admin-mono">{i.orderId}</td><td>{formatMoney(i.totalPaise)}</td></tr>)}
                  {(data.issues?.missingInGateway.length ?? 0) === 0 && <tr><td colSpan={2} className="admin-empty">None.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {resyncOrderId && (
        <ReasonModal
          title="Re-sync this payment"
          description="Re-fetches the payment from Cashfree and replays the webhook handler. Idempotent — safe to run more than once."
          onClose={() => setResyncOrderId(null)}
          onConfirm={async (reason) => {
            await api.post(`/admin/payments/${resyncOrderId}/resync`, { reason });
            load();
          }}
        />
      )}
    </div>
  );
}
