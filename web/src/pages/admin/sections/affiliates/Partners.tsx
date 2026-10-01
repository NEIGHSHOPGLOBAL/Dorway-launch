import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../../lib/api";
import { useAdminRange, formatMoney, formatDate } from "../../../../lib/adminApi";
import { adminHref } from "../../../../lib/adminHost";

interface PartnerRow {
  id: string; name: string; phoneMasked: string | null; code: string; status: string; joinedAt: string;
  clicks: number; signups: number; paidCustomers: number; onHold: number; approved: number; paid: number;
  hasPayoutMethod: boolean; hasPan: boolean; openFlags: number; isTest: boolean;
}

const STATUS_COLOR: Record<string, string> = { ACTIVE: "green", SUSPENDED: "amber", CLOSED: "grey" };

export function Partners() {
  const range = useAdminRange();
  const navigate = useNavigate();
  const [items, setItems] = useState<PartnerRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [flagged, setFlagged] = useState("");

  function load(reset: boolean) {
    api
      .get<{ items: PartnerRow[]; nextCursor: string | null }>(`/admin/partners${range.query({ status: status || undefined, flagged: flagged || undefined, cursor: reset ? undefined : cursor ?? undefined })}`)
      .then((r) => { setItems((p) => (reset ? r.items : [...p, ...r.items])); setCursor(r.nextCursor); });
  }
  useEffect(() => { load(true); /* eslint-disable-next-line */ }, [range.from, range.to, range.includeTest, status, flagged]);

  return (
    <div>
      <h2 className="admin-h2">Partners</h2>
      <div className="admin-filters">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="closed">Closed</option>
        </select>
        <select value={flagged} onChange={(e) => setFlagged(e.target.value)}>
          <option value="">Any</option>
          <option value="true">Has open flag</option>
        </select>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Name</th><th>Phone</th><th>Code</th><th>Status</th><th>Joined</th><th>Clicks/Signups/Paid</th><th>On hold/Approved/Paid</th><th>Method</th><th>Flags</th></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="admin-row-link" onClick={() => navigate(adminHref(`/affiliates/partners/${p.id}`))}>
                <td><Link to={adminHref(`/affiliates/partners/${p.id}`)} className="admin-link-btn">{p.name}</Link>{p.isTest && <span className="admin-badge grey" style={{ marginLeft: 6 }}>test</span>}</td>
                <td className="admin-mono">{p.phoneMasked ?? "—"}</td>
                <td className="admin-mono">{p.code}</td>
                <td><span className={`admin-badge ${STATUS_COLOR[p.status] ?? "grey"}`}>{p.status}</span></td>
                <td>{formatDate(p.joinedAt)}</td>
                <td>{p.clicks} / {p.signups} / {p.paidCustomers}</td>
                <td>{formatMoney(p.onHold)} / {formatMoney(p.approved)} / {formatMoney(p.paid)}</td>
                <td>{p.hasPayoutMethod ? "✓" : "missing"} · PAN {p.hasPan ? "✓" : "missing"}</td>
                <td>{p.openFlags > 0 ? <span className="admin-badge red">{p.openFlags}</span> : "—"}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={9} className="admin-empty">No partners match.</td></tr>}
          </tbody>
        </table>
      </div>
      {cursor && <button className="admin-btn ghost sm" style={{ marginTop: 12 }} onClick={() => load(false)}>Load more</button>}
    </div>
  );
}
