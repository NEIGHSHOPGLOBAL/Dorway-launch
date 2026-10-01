# Dorway — Customer Flow (as built)

**Scope:** the authenticated customer journey from first login through to the post-purchase dashboard: **Login → Pricing → Checkout → Checkout return → Dashboard**. This documents what is actually implemented today (not a spec to build toward) — file paths and endpoints point at the real code.

**Design system:** every screen in this flow uses the light bottle-green system shared with the landing page and partner program — Comfortaa for headings, Inter for body text, JetBrains Mono for numbers/codes. There is no dark mode anywhere in this flow (`web/src/styles/design-system.css`, `app.css`).

---

## 0. Flow at a glance

```
  ?ref=<code> captured ──────────────────────────────────┐
  (web/src/lib/referral.ts, on any page load)             │
                                                           ▼
┌──────────┐      ┌───────────┐      ┌──────────┐   ┌───────────┐   ┌───────────┐
│  Login   │ ───▶ │  Pricing  │ ───▶ │ Checkout │ ─▶│  Checkout │ ─▶│ Dashboard │
│ (OTP)    │      │ (/pricing)│      │(/checkout│   │  return   │   │(/dashboard│
│ /login   │      │           │      │ /:plan)  │   │           │   │    )      │
└──────────┘      └───────────┘      └──────────┘   └───────────┘   └─────┬─────┘
                                                                            │
                                                                            ▼
                                                                  Onboarding setup
                                                                  (/onboarding/setup)
```

A visitor can enter this flow from **Pricing** directly (anonymous) and gets bounced to **Login** first; everything after Login requires a session cookie (`dw_session`, httpOnly, 30-day JWT — `server/src/lib/session.ts`).

---

## 1. Login — `web/src/pages/Login.tsx`, `/login`

**Auth method:** phone number + WhatsApp OTP. No password, ever.

| Step | What happens |
|---|---|
| 1 | User lands on `/login` (directly, or redirected here with `?next=<path>` by a guarded page). Left panel is the branded marketing column (`AuthBrandPanel.tsx`); right panel is the form. |
| 2 | Enters a 10-digit number → `POST /api/auth/request-otp { phone }`. |
| 3 | Server normalizes to E.164, rate-limits (3 per 15 min per phone, 10 per hour per IP — `lib/rateLimit.ts`), creates a `login_otps` row (code hashed with bcrypt), and sends the WhatsApp OTP template `dorway_login_otp` (`lib/whatsapp.ts`). If `WHATSAPP_OTP_ENABLED` is off, the code is logged to the server console instead (`[dev email] OTP for …`). |
| 4 | UI switches to the 6-box OTP screen. Paste-to-fill and auto-advance are supported (`otp-boxes` in `app.css`). |
| 5 | On submit → `POST /api/auth/verify-otp { phone, code, referralCode }`. `referralCode` is read from the `dw_ref` cookie set by `captureReferralFromUrl()` if the visitor arrived via a partner link (`web/src/lib/referral.ts`). |
| 6 | Server verifies the code (max 5 attempts, 5-minute expiry), **upserts** the `User` row by phone (first login = account creation), issues the session cookie, and — **only on first-ever signup** — logs the `IDENTIFIED` onboarding event and runs referral attribution (`routes/auth.ts`, `lib/partnerAttribution.ts`). |
| 7 | Frontend calls `refresh()` on the shared `AuthProvider` (`lib/auth.tsx`) to pull `/api/auth/me`, fires the Meta Pixel `CompleteRegistration` event, then navigates to `next` (default `/pricing`). |

**Errors shown:** `whatsapp_otp_disabled`, `whatsapp_send_failed`, `invalid_phone`, `expired_or_missing`, `too_many_attempts`, `wrong_code` — mapped to plain-language copy in `Login.tsx`.

**Data touched:** `users` (upsert), `login_otps` (create/consume), `onboarding_events` (first login only), `referrals`/`referral_events` (first login only, if a referral code is present).

---

## 2. Pricing — `web/src/pages/Pricing.tsx`, `/pricing`

The plan-purchasing page. Reachable without logging in — choosing a plan is what forces the login gate.

