import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MessageCircle, ShieldCheck, AlertCircle } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { trackCompleteRegistration } from "../lib/pixel";
import { getReferralCode } from "../lib/referral";

// Trimmed, 1:1 copy of the auth-screen rules from the partner program's
// design system (web/src/pages/partners/DorwayPartners.jsx `STYLES`), scoped
// under the same `.dw` root class, so this page matches that look exactly.
const AUTH_STYLES = `
.dw {
  --paper: #F6F8F5; --ink: #12211C; --ink-soft: #56675F; --line: #E3E7E1;
  --green: #0B8A5C; --green-deep: #065C3C; --mint: #DCF0E4; --mint-soft: #EEF7F1;
  --clay: #B24A3F;
  --ease: cubic-bezier(.22,.8,.24,1);
  --display: 'Comfortaa', ui-rounded, 'Segoe UI', system-ui, sans-serif;
  --body: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-family: var(--body); color: var(--ink); background: #fff;
  font-size: 16px; line-height: 1.65; -webkit-font-smoothing: antialiased; min-height: 100vh;
}
.dw *, .dw *::before, .dw *::after { box-sizing: border-box; }
:where(.dw) :where(h1, h2, h3, p) { margin: 0; }
:where(.dw) a { color: inherit; text-decoration: none; }
:where(.dw) button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; padding: 0; }
.dw :focus-visible { outline: 2px solid var(--green); outline-offset: 3px; border-radius: 8px; }

.dw-h2 { font-family: var(--display); font-weight: 700; font-size: 40px; line-height: 1.15; letter-spacing: -0.02em; }
.dw-h3 { font-family: var(--display); font-weight: 700; font-size: 24px; line-height: 1.25; letter-spacing: -0.01em; }
.dw-body { color: var(--ink-soft); }
.dw-small { font-size: 14px; line-height: 1.5; color: var(--ink-soft); }

.dw-logo svg { flex-shrink: 0; }
.dw-logo { display: inline-flex; align-items: center; gap: 10px; font-family: var(--display); font-weight: 700; font-size: 24px; letter-spacing: -0.02em; }

.dw-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 52px; padding: 0 26px; border-radius: 10px; font-weight: 600; font-size: 16px; white-space: nowrap;
  transition: background .25s var(--ease), border-color .25s var(--ease), color .25s var(--ease), translate .25s var(--ease), box-shadow .25s var(--ease), opacity .2s; }
.dw-btn:hover:not(:disabled) { translate: 0 -1px; }
.dw-btn:disabled { opacity: .45; cursor: not-allowed; }
.dw-btn--primary { background: var(--ink); color: #fff; }
.dw-btn--primary:hover:not(:disabled) { background: #1D3129; box-shadow: 0 10px 24px -12px rgba(18,33,28,.55); }
.dw-btn--block { width: 100%; }
.dw-spin { width: 16px; height: 16px; border-radius: 99px; border: 2px solid currentColor; border-right-color: transparent; animation: dw-rot .7s linear infinite; }
@keyframes dw-rot { to { transform: rotate(360deg); } }

.dw-textlink { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: var(--green); }
.dw-textlink:hover { color: var(--green-deep); }

.dw-auth { min-height: 100vh; display: grid; grid-template-columns: 1fr 1fr; }
.dw-auth__side { position: relative; overflow: hidden; isolation: isolate; background: var(--ink); color: #fff; padding: 40px 56px; display: flex; flex-direction: column; justify-content: space-between; }
.dw-auth__side .dw-arch { position: absolute; inset: 0; z-index: -1; color: #fff; opacity: .05; }
.dw-auth__side .dw-glow { position: absolute; inset: auto -20% -30% -20%; height: 90%; z-index: -1; background: radial-gradient(50% 60% at 50% 100%, rgba(31,168,114,.45) 0%, rgba(31,168,114,0) 70%); }
.dw-auth__side .dw-logo { color: #fff; }
.dw-auth__side-img { width: min(95%, 476px); height: auto; max-height: 82%; object-fit: contain; margin: 0 auto; display: block; border-radius: 20px; filter: drop-shadow(0 24px 40px rgba(0,0,0,.35)); }
.dw-auth__main { display: flex; flex-direction: column; padding: 32px 24px; }
.dw-auth__top { display: flex; justify-content: space-between; align-items: center; max-width: 460px; width: 100%; margin: 0 auto; }
.dw-auth__box { width: 100%; max-width: 460px; margin: auto; padding-block: 40px; }
.dw-auth__box > * { animation: dw-swap .5s var(--ease) both; }
@keyframes dw-swap { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.dw-auth__mlogo { visibility: hidden; }

.dw-field { display: flex; flex-direction: column; gap: 7px; margin-top: 18px; }
.dw-field label { font-weight: 500; font-size: 14.5px; }
.dw-input { height: 52px; border-radius: 12px; border: 1px solid #CDD4CE; background: #fff; padding: 0 16px; font: inherit; font-size: 16px; color: var(--ink); width: 100%; transition: border-color .2s, box-shadow .2s; }
.dw-input:focus { outline: none; border-color: var(--green); box-shadow: 0 0 0 4px rgba(11,138,92,.12); }
.dw-input.is-error { border-color: var(--clay); }
.dw-inputgroup { display: flex; align-items: stretch; border: 1px solid #CDD4CE; border-radius: 12px; overflow: hidden; background: #fff; transition: border-color .2s, box-shadow .2s; }
.dw-inputgroup:focus-within { border-color: var(--green); box-shadow: 0 0 0 4px rgba(11,138,92,.12); }
.dw-inputgroup.is-error { border-color: var(--clay); }
.dw-inputgroup__pre { display: flex; align-items: center; gap: 6px; padding: 0 14px; background: var(--paper); border-right: 1px solid var(--line); font-weight: 500; color: var(--ink-soft); }
.dw-inputgroup .dw-input { border: 0; border-radius: 0; box-shadow: none; }
.dw-err { color: var(--clay); font-size: 13.5px; display: flex; align-items: center; gap: 6px; }
.dw-hint { font-size: 13.5px; color: var(--ink-soft); }

.dw-otp { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-top: 24px; }
.dw-otp input { height: 60px; text-align: center; font-family: var(--mono); font-size: 24px; border-radius: 12px; border: 1px solid #CDD4CE; width: 100%; min-width: 0; transition: border-color .2s, box-shadow .2s, scale .2s var(--ease); }
.dw-otp input:focus { outline: none; border-color: var(--green); box-shadow: 0 0 0 4px rgba(11,138,92,.12); scale: 1.04; }
.dw-otp.is-error input { border-color: var(--clay); animation: dw-shake .4s ease; }
@keyframes dw-shake { 25% { translate: -4px 0; } 75% { translate: 4px 0; } }

.dw-waline { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 12px; background: var(--mint-soft); border: 1px solid #CFE6D8; font-size: 14px; margin-top: 18px; }
.dw-waline svg { color: var(--green); flex-shrink: 0; }

@media (max-width: 960px) {
  .dw-auth { grid-template-columns: 1fr; }
  .dw-auth__side { display: none; }
  .dw-auth__mlogo { visibility: visible; }
}
@media (prefers-reduced-motion: reduce) {
  .dw *, .dw *::before, .dw *::after { animation: none !important; transition: none !important; }
}
`;

