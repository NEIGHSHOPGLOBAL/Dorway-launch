import { useEffect, useMemo, useState } from "react";
import { Inbox, Users, Workflow, CalendarClock, Sparkles, Lock, Eye, Check, CircleDot } from "lucide-react";
import sampleWorkspace from "../../data/sampleWorkspace.json";
import { trackFunnel } from "../../lib/funnel";
import { trackViewContent } from "../../lib/pixel";
import { PaywallSheet } from "./PaywallSheet";
import { WhatsAppHelpButton } from "../WhatsAppHelpButton";

type Tab = "inbox" | "leads" | "pipeline" | "followups" | "ask";

const TABS: { key: Tab; label: string; icon: typeof Inbox }[] = [
  { key: "inbox", label: "Inbox", icon: Inbox },
  { key: "leads", label: "Leads", icon: Users },
  { key: "pipeline", label: "Pipeline", icon: Workflow },
  { key: "followups", label: "Follow-ups", icon: CalendarClock },
  { key: "ask", label: "Ask Dorway", icon: Sparkles },
];

const TOUR_KEY = "dw_preview_tour_dismissed";
const VISITED_KEY = "dw_preview_visited";

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

/**
 * userchanges.md §4 — the preview-state Dashboard: a realistic, clearly
 * labelled sample workspace. Reading is free; doing opens the paywall.
 * Also reused (read-only, `mode="paid-preview"`) from StatusHome's "Explore
 * the sample workspace" link (A-5).
 */
