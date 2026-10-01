import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { OnboardingState } from "../../lib/useOnboardingState";
import { formatRupeesExact } from "../../lib/usePlans";
import { supportWaLink } from "../../lib/support";
import { WorkspacePreview } from "./WorkspacePreview";

function useCountdown(launchAt: string | null) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!launchAt) return;
    const target = Date.parse(launchAt);
    let raf: number;
    function tick() {
      setRemaining(Math.max(0, target - Date.now()));
      raf = requestAnimationFrame(tick);
    }
    tick();
    return () => cancelAnimationFrame(raf);
  }, [launchAt]);
  return remaining;
}

function icsLink(title: string, startIso: string): string {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + 20 * 60_000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${title}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\n");
  return `data:text/calendar;charset=utf8,${encodeURIComponent(body)}`;
}

// userchanges.md §8.3 — the paid-but-not-live Dashboard: status card, 5-step
// path, head-start checklist, plan card, help.
export function StatusHome({ data }: { data: OnboardingState }) {
  const navigate = useNavigate();
  const [exploring, setExploring] = useState(false);
  const e = data.entitlement!;
  const remaining = useCountdown(data.launch?.launchAt ?? null);
  const days = remaining !== null ? Math.floor(remaining / 86400000) : null;
  const hours = remaining !== null ? Math.floor((remaining % 86400000) / 3600000) : null;

  const state = data.accountState;

  const statusCard = (() => {
    if (state === "REJECTED") {
      return {
        tone: "clay" as const,
        title: "Account not approved",
        body: `${e.rejectionReason ?? "Please contact support."} A full refund of ${formatRupeesExact(e.totalPaise)} has been started and should reach you in 5–7 working days.`,
      };
    }
    if (state === "SETUP_SCHEDULED") {
      const when = e.setupCallAt ? new Date(e.setupCallAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "";
      return { tone: "mint" as const, title: `Setup call on ${when}`, body: null };
    }
    if (state === "APPROVED") {
      return {
        tone: "mint" as const,
        title: "Approved",
        body: `${e.setupOwnerName ?? "Our team"} from our team will WhatsApp you to book your setup call.`,
      };
    }
    // AWAITING_APPROVAL
    return {
      tone: "amber" as const,
      title: "Awaiting approval",
      body: `Payment received${e.paidAt ? ` on ${new Date(e.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}. Our team is reviewing your account and will WhatsApp you within 1 working day to book your setup call.`,
    };
  })();

  type StepState = "done" | "active" | "locked";
  const steps: { label: string; detail: string; state: StepState }[] = [
    { label: "Payment confirmed", detail: e.paidAt ? new Date(e.paidAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "", state: "done" },
    { label: "Account review", detail: "usually within 1 working day", state: state === "AWAITING_APPROVAL" ? "active" : "done" },
    {
      label: "Setup call with our team",
      detail: state === "SETUP_SCHEDULED" && e.setupCallAt ? new Date(e.setupCallAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "we'll book this with you on WhatsApp",
      state: state === "SETUP_SCHEDULED" ? "done" : state === "APPROVED" ? "active" : "locked",
    },
    { label: "Connect your WhatsApp number", detail: "done together on the call", state: "locked" },
    {
      label: "Go live",
      detail: data.launch ? new Date(data.launch.launchAt).toLocaleDateString("en-IN", { day: "numeric", month: "long" }) + ", launch day" : "",
      state: "locked",
    },
  ];

  const headStart = [
    { label: "Business name as on GST", done: data.setup.sectionBDone },
    { label: "A WhatsApp Business number not already on the consumer app", done: data.setup.sectionADone },
    { label: "Business document (PDF)", done: data.setup.sectionCDone },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontFamily: "Comfortaa, cursive", fontSize: 26 }}>
          {data.profile.businessName ?? "Your workspace"} · Dorway {e.termMonths} months
        </h1>
        {data.launch && remaining !== null && remaining > 0 && (
          <div className="preview-countdown">Launching in {days}d {String(hours).padStart(2, "0")}h</div>
        )}
      </div>

      <div className={`status-card ${statusCard.tone}`}>
        <div className="status-card-title">{statusCard.title}</div>
        {statusCard.body && <p>{statusCard.body}</p>}
        {state === "SETUP_SCHEDULED" && e.setupCallAt && (
          <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
            <a href={icsLink("Dorway setup call", e.setupCallAt)} download="dorway-setup-call.ics" style={{ fontWeight: 600, fontSize: 13 }}>Add to calendar</a>
            {e.setupOwnerPhone && (
              <a href={supportWaLink("Hi, I need to reschedule my Dorway setup call.")} target="_blank" rel="noreferrer" style={{ fontWeight: 600, fontSize: 13 }}>
                Need to reschedule? Message {e.setupOwnerName}
              </a>
            )}
          </div>
        )}
        {state === "REJECTED" && (
          <a href={supportWaLink("Hi, I have a question about my rejected Dorway account.")} target="_blank" rel="noreferrer" style={{ fontWeight: 600, fontSize: 13 }}>
            Chat with support
          </a>
        )}
      </div>

      {state !== "REJECTED" && (
        <div className="card account-panel">
          <h2>Your path to going live</h2>
          {steps.map((s) => (
            <div key={s.label} className="checklist-row">
              <span className={`checklist-icon ${s.state}`}>
                {s.state === "done" ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : s.state === "active" ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                ) : (
                  <span className="hollow-dot" />
                )}
              </span>
              <div className="checklist-text">
                <div className={`checklist-title ${s.state}`}>{s.label}</div>
                <div className="field-hint" style={{ margin: 0 }}>{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {state !== "REJECTED" && (
        <div className="status-grid-2">
          <div className="card account-panel">
            <h2>Get a head start</h2>
            <p className="field-hint" style={{ marginTop: -8, marginBottom: 12 }}>Have these ready for the call</p>
            {headStart.map((h) => (
              <div key={h.label} className="checklist-row" style={{ paddingBlock: 10 }}>
                <span className={`checklist-icon ${h.done ? "done" : "locked"}`}>
                  {h.done ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> : <span className="hollow-dot" />}
                </span>
                <span className="checklist-title" style={{ fontSize: 14 }}>{h.label}</span>
              </div>
            ))}
            <button className="btn btn-primary btn-nav" style={{ marginTop: 12 }} onClick={() => navigate("/onboarding/setup")}>Start setup form</button>
          </div>

          <div>
            <div className="card account-panel">
              <h2>Your plan</h2>
              <div className="account-row"><span className="label">Plan</span><span className="value">Dorway · {e.termMonths} months</span></div>
              <div className="account-row"><span className="label">Starts</span><span className="value">{new Date(e.accessStartsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></div>
              <div className="account-row"><span className="label">Paid</span><span className="value mono">{formatRupeesExact(e.totalPaise)}</span></div>
              <a href={`/api/orders/${e.orderId}/invoice`} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8, fontWeight: 600, fontSize: 13, color: "var(--green)" }}>
                Download invoice
              </a>
            </div>
            <div className="card account-panel">
              <h2>Need help?</h2>
              <a href={supportWaLink("Hi, I have a question about my Dorway account.")} target="_blank" rel="noreferrer" className="field-hint">Chat with us on WhatsApp</a>
            </div>
          </div>
        </div>
      )}

      <button className="auth-switch" style={{ background: "none", border: "none", color: "var(--green)", fontWeight: 600, padding: 0, marginTop: 20, cursor: "pointer" }} onClick={() => setExploring((v) => !v)}>
        {exploring ? "Hide sample workspace" : "Explore the sample workspace"}
      </button>
      {exploring && (
        <div style={{ marginTop: 16 }}>
          <WorkspacePreview businessName={data.profile.businessName ?? "Your workspace"} launchAt={data.launch?.launchAt ?? null} mode="paid-preview" accessStartsAt={e.accessStartsAt} />
        </div>
      )}
    </div>
  );
}
