import { api } from "./api";

// partners.md §7.1: a click on a partner link is remembered for
// PROGRAM.attributionDays (60) via a first-party cookie. A code typed later
// at checkout overrides it — see Checkout.tsx.
const REF_COOKIE = "dw_ref";
const REF_DAYS = 60;
const VISITOR_KEY = "dw_visitor_id";

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 86_400_000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function getVisitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

export function getReferralCode(): string | null {
  return getCookie(REF_COOKIE);
}

/** Call once on app load. Reads ?ref=<code>, remembers it, and logs a link_opened event. */
export function captureReferralFromUrl() {
  const ref = new URLSearchParams(window.location.search).get("ref");
  if (!ref) return;
  setCookie(REF_COOKIE, ref, REF_DAYS);
  api.post("/partners/track", { code: ref, visitorId: getVisitorId() }).catch(() => {});
}
