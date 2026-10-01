import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../../../lib/api";
import { formatMoney, formatDateTime } from "../../../../lib/adminApi";
import { ReasonModal } from "../../components/ReasonModal";

interface UserDetailData {
  id: string; businessName: string; phoneMasked: string | null; emailMasked: string | null; createdAt: string;
  source: string; onboardingStep: string; isTest: boolean;
  referral: { partnerId: string; partnerName: string; partnerCode: string; via: string; at: string; status: string } | null;
  purchases: { id: string; plan: string; termMonths: number; totalPaise: number; status: string; createdAt: string; paidAt: string | null }[];
  timeline: { at: string; kind: string; label: string }[];
  notes: { id: string; text: string; adminId: string; createdAt: string }[];
}

export function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<UserDetailData | null>(null);
  const [noteText, setNoteText] = useState("");
  const [showTestModal, setShowTestModal] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  function load() {
    api.get<UserDetailData>(`/admin/users/${id}`).then(setData);
  }
  useEffect(() => { load(); }, [id]);

  async function reveal(field: string) {
    const r = await api.post<{ value: string }>("/admin/pii/reveal", { entityType: "user", entityId: id, field });
    setRevealed((s) => ({ ...s, [field]: r.value }));
  }

  async function addNote() {
    if (!noteText.trim()) return;
    await api.post(`/admin/users/${id}/notes`, { text: noteText.trim() });
    setNoteText("");
    load();
  }

  if (!data) return <p className="admin-sub">Loading…</p>;

  return (
    <div>
      <Link to="/onboarding/users" className="admin-link-btn">← Users</Link>
      <h2 className="admin-h2" style={{ marginTop: 10 }}>{data.businessName}</h2>
      <p className="admin-sub">
        <span className="admin-reveal" onClick={() => reveal("phone")}>{revealed.phone ?? data.phoneMasked ?? "—"}</span>
        {" · "}
        <span className="admin-reveal" onClick={() => reveal("email")}>{revealed.email ?? data.emailMasked ?? "—"}</span>
        {" · Signed up "}{formatDateTime(data.createdAt)}
        {" · "}<span className="admin-badge blue">{data.onboardingStep}</span>
        {data.isTest && <span className="admin-badge grey" style={{ marginLeft: 6 }}>test account</span>}
      </p>

      <div className="admin-card">
        <button className="admin-btn ghost sm" onClick={() => setShowTestModal(true)}>{data.isTest ? "Unmark as test account" : "Mark as test account"}</button>
      </div>

      <div className="admin-grid-2">
        <div className="admin-card">
          <h3>Timeline</h3>
          {data.timeline.map((t, i) => (
            <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid var(--a-line)", fontSize: 13.5 }}>
              <div>{t.label}</div>
              <div style={{ fontSize: 11.5, color: "var(--a-ink-soft)" }}>{formatDateTime(t.at)}</div>
            </div>
          ))}
          {data.timeline.length === 0 && <p className="admin-sub" style={{ margin: 0 }}>No events yet.</p>}
        </div>

        <div>
          <div className="admin-card">
            <h3>Referral</h3>
            {data.referral ? (
              <p style={{ fontSize: 13.5, margin: 0 }}>
                Via <Link to={`/affiliates/partners/${data.referral.partnerId}`} className="admin-link-btn">{data.referral.partnerName} ({data.referral.partnerCode})</Link>
                {" · "}{data.referral.via} · {formatDateTime(data.referral.at)} · <span className="admin-badge blue">{data.referral.status}</span>
              </p>
            ) : (
              <p className="admin-sub" style={{ margin: 0 }}>Direct — no referring partner.</p>
            )}
          </div>

          <div className="admin-card">
            <h3>Purchases</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Plan</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {data.purchases.map((p) => <tr key={p.id}><td>{p.plan} · {p.termMonths}mo</td><td>{formatMoney(p.totalPaise)}</td><td>{p.status}</td><td>{formatDateTime(p.paidAt ?? p.createdAt)}</td></tr>)}
                  {data.purchases.length === 0 && <tr><td colSpan={4} className="admin-empty">No checkouts yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin-card">
            <h3>Notes</h3>
            {data.notes.map((n) => (
              <div className="admin-note" key={n.id}>
                {n.text}
                <div className="meta">{n.adminId} · {formatDateTime(n.createdAt)}</div>
              </div>
            ))}
            <textarea rows={2} placeholder="Add a note…" value={noteText} onChange={(e) => setNoteText(e.target.value)} style={{ width: "100%", marginTop: 10 }} />
            <button className="admin-btn sm" onClick={addNote}>Add note</button>
          </div>
        </div>
      </div>

      {showTestModal && (
        <ReasonModal
          title={data.isTest ? "Unmark as test account" : "Mark as test account"}
          description="Test accounts are excluded from every metric unless the include-test toggle is on."
          onClose={() => setShowTestModal(false)}
          onConfirm={async (reason) => {
            await api.post(`/admin/users/${id}/test-flag`, { isTest: !data.isTest, reason });
            load();
          }}
        />
      )}
    </div>
  );
}
