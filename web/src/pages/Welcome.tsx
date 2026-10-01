import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { trackFunnel } from "../lib/funnel";

const TEAM_SIZES = ["Just me", "2–5", "6–15", "16+"] as const;

// userchanges.md §3 — first-login-only profile step. A preview titled
// "Kapoor Interiors" converts better than "Your dashboard".
export function Welcome() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [businessName, setBusinessName] = useState(user?.businessName ?? "");
  const [businessCity, setBusinessCity] = useState(user?.businessCity ?? "");
  const [teamSize, setTeamSize] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/onboarding/profile", {
        fullName,
        businessName,
        businessCity,
        teamSize: teamSize ?? undefined,
      });
      await refresh();
      navigate("/dashboard", { replace: true });
    } catch {
      setError("Couldn't save that — try again.");
    } finally {
      setBusy(false);
    }
  }

  function skip() {
    trackFunnel("PROFILE_SKIPPED");
    navigate("/dashboard", { replace: true });
  }

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <div className="caption" style={{ marginBottom: 8 }}>Step 1 of 2 · About your business</div>
        <h1>Tell us about your business</h1>
        <p className="lead">Four quick fields — this personalises the preview you're about to see.</p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="fullName">Your name</label>
            <input id="fullName" type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Rohan Kapoor" />
          </div>
          <div className="field">
            <label htmlFor="businessName">Business name</label>
            <input id="businessName" type="text" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Kapoor Interiors" />
          </div>
          <div className="field">
            <label htmlFor="businessCity">City</label>
            <input id="businessCity" type="text" required value={businessCity} onChange={(e) => setBusinessCity(e.target.value)} placeholder="Delhi" />
          </div>
          <div className="field">
            <label>How many people reply to customers on WhatsApp? (optional)</label>
            <div className="chip-row">
              {TEAM_SIZES.map((size) => (
                <button
                  type="button"
                  key={size}
                  className={`chip${teamSize === size ? " selected" : ""}`}
                  onClick={() => setTeamSize(teamSize === size ? null : size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          {error && <div className="field-error">{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy || !fullName || !businessName || !businessCity}>
            {busy ? <span className="spinner" /> : "Show my workspace"}
          </button>
        </form>
        <div className="auth-switch">
          <button onClick={skip}>Skip for now</button>
        </div>
      </div>
    </div>
  );
}