export function WorkspacePreview({
  businessName,
  launchAt,
  mode = "unpaid",
  accessStartsAt,
}: {
  businessName: string;
  launchAt: string | null;
  mode?: "unpaid" | "paid-preview";
  accessStartsAt?: string | null;
}) {
  const [tab, setTab] = useState<Tab>("inbox");
  const [selectedId, setSelectedId] = useState(sampleWorkspace.conversations[0]?.id ?? null);
  const [paywall, setPaywall] = useState<{ trigger: string; headline: string } | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [tourDismissed, setTourDismissed] = useState(() => localStorage.getItem(TOUR_KEY) === "1");
  const [askOpenIndex, setAskOpenIndex] = useState<number | null>(null);
  const returning = useMemo(() => {
    if (mode !== "unpaid") return false;
    const seen = localStorage.getItem(VISITED_KEY) === "1";
    localStorage.setItem(VISITED_KEY, "1");
    return seen;
  }, [mode]);

  const remaining = useCountdown(launchAt);
  const days = remaining !== null ? Math.floor(remaining / 86400000) : null;
  const hours = remaining !== null ? Math.floor((remaining % 86400000) / 3600000) : null;
  const mins = remaining !== null ? Math.floor((remaining % 3600000) / 60000) : null;

  useEffect(() => {
    trackFunnel("PREVIEW_VIEWED");
    trackViewContent({ planCodes: ["growth"] });
  }, []);

  useEffect(() => {
    trackFunnel("PREVIEW_TAB_VIEWED", { tab });
  }, [tab]);

  function openPaywall(trigger: string, headline: string) {
    setPaywall({ trigger, headline });
  }

  function dismissTour() {
    localStorage.setItem(TOUR_KEY, "1");
    setTourDismissed(true);
  }

  const selected = sampleWorkspace.conversations.find((c) => c.id === selectedId) ?? sampleWorkspace.conversations[0];

  return (
    <div className="preview-shell">
      <div className="preview-topbar">
        <div className="preview-topbar-name">
          <span className="workspace-dot" aria-hidden="true" />
          {businessName} <span style={{ color: "var(--ink-soft)" }}>▾</span>
        </div>
        {mode === "unpaid" && launchAt && remaining !== null && remaining > 0 && (
          <div className="preview-countdown">Launching in {days}d {String(hours).padStart(2, "0")}h {String(mins).padStart(2, "0")}m</div>
        )}
        {mode === "unpaid" ? (
          <button className="btn btn-primary btn-nav" onClick={() => openPaywall("top_bar", `Unlock Dorway for ${businessName}`)}>
            Unlock Dorway
          </button>
        ) : (
          <span className="admin-badge amber">Sample</span>
        )}
      </div>

      <div className="preview-body">
        <aside className="preview-sidebar">
          {TABS.map((t) => {
            const Icon = t.icon;
            const unread = t.key === "inbox" ? sampleWorkspace.conversations.filter((c) => c.unread).length : 0;
            return (
              <button key={t.key} className={`preview-sidebar-item${tab === t.key ? " active" : ""}`} onClick={() => setTab(t.key)}>
                <Icon size={18} />
                <span>{t.label}</span>
                {unread > 0 && <span className="preview-sidebar-badge">{unread}</span>}
              </button>
            );
          })}

          {mode === "unpaid" && (
            <div className="preview-checklist">
              <div className="caption" style={{ marginBottom: 10 }}>Getting started · 1 of 5</div>
              <div className="checklist-row" style={{ paddingBlock: 8 }}>
                <span className="checklist-icon done"><Check size={14} /></span>
                <span className="checklist-title" style={{ fontSize: 13 }}>Account created</span>
              </div>
              <div className="checklist-row" style={{ paddingBlock: 8, cursor: "pointer" }} onClick={() => openPaywall("checklist_plan", "Unlock Dorway for " + businessName)}>
                <span className="checklist-icon active"><CircleDot size={12} /></span>
                <span className="checklist-title" style={{ fontSize: 13 }}>Choose your plan</span>
              </div>
              {["Connect your WhatsApp", "Add your team", "Go live"].map((label) => (
                <div key={label} className="checklist-row" style={{ paddingBlock: 8 }}>
                  <span className="checklist-icon locked"><Lock size={12} /></span>
                  <span className="checklist-title locked" style={{ fontSize: 13 }}>{label}</span>
                </div>
              ))}
            </div>
          )}
        </aside>

        <main className="preview-main">
          {!bannerDismissed && (
            <div className="preview-banner">
              <Eye size={16} />
              <span>
                {mode === "paid-preview"
                  ? `This is a sample. Yours goes live on ${accessStartsAt ? new Date(accessStartsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long" }) : "launch day"}.`
                  : returning
                  ? `Welcome back. Your workspace is ready. Unlock it to connect your number.`
                  : "You're viewing a sample workspace. Unlock Dorway to connect your own WhatsApp number."}
              </span>
              {mode === "unpaid" && (
                <button className="preview-banner-link" onClick={() => openPaywall("banner_see_plans", `Unlock Dorway for ${businessName}`)}>
                  See plans
                </button>
              )}
              <button className="preview-banner-close" aria-label="Dismiss" onClick={() => setBannerDismissed(true)}>×</button>
            </div>
          )}

          {mode === "unpaid" && !tourDismissed && (
            <div className="preview-tour">
              <strong>Quick tour</strong>
              <ul>
                <li>Every enquiry lands here — the Inbox.</li>
                <li>Every lead has one owner — open a conversation to see it.</li>
                <li>Connect your number to make this yours — the Unlock button, top right.</li>
              </ul>
              <button className="preview-banner-link" onClick={dismissTour}>Got it</button>
            </div>
          )}

          {tab === "inbox" && (
            <div className="preview-split">
              <div className="preview-list">
                {sampleWorkspace.conversations.map((c) => (
                  <button key={c.id} className={`preview-row${selected?.id === c.id ? " selected" : ""}`} onClick={() => setSelectedId(c.id)}>
                    <div className="preview-row-main">
                      <div className="preview-row-name">{c.name} {c.unread && <span className="unread-dot" />}</div>
                      <div className="preview-row-preview">{c.preview}</div>
                    </div>
                    <span className="preview-row-time">{c.time}</span>
                  </button>
                ))}
              </div>
              {selected && (
                <div className="preview-thread">
                  <div className="preview-thread-head">
                    <div>
                      <div className="preview-row-name">{selected.name} <span className="sample-chip">Sample</span></div>
                      <div className="field-hint" style={{ margin: 0 }}>Owner: {selected.owner} · {selected.stage} · Next: {selected.nextFollowUp}</div>
                    </div>
                  </div>
                  <div className="preview-thread-body">
                    {selected.thread.map((m, i) => (
                      <div key={i} className={`preview-bubble ${m.from === "us" ? "us" : "them"}`}>
                        {"author" in m && m.author && <div className="preview-bubble-author">{m.author}</div>}
                        <div>{m.text}</div>
                        <div className="preview-bubble-time">{m.time}</div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="preview-composer"
                    onFocus={() => openPaywall("composer", "Reply to real customers from one shared number")}
                    onClick={() => openPaywall("composer", "Reply to real customers from one shared number")}
                  >
                    <Lock size={14} /> Unlock Dorway to reply to real customers
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === "leads" && (
            <div className="preview-list" style={{ maxWidth: 560 }}>
              {sampleWorkspace.conversations.map((c) => (
                <div key={c.id} className="preview-row">
                  <div className="preview-row-main">
                    <div className="preview-row-name">{c.name} <span className="sample-chip">Sample</span></div>
                    <div className="preview-row-preview">Owner: {c.owner} · {c.stage}</div>
                  </div>
                </div>
              ))}
              <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => openPaywall("import_leads", "Bring your existing leads with you")}>
                <Lock size={14} style={{ marginRight: 6 }} /> Import leads
              </button>
            </div>
          )}

          {tab === "pipeline" && (
            <div className="preview-pipeline">
              {sampleWorkspace.pipeline.stages.map((s) => (
                <div key={s.name} className="preview-pipeline-col">
                  <div className="caption">{s.name}</div>
                  <div className="preview-pipeline-count">{s.count}</div>
                </div>
              ))}
            </div>
          )}

          {tab === "followups" && (
            <div className="preview-list" style={{ maxWidth: 560 }}>
              {sampleWorkspace.followUps.map((f) => (
                <div key={f.lead} className="preview-row">
                  <div className="preview-row-main">
                    <div className="preview-row-name">{f.lead}</div>
                    <div className="preview-row-preview">{f.detail}{f.owner ? ` · ${f.owner}` : ""}</div>
                  </div>
                  <span className={`admin-badge ${f.due === "Overdue" ? "red" : "amber"}`}>{f.due}</span>
                </div>
              ))}
              <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => openPaywall("create_sequence", "Let follow-ups send themselves")}>
                <Lock size={14} style={{ marginRight: 6 }} /> Create sequence
              </button>
            </div>
          )}

          {tab === "ask" && (
            <div style={{ maxWidth: 640 }}>
              <p className="field-hint">Ask Dorway is read-only here — try one of these real questions.</p>
              {sampleWorkspace.askDorway.map((qa, i) => (
                <div key={qa.q} className="preview-ask-item">
                  <button className="preview-ask-q" onClick={() => setAskOpenIndex(askOpenIndex === i ? null : i)}>{qa.q}</button>
                  {askOpenIndex === i && <p className="preview-ask-a">{qa.a}</p>}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {mode === "unpaid" && (
        <div className="preview-mobile-bar">
          <span>Unlock Dorway · from ₹1,499/mo</span>
          <button className="btn btn-primary" onClick={() => openPaywall("mobile_bar", `Unlock Dorway for ${businessName}`)}>Unlock</button>
        </div>
      )}

      <PaywallSheet
        open={Boolean(paywall)}
        onClose={() => setPaywall(null)}
        trigger={paywall?.trigger ?? ""}
        headline={paywall?.headline ?? ""}
        businessName={businessName}
      />
      {mode === "unpaid" && <WhatsAppHelpButton page="workspace preview" />}
    </div>
  );
}