| Element | Source |
|---|---|
| Launch countdown | `GET /api/launch-state` → server-authoritative `serverTime`/`launchAt`; client ticks a local `requestAnimationFrame` loop off the server/client clock offset so it can't be spoofed by changing the device clock (`useCountdown` in `Pricing.tsx`). Only shown while `phase === "PRE_LAUNCH"`. |
| Plan cards | `<PricingCards />` (`web/src/components/PricingCards.tsx`), fed by `usePlans(termMonths)` → `GET /api/plans?termMonths=`. |
| Term toggle | 1 / 6 / 12 months. Early-bird pricing only applies to 6 & 12-month prepaid terms — picking 1-month always shows the normal rate (`lib/pricing.ts` `effectiveRatePaise`). |
| Early-bird banner | Shown when `earlyBirdOpen` is true (server checks launch date, seat cap, and force-close flag against the count of early-bird `PAID` orders — `routes/plans.ts`). |
| "Try now" | `choosePlan()` fires the Meta Pixel `AddToCart` event, then routes to `/checkout/:planCode?term=<n>` — or to `/login?next=<that URL>` first if there's no session. |

Today there is exactly one active plan ("Dorway", `growth`), so the grid renders a single centered card rather than a 3-column comparison (`pricing-grid single` in `app.css`).

**Data touched:** read-only (`plans`, `launch_config`, a `PAID`-order count for the early-bird seat check).

---

## 3. Checkout — `web/src/pages/Checkout.tsx`, `/checkout/:planCode`

Guarded: redirects to `/login?next=…` if there's no session (checked via `useAuth()`).

