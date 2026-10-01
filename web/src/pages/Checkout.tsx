import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { usePlans, formatRupees, formatRupeesExact, type TermMonths } from "../lib/usePlans";
import { useAuth } from "../lib/auth";
import { INDIAN_STATES, GSTIN_RE, stateFromGstin } from "../lib/gstStates";
import { trackInitiateCheckout, trackAddPaymentInfo } from "../lib/pixel";
import { trackFunnel } from "../lib/funnel";
import { getReferralCode } from "../lib/referral";
import { TermPicker } from "../components/TermPicker";
import { WhatsAppHelpButton } from "../components/WhatsAppHelpButton";

declare global {
  interface Window {
    Cashfree?: (opts: { mode: "sandbox" | "production" }) => {
      checkout: (opts: { paymentSessionId: string; redirectTarget?: string }) => void;
    };
  }
}

interface Quote {
  discountPercent: number;
  ratePaiseMonth: number;
  savingsPaise: number;
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  placeOfSupply: string;
  resolvedFromGstin: boolean;
}

let cashfreeSdkPromise: Promise<void> | null = null;
/** userchanges.md X-10 — load the Cashfree SDK only on this route, not globally. */
function loadCashfreeSdk(): Promise<void> {
  if (window.Cashfree) return Promise.resolve();
  if (!cashfreeSdkPromise) {
    cashfreeSdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("cashfree_sdk_failed"));
      document.head.appendChild(script);
    });
  }
  return cashfreeSdkPromise;
}

const AFTER_PAY_STEPS = [
  "Payment confirmed · instant",
  "Our team reviews your account · 1 working day",
  "Setup call on WhatsApp · we'll reach out",
  "Go live on launch day",
];

