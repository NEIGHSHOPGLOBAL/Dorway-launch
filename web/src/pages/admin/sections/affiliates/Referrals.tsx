import { useEffect, useState } from "react";
import { api } from "../../../../lib/api";
import { formatDateTime } from "../../../../lib/adminApi";
import { ReasonModal } from "../../components/ReasonModal";

interface ReferralRow { id: string; accountId: string; customerMasked: string; partnerId: string; partnerName: string; partnerCode: string; via: string; attributedAt: string; status: string; rejectionReason: string | null }

export function Referrals() {
  const [items, setItems] = useState<ReferralRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  function load(reset: boolean) {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (!reset && cursor) q.set("cursor", cursor);
    api.get<{ items: ReferralRow[]; nextCursor: string | null }>(`/admin/referrals?${q.toString()}`).then((r) => {
      setItems((p) => (reset ? r.items : [...p, ...r.items]));
      setCursor(r.nextCursor);
    });
  }
  useEffect(() => { load(true); /* eslint-disable-next-line */ }, [status]);

  return (
    <div>
      <h2 className="admin-h2">Referrals</h2>
      <div className="admin-filters">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="signed_up">Signed up</option>
          <option value="converted">Converted</option>
          <option value="rejected">Rejected</option>
        </select>
        <button className="admin-btn sm" onClick={() => setManualOpen(true)}>Manual attribution</button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Customer</th><th>Partner</th><th>Via</th><th>Attributed</th><th>Status</th><th>Rejection reason</th><th></th></tr></thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{r.customerMasked}</td>
                <td className="admin-mono">{r.partnerName} ({r.partnerCode})</td>
                <td>{r.via}</td>
                <td>{formatDateTime(r.attributedAt)}</td>
                <td><span className="admin-badge blue">{r.status}</span></td>
                <td>{r.rejectionReason ?? "—"}</td>
                <td>{r.status !== "rejected" && <button className="admin-btn danger sm" onClick={() => setRejectId(r.id)}>Reject</button>}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={7} className="admin-empty">No referrals match.</td></tr>}
          </tbody>
        </table>
      </div>
      {cursor && <button className="admin-btn ghost sm" style={{ marginTop: 12 }} onClick={() => load(false)}>Load more</button>}

      {rejectId && (
        <ReasonModal
          title="Reject referral"
          description="Any on-hold commission on this referral's orders is reversed."
          danger
          onClose={() => setRejectId(null)}
          onConfirm={async (reason) => {
            await api.post(`/admin/referrals/${rejectId}/reject`, { reason });
            load(true);
          }}
        />
      )}

      {manualOpen && (
        <ReasonModal
          title="Manual attribution"
          description="Assign an unattributed account to a partner. Cannot reassign an account already attributed elsewhere."
          extraFields={[{ key: "accountId", label: "Account id" }, { key: "partnerId", label: "Partner id" }]}
          onClose={() => setManualOpen(false)}
          onConfirm={async (reason, extra) => {
            await api.post("/admin/referrals/manual", { accountId: extra.accountId, partnerId: extra.partnerId, reason });
            load(true);
          }}
        />
      )}
    </div>
  );
}
