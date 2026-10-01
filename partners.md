# Dorway Partner Program — Developer Handoff

**Frontend:** `DorwayPartners.jsx` (single React file, runs on mock data today)
**Related:** `DorwayLanding.jsx` (main site; footer links to `/partners`)
**Status:** UI complete and clickable end to end. Backend, tracking, payouts and admin are not built.

This document is what you need to take the partner program from a mock-driven UI to production. Read sections 1 to 3 first. Section 12 lists decisions the business still owes you. Build around them, but don't hard-code a guess.

---

## 1. What the program does

A partner signs up with name, phone and email, and verifies the phone with a WhatsApp OTP. They get a unique **5-word referral code** (for example `maple-river-quiet-orbit-lotus`) and a referral link (`https://dorway.in/?ref=<code>`).

When a business signs up through the link, or types the code at checkout, and pays, the partner earns commission. The partner dashboard shows:

- how often the code or link was used
- abandoned checkouts
- completed checkouts
- pending and approved payouts

### Rules (current assumptions, all configurable)

| Rule | Value | Config key |
|---|---|---|
| Commission | 10% of each completed checkout | `PROGRAM.commissionRate` |
| Commission applies to | The referred customer's **first** completed checkout | `PROGRAM.commissionOn` ⚠️ see §12 |
| Speed bonus | ₹1,000 for every 10 completed checkouts within 7 days | `PROGRAM.bonus` |
| Minimum payout | ₹2,000 approved balance before a payout can be requested | `PROGRAM.minPayout` ⚠️ see §12 |
| Hold period | 30 days (refund window) before commission is approved | `PROGRAM.holdDays` |
| Attribution window | 60 days from link click | `PROGRAM.attributionDays` |
| Payout SLA | 7 working days from request | `PROGRAM.payoutSla` |
| OTP | 6 digits, 30 s resend, 5 min expiry | `PROGRAM.otp` |

**Server is the source of truth for every rule.** The `PROGRAM` object in the frontend only drives copy and display. Mirror these values in server config and never trust amounts or eligibility sent from the client.

---

## 2. Frontend overview

### 2.1 Routes (hash router today)

| Route | Screen |
|---|---|
| `#/` | Partner landing page with earnings calculator |
| `#/join` | Register: details → WhatsApp OTP → code reveal |
| `#/login` | Login: phone → WhatsApp OTP → dashboard |
| `#/dashboard` | Tabs: Overview, Code activity, Checkouts, Payouts, Share kit, Settings |

The hash router exists so the file runs standalone. In the real app:

- Move to `react-router` with the paths `/partners`, `/partners/join`, `/partners/login` and `/partners/dashboard`.
- Guard the dashboard route on a server session.

### 2.2 File layout inside `DorwayPartners.jsx`

The sections appear in this order. Suggested split when you break it up:

| Section in file | Suggested module |
|---|---|
| `PROGRAM`, `PLAN_VALUES` | `config/partnerProgram.ts` |
| Helpers (`money`, `maskPhone`, `ago`, `copyText`, …) | `lib/format.ts`, `lib/clipboard.ts` |
| `api` + `mockDb` + `buildMockDashboard` | `api/partners.ts` (delete the mock) |
| `computeEarnings` | **Delete.** Server returns balances (see §4.4). |
| `STYLES`, `STYLES_EXTRA` | `styles/partners.css` (all classes prefixed `dw-`) |
| Primitives (`Mark`, `Logo`, `ArchPattern`, `Avatar`, `CopyBtn`, `ToastProvider`, `useScrollReveal`) | `components/ui/*` (share with main site) |
| Landing sections | `pages/partners/Landing/*` |
| `Auth`, `OtpInput` | `pages/partners/Auth/*` |
| `Dashboard` and its tab views | `pages/partners/Dashboard/*` |

### 2.3 Frontend TODOs (already marked `TODO(launch)` in code)

