import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../../../lib/api";
import { formatMoney, formatDateTime, formatDate, formatPct } from "../../../../lib/adminApi";
import { adminHref } from "../../../../lib/adminHost";
import { ReasonModal } from "../../components/ReasonModal";

const STATUS_COLOR: Record<string, string> = { ACTIVE: "green", SUSPENDED: "amber", CLOSED: "grey" };

interface PartnerDetailData {
  partner: { id: string; name: string; phoneMasked: string | null; emailMasked: string; code: string; status: string; joinedAt: string; termsVersion: string; termsAcceptedAt: string; whatsappOptIn: boolean; isTest: boolean };
  balances: { onHold: number; approved: number; inProcess: number; paid: number; reversed: number };
  summary: { clicks: number; signups: number; paidCustomers: number; openFlags: number };
  payoutMethod: { hasMethod: boolean; type?: string; upiId?: string | null; accountNumberMasked?: string | null; panMasked?: string | null; verified?: boolean };
  activity: { id: string; type: string; source: string; createdAt: string }[];
  referrals: { id: string; accountId: string; businessMasked: string; attributedVia: string; attributedAt: string; status: string; rejectionReason: string | null }[];
  commissions: { id: string; orderId: string; amount: number; status: string; holdUntil: string; paidAt: string; bonusId: string | null }[];
  bonuses: { id: string; amount: number; status: string; earnedAt: string; holdUntil: string }[];
  payouts: { id: string; amount: number; status: string; requestedAt: string; paidAt: string | null; reference: string | null }[];
  ledger: { at: string; kind: string; amount: number }[];
  notes: { id: string; text: string; adminId: string; createdAt: string }[];
  flags: { id: string; rule: string; status: string; createdAt: string }[];
}

const TABS = ["activity", "referrals", "commissions", "bonuses", "payouts", "ledger", "notes", "flags"] as const;

