import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useOnboardingState } from "../lib/useOnboardingState";

interface Row {
  key: string;
  title: string;
  detail?: string;
  state: "done" | "active" | "locked";
  lockedReason?: string;
  cta?: { label: string; to: string };
}

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

export function Dashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const { data, loading } = useOnboardingState();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login?next=/dashboard", { replace: true });
  }, [authLoading, user, navigate]);

  const remaining = useCountdown(data?.launch?.launchAt ?? null);

  if (!user || loading || !data) {
    return (
      <section className="page-hero">
        <div className="container"><p className="lead">Loading…</p></div>
      </section>
    );
  }

  const hasPlan = Boolean(data.entitlement);
  const setupDone = Boolean(data.setup.submittedAt);

  const rows: Row[] = [
    { key: "account", title: "Account created", state: "done" },
    {
      key: "plan",
      title: "Choose your plan",
      detail: hasPlan ? undefined : "Lock the founding rate before we open",
      state: hasPlan ? "done" : "active",
      cta: hasPlan ? undefined : { label: "Choose", to: "/pricing" },
    },
    {
      key: "setup",
      title: "Connect your WhatsApp number",
      state: setupDone ? "done" : hasPlan ? "active" : "locked",
      lockedReason: hasPlan ? undefined : "Available after you choose a plan",
      cta: setupDone ? undefined : hasPlan ? { label: "Start setup", to: "/onboarding/setup" } : undefined,
    },
    {
      key: "team",
      title: "Add your team",
      state: "locked",
      lockedReason: "Available once your WhatsApp setup is submitted",
    },
    {
      key: "inbox",
      title: "Open your inbox",
      state: "locked",
      lockedReason: data.launch ? `Unlocks ${new Date(data.launch.launchAt).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}` : undefined,
    },
  ];
  const doneCount = rows.filter((r) => r.state === "done").length;

  const days = remaining !== null ? Math.floor(remaining / 86400000) : null;
  const hours = remaining !== null ? Math.floor((remaining % 86400000) / 3600000) : null;
  const mins = remaining !== null ? Math.floor((remaining % 3600000) / 60000) : null;
  const secs = remaining !== null ? Math.floor((remaining % 60000) / 1000) : null;

  return (
    <section style={{ paddingTop: 64, paddingBottom: 96 }}>
      <div className="container" style={{ maxWidth: 680 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <h1 style={{ fontFamily: "Comfortaa, cursive", fontSize: 28 }}>
            {data.profile.fullName ? `Hey, ${data.profile.fullName.split(" ")[0]}` : "Your dashboard"}
          </h1>
          <button
            className="btn btn-secondary"
            onClick={() => {
              // Navigate away first so this page's own "redirect to /login if
              // logged out" guard doesn't race the click handler and win.
              navigate("/", { replace: true });
              logout();
            }}
          >
            Log out
          </button>
        </div>

        {data.launch && remaining !== null && remaining > 0 && (
          <div className="card account-panel" style={{ textAlign: "center" }}>
            <div className="caption">Dorway opens in</div>
            <div className="countdown" style={{ marginTop: 12 }}>
              <div className="countdown-cell"><div className="num">{days}</div><div className="unit">days</div></div>
              <div className="countdown-cell"><div className="num">{String(hours).padStart(2, "0")}</div><div className="unit">hrs</div></div>
              <div className="countdown-cell"><div className="num">{String(mins).padStart(2, "0")}</div><div className="unit">min</div></div>
              <div className="countdown-cell"><div className="num">{String(secs).padStart(2, "0")}</div><div className="unit">sec</div></div>
            </div>
            {data.launch.earlyBirdSeatsLeft !== null && (
              <p className="field-hint" style={{ marginTop: 12 }}>
                Founding rate ends when we launch. {data.launch.earlyBirdSeatsLeft} places left.
              </p>
            )}
          </div>
        )}

        <div className="card account-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h2 style={{ marginBottom: 0 }}>Your setup</h2>
            <span className="caption">{doneCount} of {rows.length} done</span>
          </div>
          <div className="progress-track" style={{ marginBottom: 24 }}>
            <div className="progress-fill" style={{ width: `${(doneCount / rows.length) * 100}%` }} />
          </div>

          {rows.map((row) => (
            <div key={row.key} className="checklist-row">
              <span className={`checklist-icon ${row.state}`}>
                {row.state === "done" ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : row.state === "active" ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                ) : (
                  <span className="hollow-dot" />
                )}
              </span>
              <div className="checklist-text">
                <div className={`checklist-title ${row.state}`}>{row.title}</div>
                {row.detail && row.state === "active" && <div className="field-hint" style={{ margin: 0 }}>{row.detail}</div>}
                {row.lockedReason && row.state === "locked" && <div className="field-hint" style={{ margin: 0 }}>{row.lockedReason}</div>}
              </div>
              {row.cta && (
                <button className="btn btn-primary btn-nav" onClick={() => navigate(row.cta!.to)}>
                  {row.cta.label}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
