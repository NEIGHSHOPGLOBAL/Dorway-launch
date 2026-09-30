const WHATSAPP_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.01 2C6.48 2 2 6.48 2 12.01c0 1.87.5 3.63 1.38 5.15L2 22l4.98-1.31a9.96 9.96 0 0 0 5.03 1.35h.01c5.53 0 10.01-4.48 10.01-10.01C22.03 6.5 17.55 2.02 12.02 2h-.01zm0 18.32h-.01a8.3 8.3 0 0 1-4.23-1.16l-.3-.18-3.15.82.84-3.07-.2-.32a8.29 8.29 0 0 1-1.28-4.4c0-4.59 3.74-8.32 8.34-8.32 2.23 0 4.32.87 5.9 2.44a8.27 8.27 0 0 1 2.44 5.89c0 4.59-3.75 8.3-8.35 8.3zm4.57-6.22c-.25-.13-1.48-.73-1.71-.81-.23-.08-.4-.13-.56.13-.17.25-.65.81-.8.98-.15.17-.29.19-.55.06-.25-.13-1.06-.39-2.02-1.24-.75-.67-1.25-1.5-1.4-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.44.06-.67.31-.23.25-.87.85-.87 2.08 0 1.23.89 2.41 1.02 2.58.13.17 1.75 2.67 4.24 3.74.59.26 1.06.41 1.42.52.6.19 1.14.16 1.57.1.48-.07 1.48-.6 1.69-1.19.21-.58.21-1.08.15-1.19-.06-.11-.23-.17-.48-.29z" />
  </svg>
);

const SPARK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="spark">
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
  </svg>
);

const CURVED_ARROW = (
  <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 8c8 0 20 4 24 24" />
    <path d="M20 28l8 4 2-9" />
  </svg>
);

const ONE_NUMBER_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const FULL_HISTORY_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="16" y2="17" />
  </svg>
);
const HANDOFF_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const ROWS = [
  { initials: "RV", color: "var(--green)", name: "Rahul Verma", preview: "Sure, sending two projects nearby now...", meta: "10:03 AM", selected: true },
  { initials: "KJ", color: "var(--amber)", name: "Kiran Joshi", preview: "What time does the clinic open on Sat...", unread: true },
  { initials: "TS", color: "var(--clay)", name: "Tara Singh", preview: "Thanks, that works for me", meta: "Yesterday" },
  { initials: "DP", color: "#5A6B65", name: "Deepak Patil", preview: "Can you call me instead?", unread: true },
];

export function TeamInboxShowcase() {
  return (
    <section className="showcase-section">
      <div className="container">
        <div className="showcase-badge">
          <span className="icon-circle">{WHATSAPP_ICON}</span>
          WhatsApp AI Agent
        </div>

        <h2 className="showcase-headline">
          Shared <span className="accent">team inbox</span>
        </h2>
        <p className="lead showcase-lead">
          Every conversation in one place. Your whole team works from the same WhatsApp number, sees the full
          history on every lead, and picks up where someone else left off. Nothing is trapped on a personal phone.
        </p>

        <div className="showcase-panel-wrap">
          <div className="showcase-ring" aria-hidden="true" />
          <div className="showcase-stack-card s2" aria-hidden="true" />
          <div className="showcase-stack-card s1" aria-hidden="true" />

          <div className="showcase-annotation" aria-hidden="true">
            {CURVED_ARROW}
            <span className="showcase-annotation-text">Full history<br />for every lead</span>
          </div>

          <div className="card showcase-panel">
            {ROWS.map((row) => (
              <div className={`mini-inbox-row${row.selected ? " selected" : ""}`} key={row.name}>
                <span className="avatar avatar-sm" style={{ background: row.color }}>{row.initials}</span>
                <div className="mini-row-text">
                  <div className="mini-row-name">{row.name}</div>
                  <div className="mini-row-preview">{row.preview}</div>
                </div>
                {row.meta ? <span className="mini-row-time">{row.meta}</span> : row.unread ? <span className="unread-dot" /> : null}
              </div>
            ))}
          </div>

          <div className="showcase-wa-badge">
            {SPARK}
            {WHATSAPP_ICON}
          </div>
        </div>

        <div className="showcase-features">
          <div>
            <div className="showcase-feature-icon">{ONE_NUMBER_ICON}</div>
            <h3>One Number</h3>
            <p>Your entire team handles conversations from a single WhatsApp number.</p>
          </div>
          <div>
            <div className="showcase-feature-icon">{FULL_HISTORY_ICON}</div>
            <h3>Full History</h3>
            <p>See complete chat history, lead details and context — always.</p>
          </div>
          <div>
            <div className="showcase-feature-icon">{HANDOFF_ICON}</div>
            <h3>Seamless Handoffs</h3>
            <p>No more lost context. Anyone can step in and continue the conversation.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
