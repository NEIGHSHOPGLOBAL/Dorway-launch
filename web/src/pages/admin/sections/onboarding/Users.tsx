import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../../lib/api";
import { useAdminRange, formatMoney, formatDateTime, timeAgo } from "../../../../lib/adminApi";

interface UserRow {
  id: string; businessName: string; phoneMasked: string | null; createdAt: string; onboardingStep: string;
  stuckSince: string; source: string; partnerCode: string | null; plan: string | null; lifetimePaise: number; isTest: boolean;
}

export function Users() {
  const range = useAdminRange();
  const [items, setItems] = useState<UserRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [step, setStep] = useState("");
  const [purchased, setPurchased] = useState("");

  function load(reset: boolean) {
    api
      .get<{ items: UserRow[]; nextCursor: string | null }>(`/admin/users${range.query({ step: step || undefined, purchased: purchased || undefined, cursor: reset ? undefined : cursor ?? undefined })}`)
      .then((r) => {
        setItems((prev) => (reset ? r.items : [...prev, ...r.items]));
        setCursor(r.nextCursor);
      });
  }

  useEffect(() => { load(true); /* eslint-disable-next-line */ }, [range.from, range.to, range.includeTest, step, purchased]);

  return (
    <div>
      <h2 className="admin-h2">Users</h2>
      <div className="admin-filters">
        <select value={step} onChange={(e) => setStep(e.target.value)}>
          <option value="">All steps</option>
          {["IDENTIFIED", "PROFILED", "PLAN_SELECTED", "PAYING", "PAID", "SETUP_STARTED", "SETUP_SUBMITTED", "PROVISIONED", "ACTIVE"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={purchased} onChange={(e) => setPurchased(e.target.value)}>
          <option value="">Purchased or not</option>
          <option value="true">Purchased</option>
          <option value="false">Not purchased</option>
        </select>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Business</th><th>Phone</th><th>Signed up</th><th>Step</th><th>Stuck for</th><th>Source</th><th>Plan</th><th>Lifetime paid</th></tr></thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td><Link to={u.id} className="admin-link-btn">{u.businessName}</Link>{u.isTest && <span className="admin-badge grey" style={{ marginLeft: 6 }}>test</span>}</td>
                <td className="admin-mono">{u.phoneMasked ?? "—"}</td>
                <td>{formatDateTime(u.createdAt)}</td>
                <td><span className="admin-badge blue">{u.onboardingStep}</span></td>
                <td>{timeAgo(u.stuckSince)}</td>
                <td>{u.source}{u.partnerCode ? ` (${u.partnerCode})` : ""}</td>
                <td>{u.plan ?? "Not purchased"}</td>
                <td>{formatMoney(u.lifetimePaise)}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={8} className="admin-empty">No users in this range.</td></tr>}
          </tbody>
        </table>
      </div>
      {cursor && <button className="admin-btn ghost sm" style={{ marginTop: 12 }} onClick={() => load(false)}>Load more</button>}
    </div>
  );
}