- [ ] Set `PROGRAM.siteUrl` to the real domain.
- [ ] Set `PROGRAM.demoMode = false`. This removes the "use 123456" hint.
- [ ] Replace every `api.*` body with real `fetch` calls (§4).
- [ ] Restore the session on load. The `partner` state in `DorwayPartners()` currently resets on refresh.
- [ ] Logout must call the server (`POST /api/partners/logout`), not just clear local state.
- [ ] Make `PLAN_VALUES` share the main site's pricing source instead of a copy.
- [ ] Replace the footer and terms links (`#`) with real pages: partner terms and privacy policy.
- [ ] Add pagination or infinite scroll to the Code activity, Checkouts and Payouts tables. They currently render everything.
- [ ] Replace `computeEarnings()` with server-provided `balances` and `sprint` (§4.4).
- [ ] Stop masking on the client. The server must send data that is already masked (§8).

---

## 3. Architecture

```
┌──────────────┐   ?ref=code    ┌──────────────────┐   checkout events   ┌──────────────────┐
│ Partner's    │ ─────────────▶ │ Main Dorway app  │ ──────────────────▶ │ Partner service  │
│ audience     │                │ (signup/checkout)│                     │ (API + DB + jobs)│
└──────────────┘                └──────────────────┘                     └────────┬─────────┘
                                                                                  │
      ┌─────────────────────┐   REST (session cookie)                            │
      │ Partner dashboard   │ ◀──────────────────────────────────────────────────┤
      │ (DorwayPartners.jsx)│                                                     │
      └─────────────────────┘                                                     │
                                            WhatsApp OTP + notification templates │
      ┌─────────────────────┐ ◀─────────────────────────────────────────────────┘
      │ Your existing OTP / │
      │ WhatsApp API        │
      └─────────────────────┘
```

**Components to build:**

1. **Partner API.** Auth (OTP), profile, dashboard, payouts and payout method.
2. **Attribution in the main app.** Capture `?ref`, remember it, attach it to signups and checkouts.
3. **Event handling.** On checkout created, paid, refunded or cancelled, write referral and commission records.
4. **Scheduled jobs.** Release holds, detect abandoned checkouts, evaluate bonuses.
5. **Admin panel (not designed yet).** Review partners, reverse commissions, process payouts (§10).
6. **Notifications.** WhatsApp templates plus email (§9).

---

## 4. API contract

Base path `/api/partners`. JSON in and out. Session is an httpOnly, Secure, SameSite=Lax cookie set on successful OTP login or register.

### 4.1 Error format

Every error returns a non-2xx status with:

```json
{ "error": { "code": "OTP_INVALID", "message": "That code doesn't match. Check the latest WhatsApp message and try again." } }
```

