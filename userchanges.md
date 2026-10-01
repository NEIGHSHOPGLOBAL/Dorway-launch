# Dorway — Customer Flow Revamp (changes to build)

**Applies to:** `user.md` (Customer Flow, as built). Same routes, same backend, same Cashfree and WhatsApp OTP setup.
**Goal:** a logged-in visitor should *feel* the product before paying. They see their own workspace, laid out and labelled, behind a clear paywall. After paying, they see a clear "we've got you" path while our team approves and sets them up.
**Design system:** match the landing page exactly (`DorwayLanding.jsx` / `design-system.css`):

| Element | Value |
|---|---|
| Body type | Inter |
| Headings | Comfortaa (never below 18px) |
| Numbers, codes, phone numbers, money breakdowns | JetBrains Mono |
| Ink | `#12211C` |
| Green | `#0B8A5C` |
| Mint | `#DCF0E4` |
| Amber | `#C98A2E` (pending states only) |
| Clay | `#B24A3F` (errors only) |
| Corner radius | 20px panels / 12px inner UI / 999px pills |
| Signature texture | Doorway-arch pattern |
| Shadow | One shadow value, used everywhere |

Light mode only. Motion follows the same rules as the landing page: one eased entrance per page, reveals on scroll for long pages, everything else responds to input, and `prefers-reduced-motion` turns it all off.

Each change below has an ID (`P-1`, `C-3`, …) so tickets can reference it.

---

## 0. Summary of what changes

