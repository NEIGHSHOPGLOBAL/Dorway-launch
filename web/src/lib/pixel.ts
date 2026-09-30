declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function fbq(...args: unknown[]) {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq(...args);
}

/** SPA navigations. Skip the first load — the base snippet in index.html already sent PageView. */
export function trackPageView() {
  fbq("track", "PageView");
}

export function trackInitiateCheckout(opts: { planCode: string; valueRupees?: number }) {
  fbq("track", "InitiateCheckout", {
    currency: "INR",
    content_ids: [opts.planCode],
    content_type: "product",
    ...(opts.valueRupees != null ? { value: opts.valueRupees } : {}),
  });
}

export function trackCompleteRegistration() {
  fbq("track", "CompleteRegistration");
}

const viewedContent = new Set<string>();
/** Pricing/plan list came into view. Dedup per plan-code set so term-toggle re-renders don't refire. */
export function trackViewContent(opts: { planCodes: string[] }) {
  const key = opts.planCodes.slice().sort().join(",");
  if (viewedContent.has(key)) return;
  viewedContent.add(key);
  fbq("track", "ViewContent", {
    currency: "INR",
    content_ids: opts.planCodes,
    content_type: "product_group",
  });
}

/** A plan's "Try now" was clicked — the visitor picked an item before checking out. */
export function trackAddToCart(opts: { planCode: string; valueRupees: number }) {
  fbq("track", "AddToCart", {
    value: opts.valueRupees,
    currency: "INR",
    content_ids: [opts.planCode],
    content_type: "product",
  });
}

/** Cashfree's payment widget is about to open — closest client-side proxy for "entered payment details". */
export function trackAddPaymentInfo(opts: { planCode: string; valueRupees: number }) {
  fbq("track", "AddPaymentInfo", {
    value: opts.valueRupees,
    currency: "INR",
    content_ids: [opts.planCode],
    content_type: "product",
  });
}

/** Waitlist signup — a real lead capture (contact info in exchange for early access). */
export function trackLead(opts: { planCode?: string } = {}) {
  if (opts.planCode) {
    fbq("track", "Lead", { content_ids: [opts.planCode], content_type: "product" });
  } else {
    fbq("track", "Lead");
  }
}

/** Contact-page email/phone click — someone reaching out directly. */
export function trackContact() {
  fbq("track", "Contact");
}

/** Fires the Meta Pixel standard "Purchase" event. Call once per completed order. */
export function trackPurchase(opts: { orderId: string; valueRupees: number; planCode: string }) {
  fbq(
    "track",
    "Purchase",
    {
      value: opts.valueRupees,
      currency: "INR",
      content_ids: [opts.planCode],
      content_type: "product",
    },
    { eventID: `purchase_${opts.orderId}` },
  );
}
