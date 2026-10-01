import { useEffect, useState } from "react";
import { api } from "../../../../lib/api";
import { formatMoney, formatDate } from "../../../../lib/adminApi";
import { ReasonModal } from "../../components/ReasonModal";

interface Row {
  id: string; type: "commission" | "bonus"; partnerId: string; partnerName: string; partnerCode: string;
  customerMasked?: string; checkoutId?: string; amount: number; status: string; holdUntil: string; payoutId: string | null;
}

export function Commissions() {
  const [type, setType] = useState<"commission" | "bonus">("commission");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [reverseTarget, setReverseTarget] = useState<Row | null>(null);

  function load(reset: boolean) {
    const q = new URLSearchParams({ type });
    if (status) q.set("status", status);
    if (!reset && cursor) q.set("cursor", cursor);
    api.get<{ items: Row[]; nextCursor: string | null }>(`/admin/commissions?${q.toString()}`).then((r) => {
      setItems((p) => (reset ? r.items : [...p, ...r.items]));
      setCursor(r.nextCursor);
    });
  }
  useEffect(() => { load(true); /* eslint-disable-next-line */ }, [type, status]);

  return (
    <div>
      <h2 className="admin-h2">Commissions &amp; bonuses</h2>
      <div className="admin-tabs">
        <button className={type === "commission" ? "active" : ""} onClick={() => setType("commission")}>Commissions</button>
        <button className={type === "bonus" ? "active" : ""} onClick={() => setType("bonus")}>Bonuses</button>
      </div>
      <div className="admin-filters">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="on_hold">On hold</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="reversed">Reversed</option>
        </select>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Partner</th>{type === "commission" && <th>Customer</th>}<th>Amount</th><th>Status</th><th>Hold until</th><th>Payout</th><th></th></tr></thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td className="admin-mono">{r.partnerName} ({r.partnerCode})</td>
                {type === "commission" && <td>{r.customerMasked}</td>}
                <td>{formatMoney(r.amount)}</td>
                <td><span className="admin-badge amber">{r.status}</span></td>
                <td>{formatDate(r.holdUntil)}</td>
                <td>{r.payoutId ? r.payoutId.slice(0, 8) + "…" : "—"}</td>
                <td>{["on_hold", "approved"].includes(r.status) && <button className="admin-btn danger sm" onClick={() => setReverseTarget(r)}>Reverse</button>}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={type === "commission" ? 7 : 6} className="admin-empty">No {type}s match.</td></tr>}
          </tbody>
        </table>
      </div>
      {cursor && <button className="admin-btn ghost sm" style={{ marginTop: 12 }} onClick={() => load(false)}>Load more</button>}

      {reverseTarget && (
        <ReasonModal
          title={`Reverse this ${reverseTarget.type}`}
          danger
          onClose={() => setReverseTarget(null)}
          onConfirm={async (reason) => {
            await api.post(`/admin/${reverseTarget.type === "commission" ? "commissions" : "bonuses"}/${reverseTarget.id}/reverse`, { reason });
            load(true);
          }}
        />
      )}
    </div>
  );
}