export function Checkout() {
  const { planCode } = useParams<{ planCode: string }>();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const initialTerm = params.get("term") === "1" ? 1 : params.get("term") === "6" ? 6 : 12;
  const [termMonths, setTermMonths] = useState<TermMonths>(initialTerm);
  const { data } = usePlans(termMonths);
  const [businessName, setBusinessName] = useState("");
  const [invoiceEmail, setInvoiceEmail] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [gstinEnabled, setGstinEnabled] = useState(false);
  const [gstin, setGstin] = useState("");
  const [referralOpen, setReferralOpen] = useState(() => Boolean(getReferralCode()));
  const [referralCode, setReferralCode] = useState(() => getReferralCode() ?? "");
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "pending" | "error"; message: string } | null>(null);
  const [termPopoverOpen, setTermPopoverOpen] = useState(false);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const idempotencyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`, { replace: true });
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) {
      setBusinessName(user.businessName ?? "");
      setInvoiceEmail(user.email ?? "");
      if (user.gstin) {
        setGstin(user.gstin);
        setGstinEnabled(true);
      }
    }
  }, [user]);

  useEffect(() => {
    loadCashfreeSdk().catch(() => {});
  }, []);

  const plan = data?.plans.find((p) => p.code === planCode);
  const selectedTerm = data?.terms.find((t) => t.termMonths === termMonths);
  const gstinValue = gstinEnabled ? gstin.trim().toUpperCase() : "";
  const gstinValid = gstinValue === "" || GSTIN_RE.test(gstinValue);
  const effectiveState = gstinValid && gstinValue ? stateFromGstin(gstinValue) : stateCode;

  useEffect(() => {
    if (!plan) return;
    trackInitiateCheckout({ planCode: plan.code, valueRupees: selectedTerm ? selectedTerm.totalPaise / 100 : undefined });
    trackFunnel("CHECKOUT_VIEWED", { planCode: plan.code, termMonths });
    // Fire once per plan+term visit, not on every quote refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.code, termMonths]);

  useEffect(() => {
    if (!plan || !effectiveState) {
      setQuote(null);
      return;
    }
    setQuoteLoading(true);
    const qparams = new URLSearchParams({ planCode: plan.code, termMonths: String(termMonths), stateCode: effectiveState });
    if (gstinValid && gstinValue) qparams.set("gstin", gstinValue);
    api
      .get<Quote>(`/checkout/quote?${qparams.toString()}`)
      .then(setQuote)
      .catch(() => setQuote(null))
      .finally(() => setQuoteLoading(false));
  }, [plan, termMonths, effectiveState, gstinValue, gstinValid]);

  useEffect(() => {
    const code = referralCode.trim();
    if (!code) {
      setReferralValid(null);
      return;
    }
    const timer = setTimeout(() => {
      api
        .get<{ valid: boolean }>(`/checkout/referral?code=${encodeURIComponent(code)}`)
        .then((r) => setReferralValid(r.valid))
        .catch(() => setReferralValid(null));
    }, 350);
    return () => clearTimeout(timer);
  }, [referralCode]);

  function changeTerm(t: TermMonths) {
    setTermMonths(t);
    setTermPopoverOpen(false);
    const next = new URLSearchParams(params);
    next.set("term", String(t));
    setParams(next, { replace: true });
  }

  async function pay() {
    if (!plan || !effectiveState || !quote || !invoiceEmail.trim()) return;
    if (!idempotencyRef.current) idempotencyRef.current = crypto.randomUUID();
    setBusy(true);
    setNotice(null);
    trackFunnel("PAY_CLICKED", { planCode: plan.code, termMonths });
    try {
      const profileChanges: Record<string, string> = {};
      if (businessName.trim() && businessName !== user?.businessName) profileChanges.businessName = businessName.trim();
      if (Object.keys(profileChanges).length > 0) {
        await api.patch("/auth/me", profileChanges);
      }
      const res = await api.post<{ paymentSessionId: string; orderId: string; cashfreeMode?: "sandbox" | "production" }>("/checkout", {
        planCode: plan.code,
        termMonths,
        stateCode: effectiveState,
        gstin: gstinValid && gstinValue ? gstinValue : undefined,
        invoiceEmail: invoiceEmail.trim(),
        referralCode: referralCode.trim() || undefined,
      });

      await loadCashfreeSdk();
      if (window.Cashfree) {
        trackAddPaymentInfo({ planCode: plan.code, valueRupees: quote.totalPaise / 100 });
        const cf = window.Cashfree({ mode: res.cashfreeMode === "production" ? "production" : "sandbox" });
        cf.checkout({ paymentSessionId: res.paymentSessionId, redirectTarget: "_self" });
      } else {
        navigate(`/checkout/return?order_id=${res.orderId}`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        setNotice({ type: "pending", message: "Payments open soon. We'll WhatsApp you the moment they do." });
      } else if (err instanceof ApiError && err.status === 429) {
        setNotice({ type: "error", message: "Too many checkout attempts. Wait a couple of minutes, then try Pay again." });
      } else {
        setNotice({ type: "error", message: "Something went wrong starting checkout. Try again in a moment." });
      }
    } finally {
      setBusy(false);
    }
  }

  function notifyMe() {
    trackFunnel("PAYMENT_NOTIFY_REQUESTED", { planCode });
    setNotice({ type: "pending", message: "Got it — we'll WhatsApp you the moment payments open." });
  }

  if (!plan || !selectedTerm) {
    return (
      <section className="page-hero">
        <div className="container"><p className="lead">Loading plan…</p></div>
      </section>
    );
  }

  const payDisabled = busy || !quote || quoteLoading || !invoiceEmail.trim() || !effectiveState;
  const payLabel = quote ? `Pay ${formatRupeesExact(quote.totalPaise)}` : "Pay";

  const summary = (
    <div className="card checkout-summary" style={{ opacity: quoteLoading ? 0.6 : 1, transition: "opacity 150ms ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <h2>Order summary</h2>
        <div style={{ position: "relative" }}>
          <button className="auth-switch" style={{ background: "none", border: "none", color: "var(--green)", fontWeight: 600, fontSize: 13, padding: 0, cursor: "pointer" }} onClick={() => setTermPopoverOpen((v) => !v)}>
            Change
          </button>
          {termPopoverOpen && data && (
            <div className="card" style={{ position: "absolute", right: 0, top: 24, zIndex: 20, width: 280, padding: 12 }}>
              <TermPicker terms={data.terms} selected={termMonths} onChange={changeTerm} compact />
            </div>
          )}
        </div>
      </div>
      <div className="summary-row"><span>{plan.name} · {termMonths} months</span><span /></div>
      <div className="summary-row"><span className="mono">{formatRupees(selectedTerm.monthlyRatePaise)} × {termMonths} months</span><span /></div>
      {quote ? (
        <>
          <div className="summary-row"><span>Subtotal</span><span className="mono">{formatRupeesExact(quote.subtotalPaise)}</span></div>
          {quote.savingsPaise > 0 && (
            <div className="summary-row"><span>Discount {quote.discountPercent}%</span><span className="mono" style={{ color: "var(--green)" }}>−{formatRupeesExact(quote.savingsPaise)}</span></div>
          )}
          {quote.igstPaise > 0 ? (
            <div className="summary-row"><span>IGST 18%</span><span className="mono">{formatRupeesExact(quote.igstPaise)}</span></div>
          ) : (
            <>
              <div className="summary-row"><span>CGST 9%</span><span className="mono">{formatRupeesExact(quote.cgstPaise)}</span></div>
              <div className="summary-row"><span>SGST 9%</span><span className="mono">{formatRupeesExact(quote.sgstPaise)}</span></div>
            </>
          )}
          <div className="summary-row total"><span>Total today</span><span>{formatRupeesExact(quote.totalPaise)}</span></div>
        </>
      ) : (
        <div className="summary-row"><span>Select a billing state to see GST</span><span /></div>
      )}

      {data && (
        <p className="field-hint" style={{ marginTop: 4 }}>
          Starts {new Date(data.accessStartsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long" })} (launch day)
        </p>
      )}

      {notice && (
        <div className={`payment-notice ${notice.type}`} style={{ marginTop: 16 }}>
          {notice.message}
          {notice.type === "pending" && notice.message.startsWith("Payments open") && (
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-secondary" onClick={notifyMe}>Notify me</button>
            </div>
          )}
        </div>
      )}

      <button className="btn btn-primary btn-block" style={{ marginTop: 20 }} onClick={pay} disabled={payDisabled}>
        {busy ? <span className="spinner" /> : payLabel}
      </button>

      <div className="checkout-trust">
        <span>UPI · Cards · Netbanking</span>
        <span>🔒 Secured by Cashfree</span>
        <span>You'll get a GST invoice by email.</span>
      </div>
    </div>
  );

  return (
    <section style={{ paddingTop: 48 }}>
      <div className="container">
        <Link to="/dashboard" className="field-hint" style={{ display: "inline-block", marginBottom: 20 }}>← Back to workspace</Link>

        {/* Mobile tappable summary bar (C-1) */}
        <button
          type="button"
          className="checkout-mobile-bar"
          onClick={() => setMobileSummaryOpen((v) => !v)}
        >
          <span>{plan.name} · {termMonths} months · {quote ? formatRupeesExact(quote.totalPaise) : "…"}</span>
          <span>{mobileSummaryOpen ? "▲" : "▼"}</span>
        </button>
        {mobileSummaryOpen && <div className="checkout-mobile-summary">{summary}</div>}

        <div className="checkout-grid">
          <div>
            <h1 style={{ fontFamily: "Comfortaa, cursive", fontSize: 32, marginBottom: 24 }}>
              You're getting {plan.name}
            </h1>

            <div className="field">
              <label htmlFor="businessName">Business name</label>
              <input id="businessName" type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Kapoor Interiors" />
            </div>

            <div className="field">
              <label htmlFor="invoiceEmail">Email for invoice</label>
              <input id="invoiceEmail" type="email" required value={invoiceEmail} onChange={(e) => setInvoiceEmail(e.target.value)} placeholder="rohan@kapoor.in" />
              <div className="field-hint">Your receipt and GST invoice go here.</div>
            </div>

            <div className="field">
              <label htmlFor="stateCode">Billing state</label>
              <select
                id="stateCode"
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                disabled={gstinEnabled && gstinValid && Boolean(gstinValue)}
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
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 14 }}>
                <input type="checkbox" checked={gstinEnabled} onChange={(e) => setGstinEnabled(e.target.checked)} />
                I need a GST invoice
              </label>
              {gstinEnabled && (
                <div style={{ marginTop: 10 }}>
                  <input
                    id="gstin"
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="22AAAAA0000A1Z5"
                  />
                  {!gstinValid && <div className="field-error">That doesn't look like a valid GSTIN.</div>}
                  {gstinValid && gstinValue && (
                    <div className="field-hint" style={{ color: "var(--green-deep)" }}>
                      ✓ {INDIAN_STATES.find((s) => s.code === stateFromGstin(gstinValue))?.name}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="field">
              {!referralOpen ? (
                <button type="button" className="auth-switch" style={{ background: "none", border: "none", color: "var(--green)", fontWeight: 600, fontSize: 14, padding: 0, cursor: "pointer" }} onClick={() => setReferralOpen(true)}>
                  + Add referral code
                </button>
              ) : (
                <>
                  <label htmlFor="referralCode">Partner referral code</label>
                  <input
                    id="referralCode"
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                    placeholder="K7MQ2"
                  />
                  {referralValid === true && <div className="field-hint" style={{ color: "var(--green-deep)" }}>✓ Code applied</div>}
                  {referralValid === false && <div className="field-error">Code not found</div>}
                </>
              )}
            </div>

            <div style={{ marginTop: 32 }}>
              <h3 style={{ fontFamily: "Comfortaa, cursive", fontSize: 17, marginBottom: 16 }}>After you pay</h3>
              {AFTER_PAY_STEPS.map((step, i) => (
                <div key={step} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                  <span className="checklist-icon active" style={{ flexShrink: 0 }}>{i + 1}</span>
                  <div className="checklist-text" style={{ paddingTop: 2 }}>{step}</div>
                </div>
              ))}
            </div>

            <p className="field-hint" style={{ marginTop: 24 }}>
              Full refund, no questions, any time before launch. Billing starts from actual launch day, not from
              today — if launch slips, your term slips with it.
            </p>
          </div>

          <div className="checkout-summary-col">{summary}</div>
        </div>

        {/* Sticky mobile pay bar (C-1) */}
        <div className="checkout-pay-bar">
          <span className="mono">{quote ? formatRupeesExact(quote.totalPaise) : "…"}</span>
          <button className="btn btn-primary" onClick={pay} disabled={payDisabled}>
            {busy ? <span className="spinner" /> : payLabel}
          </button>
        </div>
      </div>
      <WhatsAppHelpButton page="checkout" term={termMonths} hideOnMobile />
    </section>
  );
}
