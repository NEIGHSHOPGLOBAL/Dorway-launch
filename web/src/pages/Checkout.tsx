import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { usePlans, formatRupees, type TermMonths } from "../lib/usePlans";
import { useAuth } from "../lib/auth";
import { INDIAN_STATES, GSTIN_RE, stateFromGstin } from "../lib/gstStates";
import { trackInitiateCheckout, trackAddPaymentInfo, trackLead } from "../lib/pixel";
import { getReferralCode } from "../lib/referral";

declare global {
  interface Window {
    Cashfree?: (opts: { mode: "sandbox" | "production" }) => {
      checkout: (opts: { paymentSessionId: string; redirectTarget?: string }) => void;
    };
  }
}

interface Quote {
  isEarlyBird: boolean;
  ratePaiseMonth: number;
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  placeOfSupply: string;
  resolvedFromGstin: boolean;
}

export function Checkout() {
  const { planCode } = useParams<{ planCode: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const initialTerm = params.get("term") === "1" ? 1 : params.get("term") === "6" ? 6 : 12;
  const [termMonths, setTermMonths] = useState<TermMonths>(initialTerm);
  const { data } = usePlans(termMonths);
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [gstin, setGstin] = useState("");
  const [address, setAddress] = useState("");
  const [referralCode, setReferralCode] = useState(() => getReferralCode() ?? "");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "pending" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`, { replace: true });
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName ?? "");
      setBusinessName(user.businessName ?? "");
      setGstin(user.gstin ?? "");
    }
  }, [user]);

  const plan = data?.plans.find((p) => p.code === planCode);
  const gstinValid = gstin.trim() === "" || GSTIN_RE.test(gstin.trim().toUpperCase());
  const effectiveState = gstinValid && gstin.trim() && GSTIN_RE.test(gstin.trim().toUpperCase()) ? stateFromGstin(gstin.trim().toUpperCase()) : stateCode;

  useEffect(() => {
    if (!plan) return;
    trackInitiateCheckout({
      planCode: plan.code,
      valueRupees: quote ? quote.totalPaise / 100 : undefined,
    });
    // Fire once per plan+term visit, not on every quote refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.code, termMonths]);

  useEffect(() => {
    if (!plan || !effectiveState) {
      setQuote(null);
      return;
    }
    const params = new URLSearchParams({ planCode: plan.code, termMonths: String(termMonths), stateCode: effectiveState });
    if (gstinValid && gstin.trim()) params.set("gstin", gstin.trim().toUpperCase());
    api
      .get<Quote>(`/checkout/quote?${params.toString()}`)
      .then(setQuote)
      .catch(() => setQuote(null));
  }, [plan, termMonths, effectiveState, gstin, gstinValid]);

  async function pay() {
    if (!plan || !effectiveState || !quote) return;
    setBusy(true);
    setNotice(null);
    try {
      const profileChanges: Record<string, string> = {};
      if (fullName.trim() && fullName !== user?.fullName) profileChanges.fullName = fullName.trim();
      if (businessName.trim() && businessName !== user?.businessName) profileChanges.businessName = businessName.trim();
      if (Object.keys(profileChanges).length > 0) {
        await api.patch("/auth/me", profileChanges);
      }
      const res = await api.post<{ paymentSessionId: string; orderId: string; cashfreeMode?: "sandbox" | "production" }>("/checkout", {
        planCode: plan.code,
        termMonths,
        stateCode: effectiveState,
        gstin: gstinValid && gstin.trim() ? gstin.trim().toUpperCase() : undefined,
        referralCode: referralCode.trim() || undefined,
      });

      if (window.Cashfree) {
        trackAddPaymentInfo({ planCode: plan.code, valueRupees: quote.totalPaise / 100 });
        const cf = window.Cashfree({ mode: res.cashfreeMode === "production" ? "production" : "sandbox" });
        cf.checkout({ paymentSessionId: res.paymentSessionId, redirectTarget: "_self" });
      } else {
        navigate(`/checkout/return?order_id=${res.orderId}`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        setNotice({
          type: "pending",
          message:
            "Payments aren't live yet — the Cashfree merchant account is still being configured. Join the waitlist and we'll email you the moment checkout opens.",
        });
      } else if (err instanceof ApiError && err.status === 429) {
        setNotice({
          type: "error",
          message: "Too many checkout attempts. Wait a couple of minutes, then try Pay again.",
        });
      } else {
        setNotice({ type: "error", message: "Something went wrong starting checkout. Try again in a moment." });
      }
    } finally {
      setBusy(false);
    }
  }

  async function joinWaitlist() {
    if (!user) return;
    await api.post("/waitlist", { email: user.email ?? undefined, source: "checkout_abandon", planIntent: planCode });
    trackLead({ planCode });
    setNotice({ type: "pending", message: "You're on the list — we'll email you the moment checkout opens." });
  }

  if (!plan) {
    return (
      <section className="page-hero">
        <div className="container"><p className="lead">Loading plan…</p></div>
      </section>
    );
  }

  const discountPaise = (plan.normalPaiseMonth - plan.ratePaiseMonth) * termMonths;

  return (
    <section style={{ paddingTop: 64 }}>
      <div className="container">
        <div className="checkout-grid">
          <div>
            <h1 style={{ fontFamily: "Comfortaa, cursive", fontSize: 32, marginBottom: 24 }}>
              You're getting {plan.name}
            </h1>

            {notice && (
              <div className={`payment-notice ${notice.type}`}>
                {notice.message}
                {notice.type === "pending" && (
                  <div style={{ marginTop: 12 }}>
                    <button className="btn btn-secondary" onClick={joinWaitlist}>Join the waitlist</button>
                  </div>
                )}
              </div>
            )}

            <div className="term-pill-row">
              <button className={`term-pill${termMonths === 1 ? " active" : ""}`} onClick={() => setTermMonths(1)}>
                1 month
              </button>
              <button className={`term-pill${termMonths === 6 ? " active" : ""}`} onClick={() => setTermMonths(6)}>
                6 months
              </button>
              <button className={`term-pill${termMonths === 12 ? " active" : ""}`} onClick={() => setTermMonths(12)}>
                12 months
              </button>
            </div>
            {termMonths === 1 && (
              <p className="field-hint" style={{ marginTop: -8, marginBottom: 20 }}>
                Month-to-month is billed at the normal rate — the early-bird discount applies to 6 &amp; 12 month terms.
              </p>
            )}

            <div className="field">
              <label htmlFor="fullName">Your name (optional)</label>
              <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Rohit Agarwal" />
            </div>

            <div className="field">
              <label htmlFor="businessName">Business name</label>
              <input id="businessName" type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Sunstone Interiors" />
            </div>

            <div className="field">
              <label htmlFor="stateCode">Billing state</label>
              <select
                id="stateCode"
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                disabled={Boolean(quote?.resolvedFromGstin)}
                style={{ width: "100%", height: 48, borderRadius: "var(--radius-md)", border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)", padding: "0 16px", fontSize: 16 }}
              >
                <option value="">Select a state</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
              <div className="field-hint">Sets the GST that applies.</div>
            </div>

            <div className="field">
              <label htmlFor="gstin">GSTIN (optional)</label>
              <input
                id="gstin"
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="22AAAAA0000A1Z5"
              />
              {!gstinValid && <div className="field-error">That doesn't look like a valid GSTIN.</div>}
              {quote?.resolvedFromGstin && (
                <div className="field-hint">
                  Billing state set to {INDIAN_STATES.find((s) => s.code === quote.placeOfSupply)?.name} from your GSTIN.
                </div>
              )}
              <div className="field-hint">Add it to claim input credit.</div>
            </div>

            <div className="field">
              <label htmlFor="address">Billing address (optional)</label>
              <input id="address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>

            <div className="field">
              <label htmlFor="referralCode">Partner referral code (optional)</label>
              <input
                id="referralCode"
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                placeholder="maple-river-quiet-orbit-lotus"
              />
              <div className="field-hint">Got a 5-word code from a Dorway partner? Enter it here.</div>
            </div>

            <p className="field-hint">
              Full refund, no questions, any time before launch and up to 7 days after. Billing starts from actual
              launch day, not from today — if launch slips, your term slips with it.
            </p>
          </div>

          <div className="card checkout-summary">
            <h2>Order summary</h2>
            <div className="summary-row"><span>{plan.name} × {termMonths} months</span><span className="mono">{formatRupees(plan.normalPaiseMonth * termMonths)}</span></div>
            {discountPaise > 0 && (
              <div className="summary-row"><span>Founding discount</span><span className="mono" style={{ color: "var(--green)" }}>−{formatRupees(discountPaise)}</span></div>
            )}
            {quote ? (
              <>
                <div className="summary-row"><span>Net</span><span className="mono">{formatRupees(quote.subtotalPaise)}</span></div>
                {quote.igstPaise > 0 ? (
                  <div className="summary-row"><span>IGST (18%)</span><span className="mono">{formatRupees(quote.igstPaise)}</span></div>
                ) : (
                  <>
                    <div className="summary-row"><span>CGST (9%)</span><span className="mono">{formatRupees(quote.cgstPaise)}</span></div>
                    <div className="summary-row"><span>SGST (9%)</span><span className="mono">{formatRupees(quote.sgstPaise)}</span></div>
                  </>
                )}
                <div className="summary-row total"><span>Total</span><span>{formatRupees(quote.totalPaise)}</span></div>
              </>
            ) : (
              <div className="summary-row"><span>Select a billing state to see GST</span><span /></div>
            )}
            <button className="btn btn-primary btn-block" style={{ marginTop: 20 }} onClick={pay} disabled={busy || !quote}>
              {busy ? <span className="spinner" /> : quote ? `Pay ${formatRupees(quote.totalPaise)}` : "Pay"}
            </button>
            <p className="field-hint" style={{ marginTop: 12, textAlign: "center" }}>
              Secured by Cashfree. Full refund any time before launch.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