The frontend shows `message` as-is. In the `api` adapter, throw `new Error(body.error.message)`. Keep messages plain and actionable.

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_FAILED` | 422 | Bad phone, email or name. Include `fields: { phone: "…" }`. |
| `OTP_RATE_LIMITED` | 429 | Too many sends. Include `retryAfterSeconds`. |
| `OTP_INVALID` | 400 | Wrong code |
| `OTP_EXPIRED` | 400 | Code older than 5 minutes |
| `OTP_TOO_MANY_ATTEMPTS` | 429 | More than 5 wrong attempts on one request |
| `PHONE_ALREADY_REGISTERED` | 409 | Register with an existing partner phone |
| `PARTNER_NOT_FOUND` | 404 | Login with a phone that has no partner account |
| `PARTNER_SUSPENDED` | 403 | Account suspended by admin |
| `PAYOUT_BELOW_MINIMUM` | 422 | Amount under `minPayout` |
| `PAYOUT_EXCEEDS_BALANCE` | 422 | Amount over available balance |
| `PAYOUT_METHOD_MISSING` | 422 | No UPI or bank on file |
| `PAN_REQUIRED` | 422 | No PAN on file |
| `PAYOUT_ALREADY_PENDING` | 409 | Optional rule: one open request at a time |
| `UNAUTHENTICATED` | 401 | No or expired session |

### 4.2 Auth

**`POST /otp/send`**
```json
// request
{ "phone": "9876543210", "purpose": "register" }        // purpose: "register" | "login"
// 200
{ "requestId": "otp_01H…", "expiresIn": 300, "resendAfter": 30 }
```
- Normalise the phone to E.164 (`+919876543210`). The frontend sends 10 digits and prefixes +91.
- `register` → reject with `PHONE_ALREADY_REGISTERED` before sending.
- `login` → reject with `PARTNER_NOT_FOUND` before sending. The UI tells them to join instead.
- Call your existing WhatsApp OTP template API.
- Rate limits (suggested):
  - 1 send per 30 s per phone
  - 3 per 10 min per phone
  - 10 per hour per IP
- Store a hash of the OTP, never the plain value.

**`POST /otp/verify`**
```json
// request
{ "requestId": "otp_01H…", "code": "482915" }
// 200
{ "verificationToken": "vt_…" }     // single-use, 10-minute expiry, bound to phone + purpose
```
- Maximum 5 attempts per `requestId`, then `OTP_TOO_MANY_ATTEMPTS`.
- Use constant-time comparison.

**`POST /register`**
```json
// request
{ "name": "Aarav Mehta", "phone": "9876543210", "email": "aarav@company.com",
  "verificationToken": "vt_…", "acceptedTerms": true }
// 201  (+ Set-Cookie session)
{ "id": "pt_…", "name": "Aarav Mehta", "phone": "9876543210", "email": "aarav@company.com",
  "code": "maple-river-quiet-orbit-lotus", "joinedAt": "2026-10-01T09:30:00Z" }
```
- Record the terms version, the timestamp and WhatsApp opt-in consent (the checkbox covers both).
- The server generates the code (§6).

**`POST /login`**
```json
{ "phone": "9876543210", "verificationToken": "vt_…" }   // 200 → Partner (+ Set-Cookie)
```

**`POST /logout`** returns 204 and clears the session.

**`GET /me`** returns the Partner, or 401. Use it on app load to restore the session.

### 4.3 Profile and settings

**`PUT /me/payout-method`**
```json
{ "type": "upi", "upiId": "aarav@okhdfcbank", "pan": "ABCDE1234F" }
// or
{ "type": "bank", "accountName": "Aarav Mehta", "accountNumber": "50100123456789",
  "ifsc": "HDFC0001234", "pan": "ABCDE1234F" }
