import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../lib/api";
import { formatDateTime } from "../../../../lib/adminApi";
import { adminHref } from "../../../../lib/adminHost";
import { ReasonModal } from "../../components/ReasonModal";

interface FlagRow { id: string; partnerId: string; partnerName: string; partnerCode: string; rule: string; evidence: unknown; status: string; createdAt: string }

export function Flags() {
  const [status, setStatus] = useState("open");
  const [items, setItems] = useState<FlagRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [action, setAction] = useState<{ kind: "dismiss" | "actioned"; flag: FlagRow } | null>(null);

  function load(reset: boolean) {
    const q = new URLSearchParams({ status });
    if (!reset && cursor) q.set("cursor", cursor);
    api.get<{ items: FlagRow[]; nextCursor: string | null }>(`/admin/flags?${q.toString()}`).then((r) => {
      setItems((p) => (reset ? r.items : [...p, ...r.items]));
      setCursor(r.nextCursor);
    });
  }
  useEffect(() => { load(true); /* eslint-disable-next-line */ }, [status]);

  return (
    <div>
      <h2 className="admin-h2">Fraud flags</h2>
      <p className="admin-sub">Created automatically by the hourly fraud-rules job. An open flag blocks that partner's payouts without an override.</p>
      <div className="admin-filters">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="open">Open</option>
          <option value="dismissed">Dismissed</option>
          <option value="actioned">Actioned</option>
          <option value="all">All</option>
        </select>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Partner</th><th>Rule</th><th>Evidence</th><th>Status</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {items.map((f) => (
              <tr key={f.id}>
                <td><Link to={adminHref(`/affiliates/partners/${f.partnerId}`)} className="admin-link-btn">{f.partnerName} ({f.partnerCode})</Link></td>
                <td>{f.rule}</td>
                <td className="admin-mono" style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>{JSON.stringify(f.evidence)}</td>
                <td><span className="admin-badge red">{f.status}</span></td>
                <td>{formatDateTime(f.createdAt)}</td>
                <td>
                  {f.status === "open" && (
                    <>
                      <button className="admin-btn ghost sm" onClick={() => setAction({ kind: "dismiss", flag: f })}>Dismiss</button>
                      <button className="admin-btn sm" style={{ marginLeft: 6 }} onClick={() => setAction({ kind: "actioned", flag: f })}>Mark actioned</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="admin-empty">No flags match.</td></tr>}
          </tbody>
        </table>
      </div>
      {cursor && <button className="admin-btn ghost sm" style={{ marginTop: 12 }} onClick={() => load(false)}>Load more</button>}

      {action && (
        <ReasonModal
          title={action.kind === "dismiss" ? "Dismiss flag" : "Mark actioned"}
          description={action.kind === "actioned" ? "Usually used after reversing referrals or suspending the partner from the partner page." : undefined}
          onClose={() => setAction(null)}
          onConfirm={async (reason) => {
            await api.post(`/admin/flags/${action.flag.id}/${action.kind}`, { reason });
            load(true);
          }}
        />
      )}
    </div>
  );
}