| Step | What happens |
|---|---|
| 1 | Pre-fills name/business/GSTIN from the logged-in user. Fires Meta Pixel `InitiateCheckout` once per plan+term combination. |
| 2 | User picks a billing state (or enters a GSTIN — a valid GSTIN's state prefix silently overrides the manually picked state, never a hard error — `onboarding.md §7.2`). |
| 3 | Live quote: `GET /api/checkout/quote?planCode&termMonths&stateCode&gstin` recomputes CGST/SGST (intra-state) or IGST (inter-state) against `SUPPLIER_STATE_CODE` — this is a preview only, nothing is created or charged yet. |
| 4 | Optional **partner referral code** field, pre-filled from the `dw_ref` cookie but editable — a typed code here overrides whatever the cookie says. |
| 5 | "Pay" → `POST /api/checkout { planCode, termMonths, stateCode, gstin?, referralCode? }`. Server re-derives everything server-side (never trusts the client's quote), creates an `Order` row, attaches the referral if one resolves, and calls Cashfree to create a hosted-checkout session. |
| 6 | If Cashfree isn't configured (`CASHFREE_APP_ID`/`SECRET` unset — the default in this environment), the server returns `503 payments_not_configured` and the UI shows a "payments aren't live yet — join the waitlist" state instead of a broken redirect. |
| 7 | Otherwise, the Cashfree JS SDK (`sdk.cashfree.com/js/v3/cashfree.js`, loaded in `index.html`) opens its hosted payment widget in-page. Pixel fires `AddPaymentInfo` right before the widget opens. |
| 8 | On completion Cashfree redirects the browser to `returnUrl` = `/checkout/return?order_id={order_id}`. |

**Money math** lives entirely server-side (`lib/pricing.ts`, `lib/gst.ts`) — the client-shown quote is cosmetic only; `POST /checkout` recomputes the real order from scratch.

**Data touched:** `orders` (create), `users` (GSTIN/billing-state backfill, `onboardingStep → PLAN_SELECTED`), `onboarding_events` (`PLAN_SELECTED`), `referrals`/`referral_events` (`checkout_started`, if a code resolves).

---

## 4. Checkout return — `web/src/pages/CheckoutReturn.tsx`, `/checkout/return`

A polling landing page — the **webhook**, not this page, is the actual source of truth for payment success.

| Step | What happens |
|---|---|
| 1 | Reads `order_id` from the query string, polls `GET /api/orders/:id` every 3s (up to 20 times) while status is `CREATED`/`PENDING` — covers UPI's up-to-a-minute settlement lag. |
| 2 | **Meanwhile, server-side:** Cashfree's `PAYMENT_SUCCESS_WEBHOOK` hits `POST /api/webhooks/cashfree` (HMAC-signature-verified, replay-guarded via a `webhook_events` dedupe key). Inside one transaction: `Payment` row created, `Order.status → PAID`, `User.onboardingStep → PAID`, an `onboarding_events` `PAID` row is logged, an `Entitlement` is created (`accessStartsAt` = the real launch date, so paying early never costs a day), and — if the order carries a referral — a `Commission` is created `on_hold` and the partner's speed-bonus window is re-evaluated (`routes/checkout.ts`). A receipt email is sent (or console-logged if Resend isn't configured). |
| 3 | Once polling sees `PAID`: fires Meta Pixel `Purchase` (deduped per order via `sessionStorage`), shows the paid plan + amount, and a 3-step "what happens next" preview (WhatsApp setup → Meta verification → launch countdown) with a **Start setup** button to `/onboarding/setup`. |
| 4 | If the order resolves to `FAILED`: "Payment didn't go through, no money was taken" with a retry link back to `/pricing`. |
| 5 | If `order_id` is missing or the lookup errors: a generic "we couldn't find that order, refunds are automatic" notice. |

**Data touched:** read-only polling from the client; all writes happen in the webhook handler described above.

---

## 5. Dashboard — `web/src/pages/Dashboard.tsx`, `/dashboard`

Guarded: redirects to `/login?next=/dashboard` if logged out. The post-purchase home base.

| Element | Source |
|---|---|
| Greeting | First name from `onboarding_profiles`/`users`, falls back to "Your dashboard". |
| Launch countdown | Same `launchAt`-driven ticking countdown as Pricing, shown only while there's time left; includes early-bird seats-remaining copy. |
| Setup checklist | Five rows, each `done` / `active` / `locked`, derived client-side from `GET /api/onboarding/state` (`useOnboardingState.ts`): **Account created** (always done) → **Choose your plan** (done once there's an `Entitlement`) → **Connect your WhatsApp number** (active once a plan exists, done once `setup.submittedAt` is set) → **Add your team** (locked — no module yet) → **Open your inbox** (locked until the real launch date). |
| Progress bar | `doneCount / rows.length`. |
| Log out | Navigates to `/` first, then calls `logout()`, so the page's own "redirect to login if logged out" guard doesn't race the click and win. |

From here, **Start setup** leads to `/onboarding/setup` — the four-section WhatsApp/Meta-verification accordion (`onboarding/Setup.tsx`): WhatsApp number, business/legal details, document upload, and an optional "I already have a WABA" section. Each section autosaves independently; submitting logs the `SETUP_SUBMITTED` onboarding event and flips the checklist row to done.

**Data touched:** read-only (`GET /onboarding/state` aggregates `users`, `entitlements`, `onboarding_profiles`, `launch_config`).

---

## 6. API reference for this flow

```
POST /api/auth/request-otp        { phone }                                    -> { ok, channel }
POST /api/auth/verify-otp         { phone, code, referralCode? }                -> { ok, user } (+ Set-Cookie dw_session)
GET  /api/auth/me                                                               -> User
POST /api/auth/logout                                                           -> { ok }

GET  /api/launch-state                                                          -> phase, launchAt, earlyBirdOpen, earlyBirdRemaining
GET  /api/plans?termMonths=1|6|12                                               -> { earlyBirdOpen, gstPercent, plans[] }

GET  /api/checkout/quote?planCode&termMonths&stateCode&gstin?                   -> preview totals (no write)
POST /api/checkout                { planCode, termMonths, stateCode, gstin?, referralCode? } -> { paymentSessionId, orderId } | 503
GET  /api/orders/:id                                                            -> order status (polled by CheckoutReturn)
POST /api/webhooks/cashfree       (Cashfree → server, HMAC-signed)              -> marks orders paid/failed/refunded

GET  /api/onboarding/state                                                      -> Dashboard checklist data
POST /api/onboarding/profile      { fullName, businessName, businessCity, fallbackEmail? }
POST /api/onboarding/setup/section-a|b|d
POST /api/onboarding/documents    (multipart)
POST /api/onboarding/setup/submit
```

---

## 7. Known gaps in this environment

- **Cashfree isn't configured** (`CASHFREE_APP_ID`/`SECRET` empty) — Checkout will return `503` until sandbox keys are added to `server/.env`. No code changes needed once they land.
- **Resend isn't configured** — OTP codes and receipts print to the server console (`[dev email] …`) instead of sending.
- **WhatsApp OTP** depends on `WHATSAPP_OTP_ENABLED` + real Meta credentials in `server/.env`; falls back to console-logging the code when either is missing.
- **"Add your team"** and **"Open your inbox"** dashboard rows are permanently locked — those modules don't exist yet (by design, per `superadmin.md` §0's out-of-scope list).