```

Validation used in the UI (re-check on the server):

| Field | Pattern |
|---|---|
| UPI | `^[\w.-]{2,}@[a-zA-Z]{2,}$` |
| Account number | 9–18 digits |
| IFSC | `^[A-Z]{4}0[A-Z0-9]{6}$` |
| PAN | `^[A-Z]{5}\d{4}[A-Z]$` |

- Encrypt account numbers and PAN at rest.
- Return them masked: last 4 of the account number, `ABXXXXX34F` for PAN.
- Consider a penny-drop or UPI name check before the first payout (§10).

**`PUT /me/notifications`** takes `{ "whatsapp": true, "email": true }`. This endpoint was missing from the comment in the JSX; add it.

### 4.4 Dashboard

**`GET /me/dashboard`**. Replace the mock shape with this. Money is in **paise (integers)** on the wire; the frontend divides by 100 in `money()`, so update that helper.

```json
{
  "partner": { "id": "pt_…", "name": "…", "phone": "9876543210", "email": "…", "code": "…" },

  "usage":   { "clicks": 164, "codeApplied": 31, "signups": 23, "checkoutsStarted": 15 },

  "balances": {
    "onHold":    889800,   // commission + bonus still in hold window
    "available": 250000,   // approved minus requested/processing/paid
    "inProcess": 249900,   // payouts requested or processing
    "paidOut":  1119900,   // lifetime paid
    "lifetime": 2509600    // everything earned, excluding reversed
  },
  "canRequestPayout": true,
  "payoutBlockedReason": null,        // or "BELOW_MINIMUM" | "METHOD_MISSING" | "PAN_REQUIRED"

  "sprint": { "count": 6, "target": 10, "windowEndsAt": "2026-10-03T08:00:00Z", "bonusesEarned": 1 },
  "nextApprovalAt": "2026-10-08T00:00:00Z",

  "counts": { "completed": 11, "abandoned": 4, "completedValue": 24096200, "abandonedValue": 6698700 },

  "payoutMethod": { "type": "upi", "upiId": "aar***@okhdfcbank", "panMasked": "ABXXXXX34F", "hasMethod": true },
  "notifications": { "whatsapp": true, "email": true },

  "recentActivity": [ /* last 6 events, same shape as the list endpoints */ ]
}
```

**Lists (paginated, cursor-based):**

| Endpoint | Item shape |
|---|---|
| `GET /me/activity?type=&cursor=` | `{ id, at, event: "link_opened"\|"code_applied"\|"signed_up"\|"checkout_started", source: "link"\|"code", businessMasked }` |
| `GET /me/checkouts?status=completed&cursor=` | `{ id, businessMasked, phoneMasked, plan, billing, amount, paidAt, commission, status: "on_hold"\|"approved"\|"paid"\|"reversed", holdUntil }` |
| `GET /me/checkouts?status=abandoned&cursor=` | `{ id, businessMasked, phoneMasked, plan, billing, amount, startedAt, stoppedAt: "plan_selected"\|"payment_page"\|"payment_failed", potentialCommission }` |
| `GET /me/payouts?cursor=` | `{ id, amount, method: "UPI"\|"Bank", status, requestedAt, paidAt, reference, tdsDeducted, netAmount }` |
| `GET /me/bonuses` | `{ id, amount, earnedAt, status, checkoutIds: [] }` |

The UI labels for enum values live in the `STATUS` map and in the `icon` map in `ActivityView`. Map snake_case to those labels in one place.

### 4.5 Payouts

**`POST /me/payouts`**
```json
{ "amount": 250000 }  // paise → 201 Payout { status: "requested", … }
```

The server must, **in one transaction with a row lock on the partner**:

1. Recompute available balance.
2. Check `minPayout ≤ amount ≤ available`.
3. Check that a payout method and PAN exist.
4. Insert the payout.

Accept an `Idempotency-Key` header, because a double-click must not create two payouts.

---

## 5. Data model

Postgres-flavoured. All money is `bigint` paise. All times are `timestamptz`.

```sql
partners (
  id               text primary key,
  name             text not null,
  phone_e164       text not null unique,
  email            text not null,
  code             text not null unique,          -- lowercase, hyphen-joined
  status           text not null default 'active', -- active | suspended | closed
  terms_version    text not null,
  terms_accepted_at timestamptz not null,
  whatsapp_opt_in  boolean not null,
  notify_whatsapp  boolean not null default true,
  notify_email     boolean not null default true,
  created_at       timestamptz not null default now()
)

partner_payout_methods (
  partner_id       text primary key references partners,
  type             text not null,                 -- upi | bank
  upi_id_enc       bytea,
  account_name     text,
  account_number_enc bytea,
  ifsc             text,
  pan_enc          bytea not null,
  verified_at      timestamptz,                   -- penny-drop / name match
  updated_at       timestamptz not null
)

otp_requests (
  id               text primary key,
  phone_e164       text not null,
  purpose          text not null,                 -- register | login
  code_hash        text not null,
  attempts         int  not null default 0,
  expires_at       timestamptz not null,
  consumed_at      timestamptz,
  ip               inet,
  created_at       timestamptz not null default now()
)

referral_events (                                 -- powers "Code activity"
  id               text primary key,
  partner_id       text not null references partners,
  type             text not null,                 -- link_opened | code_applied | signed_up | checkout_started
  source           text not null,                 -- link | code
  visitor_id       text,                          -- first-party cookie id, for dedupe
  account_id       text,                          -- Dorway customer account, once known
  created_at       timestamptz not null default now()
)
-- dedupe link_opened: unique (partner_id, visitor_id, date(created_at)) where type = 'link_opened'

