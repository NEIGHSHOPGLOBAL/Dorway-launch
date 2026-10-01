import { Fragment, useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { formatDateTime } from "../../../lib/adminApi";

interface AuditRow { id: string; actor: string; action: string; entityType: string | null; entityId: string | null; reason: string | null; before: unknown; after: unknown; ip: string | null; createdAt: string }

export function AuditLog() {
  const [items, setItems] = useState<AuditRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  function load(reset: boolean) {
    const q = new URLSearchParams();
    if (action) q.set("action", action);
    if (entityType) q.set("entityType", entityType);
    if (!reset && cursor) q.set("cursor", cursor);
    api.get<{ items: AuditRow[]; nextCursor: string | null }>(`/admin/audit-log?${q.toString()}`).then((r) => {
      setItems((p) => (reset ? r.items : [...p, ...r.items]));
      setCursor(r.nextCursor);
    });
  }
  useEffect(() => { load(true); /* eslint-disable-next-line */ }, [action, entityType]);

  return (
    <div>
      <h2 className="admin-h2">Audit log</h2>
      <p className="admin-sub">Append-only. Nobody — including Super admins — can edit or delete a row.</p>
      <div className="admin-filters">
        <input type="text" placeholder="Filter by action…" value={action} onChange={(e) => setAction(e.target.value)} />
        <input type="text" placeholder="Filter by entity type…" value={entityType} onChange={(e) => setEntityType(e.target.value)} />
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Reason</th><th>IP</th><th></th></tr></thead>
          <tbody>
            {items.map((r) => (
              <Fragment key={r.id}>
                <tr>
                  <td>{formatDateTime(r.createdAt)}</td>
                  <td className="admin-mono">{r.actor}</td>
                  <td>{r.action}</td>
                  <td className="admin-mono">{r.entityType ?? "—"} {r.entityId ? `· ${r.entityId.slice(0, 8)}…` : ""}</td>
                  <td>{r.reason ?? "—"}</td>
                  <td className="admin-mono">{r.ip ?? "—"}</td>
                  <td><button className="admin-link-btn" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>{expanded === r.id ? "Hide" : "Details"}</button></td>
                </tr>
                {expanded === r.id && (
                  <tr>
                    <td colSpan={7}>
                      <pre style={{ fontSize: 11.5, whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify({ before: r.before, after: r.after }, null, 2)}</pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {items.length === 0 && <tr><td colSpan={7} className="admin-empty">No audit entries match.</td></tr>}
          </tbody>
        </table>
      </div>
      {cursor && <button className="admin-btn ghost sm" style={{ marginTop: 12 }} onClick={() => load(false)}>Load more</button>}
    </div>
  );
}
