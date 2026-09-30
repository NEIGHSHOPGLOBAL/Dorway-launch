import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { adminHomePath } from "../../lib/adminHost";

export function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/admin/login", { username, password });
      navigate(adminHomePath(), { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Wrong username or password.");
      } else if (err instanceof ApiError && err.status === 429) {
        setError("Too many attempts. Try again in a few minutes.");
      } else {
        setError("Something went wrong. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell" style={{ background: "#0C1512", minHeight: "100vh" }}>
      <div className="card auth-card" style={{ background: "#121D19", borderColor: "#22302B" }}>
        <h1 style={{ color: "#EDF2EF" }}>Admin console</h1>
        <p className="lead" style={{ color: "#8A9A94" }}>Internal use only.</p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="username" style={{ color: "#EDF2EF" }}>Username</label>
            <input
              id="username"
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ background: "#0C1512", borderColor: "#22302B", color: "#EDF2EF" }}
            />
          </div>
          <div className="field">
            <label htmlFor="password" style={{ color: "#EDF2EF" }}>Password</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ background: "#0C1512", borderColor: "#22302B", color: "#EDF2EF" }}
            />
          </div>
          {error && <div className="field-error">{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy || !username || !password}>
            {busy ? <span className="spinner" /> : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
