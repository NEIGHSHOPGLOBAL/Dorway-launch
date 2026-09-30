import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export function OnboardingProfile() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessCity, setBusinessCity] = useState("");
  const [fallback, setFallback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsFallback = user && !user.email;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, string> = { fullName, businessName, businessCity };
      if (needsFallback && fallback) body.fallbackEmail = fallback;
      await api.post("/onboarding/profile", body);
      await refresh();
      navigate("/dashboard", { replace: true });
    } catch {
      setError("Couldn't save that — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <h1>Who are you?</h1>
        <p className="lead">Four quick fields — everything else waits until it's actually needed.</p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="fullName">Your name</label>
            <input id="fullName" type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Rohit Agarwal" />
          </div>
          <div className="field">
            <label htmlFor="businessName">Business name</label>
            <input
              id="businessName"
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Sunstone Interiors"
            />
            <div className="field-hint">Used for your invoice, Meta verification, and your WhatsApp display name.</div>
          </div>
          <div className="field">
            <label htmlFor="businessCity">City</label>
            <input id="businessCity" type="text" required value={businessCity} onChange={(e) => setBusinessCity(e.target.value)} placeholder="Delhi" />
          </div>
          {needsFallback && (
            <div className="field">
              <label htmlFor="fallback">Email (optional)</label>
              <input id="fallback" type="email" value={fallback} onChange={(e) => setFallback(e.target.value)} placeholder="you@business.com" />
              <div className="field-hint">A fallback channel, in case WhatsApp isn't reachable.</div>
            </div>
          )}
          {error && <div className="field-error">{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy || !fullName || !businessName || !businessCity}>
            {busy ? <span className="spinner" /> : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