referrals (                                       -- one per referred customer account
  id               text primary key,
  partner_id       text not null references partners,
  account_id       text not null unique,          -- a customer can only ever belong to one partner
  attributed_via   text not null,                 -- link | code
  attributed_at    timestamptz not null,
  status           text not null,                 -- signed_up | converted | rejected
  rejection_reason text                           -- self_referral | existing_customer | fraud
)

checkouts_ref (                                   -- mirror of main-app checkouts that carry a referral
  id               text primary key,              -- main-app checkout/order id
  referral_id      text not null references referrals,
  plan             text not null,
  billing          text not null,                 -- monthly | annual
  amount           bigint not null,               -- see §12: pre-GST or incl-GST
  state            text not null,                 -- started | abandoned | completed | refunded
  stopped_at       text,                          -- plan_selected | payment_page | payment_failed
  started_at       timestamptz not null,
  paid_at          timestamptz
)

commissions (
  id               text primary key,
  partner_id       text not null references partners,
  checkout_id      text not null unique references checkouts_ref,
  amount           bigint not null,
  status           text not null,                 -- on_hold | approved | paid | reversed
  hold_until       timestamptz not null,
  approved_at      timestamptz,
  reversed_at      timestamptz,
  reversal_reason  text,
  payout_id        text references payouts,
  bonus_id         text references bonuses        -- set when this commission counted toward a bonus
)

bonuses (
  id               text primary key,
  partner_id       text not null references partners,
  amount           bigint not null,
  status           text not null,                 -- on_hold | approved | paid | reversed
  earned_at        timestamptz not null,
  hold_until       timestamptz not null,          -- = max(hold_until) of its commissions
  payout_id        text references payouts
)

payouts (
  id               text primary key,
  partner_id       text not null references partners,
  amount           bigint not null,               -- gross
  tds_amount       bigint not null default 0,
  net_amount       bigint not null,
  method_snapshot  jsonb not null,                -- masked copy of method at request time
  status           text not null,                 -- requested | processing | paid | rejected
  reference        text,                          -- UTR
  rejection_reason text,
  idempotency_key  text unique,
  requested_at     timestamptz not null,
  paid_at          timestamptz
)

