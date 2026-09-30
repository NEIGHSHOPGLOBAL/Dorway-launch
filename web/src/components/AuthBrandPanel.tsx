const ICON_INBOX = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);
const ICON_ASSIGN = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const ICON_FOLLOWUP = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
const ICON_HEALTH = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const FEATURES = [
  { icon: ICON_INBOX, label: "Shared team inbox" },
  { icon: ICON_ASSIGN, label: "Auto-assignment" },
  { icon: ICON_FOLLOWUP, label: "Follow-up sequences" },
  { icon: ICON_HEALTH, label: "Account health" },
];

// Original abstract network graphic — a wireframe sphere of dots with a
// couple of connecting arcs, evoking WhatsApp's reach without copying any
// specific reference art.
function NetworkGraphic({ className }: { className: string }) {
  const dots: { cx: number; cy: number; r: number; o: number }[] = [];
  const rings = 9;
  for (let ring = 0; ring < rings; ring++) {
    const y = -140 + ring * 34;
    const rowRadius = Math.sqrt(Math.max(0, 150 * 150 - y * y));
    const count = Math.max(6, Math.round((rowRadius / 150) * 22));
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const x = Math.cos(angle) * rowRadius;
      const z = Math.sin(angle);
      if (z < -0.15) continue;
      dots.push({ cx: 200 + x, cy: 200 + y * 0.72, r: 1.2 + z * 0.6, o: 0.25 + z * 0.5 });
    }
  }
  const nodes = [
    { cx: 130, cy: 150 },
    { cx: 250, cy: 120 },
    { cx: 300, cy: 210 },
    { cx: 160, cy: 260 },
  ];

  return (
    <svg className={className} viewBox="0 0 400 400" aria-hidden="true">
      <defs>
        <radialGradient id="globe-fade" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#2BC786" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#2BC786" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="200" r="150" fill="url(#globe-fade)" />
      <circle cx="200" cy="200" r="150" fill="none" stroke="#22302B" strokeWidth="1" />
      {dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill="#2BC786" opacity={d.o} />
      ))}
      <path d="M130,150 Q215,80 300,210" fill="none" stroke="#2BC786" strokeOpacity="0.4" strokeWidth="1" />
      <path d="M160,260 Q230,240 250,120" fill="none" stroke="#2BC786" strokeOpacity="0.3" strokeWidth="1" />
      {nodes.map((n, i) => (
        <circle key={i} cx={n.cx} cy={n.cy} r="4" fill="#2BC786" />
      ))}
    </svg>
  );
}

/** Logo + headline. Sits above the form on every breakpoint. */
export function AuthBrandHeader() {
  return (
    <div className="auth-brand-header">
      <div className="auth-brand-logo">
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            fill="currentColor"
            fillRule="evenodd"
            clipRule="evenodd"
            d="M6,36 L6,20 A14,14 0 0 1 34,20 L34,36 L27,36 L27,21 A7,7 0 0 0 13,21 L13,36 Z"
          />
        </svg>
        <span>Dorway</span>
      </div>

      <h1 className="auth-brand-headline">
        Your team already sells on WhatsApp.
        <br />
        <span className="accent">Now you can actually run it.</span>
      </h1>
    </div>
  );
}

/** Lead copy, feature highlights, and the decorative graphic. Sits below the
 * form on mobile, and fills the rest of the left column on desktop. */
export function AuthBrandFooter() {
  return (
    <div className="auth-brand-footer">
      <p className="auth-brand-lead">
        Every enquiry lands in one shared inbox on your own WhatsApp Business number — assigned, followed up, and
        never lost.
      </p>

      <div className="auth-brand-features-wrap">
        <div className="auth-brand-features-label">
          <span className="rule" />
          Why teams switch
        </div>
        <div className="auth-brand-features">
          {FEATURES.map((f) => (
            <div className="auth-brand-feature" key={f.label}>
              <div className="auth-brand-feature-icon">{f.icon}</div>
              <div className="auth-brand-feature-label">{f.label}</div>
            </div>
          ))}
        </div>
      </div>

      <NetworkGraphic className="auth-brand-graphic" />
      <NetworkGraphic className="auth-brand-graphic-mobile" />

      <div className="auth-brand-tag">
        <span className="rule" />
        Built for teams that sell through WhatsApp.
      </div>
    </div>
  );
}
