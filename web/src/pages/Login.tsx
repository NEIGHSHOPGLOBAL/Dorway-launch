import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { AuthBrandHeader, AuthBrandFooter } from "../components/AuthBrandPanel";
import { trackCompleteRegistration } from "../lib/pixel";

const REQUEST_ERROR_MESSAGES: Record<string, string> = {
  whatsapp_otp_disabled: "WhatsApp login isn't available right now — try again shortly.",
  whatsapp_send_failed: "Couldn't send that WhatsApp message. Check the number and try again.",
  invalid_phone: "That doesn't look like a valid phone number.",
};

const VERIFY_ERROR_MESSAGES: Record<string, string> = {
  expired_or_missing: "That code has expired — request a new one.",
  too_many_attempts: "Too many attempts. Request a new code.",
  wrong_code: "That code isn't right. Try again.",
  invalid_phone: "That doesn't look like a valid phone number.",
};

export function Login() {
  const [step, setStep] = useState<"identify" | "otp">("identify");
  const [phone, setPhone] = useState("");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { refresh } = useAuth();
  const next = params.get("next") ?? "/pricing";

  async function requestOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/auth/request-otp", { phone });
      setStep("otp");
      setTimeout(() => inputsRef.current[0]?.focus(), 50);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(REQUEST_ERROR_MESSAGES[err.code ?? ""] ?? "Something went wrong sending your code. Try again.");
      } else {
        setError("Something went wrong sending your code. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  function updateDigit(i: number, value: string) {
    const v = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < 5) inputsRef.current[i + 1]?.focus();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputsRef.current[i - 1]?.focus();
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) {
      e.preventDefault();
      setDigits(text.split(""));
      inputsRef.current[5]?.focus();
    }
  }

  async function verifyOtp(e: FormEvent) {
    e.preventDefault();
    const code = digits.join("");
    if (code.length !== 6) return;
    setError(null);
    setBusy(true);
    try {
      await api.post("/auth/verify-otp", { phone, code });
      await refresh();
      trackCompleteRegistration();
      navigate(next, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(VERIFY_ERROR_MESSAGES[err.code ?? ""] ?? "Couldn't verify that code.");
      } else {
        setError("Couldn't verify that code.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-split">
      <AuthBrandHeader />

      <div className="auth-form-panel">
        <div className="auth-form-inner">
          {step === "identify" ? (
            <>
              <h1>Get started</h1>
              <p className="lead">We'll send a code to your WhatsApp — no password to remember.</p>
              <form onSubmit={requestOtp}>
                <div className="field">
                  <label htmlFor="phone">WhatsApp number</label>
                  <input
                    id="phone"
                    type="tel"
                    required
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="98765 43210"
                  />
                </div>
                {error && <div className="field-error">{error}</div>}
                <button className="btn btn-primary btn-block" type="submit" disabled={busy || !phone}>
                  {busy ? <span className="spinner" /> : "Send code"}
                </button>
              </form>
              <p className="field-hint" style={{ textAlign: "center", marginTop: 20 }}>
                By continuing you agree to our{" "}
                <Link to="/legal/terms" style={{ color: "var(--green)" }}>Terms</Link> &{" "}
                <Link to="/legal/privacy" style={{ color: "var(--green)" }}>Privacy Policy</Link>.
              </p>
            </>
          ) : (
            <>
              <h1>Enter your code</h1>
              <p className="lead">Sent via WhatsApp to {phone}. It expires in 5 minutes.</p>
              <form onSubmit={verifyOtp}>
                <div className="field">
                  <label>Six-digit code</label>
                  <div className="otp-boxes">
                    {digits.map((d, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          inputsRef.current[i] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        autoComplete={i === 0 ? "one-time-code" : "off"}
                        maxLength={1}
                        value={d}
                        onChange={(e) => updateDigit(i, e.target.value)}
                        onKeyDown={(e) => onKeyDown(i, e)}
                        onPaste={onPaste}
                      />
                    ))}
                  </div>
                  {error && <div className="field-error">{error}</div>}
                </div>
                <button className="btn btn-primary btn-block" type="submit" disabled={busy || digits.join("").length !== 6}>
                  {busy ? <span className="spinner" /> : "Verify and continue"}
                </button>
              </form>
              <div className="auth-switch">
                <button
                  onClick={() => {
                    setStep("identify");
                    setDigits(["", "", "", "", "", ""]);
                    setError(null);
                  }}
                >
                  Use a different number
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <AuthBrandFooter />
    </div>
  );
}
