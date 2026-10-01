import { useEffect, useState } from "react";
import { api } from "../../../../lib/api";
import { formatDateTime } from "../../../../lib/adminApi";
import { ReasonModal } from "../../components/ReasonModal";

interface ApprovalRow {
  entitlementId: string;
  businessName: string;
  phoneMasked: string | null;
  plan: string;
  termMonths: number;
  paidAt: string | null;
  waitingHours: number | null;
  setupFormProgress: string;
  partnerCode: string | null;
}

export function Approvals() {
  const [items, setItems] = useState<ApprovalRow[]>([]);
  const [awaitingScheduling, setAwaitingScheduling] = useState<ApprovalRow[]>([]);
  const [action, setAction] = useState<{ kind: "approve" | "schedule" | "reject"; row: ApprovalRow } | null>(null);

  function load() {
    api.get<{ items: ApprovalRow[]; awaitingScheduling: ApprovalRow[] }>("/admin/approvals").then((r) => {
      setItems(r.items);
      setAwaitingScheduling(r.awaitingScheduling);
    });
  }
  useEffect(() => { load(); }, []);

  return (
    <div>
      <h2 className="admin-h2">Approvals</h2>
      <p className="admin-sub">Paid accounts waiting for review, oldest first. Approve sends a setup-owner introduction; reject refunds in full and reverses any on-hold commission.</p>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Business</th><th>Phone</th><th>Plan / term</th><th>Paid</th><th>Waiting</th><th>Setup form</th><th>Partner</th><th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.entitlementId}>
                <td>{r.businessName}</td>
                <td className="admin-mono">{r.phoneMasked ?? "—"}</td>
                <td>{r.plan} · {r.termMonths}mo</td>
                <td>{formatDateTime(r.paidAt)}</td>
                <td>
                  <span className={`admin-badge ${r.waitingHours !== null && r.waitingHours > 24 ? "red" : "amber"}`}>
                    {r.waitingHours !== null ? `${Math.round(r.waitingHours)}h` : "—"}
                  </span>
                </td>
                <td>{r.setupFormProgress}</td>
                <td>{r.partnerCode ?? "—"}</td>
                <td>
                  <button className="admin-btn sm" onClick={() => setAction({ kind: "approve", row: r })}>Approve</button>
                  <button className="admin-btn ghost sm" style={{ marginLeft: 6 }} onClick={() => setAction({ kind: "reject", row: r })}>Reject</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={8} className="admin-empty">Nothing waiting on review.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2 className="admin-h2" style={{ marginTop: 32 }}>Awaiting setup call</h2>
      <p className="admin-sub">Approved accounts that don't have a setup call booked yet.</p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Business</th><th>Phone</th><th>Plan / term</th><th>Partner</th><th></th></tr></thead>
          <tbody>
            {awaitingScheduling.map((r) => (
              <tr key={r.entitlementId}>
                <td>{r.businessName}</td>
                <td className="admin-mono">{r.phoneMasked ?? "—"}</td>
                <td>{r.plan} · {r.termMonths}mo</td>
                <td>{r.partnerCode ?? "—"}</td>
                <td><button className="admin-btn sm" onClick={() => setAction({ kind: "schedule", row: r })}>Log setup call</button></td>
              </tr>
            ))}
            {awaitingScheduling.length === 0 && <tr><td colSpan={5} className="admin-empty">Nothing waiting on a call.</td></tr>}
          </tbody>
        </table>
      </div>

      {action?.kind === "approve" && (
        <ReasonModal
          title={`Approve ${action.row.businessName}`}
          description="Sets a setup owner and notifies the customer on WhatsApp + email."
          confirmLabel="Approve"
          extraFields={[
            { key: "setupOwnerName", label: "Setup owner name" },
            { key: "setupOwnerPhone", label: "Setup owner phone" },
          ]}
          onClose={() => setAction(null)}
          onConfirm={async (reason, extra) => {
            await api.post(`/admin/approvals/${action.row.entitlementId}/approve`, {
              reason,
              setupOwnerName: extra.setupOwnerName ?? "",
              setupOwnerPhone: extra.setupOwnerPhone ?? "",
            });
            load();
          }}
        />
      )}
      {action?.kind === "schedule" && (
        <ReasonModal
          title={`Log setup call for ${action.row.businessName}`}
          description="Sets the call time and notifies the customer. Use a full date/time, e.g. 2026-10-05T11:00."
          confirmLabel="Save"
          extraFields={[{ key: "setupCallAt", label: "Call date/time", placeholder: "2026-10-05T11:00" }]}
          onClose={() => setAction(null)}
          onConfirm={async (reason, extra) => {
            const local = extra.setupCallAt;
            if (!local) throw new Error("A call date/time is required.");
            await api.post(`/admin/approvals/${action.row.entitlementId}/schedule-call`, {
              reason,
              setupCallAt: new Date(local).toISOString(),
            });
            load();
          }}
        />
      )}
      {action?.kind === "reject" && (
        <ReasonModal
          title={`Reject ${action.row.businessName}`}
          description="Starts a full refund via Cashfree and reverses any on-hold partner commission."
          confirmLabel="Reject"
          danger
          onClose={() => setAction(null)}
          onConfirm={async (reason) => {
            await api.post(`/admin/approvals/${action.row.entitlementId}/reject`, { reason });
            load();
          }}
        />
      )}
    </div>
  );
}