ledger_entries (                                  -- recommended: append-only audit of every balance change
  id               bigserial primary key,
  partner_id       text not null,
  kind             text not null,                 -- commission_hold | commission_approve | commission_reverse | bonus_* | payout_request | payout_paid | payout_reject
  amount           bigint not null,               -- signed
  ref_id           text not null,
  created_at       timestamptz not null default now()
)
```

**Balances** are derived from `commissions`, `bonuses` and `payouts`. Keep the ledger for audit and reconciliation, and compute `available` inside the payout transaction.

---

## 6. Referral code generation

- Five words from a curated wordlist, lowercase, joined by hyphens.
  - The frontend mock uses ~80 words. Server-side, use a list of 1,000–2,000 short, common, unambiguous words.
  - No profanity, no brand names, no near-homophones.
- No repeated word within a code.
- Insert under the `unique(code)` constraint and retry on conflict.
- **Normalise on input at checkout:**
  - Lowercase.
  - Trim.
  - Collapse spaces, underscores and dots into `-`.
  - So `Maple River quiet_orbit.lotus` matches.
- Codes are permanent. If one must change (for example an offensive combination), keep the old code as an alias pointing to the same partner.

---

## 7. Attribution and commission lifecycle

### 7.1 Tracking in the main app

1. On any page load with `?ref=<code>`:
   - Validate that the code exists and the partner is active.
   - Set the first-party cookie `dw_ref=<code>` for `attributionDays` (60).
   - Log `link_opened`, deduped per visitor per day. The UI copy says so.
2. **Last click wins** between different partners' links. Changing this is a business decision (§12).
3. On signup, if a cookie is present:
   - Create a `referrals` row (`attributed_via = link`).
   - Log `signed_up`.
4. At checkout the customer may type a code. **A typed code overrides the cookie.**
   - Log `code_applied`.
   - Upsert the referral with `attributed_via = code`.
5. On checkout session created, log `checkout_started` and create a `checkouts_ref` row with `state = started`.
6. A customer account belongs to **one partner for life**, set at first attribution. Later links or codes don't reassign it, unless the business decides otherwise.

**Reject the referral** (`referrals.status = rejected`) when any of these is true:

| Reason | Check |
|---|---|
| Self-referral | Customer phone, email, PAN, GSTIN or payment instrument matches the partner |
| Existing customer | The account was already a paying customer before attribution |
| Suspended partner | The partner is suspended |

### 7.2 Events from the main app → partner service

Use webhooks or a queue. Handlers must be **idempotent**, keyed on the event id.

| Event | Action |
|---|---|
| `checkout.started` | Upsert `checkouts_ref` (`started`) |
| `checkout.paid` | Mark `completed`, set `paid_at`. If this is the account's **first** paid checkout (per §1), create a commission (`on_hold`, `hold_until = paid_at + holdDays`), then evaluate the bonus (§7.4). Notify the partner. |
| `checkout.payment_failed` | `stopped_at = payment_failed`. The abandoned job decides the final state. |
| `order.refunded` / `subscription.cancelled_with_refund` | If the commission is `on_hold`, set it to `reversed` and re-evaluate any bonus that used it. After the hold, no clawback by default (§12). |

### 7.3 Commission state machine

```
             paid                 hold_until passed            included in payout → paid
checkout ─────────▶ on_hold ───────────────────────▶ approved ───────────────────────▶ paid
                       │
                       │ refund / cancel inside hold
                       ▼
                    reversed