function Mark({ size = 36 }: { size?: number }) {
  return (
    <img
      src="/logo.png"
      width={size}
      height={size}
      alt=""
      style={{ display: "block", borderRadius: size * 0.275, objectFit: "contain" }}
    />
  );
}

function ArchPattern({ id }: { id: string }) {
  return (
    <svg className="dw-arch" aria-hidden="true" width="100%" height="100%">
      <defs>
        <pattern id={id} width="64" height="72" patternUnits="userSpaceOnUse">
          <path d="M14 62V32a18 18 0 0 1 36 0v30" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

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
  const explicitNext = params.get("next");
  const next = explicitNext ?? "/dashboard";

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
      const res = await api.post<{ isNewUser: boolean }>("/auth/verify-otp", { phone, code, referralCode: getReferralCode() ?? undefined });
      await refresh();
      trackCompleteRegistration();
      navigate(res.isNewUser && !explicitNext ? "/welcome" : next, { replace: true });
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
    <div className="dw">
      <style>{AUTH_STYLES}</style>
      <div className="dw-auth">
        <aside className="dw-auth__side">
          <ArchPattern id="dw-arch-login" />
          <div className="dw-glow" aria-hidden="true" />
          <Link to="/" className="dw-logo"><Mark /><span>dorway</span></Link>
          <img src="/login-left.png" alt="Shared WhatsApp inbox: every enquiry lands in one shared inbox, assigned, followed up, and never lost." className="dw-auth__side-img" />
          <p style={{ color: "#8FA89C", fontSize: 13.5 }}>Your number is only used to verify you and send account updates on WhatsApp.</p>
        </aside>

        <div className="dw-auth__main">
          <div className="dw-auth__top">
            <span className="dw-auth__mlogo">
              <Link to="/" className="dw-logo"><Mark size={30} /><span style={{ color: "var(--ink)" }}>dorway</span></Link>
            </span>
          </div>

          <div className="dw-auth__box" key={step}>
            {step === "identify" ? (
              <form onSubmit={requestOtp} noValidate>
                <h1 className="dw-h3" style={{ fontSize: 30 }}>Log in or create your account</h1>
                <p className="dw-body" style={{ marginTop: 8 }}>We'll send a one-time code to your WhatsApp.</p>

                <div className="dw-field">
                  <label htmlFor="f-phone">WhatsApp number</label>
                  <div className={`dw-inputgroup ${error ? "is-error" : ""}`}>
                    <span className="dw-inputgroup__pre">+91</span>
                    <input
                      id="f-phone"
                      className="dw-input"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="98765 43210"
                      autoFocus
                    />
                  </div>
                  {error ? (
                    <span className="dw-err"><AlertCircle size={14} />{error}</span>
                  ) : (
                    <span className="dw-hint">The code arrives on WhatsApp on this number.</span>
                  )}
                </div>

                <button type="submit" className="dw-btn dw-btn--primary dw-btn--block" style={{ marginTop: 26 }} disabled={busy || phone.length < 10}>
                  {busy ? <span className="dw-spin" /> : <MessageCircle size={18} />}{busy ? "Sending code" : "Send code on WhatsApp"}
                </button>

                <p className="dw-small" style={{ marginTop: 16, textAlign: "center" }}>
                  By continuing you agree to our{" "}
                  <Link className="dw-textlink" to="/legal/terms">Terms</Link> &{" "}
                  <Link className="dw-textlink" to="/legal/privacy">Privacy Policy</Link>.
                </p>
              </form>
            ) : (
              <div>
                <h1 className="dw-h3" style={{ fontSize: 30 }}>Enter the code</h1>
                <div className="dw-waline">
                  <MessageCircle size={18} />
                  <span>
                    Sent on WhatsApp to <strong className="dw-mono">+91 {phone.slice(0, 5)} {phone.slice(5)}</strong>.{" "}
                    <button type="button" className="dw-textlink" onClick={() => { setStep("identify"); setDigits(["", "", "", "", "", ""]); setError(null); }}>
                      Change
                    </button>
                  </span>
                </div>

                <form onSubmit={verifyOtp}>
                  <div className={`dw-otp ${error ? "is-error" : ""}`} role="group" aria-label="One-time code">
                    {digits.map((d, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          inputsRef.current[i] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        aria-label={`Digit ${i + 1}`}
                        autoComplete={i === 0 ? "one-time-code" : "off"}
                        maxLength={1}
                        value={d}
                        onChange={(e) => updateDigit(i, e.target.value)}
                        onKeyDown={(e) => onKeyDown(i, e)}
                        onPaste={onPaste}
                      />
                    ))}
                  </div>
                  {error && <p className="dw-err" style={{ marginTop: 12 }}><AlertCircle size={14} />{error}</p>}
                  <button type="submit" className="dw-btn dw-btn--primary dw-btn--block" style={{ marginTop: 22 }} disabled={busy || digits.join("").length !== 6}>
                    {busy ? <span className="dw-spin" /> : <ShieldCheck size={18} />}{busy ? "Verifying" : "Verify and continue"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
