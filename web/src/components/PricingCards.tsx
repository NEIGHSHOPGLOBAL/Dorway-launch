import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlans, formatRupees, formatRupeesExact, type TermMonths } from "../lib/usePlans";
import { useOnboardingState } from "../lib/useOnboardingState";
import { useAuth } from "../lib/auth";
import { trackViewContent, trackAddToCart } from "../lib/pixel";
import { TermPicker } from "./TermPicker";

const FEATURE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const REASSURANCE = [
  { title: "Your number, your data", body: "You connect your own WhatsApp Business Account." },
  { title: "Setup done with you", body: "Our team calls you after purchase and helps you go live." },
  { title: "Pay now, start at launch", body: "Your term starts on launch day, not today." },
];

const FAQ = [
  { q: "What happens after I pay?", a: "Our team reviews your account and WhatsApps you within 1 working day to book a setup call." },
  { q: "When does my plan start?", a: "On launch day — not the day you pay. Paying early never costs you a day." },
  { q: "Do I need my own WhatsApp number?", a: "Yes — Dorway connects to your own WhatsApp Business Account. We help you set it up on the call." },
  { q: "Can I get a GST invoice?", a: "Yes — add your GSTIN at checkout and we'll email you one automatically." },
  { q: "What if I change my mind?", a: "Full refund, no questions, any time before launch." },
];

export function PricingCards({ compact = false }: { compact?: boolean }) {
  const [termMonths, setTermMonths] = useState<TermMonths>(12);
  const { data, loading, error } = usePlans(termMonths);
  const { user } = useAuth();
  const { data: onboarding } = useOnboardingState();
  const navigate = useNavigate();

  useEffect(() => {
    if (data?.plans.length) trackViewContent({ planCodes: data.plans.map((p) => p.code) });
  }, [data]);

  if (loading) {
    return <p className="lead text-center">Loading pricing…</p>;
  }
  if (error || !data) {
    return <p className="lead text-center">Couldn't load pricing right now. Refresh to try again.</p>;
  }

  const plan = data.plans[0];
  const term = data.terms.find((t) => t.termMonths === termMonths)!;

  function continueToCheckout() {
    trackAddToCart({ planCode: plan.code, valueRupees: term.monthlyRatePaise / 100 });
    const dest = `/checkout/${plan.code}?term=${termMonths}`;
    navigate(user ? dest : `/login?next=${encodeURIComponent(dest)}`);
  }

  // PR-7 — already entitled: replace the selector with the summary.
  if (onboarding?.entitlement) {
    const e = onboarding.entitlement;
    return (
      <div className="card pricing-summary-panel" style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
        <h3 style={{ fontFamily: "Comfortaa, cursive", marginBottom: 8 }}>You're on Dorway</h3>
        <p className="lead" style={{ fontSize: 15 }}>
          {e.termMonths} months · starts {new Date(e.accessStartsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}
        </p>
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate("/billing")}>Go to billing</button>
      </div>
    );
  }

  return (
    <>
      {!compact && <TermPicker terms={data.terms} selected={termMonths} onChange={setTermMonths} />}

      <div className="card pricing-summary-panel">
        <div className="pricing-price">
          <span className="amount">{formatRupees(term.monthlyRatePaise)}</span>
          <span className="period">/month</span>
        </div>
        <div className="summary-row"><span>Billed today</span><span className="mono">{formatRupeesExact(term.subtotalPaise)}</span></div>
        <div className="summary-row"><span>GST (18%)</span><span className="mono">+ {formatRupeesExact(term.gstPaise)}</span></div>
        {term.savingsPaise > 0 && (
          <div className="summary-row"><span>You save</span><span className="mono" style={{ color: "var(--green)" }}>{formatRupeesExact(term.savingsPaise)}</span></div>
        )}
        <div className="summary-row total"><span>Total due</span><span>{formatRupeesExact(term.totalPaise)}</span></div>
        <p className="field-hint" style={{ textAlign: "center" }}>
          Starts {new Date(data.accessStartsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}, launch day.
        </p>
        <button className="btn btn-primary btn-block" onClick={continueToCheckout}>
          {user ? "Continue to checkout" : "Get started"}
        </button>
      </div>

      {!compact && (
        <>
          <div className="pricing-included">
            <ul className="pricing-features two-col">
              {plan.features.map((f) => (
                <li key={f}>{FEATURE_ICON}{f}</li>
              ))}
            </ul>
          </div>

          <div className="reassurance-tiles">
            {REASSURANCE.map((r) => (
              <div key={r.title} className="reassurance-tile">
                <h3>{r.title}</h3>
                <p>{r.body}</p>
              </div>
            ))}
          </div>

          <div className="pricing-note">
            <strong>No per-message markup from us.</strong> WhatsApp's own message charges are billed by Meta to your
            account, at their published rates.
          </div>

          <div className="pricing-faq">
            {FAQ.map((f) => (
              <details key={f.q} className="pricing-faq-item">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </>
      )}
    </>
  );
}
