import type { TermData, TermMonths } from "../lib/usePlans";
import { formatRupees } from "../lib/usePlans";

const TERM_LABEL: Record<TermMonths, string> = { 1: "1 month", 6: "6 months", 12: "12 months" };

/**
 * userchanges.md — "the same three term cards" used identically by the
 * Pricing page (PR-2), the paywall sheet (S-1) and Checkout's "Change"
 * popover (C-4). Radio-group semantics per X-9.
 */
export function TermPicker({
  terms,
  selected,
  onChange,
  compact = false,
}: {
  terms: TermData[];
  selected: TermMonths;
  onChange: (term: TermMonths) => void;
  compact?: boolean;
}) {
  return (
    <div className={`term-picker${compact ? " compact" : ""}`} role="radiogroup" aria-label="Billing term">
      {terms.map((t) => {
        const isSelected = t.termMonths === selected;
        return (
          <button
            key={t.termMonths}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={`term-card${isSelected ? " selected" : ""}`}
            onClick={() => onChange(t.termMonths)}
          >
            {t.badge && <span className="term-card__badge">{t.badge}</span>}
            <span className="term-card__label">{TERM_LABEL[t.termMonths]}</span>
            <span className="term-card__price mono">{formatRupees(t.monthlyRatePaise)}<span className="term-card__period">/mo</span></span>
            {isSelected && (
              <span className="term-card__check" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