```

**Commission amount** is `floor(amount × commissionRate)` in paise. The base amount is decided in §12.

### 7.4 Speed bonus algorithm

**Goal:** ₹1,000 for every 10 completed (non-reversed) checkouts that land within 7 days. It repeats.

Run this on each new commission:

1. Take the partner's commissions with `bonus_id IS NULL` and status not `reversed`, ordered by `paid_at`.
2. Slide a window over them. The window starts at the oldest unconsumed commission and ends 7 days later.
   - If the window contains 10 or more commissions, take the first 10.
   - Create a bonus (`on_hold`, `hold_until = max(hold_until)` of the 10) and set their `bonus_id`.
   - Repeat until no window qualifies.
3. Commissions older than 7 days before the newest unconsumed one can never join a window. They simply stay unconsumed.

**If a commission inside a bonus is reversed during the hold:** reverse the bonus, clear `bonus_id` on the other 9, and re-run the algorithm. This is the recommended default; confirm it in §12.

**Dashboard `sprint`:**

| Field | Value |
|---|---|
| `count` | Unconsumed, non-reversed commissions within the last 7 days, counted from the oldest of those |
| `windowEndsAt` | Oldest in-window `paid_at` + 7 days |

When `count` is 0, the UI shows "your next completed checkout starts a 7-day window."

### 7.5 Abandoned checkouts

A `checkouts_ref` row becomes `abandoned` when all of these hold:

- It is still `started`.
- It has had no payment for **N hours** (suggest 1 h, configurable).
- The account has no other paid checkout.

If the customer pays later, it moves to `completed` and disappears from the Abandoned tab.

`stopped_at` comes from the furthest funnel step the main app reported. The UI shows three values: `plan_selected`, `payment_page` and `payment_failed`.

### 7.6 Scheduled jobs

| Job | Frequency | Does |
|---|---|---|
| `release_holds` | Hourly | `on_hold` → `approved` for commissions and bonuses where `hold_until ≤ now()`, after a final refund check. Notify the partner. |
| `mark_abandoned` | Every 15 min | §7.5 |
| `expire_otps` | Daily | Delete expired and consumed OTP rows older than 7 days |
| `reconcile` | Daily | Compare the ledger with the underlying tables and alert on mismatch |

---

## 8. Privacy and security

- **Never send full customer data to the partner dashboard.** The mock sends full names and phones and masks them in the browser. That must not ship. The server returns already-masked values:
  - Business: first word, then the initials of the rest (`Kapoor I.`).
  - Phone: `+91 98XXX XX207`.
- Partners see only their own referrals. Scope every query by `partner_id` from the session, never from a request parameter.
- The abandoned-checkout "Follow-up" button only copies a message for the partner to send personally. The UI tells partners not to add these contacts to bulk lists. Keep it that way. **Do not** build a feature that lets partners message customers through Dorway's WhatsApp number: that customer never opted in to messages from the partner.
- Encrypt PAN and bank account numbers at rest. Log access to them.
- OTP:
  - Store hashed.
  - Single use.
  - Rate-limited (§4.2).
  - Tokens bound to phone and purpose.
- Sessions:
  - httpOnly, Secure cookie.
  - Rotate the session on login.
  - 30-day expiry is suggested.
- Add CSRF protection on state-changing endpoints, or rely on SameSite plus a custom header check.
- Changing phone number is support-only (the UI says so), because the phone is the login identity.

---

## 9. Notifications

Use your existing WhatsApp API. Every template below except OTP needs Meta approval as a **utility** template. Consent is captured by the terms checkbox at sign-up, which reads "…and to receive program updates on WhatsApp." Store it on the partner record.

| Trigger | Channel | Template (suggested) |
|---|---|---|
| OTP | WhatsApp | Existing authentication template |
| Registration complete | WhatsApp + email | Welcome message with their code and link |
| Checkout completed | WhatsApp | "{{business}} completed checkout. {{amount}} commission is on hold until {{date}}." |
| Commission or bonus approved | WhatsApp | "{{amount}} is now approved. Available to withdraw: {{available}}." |
| Bonus earned | WhatsApp | "You landed {{n}} checkouts in {{days}} days. {{bonus}} bonus added." |
| Payout paid | WhatsApp + email | "{{amount}} sent to {{method}}. Ref {{utr}}." |
| Payout rejected | WhatsApp + email | Reason and what to fix |
| Weekly summary | Email | Uses, checkouts, balances |

Respect `notify_whatsapp` and `notify_email` from Settings. Transactional payout messages should still go out by email even if WhatsApp is off.

---

## 10. Admin panel (to design and build)

The UI has no admin views. Minimum needed before launch:

- **Partners:** search, view, suspend or unsuspend, see their referrals and balances, add notes.
- **Referrals and commissions:**
  - View all.
  - Manually reverse with a reason. The partner sees `Reversed`.
  - Manually attribute with an audit note.
- **Payout queue:**
  - List `requested` payouts.
  - Mark as `processing`.
  - Mark as `paid` with a UTR, or `rejected` with a reason.
  - Export a CSV for bank bulk upload.
  - Optional: automate with a payout API such as RazorpayX or Cashfree Payouts.
- **Fraud flags:**
  - Many signups from one IP or device.
  - Self-referral matches.
  - Unusually fast conversions.
  - Clusters of refunds.
- **Program settings:** read-only view of the live rule values, with changes versioned.

Every admin action writes to `ledger_entries` (where money moves) and to an admin audit log.

---

## 11. Testing checklist

**Auth**
- [ ] Register happy path; OTP arrives on WhatsApp; code reveal shows 5 words
- [ ] Register with an already-registered phone → `PHONE_ALREADY_REGISTERED` shown on the form
- [ ] Login with an unknown phone → `PARTNER_NOT_FOUND` with the message to join
- [ ] Wrong OTP → shake and error; the 6th attempt → locked
- [ ] Expired OTP; resend after 30 s; rate limit triggers
- [ ] Pasting a 6-digit code fills all boxes; iOS/Android SMS-style autofill does not break the inputs
- [ ] Refresh on the dashboard keeps the session

**Attribution**
- [ ] `?ref` sets the cookie; signup within 60 days is attributed
- [ ] Code typed at checkout overrides a different partner's cookie
- [ ] Code with capitals, spaces or underscores still matches
- [ ] Self-referral is rejected
- [ ] Existing customer is not attributed

**Money**
- [ ] Commission = 10% of the correct base, rounded down in paise
- [ ] Refund inside the hold → reversed; after the hold → unchanged (per decision)
- [ ] Hold release job moves to approved and the dashboard balance updates
- [ ] 10 checkouts in 7 days → one bonus; 20 → two; 10 across 8 days → none
- [ ] Reversal inside a bonus set → bonus reversed and re-evaluated
- [ ] Payout below ₹2,000 rejected; above available rejected; double-submit creates one payout
- [ ] Payout without a method or PAN is blocked with the right UI message

**UI**
- [ ] All tabs at 375, 768, 1024 and 1440 widths; mobile bottom tab bar
- [ ] Empty states: new partner with zero activity sees sensible zeros and no broken rings or bars
- [ ] Reduced-motion setting disables animations
- [ ] Keyboard: OTP boxes, tabs, modal focus and Escape

---

## 12. Open decisions (business owner to confirm)

These change the maths. The frontend reads from `PROGRAM`, so answers mostly mean changing server config and page copy.

1. **"Minimum 2k" meaning.** Built as a minimum **approved balance of ₹2,000 before withdrawal**. The alternative is a minimum **checkout value of ₹2,000** for a referral to count. If both apply, add `minCheckoutValue`.
2. **First payment or recurring.** Built as commission on the referred customer's **first** completed checkout only. If recurring, define for how many months and whether renewals count toward the bonus.
3. **Commission base.** Pre-GST amount (recommended) or amount including GST? Before or after any discount?
4. **Annual plans.** Is 10% of the full annual payment correct? The calculator assumes yes.
5. **Bonus reversal.** Confirm the §7.4 rule: if one of the 10 checkouts is refunded inside the hold, the bonus is reversed and recalculated.
6. **Refund after the hold.** No clawback (current assumption), or claw back from future earnings?
7. **Attribution conflicts.** Last click wins between links, and a typed code beats a cookie. Confirm.
8. **Tax.** Commission payouts to partners likely attract TDS under Section 194H. Confirm the current rate and annual threshold with your CA, and decide whether GST-registered partners must raise an invoice. The UI currently says only "tax is deducted at source where the law requires it."
9. **Payout cadence.** On request at any time (built), or batched on fixed dates?
10. **Who can join.** Individuals only, or businesses too (GSTIN field)? Any approval step, or instant approval (built)?
11. **Customer incentive.** Does the referred customer get anything, such as a discount or extended trial? The page currently promises nothing, and the rules forbid partners from promising discounts.
12. **Pricing values.** `PLAN_VALUES` are placeholders copied from the main page's placeholder pricing.

---

## 13. Launch checklist

- [ ] §12 decisions made; `PROGRAM` and server config match
- [ ] `demoMode: false`; mock `api` removed
- [ ] WhatsApp utility templates approved by Meta
- [ ] Partner terms and privacy pages live and linked; terms version recorded at sign-up
- [ ] Attribution live in the main app and verified end to end on staging with a real payment and refund
- [ ] Jobs scheduled and monitored; `reconcile` alert wired
- [ ] Admin payout queue working; first test payout sent and marked paid with a UTR
- [ ] PAN and bank encryption verified; access logged
- [ ] Rate limits verified on OTP endpoints
- [ ] Analytics events: `partner_landing_view`, `join_started`, `otp_sent`, `otp_verified`, `partner_registered`, `code_copied`, `link_copied`, `share_whatsapp_clicked`, `payout_requested`