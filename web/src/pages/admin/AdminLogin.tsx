import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { adminHomePath } from "../../lib/adminHost";

function Mark() {
  return <img src="/logo.png" width="40" height="40" alt="" style={{ display: "block", borderRadius: 11, objectFit: "contain" }} />;
}

export function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="admin-login">
      <div className="admin-login-card">
        <div className="admin-login-brand">
          <Mark />
          <div>
            <span className="admin-login-word">dorway</span>
            <span className="admin-login-kicker">Admin</span>
          </div>
        </div>
        <h1>Sign in</h1>
        <p className="admin-login-lead">Internal console for onboarding, purchases, and partners.</p>
        <form onSubmit={submit}>
          <div className="admin-login-field">
            <label htmlFor="admin-username">Username</label>
            <input
              id="admin-username"
              type="text"
              required
              autoComplete="username"
              autoFocus
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="admin-login-field">
            <label htmlFor="admin-password">Password</label>
            <div className="admin-login-pass">
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="admin-login-eye"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          {error && (
            <div className="admin-login-error" role="alert">
              {error}
            </div>
          )}
          <button className="admin-login-submit" type="submit" disabled={busy || !username || !password}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
