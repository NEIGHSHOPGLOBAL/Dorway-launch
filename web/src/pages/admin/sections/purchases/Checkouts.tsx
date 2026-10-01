import { useEffect, useState } from "react";
import { api } from "../../../../lib/api";
import { useAdminRange, formatMoney, formatDateTime } from "../../../../lib/adminApi";

interface CheckoutRow {
  id: string; business: string; plan: string; billing: string; subtotalPaise: number; gstPaise: number; totalPaise: number;
  status: string; furthestStep: string; partnerCode: string | null; startedAt: string; completedAt: string | null;
}

const STATUS_COLOR: Record<string, string> = { started: "blue", abandoned: "amber", completed: "green", failed: "red", refunded: "grey" };

export function Checkouts() {
  const range = useAdminRange();
  const [items, setItems] = useState<CheckoutRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [hasPartner, setHasPartner] = useState("");

  function load(reset: boolean) {
    api
      .get<{ items: CheckoutRow[]; nextCursor: string | null }>(`/admin/checkouts${range.query({ status: status || undefined, hasPartner: hasPartner || undefined, cursor: reset ? undefined : cursor ?? undefined })}`)
      .then((r) => { setItems((p) => (reset ? r.items : [...p, ...r.items])); setCursor(r.nextCursor); });
  }
  useEffect(() => { load(true); /* eslint-disable-next-line */ }, [range.from, range.to, range.includeTest, status, hasPartner]);

  return (
    <div>
      <h2 className="admin-h2">Checkouts</h2>
      <div className="admin-filters">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="started">Started</option>
          <option value="abandoned">Abandoned</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
        <select value={hasPartner} onChange={(e) => setHasPartner(e.target.value)}>
          <option value="">Any partner</option>
          <option value="true">Has partner</option>
          <option value="false">No partner</option>
        </select>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Business</th><th>Plan</th><th>Total</th><th>Status</th><th>Furthest step</th><th>Partner</th><th>Started</th></tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td>{c.business}</td>
                <td>{c.plan} · {c.billing}</td>
                <td title={`Subtotal ${formatMoney(c.subtotalPaise)} + GST ${formatMoney(c.gstPaise)}`}>{formatMoney(c.totalPaise)}</td>
                <td><span className={`admin-badge ${STATUS_COLOR[c.status] ?? "grey"}`}>{c.status}</span></td>
                <td>{c.furthestStep}</td>
                <td className="admin-mono">{c.partnerCode ?? "—"}</td>
                <td>{formatDateTime(c.startedAt)}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={7} className="admin-empty">No checkouts in this range.</td></tr>}
          </tbody>
        </table>
      </div>
      {cursor && <button className="admin-btn ghost sm" style={{ marginTop: 12 }} onClick={() => load(false)}>Load more</button>}
    </div>
  );
}