export function PartnerDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PartnerDetailData | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("activity");
  const [statusModal, setStatusModal] = useState<"suspended" | "active" | "closed" | null>(null);
  const [noteText, setNoteText] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [reverseTarget, setReverseTarget] = useState<{ kind: "commission" | "bonus"; id: string } | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [loadError, setLoadError] = useState(false);

  function load() {
    setLoadError(false);
    api.get<PartnerDetailData>(`/admin/partners/${id}`).then(setData).catch(() => setLoadError(true));
  }
  useEffect(() => { load(); }, [id]);

  async function reveal(field: string) {
    const r = await api.post<{ value: string }>("/admin/pii/reveal", { entityType: "partner", entityId: id, field });
    setRevealed((s) => ({ ...s, [field]: r.value }));
  }
  async function revealMethod(field: string) {
    const r = await api.post<{ value: string }>("/admin/pii/reveal", { entityType: "partnerPayoutMethod", entityId: id, field });
    setRevealed((s) => ({ ...s, [`method.${field}`]: r.value }));
  }
  async function addNote() {
    if (!noteText.trim()) return;
    await api.post(`/admin/partners/${id}/notes`, { text: noteText.trim() });
    setNoteText("");
    load();
  }

  async function copy(kind: "code" | "link", value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1500);
  }

  if (loadError) return <p className="admin-sub">Couldn’t load this partner. <button className="admin-link-btn" onClick={load}>Try again</button></p>;
  if (!data) return <p className="admin-sub">Loading…</p>;

  const referralLink = `https://dorwayai.com/?ref=${data.partner.code}`;
  const conversion = data.summary.signups === 0 ? 0 : (data.summary.paidCustomers / data.summary.signups) * 100;
  const counts: Record<string, number> = {
    referrals: data.referrals.length,
    commissions: data.commissions.length,
    bonuses: data.bonuses.length,
    payouts: data.payouts.length,
    notes: data.notes.length,
    flags: data.flags.length,
  };

  return (
    <div>
      <Link to={adminHref("/affiliates/partners")} className="admin-link-btn">← Partners</Link>
      <h2 className="admin-h2" style={{ marginTop: 10 }}>
        {data.partner.name}
        <span className={`admin-badge ${STATUS_COLOR[data.partner.status] ?? "grey"}`} style={{ marginLeft: 10, verticalAlign: "middle" }}>{data.partner.status}</span>
        {data.partner.isTest && <span className="admin-badge grey" style={{ marginLeft: 6, verticalAlign: "middle" }}>test</span>}
      </h2>
      <p className="admin-sub">
        <span className="admin-reveal" onClick={() => reveal("phone")}>{revealed.phone ?? data.partner.phoneMasked ?? "—"}</span>
        {" · "}
        <span className="admin-reveal" onClick={() => reveal("email")}>{revealed.email ?? data.partner.emailMasked}</span>
        {" · Joined "}{formatDate(data.partner.joinedAt)}
        {" · click a contact to reveal it"}
      </p>

      <div className="admin-filters">
        {data.partner.status !== "SUSPENDED" && <button className="admin-btn ghost sm" onClick={() => setStatusModal("suspended")}>Suspend</button>}
        {data.partner.status === "SUSPENDED" && <button className="admin-btn ghost sm" onClick={() => setStatusModal("active")}>Unsuspend</button>}
        {data.partner.status !== "CLOSED" && <button className="admin-btn danger sm" onClick={() => setStatusModal("closed")}>Close</button>}
      </div>

      <div className="admin-grid-2">
        <div className="admin-card">
          <h3>Code and link</h3>
          <p style={{ fontSize: 13.5, margin: "0 0 8px" }}>
            <span className="admin-mono">{data.partner.code}</span>
            <button className="admin-btn ghost sm" style={{ marginLeft: 10 }} onClick={() => copy("code", data.partner.code)}>{copied === "code" ? "Copied" : "Copy code"}</button>
          </p>
          <p className="admin-mono" style={{ margin: 0, wordBreak: "break-all" }}>{referralLink}</p>
          <button className="admin-btn ghost sm" style={{ marginTop: 10 }} onClick={() => copy("link", referralLink)}>{copied === "link" ? "Copied" : "Copy link"}</button>
        </div>
        <div className="admin-card">
          <h3>Account</h3>
          <p style={{ fontSize: 13.5, margin: 0, lineHeight: 1.7 }}>
            Terms {data.partner.termsVersion} accepted {formatDateTime(data.partner.termsAcceptedAt)}<br />
            WhatsApp opt-in {data.partner.whatsappOptIn ? "yes" : "no"}<br />
            Open fraud flags {data.summary.openFlags > 0 ? <button className="admin-link-btn" onClick={() => setTab("flags")}>{data.summary.openFlags}</button> : "none"}
          </p>
        </div>
      </div>

      <div className="admin-kpi-row">
        <div className="admin-kpi"><div className="label">Clicks</div><div className="value">{data.summary.clicks}</div></div>
        <div className="admin-kpi"><div className="label">Signups</div><div className="value">{data.summary.signups}</div></div>
        <div className="admin-kpi"><div className="label">Paid customers</div><div className="value">{data.summary.paidCustomers}</div></div>
        <div className="admin-kpi"><div className="label">Signup → paid</div><div className="value">{formatPct(conversion)}</div></div>
      </div>

      <div className="admin-kpi-row">
        <div className="admin-kpi"><div className="label">On hold</div><div className="value">{formatMoney(data.balances.onHold)}</div></div>
        <div className="admin-kpi"><div className="label">Approved</div><div className="value">{formatMoney(data.balances.approved)}</div></div>
        <div className="admin-kpi"><div className="label">In process</div><div className="value">{formatMoney(data.balances.inProcess)}</div></div>
        <div className="admin-kpi"><div className="label">Paid (lifetime)</div><div className="value">{formatMoney(data.balances.paid)}</div></div>
        <div className="admin-kpi"><div className="label">Reversed</div><div className="value">{formatMoney(data.balances.reversed)}</div></div>
      </div>

      <div className="admin-card">
        <h3>Payout method</h3>
        {data.payoutMethod.hasMethod ? (
          <p style={{ fontSize: 13.5, margin: 0 }}>
            {data.payoutMethod.type === "upi" ? (
              <span className="admin-reveal" onClick={() => revealMethod("upiId")}>{revealed["method.upiId"] ?? data.payoutMethod.upiId}</span>
            ) : (
              <span className="admin-reveal" onClick={() => revealMethod("accountNumber")}>{revealed["method.accountNumber"] ?? data.payoutMethod.accountNumberMasked}</span>
            )}
            {" · PAN "}<span className="admin-reveal" onClick={() => revealMethod("pan")}>{revealed["method.pan"] ?? data.payoutMethod.panMasked}</span>
            {" · "}{data.payoutMethod.verified ? "Verified" : "Not verified"}
          </p>
        ) : (
          <p className="admin-sub" style={{ margin: 0 }}>No payout method on file.</p>
        )}
      </div>

      <div className="admin-tabs">
        {TABS.map((t) => <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}{counts[t] != null ? ` (${counts[t]})` : ""}</button>)}
      </div>

      {tab === "activity" && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>When</th><th>Type</th><th>Source</th></tr></thead>
            <tbody>
              {data.activity.map((a) => <tr key={a.id}><td>{formatDateTime(a.createdAt)}</td><td>{a.type}</td><td>{a.source}</td></tr>)}
              {data.activity.length === 0 && <tr><td colSpan={3} className="admin-empty">No activity yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "referrals" && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Customer</th><th>Via</th><th>Attributed</th><th>Status</th><th>Rejection reason</th></tr></thead>
            <tbody>
              {data.referrals.map((r) => (
                <tr key={r.id}>
                  <td><Link to={adminHref(`/onboarding/users/${r.accountId}`)} className="admin-link-btn">{r.businessMasked}</Link></td>
                  <td>{r.attributedVia}</td>
                  <td>{formatDateTime(r.attributedAt)}</td>
                  <td><span className="admin-badge blue">{r.status}</span></td>
                  <td>{r.rejectionReason ?? "—"}</td>
                </tr>
              ))}
              {data.referrals.length === 0 && <tr><td colSpan={5} className="admin-empty">No referred customers yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "commissions" && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Order</th><th>Amount</th><th>Status</th><th>Hold until</th><th></th></tr></thead>
            <tbody>
              {data.commissions.length === 0 && <tr><td colSpan={5} className="admin-empty">No commissions yet.</td></tr>}
              {data.commissions.map((c) => (
                <tr key={c.id}>
                  <td className="admin-mono">{c.orderId.slice(0, 8)}…</td><td>{formatMoney(c.amount)}</td><td><span className="admin-badge amber">{c.status}</span></td><td>{formatDate(c.holdUntil)}</td>
                  <td>{["on_hold", "approved"].includes(c.status) && <button className="admin-btn danger sm" onClick={() => setReverseTarget({ kind: "commission", id: c.id })}>Reverse</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "bonuses" && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Amount</th><th>Status</th><th>Earned</th><th>Hold until</th><th></th></tr></thead>
            <tbody>
              {data.bonuses.length === 0 && <tr><td colSpan={5} className="admin-empty">No bonuses yet.</td></tr>}
              {data.bonuses.map((b) => (
                <tr key={b.id}>
                  <td>{formatMoney(b.amount)}</td><td><span className="admin-badge amber">{b.status}</span></td><td>{formatDate(b.earnedAt)}</td><td>{formatDate(b.holdUntil)}</td>
                  <td>{["on_hold", "approved"].includes(b.status) && <button className="admin-btn danger sm" onClick={() => setReverseTarget({ kind: "bonus", id: b.id })}>Reverse</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "payouts" && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Requested</th><th>Amount</th><th>Status</th><th>Reference</th></tr></thead>
            <tbody>
              {data.payouts.map((p) => <tr key={p.id}><td>{formatDate(p.requestedAt)}</td><td>{formatMoney(p.amount)}</td><td><span className="admin-badge blue">{p.status}</span></td><td className="admin-mono">{p.reference ?? "—"}</td></tr>)}
              {data.payouts.length === 0 && <tr><td colSpan={4} className="admin-empty">No payouts yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "ledger" && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>When</th><th>Kind</th><th>Amount</th></tr></thead>
            <tbody>
              {data.ledger.map((l, i) => <tr key={i}><td>{formatDateTime(l.at)}</td><td>{l.kind}</td><td>{l.amount >= 0 ? "+" : ""}{formatMoney(l.amount)}</td></tr>)}
              {data.ledger.length === 0 && <tr><td colSpan={3} className="admin-empty">No balance changes yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "notes" && (
        <div className="admin-card">
          {data.notes.length === 0 && <p className="admin-sub" style={{ marginTop: 0 }}>No notes yet.</p>}
          {data.notes.map((n) => <div className="admin-note" key={n.id}>{n.text}<div className="meta">{n.adminId} · {formatDateTime(n.createdAt)}</div></div>)}
          <textarea rows={2} placeholder="Add a note…" value={noteText} onChange={(e) => setNoteText(e.target.value)} style={{ width: "100%", marginTop: 10 }} />
          <button className="admin-btn sm" onClick={addNote}>Add note</button>
        </div>
      )}

      {tab === "flags" && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Rule</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>
              {data.flags.map((f) => <tr key={f.id}><td>{f.rule}</td><td><span className="admin-badge red">{f.status}</span></td><td>{formatDateTime(f.createdAt)}</td></tr>)}
              {data.flags.length === 0 && <tr><td colSpan={3} className="admin-empty">No flags on this partner.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {statusModal && (
        <ReasonModal
          title={statusModal === "closed" ? "Close partner" : statusModal === "suspended" ? "Suspend partner" : "Unsuspend partner"}
          description={statusModal === "closed" ? "Permanent — the code stops working and any approved balance is queued for payout." : statusModal === "suspended" ? "New clicks and codes won't be attributed. Existing approved balance stays payable." : undefined}
          danger={statusModal === "closed"}
          onClose={() => setStatusModal(null)}
          onConfirm={async (reason) => {
            await api.post(`/admin/partners/${id}/status`, { status: statusModal, reason });
            load();
          }}
        />
      )}

      {reverseTarget && (
        <ReasonModal
          title={`Reverse this ${reverseTarget.kind}`}
          danger
          onClose={() => setReverseTarget(null)}
          onConfirm={async (reason) => {
            await api.post(`/admin/${reverseTarget.kind === "commission" ? "commissions" : "bonuses"}/${reverseTarget.id}/reverse`, { reason });
            load();
          }}
        />
      )}
    </div>
  );
}
