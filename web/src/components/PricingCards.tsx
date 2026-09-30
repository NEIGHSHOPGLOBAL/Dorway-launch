import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlans, formatRupees, type TermMonths } from "../lib/usePlans";
import { useAuth } from "../lib/auth";
import { trackViewContent, trackAddToCart } from "../lib/pixel";

const FEATURE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export function PricingCards({ compact = false }: { compact?: boolean }) {
  const [termMonths, setTermMonths] = useState<TermMonths>(12);
  const { data, loading, error } = usePlans(termMonths);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (data?.plans.length) trackViewContent({ planCodes: data.plans.map((p) => p.code) });
  }, [data]);

  function choosePlan(planCode: string) {
    const plan = data?.plans.find((p) => p.code === planCode);
    if (plan) trackAddToCart({ planCode, valueRupees: (plan.ratePaiseMonth * termMonths) / 100 });
    const dest = `/checkout/${planCode}?term=${termMonths}`;
    navigate(user ? dest : `/login?next=${encodeURIComponent(dest)}`);
  }

  if (loading) {
    return <p className="lead text-center">Loading pricing…</p>;
  }
  if (error || !data) {
    return <p className="lead text-center">Couldn't load pricing right now. Refresh to try again.</p>;
  }

  return (
    <>
      {data.earlyBirdOpen && (
        <div className="early-bird-banner">
          Early-bird rate on 6 &amp; 12 month terms — locked for as long as your subscription stays active.
        </div>
      )}

      {!compact && (
        <div className="term-toggle">
          <div className="pricing-toggle" role="group" aria-label="Billing term">
            <button type="button" className={termMonths === 1 ? "active" : ""} onClick={() => setTermMonths(1)}>
              1 month
            </button>
            <button type="button" className={termMonths === 6 ? "active" : ""} onClick={() => setTermMonths(6)}>
              6 months
            </button>
            <button type="button" className={termMonths === 12 ? "active" : ""} onClick={() => setTermMonths(12)}>
              12 months <span className="pricing-badge">Best value</span>
            </button>
          </div>
        </div>
      )}

      <div className="pricing-grid single">
        {data.plans.map((plan) => (
          <div key={plan.code} className="card pricing-card popular">
            <div className="pricing-tier-name">{plan.name}</div>
            <div className="pricing-tier-desc">
              {plan.seatCap ? `Up to ${plan.seatCap} seats` : "Unlimited seats"} · {plan.numberCap} WhatsApp number
              {plan.numberCap > 1 ? "s" : ""}
            </div>
            <div className="pricing-price">
              {plan.isEarlyBirdRate && <span className="price-strike">{formatRupees(plan.normalPaiseMonth)}</span>}
              <span className="amount">{formatRupees(plan.ratePaiseMonth)}</span>
              <span className="period">/month</span>
            </div>
            {termMonths === 1 && (
              <p className="field-hint" style={{ marginTop: -16, marginBottom: 20 }}>
                Month-to-month — the early-bird rate applies to 6 &amp; 12 month prepaid terms.
              </p>
            )}
            <ul className="pricing-features">
              {plan.features.map((f) => (
                <li key={f}>
                  {FEATURE_ICON}
                  {f}
                </li>
              ))}
              <li className="note">Meta message charges billed separately, direct to Meta</li>
            </ul>
            <button className="btn btn-primary" onClick={() => choosePlan(plan.code)}>
              Try now
            </button>
          </div>
        ))}
      </div>

      <div className="pricing-note">
        <strong>About WhatsApp message charges.</strong> Meta charges for conversations separately from your Dorway
        subscription. You attach your own payment method to your own WhatsApp Business Account and pay Meta directly
        at their published rates — we don't mark it up or resell it.
      </div>
    </>
  );
}