| # | Change | Pages |
|---|---|---|
| 1 | New term pricing: ₹1,999/mo + GST; 6 months −10%; 12 months −25% | Pricing, Checkout, server pricing |
| 2 | **Workspace preview behind a paywall** for logged-in users without a plan | Dashboard (new state), new paywall sheet |
| 3 | Checkout redesigned: two-column, sticky summary, exact totals, trust, mobile pay bar | Checkout |
| 4 | **Post-purchase "Awaiting approval" journey** with admin approval and a setup call | Checkout return, Dashboard, Admin |
| 5 | Short profile step after first login, used to personalise the preview | New `/welcome` |
| 6 | Landing and app copy aligned to the real offer (no "free trial" if there isn't one) | Landing, Login, Pricing |
| 7 | Funnel tracking, recovery messages, billing and invoice page, failure handling | Several |

---

## 1. Pricing fix (server first)

### 1.1 Rule

| Term | Discount | Per-month rate (excl. GST) | Billed today (excl. GST) | You save vs monthly |
|---|---|---|---|---|
| 1 month | 0% | ₹1,999 | ₹1,999 | — |
| 6 months | 10% | ₹1,799 | ₹10,794 | ₹1,200 |
| 12 months | 25% | ₹1,499 | ₹17,988 | ₹5,988 |

GST at 18% is added on top (confirm the rate in §11, question 4):

| Term | Subtotal | GST 18% | **Total due** |
|---|---|---|---|
| 1 month | ₹1,999.00 | ₹359.82 | **₹2,358.82** |
| 6 months | ₹10,794.00 | ₹1,942.92 | **₹12,736.92** |
| 12 months | ₹17,988.00 | ₹3,237.84 | **₹21,225.84** |

**Rounding rule (implement exactly):**

1. Compute the per-month rate in whole rupees: `monthlyRate = round(199900 × (1 − discount) / 100) × 100` (in paise).
   - 6 months: `199900 × 0.90 = 179910` → `179900` (₹1,799).
   - 12 months: `199900 × 0.75 = 149925` → `149900` (₹1,499).
2. `subtotal = monthlyRate × termMonths`.
3. GST is computed on the subtotal, in paise, and split into CGST and SGST (half each) or IGST, exactly as `lib/gst.ts` does today.
4. The UI shows "10% off" and "25% off". The true discount is within 0.01% of that, which is fine.

### 1.2 Code changes

- **`P-1` `lib/pricing.ts`.** Replace the early-bird-only `effectiveRatePaise` logic with a term discount table read from config:
  ```ts
  export const TERM_DISCOUNTS = { 1: 0, 6: 0.10, 12: 0.25 } as const;
  ```
  Keep the early-bird code path behind a flag until §11, question 1 is answered. **Do not stack early-bird with term discounts** unless the business confirms.
- **`P-2` `GET /api/plans?termMonths=`.** Return everything the UI needs, so the client never does maths:
  ```json
  {
    "gstPercent": 18,
    "terms": [
      { "termMonths": 1,  "discountPercent": 0,  "monthlyRatePaise": 199900, "subtotalPaise": 199900,  "savingsPaise": 0,      "gstPaise": 35982,  "totalPaise": 235882,  "badge": null },
      { "termMonths": 6,  "discountPercent": 10, "monthlyRatePaise": 179900, "subtotalPaise": 1079400, "savingsPaise": 120000, "gstPaise": 194292, "totalPaise": 1273692, "badge": "Save 10%" },
      { "termMonths": 12, "discountPercent": 25, "monthlyRatePaise": 149900, "subtotalPaise": 1798800, "savingsPaise": 598800, "gstPaise": 323784, "totalPaise": 2122584, "badge": "Best value" }
    ],
    "plans": [ /* existing */ ],
    "accessStartsAt": "2026-11-15T00:00:00+05:30"
  }
  ```
  `gstPaise` here assumes the default supplier state. The checkout quote recalculates the CGST/SGST vs IGST split from the customer's state; the total GST stays the same.
- **`P-3` `POST /api/checkout`.** It still recalculates everything server-side; only the rate source changes. Store `discountPercent`, `monthlyRatePaise` and `savingsPaise` on the `Order` so invoices and the admin panel don't recompute history.
- **`P-4` Partner commission base.** It is the **post-discount subtotal, excluding GST**, so 10% of ₹17,988 = ₹1,798.80 for a 12-month order. Update `partner.md` §12, question 3 as decided.
- **`P-5`** Update the landing page pricing section (`DorwayLanding.jsx` `PRICING`) to this single plan with three terms. Remove the three-tier Starter / Growth / Scale placeholder.

---

## 2. Login — `/login`

**What changes and why:** today Login is a plain form. It is the first moment of commitment, so it should say what they get next ("see your workspace") and remove any fear about the OTP.

- **`L-1` Layout.**
  - Two columns on desktop.
  - **Left:** the dark ink brand panel with the arch pattern and green glow, same as the partner auth screen.
  - **Right:** the form.
  - Mobile: form only, with the logo on top.
- **`L-2` Left panel copy:**
  - Headline: **"Your team's WhatsApp, finally organised."**
  - Three lines with green check icons:
    - "One shared inbox on your business number"
    - "Every lead gets an owner"
    - "Follow-ups that send themselves"
  - Under them, a small preview card: a cropped inbox row with a `New → Contacted` status chip, reused from the landing hero.
- **`L-3` Form copy:**
  - Title: "Log in or create your account".
  - Sub: "We'll send a 6-digit code to your WhatsApp. No password needed."
  - Button: "Send code on WhatsApp".
  - Under the button: "New here? Logging in creates your account and opens a preview of your workspace." This line moves people from login to the preview.
- **`L-4` OTP screen.** Keep the existing 6 boxes, paste-to-fill and auto-advance. Add:
  - "Sent to **+91 98765 43210**" with a **Change** link.
  - The resend countdown "Resend in 0:30", then "Resend code".
  - After 2 resends, a help line: "Not getting it? Make sure WhatsApp is active on this number."
  - Wrong code: shake animation and a clay error under the boxes. Auto-submit when the 6th digit is entered.
- **`L-5` Consent line** under the phone field, small text: "By continuing you agree to the Terms and Privacy Policy and to receive account messages on WhatsApp." Store the consent timestamp on `users`; it is needed for the reminder messages in `X-3`.
- **`L-6` Referral chip.** If a `dw_ref` cookie exists, show a small mint chip above the form: "Referred by a Dorway partner". Do not show the partner's name here.
- **`L-7` Redirect after verify:**
  - First-ever login → `/welcome` (§3).
  - Returning user without a plan → `/dashboard` (preview state, §4).
  - Returning paid user → `/dashboard` (their status state, §7).
  - If `next` is set (e.g. from Checkout), honour it.

---

## 3. Welcome / profile step — `/welcome` (new, first login only)

**Why:** a preview titled "Kapoor Interiors" converts better than "Your dashboard". The `POST /api/onboarding/profile` endpoint already exists; this step just uses it at the right moment.

- **`W-1`** One card, centred, with a progress hint "Step 1 of 2 · About your business". Fields:
  - Your name (pre-filled if known)
  - Business name
  - City
  - **New, optional:** "How many people reply to customers on WhatsApp?" as chips `Just me` · `2–5` · `6–15` · `16+`
- **`W-2`** Button: "Show my workspace". Skip link: "Skip for now". Never block on this step.
- **`W-3`** Save → log the `PROFILE_COMPLETED` onboarding event → go to `/dashboard`.
- **`W-4`** The team-size answer is stored on `onboarding_profiles.teamSize`. It personalises preview copy ("Built for your 2–5 person team") and is a segment in the admin funnel.

---

## 4. Dashboard — preview state behind a paywall (new)

**When shown:** the user is logged in **and has no `Entitlement`**. This replaces the current checklist-only dashboard for unpaid users.

**Principle:** show a realistic, *clearly labelled sample* workspace that the user can click around. Reading is free. **Doing** (sending, connecting, importing, inviting) opens the paywall. Never imply the sample data is theirs, and never show features that won't exist at launch.

### 4.1 Layout

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ ▣ Kapoor Interiors ▾        Launching in 12d 04h 31m        [Unlock Dorway]   │ ← top bar
├──────────────┬────────────────────────────────────────────────────────────────┤
│ ▢ Inbox  12  │ ┌ mint banner ─────────────────────────────────────────────────┐ │
│ ▢ Leads      │ │ 👁  You're viewing a sample workspace. Unlock Dorway to       │ │
│ ▢ Pipeline   │ │    connect your own WhatsApp number.  [See plans]  [×]      │ │
│ ▢ Follow-ups │ └──────────────────────────────────────────────────────────────┘ │
│ ▢ Ask Dorway │                                                                  │
│              │   [ sample inbox / pipeline / follow-ups — fully browsable ]     │
│ ──────────── │                                                                  │
│ Getting      │                                                                  │
│ started 1/5  │                                                                  │
│ ✓ Account    │                                                                  │
│ ● Choose plan│                                                                  │
│ 🔒 Connect WA│                                                                  │
│ 🔒 Team      │                                                                  │
│ 🔒 Go live   │                                                                  │
└──────────────┴────────────────────────────────────────────────────────────────┘
```

(Emoji above are for the wireframe only. Use lucide icons in the build: `eye`, `lock`, `check`, `circle-dot`.)

### 4.2 Specs

- **`D-1` App shell.** Use the same app shell the real product will use (sidebar, top bar), so the preview *is* the product's frame.
  - Workspace name = `businessName` from `/welcome`, or "Your workspace".
  - Sidebar items: Inbox, Leads, Pipeline, Follow-ups, Ask Dorway. **Only list modules planned for launch** (§11, question 6).
- **`D-2` Sample data.** Reuse the landing mockup data (Neha Sharma, Vikram Joshi, Farah Khan…).
  - Load it from a static `sampleWorkspace.json`. No API.
  - Every screen keeps the mint banner: "You're viewing a sample workspace".
  - Each sample conversation carries a small grey `Sample` chip.
- **`D-3` Clickable, read-only.** Users can:
  - switch sidebar tabs
  - open a conversation and read the thread
  - see the lead card (owner, stage, next follow-up)
  - drag nothing
  - use Ask Dorway with the 5 canned prompts and answers from the landing page
- **`D-4` Locked actions open the paywall sheet (§5).** Each lock triggers the sheet with a headline matched to what they tried:

  | User does | Paywall headline |
  |---|---|
  | Types in the composer / clicks Send | "Reply to real customers from one shared number" |
  | Clicks "Connect WhatsApp number" | "Connect your own WhatsApp Business number" |
  | Clicks "Import leads" | "Bring your existing leads with you" |
  | Clicks "Invite teammate" | "Give your whole team one inbox" |
  | Clicks "Create sequence" | "Let follow-ups send themselves" |
  | Clicks "Unlock Dorway" (top bar) | "Unlock Dorway for Kapoor Interiors" |

  The composer shows a lock icon and the placeholder "Unlock Dorway to reply to real customers". The composer stays focusable, and focusing it opens the sheet.
- **`D-5` Getting-started checklist** in the sidebar foot, with the same five rows as today:
  - Account created: done
  - Choose your plan: **active**, clicking opens the paywall
  - Connect your WhatsApp: locked
  - Add your team: locked
  - Go live: locked, shows the launch date

  Progress text: "1 of 5".
- **`D-6` Top bar.**
  - Launch countdown, server-authoritative as today.
  - Primary button **"Unlock Dorway"**: ink fill. It is the only primary button on the screen.
  - If the early bird is still on (§11, question 1), a small amber pill "12 early-bird seats left", shown only when the number is real.
- **`D-7` First-visit tour.** Three tooltips, shown once and dismissible: Inbox ("Every enquiry lands here"), Lead card ("Every lead has one owner"), Unlock button ("Connect your number to make it yours"). Store a dismissed flag on the user.
- **`D-8` Return visits.** If they visited before and didn't pay, the banner copy changes to: "Welcome back, Rohan. Your workspace is ready. Unlock it to connect your number." This is the user's own workspace name, not a fake scarcity message.
- **`D-9` Mobile.**
  - The sidebar becomes a bottom tab bar.
  - The mint banner shortens to one line.
  - A sticky bottom bar shows "Unlock Dorway · from ₹1,499/mo" and opens the sheet as a bottom sheet.

---

## 5. Paywall sheet (new component)

Opens from any locked action, the top bar or the checklist. On desktop it is a right-side drawer, 480px wide. On mobile it is a bottom sheet, 90% height. **It lets users pick a term and go straight to checkout without visiting `/pricing`.**

```
┌──────────────────────────────────────────────┐
│ Reply to real customers from one shared  [×] │
│ number                                        │
│ Unlock Dorway for Kapoor Interiors.          │
│                                               │
│ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│ │ 1 month  │ │ 6 months │ │ 12 months     │  │
│ │ ₹1,999/mo│ │ ₹1,799/mo│ │ ₹1,499/mo  ✓  │  │
│ │          │ │ Save 10% │ │ Best value    │  │
│ └──────────┘ └──────────┘ └───────────────┘  │
│                                               │
│ ₹17,988 billed today + GST · you save ₹5,988 │
│ Your 12 months start on 15 Nov, launch day.  │
│                                               │
│ What you unlock                               │
│ ✓ Shared inbox on your own WhatsApp number    │
│ ✓ Automatic lead assignment                   │
│ ✓ Follow-up reminders                         │
│ ✓ Pipeline for every lead                     │
│ ✓ Hands-on setup with our team                │
│                                               │
│ [ Continue to checkout ]                      │
│ Secure payment · UPI, cards, netbanking       │
│ Questions? Chat with us on WhatsApp           │
└──────────────────────────────────────────────┘
```

- **`S-1` Term cards** are selectable (radio group semantics).
  - Default selection: **12 months** (§11, question 5).
  - The selected card gets a 2px ink border and a check.
  - The badge comes from `P-2`.
- **`S-2` Price line.** "₹X billed today + GST · you save ₹Y". This is always the honest total excluding GST, with GST clearly stated. The figures come from `GET /api/plans`.
- **`S-3` Access line.** "Your N months start on {launch date}, launch day." This uses the existing `accessStartsAt` logic: paying early never costs a day. **This is the strongest pre-launch reason to buy now, so make it visible.**
- **`S-4` Unlock list.** Only include things that will exist at launch (§11, question 6). "Hands-on setup with our team" is real: it is the approval and setup call in §7.
- **`S-5` CTA** "Continue to checkout" → `/checkout/growth?term=12`. Keep the sheet's term in the URL.
- **`S-6` Help link.** "Questions? Chat with us on WhatsApp" opens `wa.me/<support number>?text=Hi, I have a question about Dorway pricing`. For Indian SMB buyers this rescues many hesitant buyers.
- **`S-7` Tracking.** Opening the sheet logs `PAYWALL_OPENED { trigger }`, and changing the term logs `TERM_SELECTED { termMonths }` (§9).

---

## 6. Pricing page — `/pricing`

**What changes and why:** there is only one plan, so drop the "pricing grid" pattern. The decision is about **term**, not plan.

- **`PR-1` Hero.**
  - H1: "One plan. Everything your team needs."
  - Sub: "Pick how long. Longer terms cost less per month."
  - Launch countdown below. Early-bird banner only if §11, question 1 keeps it.
- **`PR-2` Term selector.** The same three term cards as the paywall sheet, larger, in a row. Default 12 months. Under them, one large summary panel:
  - per-month price
  - billed-today subtotal
  - GST line in mono: `+ ₹3,237.84 GST (18%)`
  - total due
  - savings
  - access start date
- **`PR-3` What's included.** A two-column checklist, then three reassurance tiles:

  | Tile | Copy |
  |---|---|
  | **Your number, your data** | You connect your own WhatsApp Business Account. |
  | **Setup done with you** | Our team calls you after purchase and helps you go live. |
  | **Pay now, start at launch** | Your term starts on launch day, not today. |

- **`PR-4` Comparison line** (honest, no competitor names): "No per-message markup from us. WhatsApp's own message charges are billed by Meta to your account." This links to the FAQ. Keep it in sync with the landing page's Meta-fees note.
- **`PR-5` Mini FAQ:**
  - What happens after I pay?
  - When does my plan start?
  - Do I need my own WhatsApp number?
  - Can I get a GST invoice?
  - What if I change my mind? (the answer depends on §11, question 3)
- **`PR-6` CTA.**
  - Logged in → "Continue to checkout".
  - Logged out → "Get started", which goes to `/login?next=/checkout/growth?term=N`.
  - Fire Pixel `AddToCart` as today.
- **`PR-7`** If the user already has an entitlement, replace the selector with "You're on Dorway · 12 months · starts 15 Nov" and a link to `/billing`.

---

## 7. Checkout — `/checkout/:planCode`

**What changes and why:** today Checkout is a form with a quote. It should look like the last, safest step: short, exact, reassuring, and on mobile one thumb-tap from paying.

### 7.1 Layout

```
┌───────────────────────────────────────────────────┬─────────────────────────────┐
│ ← Back to workspace         ▣ dorway   🔒 Secure  │                             │
├───────────────────────────────────────────────────┤  ORDER SUMMARY (sticky)     │
│ ① Billing details                                 │  Dorway · 12 months  Change │
│   Business name   [Kapoor Interiors          ]    │  ₹1,499 × 12 months         │
│   Email for invoice [rohan@kapoor.in         ]    │  Subtotal       ₹17,988.00  │
│   State           [Rajasthan            ▾]        │  Discount 25%   −₹5,988.00  │
│   ☐ I need a GST invoice                          │  CGST 9%         ₹1,618.92  │
│      GSTIN [08ABCDE1234F1Z5] ✓ Rajasthan          │  SGST 9%         ₹1,618.92  │
│                                                   │  ─────────────────────────  │
│ ② Referral code (optional)        + Add code      │  Total today    ₹21,225.84  │
│                                                   │                             │
│ ③ After you pay                                   │  Starts 15 Nov (launch day) │
│   1 Payment confirmed · instant                   │                             │
│   2 Our team reviews your account · 1 working day │  [ Pay ₹21,225.84 ]         │
│   3 Setup call on WhatsApp · we'll reach out      │  UPI · Cards · Netbanking   │
│   4 Go live on launch day                         │  Secured by Cashfree        │
└───────────────────────────────────────────────────┴─────────────────────────────┘
```

### 7.2 Specs

- **`C-1` Two columns** on desktop: the form on the left (max 560px) and a **sticky order summary** on the right (380px). On mobile the summary collapses into a tappable bar at the top ("Dorway · 12 months · ₹21,225.84 ▾"), and a **sticky bottom pay bar** shows the exact amount.
- **`C-2` Fewer fields.**
  - Business name, pre-filled from `/welcome`.
  - **Email for invoice.** New and required: receipts and the GST invoice need it. Pre-fill from `fallbackEmail`.
  - State.
  - GSTIN sits behind a checkbox, "I need a GST invoice", **collapsed by default**.
  - Remove anything else the payment doesn't need.
- **`C-3` GSTIN behaviour.** Keep the existing rule that a valid GSTIN state prefix silently overrides the chosen state. Show it, though: a green check and "Rajasthan" beside the field.
  - Validate the format inline.
  - An invalid GSTIN is an inline clay error. It never blocks payment if the box is unticked.
- **`C-4` Term change inline.** The summary's "Change" link opens the three term cards in a popover. Changing the term re-quotes. The URL `?term=` updates.
- **`C-5` Exact breakdown in mono:**
  - per-month × months
  - subtotal
  - discount line (only when more than 0)
  - CGST/SGST or IGST
  - total

  Values come from `GET /api/checkout/quote`. While the quote reloads, keep the old numbers at 50% opacity. Never show blanks.
- **`C-6` Pay button label** is the exact total: **"Pay ₹21,225.84"**. Disable it while the quote is stale or loading. Show a spinner on click, and prevent double submits (idempotency key on `POST /api/checkout`).
- **`C-7` Referral code.**
  - Collapsed as "+ Add code" unless the `dw_ref` cookie pre-fills it.
  - When filled, validate live via the new `GET /api/checkout/referral?code=` → `{ valid }`.
  - Show a green "Code applied" or a clay "Code not found".
  - **No customer discount is attached**, so don't imply one. A typed code still overrides the cookie, as today.
- **`C-8` "After you pay" timeline.** Four steps, matching the post-purchase states in §8, so expectations are set *before* payment.
- **`C-9` Trust row** under the button:
  - "UPI · Cards · Netbanking"
  - "Secured by Cashfree"
  - a lock icon
  - the line "You'll get a GST invoice by email."

  No fake badges or seals.
- **`C-10` Payments not configured (`503`).** Replace "join the waitlist" with: "Payments open soon. We'll WhatsApp you the moment they do." Add a button "Notify me", which logs a `PAYMENT_NOTIFY_REQUESTED` event. Never show a broken widget.
- **`C-11` Back link.** "← Back to workspace" goes to the preview, not to Pricing. Users came from the workspace, so return them there.
- **`C-12` Leaving checkout.** If the user leaves after `POST /api/checkout` created an order, that order stays `CREATED`. It feeds the recovery messages (`X-3`) and the admin's abandoned-checkout view.

---

## 8. After payment — approval and setup journey (new)

### 8.1 Account states

Add an approval layer on the server after `PAID`. **The webhook stays the source of truth for payment; admin approval is a separate step.**

| State | Set by | Dashboard shows |
|---|---|---|
| `PREVIEW` | Logged in, no paid order | Sample workspace + paywall (§4) |
| `PAYMENT_PENDING` | Order `CREATED`/`PENDING` | Preview + amber banner "Your payment is being confirmed" |
| `AWAITING_APPROVAL` | Webhook marks `PAID` | Status home (§8.3), step 2 active |
| `APPROVED` | Admin approves | Status home, step 3 active, setup owner shown |
| `SETUP_SCHEDULED` | Admin logs a setup call time | Status home, call time shown |
| `LIVE` | Launch date reached **and** setup done | The real product (future) |
| `REJECTED` | Admin rejects (rare) | A clear message, refund status, support link |

**Data:**
- Add `Entitlement.approvalStatus`: `PENDING_REVIEW` | `APPROVED` | `REJECTED`.
- Add `approvedAt`, `approvedBy`, `rejectionReason`, `setupOwnerName`, `setupOwnerPhone`, `setupCallAt`.
- `GET /api/onboarding/state` returns a derived `accountState` (one of the states above), so the client never re-derives it.

**New onboarding events:**
- `APPROVED`
- `REJECTED`
- `SETUP_CALL_SCHEDULED`
- `LIVE`

### 8.2 Checkout return — `/checkout/return`

- **`R-1` While confirming.**
  - A calm full-page state: an animated ring and "Confirming your payment…".
  - Sub: "UPI can take up to a minute. Don't close this page."
  - Keep polling every 3 s, up to 20 times, as today.
- **`R-2` Paid.**
  - A success ring pops in.
  - **"Payment received. You're in, Rohan."**
  - The amount in mono and the plan/term.
  - "A GST invoice is on its way to rohan@kapoor.in".
  - Then the **4-step timeline** from `C-8`, with step 1 done and step 2 active:
    - "Our team is reviewing your account. We'll WhatsApp you within 1 working day to book your setup call."
  - Primary button: **"Go to your dashboard"**. Secondary: "Start setup now", which goes to `/onboarding/setup` (see `R-5`).
  - Fire Pixel `Purchase` once, as today.
- **`R-3` Still pending after 20 polls.** Don't dead-end. Show:
  - "We're still confirming with your bank. You don't need to pay again. We'll WhatsApp you as soon as it's done."
  - A "Go to dashboard" button. The dashboard shows `PAYMENT_PENDING`.
- **`R-4` Failed.**
  - "Payment didn't go through. No money was taken."
  - **"Try again"** goes back to `/checkout/growth?term=<same term>` with the same details pre-filled, not to `/pricing`.
  - A secondary help link: "Chat with us on WhatsApp".
- **`R-5` Setup while waiting.** The WhatsApp/Meta setup form (`/onboarding/setup`) stays available while `AWAITING_APPROVAL`. The copy frames it as "Get a head start: have these ready for your setup call." Approval does not block it.

### 8.3 Dashboard — status home (paid users before go-live)

Replaces the preview for paid users. Same app shell; the main area becomes a status page.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Kapoor Interiors · Dorway 12 months                Launching in 12d 04h 31m  │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌ amber card ───────────────────────────────────────────────────────────┐   │
│  │ ⏳ Awaiting approval                                                    │   │
│  │ Payment received on 1 Oct. Our team is reviewing your account and will │   │
│  │ WhatsApp you within 1 working day to book your setup call.             │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Your path to going live                                                     │
│   ✓ Payment confirmed            1 Oct, 7:42 PM                              │
│   ● Account review               usually within 1 working day                │
│   ○ Setup call with our team     we'll book this with you on WhatsApp        │
│   ○ Connect your WhatsApp number done together on the call                   │
│   ○ Go live                      15 Nov, launch day                          │
│                                                                              │
│  ┌ Get a head start ─────────────┐  ┌ Your plan ──────────────────────────┐  │
│  │ Have these ready for the call │  │ Dorway · 12 months                  │  │
│  │ ☐ Business name as on GST     │  │ Starts 15 Nov · ends 14 Nov 2027    │  │
│  │ ☐ A number not on WhatsApp app│  │ Paid ₹21,225.84 · [Download invoice] │  │
│  │ ☐ Business document (PDF)     │  └─────────────────────────────────────┘  │
│  │ [Start setup form]            │  ┌ Need help? ─────────────────────────┐  │
│  └───────────────────────────────┘  │ Chat with us on WhatsApp            │  │
│                                     └─────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **`A-1` Status card colour by state:**

  | State | Card colour | Copy |
  |---|---|---|
  | `AWAITING_APPROVAL` | Amber | As in the wireframe |
  | `APPROVED` | Mint | "Approved. {setupOwnerName} from our team will WhatsApp you to book your setup call." Show the owner's first name and avatar initials. |
  | `SETUP_SCHEDULED` | Mint | "Setup call on {date, time}." Add an "Add to calendar" `.ics` link and a "Need to reschedule? Message {owner}" link. |
  | `REJECTED` | Clay | Reason in plain language, refund status, and a support link |

- **`A-2` Path timeline.** It uses the same five steps everywhere: Checkout (`C-8`), Return (`R-2`) and here. Done steps show the date and time.
- **`A-3` Head-start checklist.** Mirrors the setup form sections. Each item links to the matching accordion section in `/onboarding/setup`. Progress reflects autosaved sections.
- **`A-4` Your plan card.** Shows term, access start and end dates (from `Entitlement`), amount paid and **Download invoice** (`X-5`).
- **`A-5` Sample workspace still reachable.** A secondary link "Explore the sample workspace" opens the preview in read-only mode with the banner "This is a sample. Yours goes live on 15 Nov." It keeps excitement up during the wait.
- **`A-6` Remove the permanently locked "Add your team" and "Open your inbox" rows** from the paid view. Fold them into the "Go live" step, so nothing on a paying user's screen looks broken.

### 8.4 Admin side (addition to `superadmin.md`)

`superadmin.md` §0 said "track, don't act" for onboarding. Approval needs one exception. Add these to `superadmin.md`:

- **`AD-1` Onboarding → Approvals queue.**
  - Shows paid accounts in `PENDING_REVIEW`, oldest first.
  - Columns: business, phone (masked), plan/term, paid at, waiting time (red after 1 working day), setup form progress, partner referral.
- **`AD-2` Actions** (Super admin; reason required; audit-logged):

  | Action | Fields | Effect |
  |---|---|---|
  | **Approve** | Setup owner (name, phone) | Sets `APPROVED` and sends a WhatsApp + email to the customer |
  | **Log setup call** | Date and time | Sets `SETUP_SCHEDULED` and notifies the customer |
  | **Reject** | Reason | Sets `REJECTED`, starts a full refund via the Cashfree refund API, notifies the customer, and reverses the partner commission if one is on hold |

- **`AD-3`** Add `approval_waiting` to the "Needs attention" list on the admin Home.
- **`AD-4`** New funnel steps in admin §5.1:
  - `profile_completed`
  - `preview_viewed`
  - `paywall_opened`
  - `checkout_started`
  - `paid`
  - `approved`
  - `setup_scheduled`
  - `setup_submitted`
  - `live`

### 8.5 Customer notifications (WhatsApp utility templates + email)

| Trigger | Message (draft) |
|---|---|
| Paid | "Payment received for Dorway (12 months). Our team will review your account and WhatsApp you within 1 working day to book your setup call." |
| Approved | "You're approved. {owner} from Dorway will help you set up. Reply here with a good time for a 20-minute call." |
| Setup scheduled | "Your Dorway setup call is on {date} at {time}. Keep your business documents handy." |
| Rejected | "We couldn't approve your Dorway account: {reason}. A full refund of ₹{amount} has been started and should reach you in 5–7 working days." |

---

## 9. Funnel tracking

Track internally (store in `onboarding_events`) **and** send to the Pixel where mapped. Every event carries `userId`, `sessionId`, `referralPartnerId?`, `utm_*` and `device`.

| Event | When | Pixel |
|---|---|---|
| `IDENTIFIED` | First OTP verify (exists) | `CompleteRegistration` (exists) |
| `PROFILE_COMPLETED` / `PROFILE_SKIPPED` | `/welcome` | — |
| `PREVIEW_VIEWED` | First preview load per day | `ViewContent` |
| `PREVIEW_TAB_VIEWED { tab }` | Sidebar tab in preview | — |
| `PAYWALL_OPENED { trigger }` | Sheet opens | — |
| `TERM_SELECTED { termMonths }` | Term card picked | — |
| `PLAN_SELECTED` | Continue to checkout (exists) | `AddToCart` (exists) |
| `CHECKOUT_VIEWED` | Checkout loads | `InitiateCheckout` (exists) |
| `PAY_CLICKED` | Pay button | `AddPaymentInfo` (exists) |
| `PAID` | Webhook (exists) | `Purchase` (exists) |
| `APPROVED` / `REJECTED` / `SETUP_CALL_SCHEDULED` | Admin | — |
| `SETUP_SUBMITTED` | Exists | — |

**Key funnel to watch:** login → preview → paywall opened → checkout viewed → paid.

**Report the paywall `trigger` breakdown.** It tells you which feature sells.

---

## 10. Other improvements

- **`X-1` Landing copy must match the real offer.**
  - The landing page currently says "Start free · 14-day full access · No credit card". The real flow is login → preview → paid plan. A buyer who expects a free trial and hits a paywall loses trust at the worst moment.
  - Change the landing primary CTA to **"Get started"** (lands on Login).
  - Replace the reassurance line with "Free workspace preview · Pay only when you're ready · Setup done with you".
  - Update the landing pricing section per `P-5`, and FAQ items about the trial.
  - Keep "Watch demo" and "Book setup" as they are.
  - If a real free trial is planned, say so and skip this (§11, question 2).
- **`X-2` One CTA vocabulary across the app:**

  | Context | Label |
  |---|---|
  | Landing | Get started |
  | Login | Send code on WhatsApp |
  | Preview / paywall | Unlock Dorway → Continue to checkout |
  | Checkout | Pay ₹{exact total} |
  | After payment | Go to your dashboard |

  Don't introduce Buy now, Subscribe, Upgrade, Try now (rename the current Pricing "Try now"), or Start trial.
- **`X-3` Recovery messages** (consent from `L-5`):

  | Who | When | Message |
  |---|---|---|
  | Logged in, no checkout | 24 h | "Your Kapoor Interiors workspace is ready to unlock." |
  | Checkout started, not paid | 1 h | "Your checkout is saved. Pick up where you left off." (link to the same term) |
  | Payment failed | 15 min | "Payment didn't go through, no money taken. Try again here." |

  - Send at most one message per stage, and never after a purchase.
  - These are likely **marketing**-category WhatsApp templates. Check the category, the cost and the opt-out wording before turning them on.
- **`X-4` WhatsApp help button.** A floating "Chat with us" button on Pricing, Checkout and the preview opens a `wa.me` link to the sales/support number with context in the prefilled text: page name and selected term. Hide it on mobile Checkout so it doesn't cover the pay bar; show it in the summary instead.
- **`X-5` Billing page — `/billing` (new).** Plan, term, access dates, GSTIN on file, and a list of orders with status, amount and **Download GST invoice (PDF)**. Linked from the plan card and the account menu. Backend: `GET /api/orders` (the user's own) and `GET /api/orders/:id/invoice`.
- **`X-6` Abandoned order reuse.** If the user returns to Checkout with an unpaid `CREATED` order for the same plan and term less than 24 h old, reuse it instead of creating a new one. This keeps admin numbers clean.
- **`X-7` Error copy.** Map every server error (`L-4`, `C-6`, `R-4`) to one plain sentence plus one next step. No raw error codes on screen.
- **`X-8` Loading and empty states.** Use skeletons in the panel shapes, not spinners, for Dashboard, Billing and Checkout summary. Never show blank numbers.
- **`X-9` Accessibility.**
  - Term cards are a radio group.
  - The paywall sheet traps focus and closes on Esc.
  - OTP boxes have labels.
  - Sticky bars don't cover focused inputs on mobile; use `scroll-padding-bottom`.
  - Contrast: `--ink-soft` on `--paper` at least 4.5:1.
- **`X-10` Performance.**
  - Lazy-load the Cashfree SDK on the Checkout route only, not in `index.html` for every page.
  - Preload Comfortaa and Inter.
  - Load the sample workspace JSON only when the preview mounts.
- **`X-11` Honesty guardrails** for the preview and pricing:
  - The sample is always labelled as a sample.
  - Countdown and seat numbers come only from the server.
  - No invented testimonials or user counts.
  - No feature in the preview or the unlock list that won't ship at launch.

---

## 11. Open questions (answer before build)

1. **Early bird.** Does the existing 6/12-month early-bird pricing go away now that term discounts exist? If both stay, do they stack? *Recommended: remove early-bird pricing and keep the countdown.*
2. **Free trial.** Is there one? If not, `X-1` is required. *Recommended: no trial; the free preview does that job.*
3. **Refunds.** What is the policy for a paid customer who changes their mind before launch? *Recommended: full refund any time before launch day. Say so on Pricing and Checkout; it is the strongest objection-killer for paying early.*
4. **GST rate.** Confirm 18% for this service.
5. **Default term.** Pre-select 12 months, or 6? *Recommended: 12, with all totals visible; A/B test against 6.*
6. **Launch scope.** Which modules exist on launch day (inbox, assignment, pipeline, follow-ups, Ask Dorway)? The preview sidebar and unlock list must list only these.
7. **Approval.** What is reviewed and why might someone be rejected (e.g. business type not allowed on WhatsApp)? What is the SLA: is "1 working day" right?
8. **Setup call.** Do we book times manually over WhatsApp (as designed), or offer a booking link?
9. **Support number.** Which WhatsApp number is used for `S-6` and `X-4`?

---

## 12. Build order

| Phase | Items | Why |
|---|---|---|
| 1 | `P-1…P-5` pricing, `C-1…C-12` checkout, `R-1…R-5` return | Correct prices and a payable checkout come first |
| 2 | §8 approval states + `AD-1…AD-4` + notifications; `A-1…A-6` status home | Paying users need to see what happens next |
| 3 | `/welcome`, preview (`D-1…D-9`), paywall sheet (`S-1…S-7`), Pricing revamp | The conversion engine |
| 4 | `X-1…X-11`, funnel events (§9) | Polish, recovery, measurement |

## 13. Acceptance checklist

- [ ] Quote, order, invoice and admin show identical totals for every term and both GST cases (intra-state and inter-state)
- [ ] 12-month order excl. GST = ₹17,988.00; intra-state total = ₹21,225.84
- [ ] A new user goes Login → Welcome → Preview, with their business name on the workspace
- [ ] Every locked action in the preview opens the paywall with the matching headline
- [ ] The sample workspace is labelled as a sample on every screen
- [ ] The paywall goes straight to Checkout with the chosen term kept
- [ ] The Pay button shows the exact total and can't double-submit
- [ ] Return page handles paid, pending-after-timeout and failed states, and retry keeps the term
- [ ] A paid user sees Awaiting approval; admin approval updates the dashboard and sends WhatsApp + email
- [ ] Reject triggers a refund and reverses any on-hold partner commission
- [ ] Invoice downloads from Billing
- [ ] Landing CTAs and reassurance copy no longer promise a free trial (unless §11, question 2 says otherwise)
- [ ] All funnel events in §9 land in `onboarding_events` with the trigger and term properties
- [ ] Mobile (375px): the sticky pay bar and the paywall bottom sheet work, with nothing hidden behind them
- [ ] `prefers-reduced-motion` disables all entrance and tour animations