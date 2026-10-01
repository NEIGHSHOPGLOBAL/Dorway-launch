import { useEffect, useState } from "react";
import { api } from "../../../../lib/api";
import { useAdminRange, formatMoney, formatDateTime } from "../../../../lib/adminApi";

interface PaymentRow { id: string; gatewayPaymentId: string; checkoutId: string; method: string | null; amountPaise: number; status: string; webhookReceivedAt: string }

export function Payments() {
  const range = useAdminRange();
  const [items, setItems] = useState<PaymentRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);

  function load(reset: boolean) {
    api
      .get<{ items: PaymentRow[]; nextCursor: string | null }>(`/admin/payments${range.query({ cursor: reset ? undefined : cursor ?? undefined })}`)
      .then((r) => { setItems((p) => (reset ? r.items : [...p, ...r.items])); setCursor(r.nextCursor); });
  }
  useEffect(() => { load(true); /* eslint-disable-next-line */ }, [range.from, range.to, range.includeTest]);

  return (
    <div>
      <h2 className="admin-h2">Payments</h2>
      <p className="admin-sub">Gateway-level records — one row per captured payment. Failed attempts don't reach the gateway as a payment row; see Checkouts for those.</p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Gateway payment id</th><th>Checkout</th><th>Method</th><th>Amount</th><th>Status</th><th>Received</th></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td className="admin-mono">{p.gatewayPaymentId}</td>
                <td className="admin-mono">{p.checkoutId.slice(0, 8)}…</td>
                <td>{p.method ?? "—"}</td>
                <td>{formatMoney(p.amountPaise)}</td>
                <td><span className="admin-badge green">{p.status}</span></td>
                <td>{formatDateTime(p.webhookReceivedAt)}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="admin-empty">No payments in this range.</td></tr>}
          </tbody>
        </table>
      </div>
      {cursor && <button className="admin-btn ghost sm" style={{ marginTop: 12 }} onClick={() => load(false)}>Load more</button>}
    </div>
  );
}
