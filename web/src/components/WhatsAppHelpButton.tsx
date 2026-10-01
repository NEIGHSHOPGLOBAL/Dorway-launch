import { supportWaLink } from "../lib/support";

// userchanges.md X-4 — floating "Chat with us" on Pricing/Checkout/preview.
// Hidden on mobile Checkout (shown in the summary bar there instead —
// Checkout.tsx has its own "Secured by Cashfree" trust row with no WhatsApp
// link needed since the pay bar already covers that space).
export function WhatsAppHelpButton({ page, term, hideOnMobile = false }: { page: string; term?: number; hideOnMobile?: boolean }) {
  const text = `Hi, I have a question about Dorway${term ? ` (${term} month plan)` : ""} — I'm on the ${page} page.`;
  return (
    <a
      href={supportWaLink(text)}
      target="_blank"
      rel="noreferrer"
      className={`wa-help-btn${hideOnMobile ? " hide-mobile" : ""}`}
      aria-label="Chat with us on WhatsApp"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39c1.45.79 3.08 1.21 4.75 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.03c-.24.68-1.42 1.3-1.95 1.34-.5.05-1.03.24-3.46-.72-2.93-1.16-4.8-4.13-4.95-4.32-.14-.2-1.18-1.57-1.18-3 0-1.42.75-2.12 1.01-2.41.26-.29.58-.36.77-.36.19 0 .39 0 .55.01.18.01.42-.07.65.5.24.58.82 2 .89 2.15.07.14.12.31.02.5-.1.19-.15.31-.29.48-.14.17-.3.37-.43.5-.14.14-.29.29-.12.57.17.29.76 1.26 1.63 2.04 1.12 1 2.06 1.31 2.35 1.46.29.14.46.12.63-.07.17-.19.72-.84.91-1.13.19-.29.38-.24.64-.14.26.1 1.65.78 1.94.92.29.14.48.21.55.33.07.12.07.67-.17 1.35z" /></svg>
    </a>
  );
}
