import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlans, formatRupeesExact, type TermMonths } from "../../lib/usePlans";
import { TermPicker } from "../TermPicker";
import { trackFunnel } from "../../lib/funnel";
import { trackAddToCart } from "../../lib/pixel";
import { supportWaLink } from "../../lib/support";

const UNLOCK_LIST = [
  "Shared inbox on your own WhatsApp number",
  "Automatic lead assignment",
  "Follow-up reminders",
  "Pipeline for every lead",
  "Hands-on setup with our team",
];

export interface PaywallTrigger {
  trigger: string;
  headline: string;
}

// userchanges.md §5 — opens from any locked action. Right drawer on desktop,
// bottom sheet on mobile (driven by CSS, same markup). Goes straight to
// Checkout with the chosen term kept (S-5).
export function PaywallSheet({
  open,
  onClose,
  trigger,
  headline,
  businessName,
  defaultTerm = 12,
}: {
  open: boolean;
  onClose: () => void;
  trigger: string;
  headline: string;
  businessName: string;
  defaultTerm?: TermMonths;
}) {
  const [term, setTerm] = useState<TermMonths>(defaultTerm);
  const { data } = usePlans(term);
  const navigate = useNavigate();
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      trackFunnel("PAYWALL_OPENED", { trigger });
      setTimeout(() => closeBtnRef.current?.focus(), 10);
    }
  }, [open, trigger]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const plan = data?.plans[0];

  function changeTerm(t: TermMonths) {
    setTerm(t);
    trackFunnel("TERM_SELECTED", { termMonths: t });
  }

  function continueToCheckout() {
    if (!plan) return;
    trackAddToCart({ planCode: plan.code, valueRupees: plan.ratePaiseMonth / 100 });
    navigate(`/checkout/${plan.code}?term=${term}`);
  }

  return (
    <div className="paywall-backdrop" onClick={onClose}>
      <div className="paywall-sheet" role="dialog" aria-modal="true" aria-labelledby="paywall-headline" onClick={(e) => e.stopPropagation()}>
        <div className="paywall-sheet-head">
          <h2 id="paywall-headline">{headline}</h2>
          <button ref={closeBtnRef} className="paywall-close" aria-label="Close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <p className="field-hint">Unlock Dorway for {businessName}.</p>

        {data && <TermPicker terms={data.terms} selected={term} onChange={changeTerm} />}

        {data && (() => {
          const t = data.terms.find((x) => x.termMonths === term)!;
          return (
            <>
              <p className="paywall-price-line mono">
                {formatRupeesExact(t.subtotalPaise)} billed today + GST
                {t.savingsPaise > 0 && <> · you save {formatRupeesExact(t.savingsPaise)}</>}
              </p>
              <p className="field-hint">
                Your {term} months start on {new Date(data.accessStartsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}, launch day.
              </p>
            </>
          );
        })()}

        <div className="paywall-unlock-list">
          <div className="caption" style={{ marginBottom: 8 }}>What you unlock</div>
          {UNLOCK_LIST.map((item) => (
            <div key={item} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8, fontSize: 14 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, color: "var(--green)", flexShrink: 0, marginTop: 2 }}><polyline points="20 6 9 17 4 12" /></svg>
              {item}
            </div>
          ))}
        </div>

        <button className="btn btn-primary btn-block" onClick={continueToCheckout} disabled={!plan}>
          Continue to checkout
        </button>
        <p className="field-hint" style={{ textAlign: "center", marginTop: 10 }}>Secure payment · UPI, cards, netbanking</p>
        <a href={supportWaLink("Hi, I have a question about Dorway pricing")} target="_blank" rel="noreferrer" className="field-hint" style={{ display: "block", textAlign: "center" }}>
          Questions? Chat with us on WhatsApp
        </a>
      </div>
    </div>
  );
}
