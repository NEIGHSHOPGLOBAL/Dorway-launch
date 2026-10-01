import { useEffect, useState } from "react";
import { api } from "../../../../lib/api";
import { formatMoney, formatDateTime } from "../../../../lib/adminApi";
import { ReasonModal } from "../../components/ReasonModal";

interface PayoutRow {
  id: string; partnerId: string; partnerName: string; partnerCode: string; requestedAt: string; ageHours: number; overSla: boolean;
  amount: number; tds: number; net: number; method: { type: string; upiId: string | null; accountNumberMasked: string | null } | null;
  checks: { balanceCovers: boolean; panPresent: boolean; methodPresent: boolean; methodVerified: boolean; partnerActive: boolean; noOpenFlag: boolean };
  allChecksPass: boolean; status: string; reference: string | null;
}

const CHECK_LABEL: Record<string, string> = { balanceCovers: "Balance covers amount", panPresent: "PAN present", methodPresent: "Method present", methodVerified: "Method verified", partnerActive: "Partner not suspended", noOpenFlag: "No open flag" };

export function Payouts() {
  const [status, setStatus] = useState("requested");
  const [items, setItems] = useState<PayoutRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<{ kind: "processing" | "paid" | "reject"; payout: PayoutRow } | null>(null);

  function load(reset: boolean) {
    const q = new URLSearchParams({ status });
    if (!reset && cursor) q.set("cursor", cursor);
    api.get<{ items: PayoutRow[]; nextCursor: string | null }>(`/admin/payouts?${q.toString()}`).then((r) => {
      setItems((p) => (reset ? r.items : [...p, ...r.items]));
      setCursor(r.nextCursor);
    });
  }
  useEffect(() => { load(true); /* eslint-disable-next-line */ }, [status]);

  async function exportSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const res = await fetch("/api/admin/payouts/export", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "payouts.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h2 className="admin-h2">Payouts queue</h2>
      <div className="admin-filters">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="requested">Requested</option>
          <option value="processing">Processing</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
        {status === "processing" && <button className="admin-btn sm" onClick={exportSelected} disabled={selected.size === 0}>Export selected ({selected.size}) as CSV</button>}
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              {status === "processing" && <th></th>}
              <th>Requested</th><th>Partner</th><th>Amount</th><th>TDS</th><th>Net</th><th>Method</th><th>Checks</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                {status === "processing" && (
                  <td><input type="checkbox" checked={selected.has(p.id)} onChange={(e) => setSelected((s) => { const n = new Set(s); if (e.target.checked) n.add(p.id); else n.delete(p.id); return n; })} /></td>
                )}
                <td style={{ color: p.overSla ? "var(--a-red)" : undefined }}>{formatDateTime(p.requestedAt)} ({Math.round(p.ageHours / 24)}d)</td>
                <td className="admin-mono">{p.partnerName} ({p.partnerCode})</td>
                <td>{formatMoney(p.amount)}</td>
                <td>{formatMoney(p.tds)}</td>
                <td>{formatMoney(p.net)}</td>
                <td className="admin-mono">{p.method ? (p.method.type === "upi" ? p.method.upiId : p.method.accountNumberMasked) : "—"}</td>
                <td>
                  <div className="admin-checks">
                    {Object.entries(p.checks).map(([k, v]) => <span key={k} className={v ? "pass" : "fail"}>{v ? "✓" : "✗"} {CHECK_LABEL[k]}</span>)}
                  </div>
                </td>
                <td><span className="admin-badge amber">{p.status}</span></td>
                <td>
                  {p.status === "requested" && <button className="admin-btn sm" onClick={() => setAction({ kind: "processing", payout: p })}>Start processing</button>}
                  {p.status === "processing" && <button className="admin-btn sm" onClick={() => setAction({ kind: "paid", payout: p })}>Mark paid</button>}
                  {["requested", "processing"].includes(p.status) && <button className="admin-btn danger sm" style={{ marginLeft: 6 }} onClick={() => setAction({ kind: "reject", payout: p })}>Reject</button>}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={9} className="admin-empty">Nothing here.</td></tr>}
          </tbody>
        </table>
      </div>
      {cursor && <button className="admin-btn ghost sm" style={{ marginTop: 12 }} onClick={() => load(false)}>Load more</button>}

      {action?.kind === "processing" && (
        <ReasonModal
          title="Start processing"
          description={action.payout.allChecksPass ? "All checks pass." : "One or more checks are failing — this will require an override."}
          onClose={() => setAction(null)}
          onConfirm={async (reason) => {
            await api.post(`/admin/payouts/${action.payout.id}/processing`, { reason, override: !action.payout.allChecksPass });
            load(true);
          }}
        />
      )}
      {action?.kind === "paid" && (
        <ReasonModal
          title="Mark paid"
          extraFields={[{ key: "reference", label: "UTR / reference" }]}
          confirmLabel="Mark paid"
          onClose={() => setAction(null)}
          onConfirm={async (reason, extra) => {
            if (!extra.reference?.trim()) throw new Error("UTR / reference is required.");
            await api.post(`/admin/payouts/${action.payout.id}/paid`, { reference: extra.reference.trim(), reason });
            load(true);
          }}
        />
      )}
      {action?.kind === "reject" && (
        <ReasonModal
          title="Reject payout"
          description="The amount returns to the partner's available balance."
          danger
          onClose={() => setAction(null)}
          onConfirm={async (reason) => {
            await api.post(`/admin/payouts/${action.payout.id}/reject`, { reason });
            load(true);
          }}
        />
      )}
    </div>
  );
}
