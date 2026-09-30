# Dorway — Onboarding Flow
### From "Try" to a provisioned account

**Written:** 16 September 2026
**Companions:** `architecture_launch.md` (payments, data model), `whatsapp.md` (OTP delivery), `otp.md` (template), `landingpage.md` (marketing surface)

---

## 1. The flow

```
  LANDING PAGE
       │  [Try Dorway]
       ▼
  ┌─────────────────────────────────────────┐
  │ 1. IDENTITY                             │
  │    enter phone or email → OTP → verify  │   ~40 sec
  └─────────────────────────────────────────┘
       ▼
  ┌─────────────────────────────────────────┐
  │ 2. WHO ARE YOU                          │
  │    name, business name, city            │   ~20 sec
  └─────────────────────────────────────────┘
       ▼
  ┌─────────────────────────────────────────┐
  │ 3. DASHBOARD                            │
  │    setup checklist, countdown,          │   ← home from here on
  │    step 2 of 5 is live: "Choose a plan" │
  └─────────────────────────────────────────┘
       ▼
  ┌─────────────────────────────────────────┐
  │ 4. PLAN SELECTION                       │
  │    3 plans × 2 terms, early-bird live   │
  └─────────────────────────────────────────┘
       ▼
  ┌─────────────────────────────────────────┐
  │ 5. CHECKOUT                             │
  │    line items, discount, GST split,     │
  │    GSTIN, billing state, total          │
  └─────────────────────────────────────────┘
       ▼
  ┌─────────────────────────────────────────┐
  │ 6. PAYMENT  (Cashfree hosted)           │
  └─────────────────────────────────────────┘
       ▼
  ┌─────────────────────────────────────────┐
  │ 7. CONFIRMED                            │
  │    receipt, invoice, what happens next  │
  └─────────────────────────────────────────┘
       ▼
  ┌─────────────────────────────────────────┐
  │ 8. SETUP                                │
  │    WhatsApp details, documents,         │   ← §9, the hard one
  │    optional existing credentials        │
  └─────────────────────────────────────────┘
       ▼
  ┌─────────────────────────────────────────┐
  │ 9. READY — countdown to 23 September    │
  └─────────────────────────────────────────┘
```

**Design rule underneath all of it: nothing is asked for before it is needed.**

Do not collect a business address to show someone a price. Do not ask for a WhatsApp number before they've paid. Every field between the "Try" click and the payment button is a place people leave. Steps 1 and 2 collect seven fields total; everything else waits until after money has changed hands, when the person is committed and willing to do work.

---

## 2. Onboarding state

One enum on the user, driving both the dashboard and any resume link.

```sql
CREATE TYPE onboarding_step AS ENUM (
  'IDENTIFIED',       -- OTP verified, nothing else known
  'PROFILED',         -- name + business captured
  'PLAN_SELECTED',    -- picked, not paid
  'PAYING',           -- order created, at the gateway
  'PAID',             -- money received, entitlement exists
  'SETUP_STARTED',    -- began the WhatsApp intake
  'SETUP_SUBMITTED',  -- everything handed over, ours to action
  'PROVISIONED',      -- tenant exists in the CRM
  'ACTIVE'            -- launched, using it
);

ALTER TABLE users
  ADD COLUMN onboarding_step onboarding_step NOT NULL DEFAULT 'IDENTIFIED',
  ADD COLUMN onboarding_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
```

The step only ever moves forward. `PAID` is set by the webhook (`architecture_launch.md` §6.4), never by the browser.

**Resume.** Someone who drops at step 5 and comes back a day later lands on the dashboard with "Choose a plan" still highlighted, not at the start. Abandonment emails at +1h and +24h carry a magic link straight to the step they left.

---

## 3. Step 1 — Identity

Single screen. One input, then one input.

```
┌───────────────────────────────────────────┐
│                                           │
│           Get started with Dorway         │
│      Founding rate, locked for a year     │
│                                           │
│   ┌─────────────────────────────────────┐ │
│   │ +91 │ 98765 43210                   │ │
│   └─────────────────────────────────────┘ │
│                                           │
│   ┌─────────────────────────────────────┐ │
│   │          Send code                  │ │
│   └─────────────────────────────────────┘ │
│                                           │
│        Use email instead                  │
│                                           │
│   By continuing you agree to our Terms    │
│   and Privacy Policy.                     │
│                                           │
└───────────────────────────────────────────┘
```

**Phone first, email as the visible alternative.** Your buyer lives on WhatsApp; a phone field reads as native. But `whatsapp.md` §0 is blunt that WhatsApp OTP likely won't be ready for the 23rd — so until `WHATSAPP_OTP_ENABLED` flips true, **the phone field is hidden and email leads.** One flag changes which is primary. Build both, ship with email.

**Country selector** defaults to `+91`, searchable. You will get NRI customers.

### The OTP screen

```
┌───────────────────────────────────────────┐
│   ←                                       │
│         Enter the code we sent            │
│         to you@business.com               │
│                                           │
│     ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐        │
│     │4 │ │8 │ │2 │ │9 │ │1 │ │  │        │
│     └──┘ └──┘ └──┘ └──┘ └──┘ └──┘        │
│                                           │
│         Resend code in 0:42               │
│         Send to my phone instead          │
│                                           │
└───────────────────────────────────────────┘
```

Behaviour that matters more than it looks like it should:

- Six separate boxes, JetBrains Mono, auto-advance on keystroke, backspace steps back, **paste fills all six**.
- `inputMode="numeric"` and `autoComplete="one-time-code"` so iOS offers the code from the notification banner.
- Auto-submit on the sixth digit. Nobody should have to find a button.
- Resend disabled for 45 seconds with a visible timer, then enabled. No hidden cooldowns — if it's rate-limited, say when it unlocks.
- Wrong code: shake the field once, clear it, focus box one, and say **"That code isn't right — 3 attempts left."** Counting down is the honest thing; silently burning attempts is not.
- Expired: **"That code has expired. Send a new one."** with the button right there.
- The other channel is always one tap away. This is the single highest-value element on the screen — see `whatsapp.md` §6.

Full backend behaviour in `architecture_launch.md` §5. Expiry is **5 minutes** (reconciled with `otp.md`).

---

## 4. Step 2 — Who are you

Four fields. Everything here has a real downstream use; nothing is collected because a form felt short.

| Field | Required | Used for |
|---|---|---|
| Your name | ✓ | Receipt, support, addressing you |
| Business name | ✓ | Invoice, Meta verification, WhatsApp display name |
| City | ✓ | Nothing yet — but it's one field and it tells you where demand is |
| Email or phone (whichever you didn't use in step 1) | — | The fallback channel. Ask, don't require. |

Not asked here: address, GSTIN, team size, industry, how you heard about us. Address and GSTIN come at checkout where they're actually needed. The rest is research you can do later by asking customers who already gave you money.

---

## 5. Step 3 — Dashboard

The dashboard **is** the onboarding checklist. Not a separate wizard the user escapes from — one persistent home that fills in over time and becomes the real dashboard on launch day.

```
┌─────────────────────────────────────────────────────────┐
│  Dorway                                    Rohit ▾      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   Dorway opens in                                       │
│                                                         │
│      06 : 21 : 44 : 08                                  │
│      days  hrs  min  sec                                │
│                                                         │
│   Founding rate ends when we launch. 63 places left.    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   Your setup                              1 of 5 done   │
│   ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░               │
│                                                         │
│   ✓  Account created                                    │
│                                                         │
│   ▸  Choose your plan                      [ Choose ]   │
│      Lock the founding rate before we open              │
│                                                         │
│   ○  Connect your WhatsApp number                       │
│      Available after you choose a plan                  │
│                                                         │
│   ○  Add your team                                      │
│                                                         │
│   ○  Open your inbox                                    │
│      Unlocks 23 September                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Three states per row:** done (check, `--green`), active (chevron, `--ink`, one primary button), locked (hollow circle, `--ink-soft`, a one-line reason). Exactly one row is active at a time — a checklist with three simultaneous CTAs is a menu, and menus stall people.

Locked rows say *why* they're locked. "Available after you choose a plan" is a reason; a greyed-out row with no explanation is a dead end.

After launch this same screen loses the countdown and gains real content — inbox summary, lead counts, team activity. Build it as the permanent home from day one.

---

## 6. Step 4 — Plan selection

Three plans, two terms. Pricing from `architecture_launch.md` §3.

```
   Billing:  [ 6 months ]  [ 12 months · 2 months free ]

   ┌────────────┐  ┌────────────────┐  ┌────────────┐
   │ Starter    │  │ Growth  ★      │  │ Scale      │
   │            │  │                │  │            │
   │ ₹̶9̶9̶9̶       │  │ ₹̶1̶,̶9̶9̶9̶         │  │ ₹̶3̶,̶9̶9̶9̶     │
   │ ₹499 /mo   │  │ ₹999 /mo       │  │ ₹1,999 /mo │
   │ + GST      │  │ + GST          │  │ + GST      │
   │            │  │                │  │            │
   │ 2 seats    │  │ 10 seats       │  │ Unlimited  │
   │ 1 number   │  │ 1 number       │  │ 3 numbers  │
   │ ...        │  │ ...            │  │ ...        │
   │            │  │                │  │            │
   │ [ Choose ] │  │ [ Choose ]     │  │ [ Choose ] │
   └────────────┘  └────────────────┘  └────────────┘

   Founding rate locked for as long as you stay subscribed.
   WhatsApp message charges are paid to Meta directly.
```

- Strike through the normal price, show the early rate beneath. The saving is the reason to buy now; make it visible without a banner shouting about it.
- `+ GST` on every price. Stating it here means the checkout total isn't a surprise, which is where trust gets lost.
- Middle card emphasised with a 2px `--green` border and a "Most popular" pill — **not** by being taller. A card that breaks the grid to claim importance reads as a template.
- Term toggle updates prices in place, no navigation.
- Seat and number caps on the card face. These are the two limits people actually compare.

**Mobile:** cards stack, Growth first. Sticky bottom bar — price on the left, "Choose Growth" on the right.

---

## 7. Step 5 — Checkout

The screen where people decide whether you're real. It should be the least designed thing you build — every gradient and animation on a payment page reads as less legitimate, not more.

```
┌──────────────────────────────────┬──────────────────────────┐
│                                  │                          │
│  Billing details                 │  Order summary           │
│                                  │                          │
│  Business name                   │  Growth plan             │
│  ┌────────────────────────────┐  │  12 months · ₹999/mo     │
│  │ Sunstone Interiors         │  │                          │
│  └────────────────────────────┘  │  Subtotal      ₹23,988   │
│                                  │  Founding      −₹12,000  │
│  Billing state                   │  discount                │
│  ┌────────────────────────────┐  │  ──────────────────────  │
│  │ Delhi                    ▾ │  │  Net             ₹11,988 │
│  └────────────────────────────┘  │                          │
│  Sets the GST that applies       │  CGST (9%)     ₹1,078.92 │
│                                  │  SGST (9%)     ₹1,078.92 │
│  GSTIN  (optional)               │  ──────────────────────  │
│  ┌────────────────────────────┐  │  Total       ₹14,145.84  │
│  │ 07AABCS1429B1ZX            │  │                          │
│  └────────────────────────────┘  │  You save ₹12,000 a year │
│  Add it to claim input credit    │  against the normal rate │
│                                  │                          │
│  Billing address                 │  ┌────────────────────┐  │
│  ┌────────────────────────────┐  │  │  Pay ₹14,145.84    │  │
│  │                            │  │  └────────────────────┘  │
│  └────────────────────────────┘  │                          │
│                                  │  Secured by Cashfree.    │
│                                  │  Full refund any time    │
│                                  │  before launch.          │
│                                  │                          │
└──────────────────────────────────┴──────────────────────────┘
```

### 7.1 The GST calculation

"Proper GST" in India means more than multiplying by 1.18 — the tax **splits differently depending on where your customer is**.

Place of supply for B2B services is the recipient's registered location. Compare it to your own registered state:

| Customer's state | Tax applied |
|---|---|
| Same as yours (intra-state) | CGST 9% + SGST 9% |
| Different state (inter-state) | IGST 18% |
| Outside India | Export of services — zero-rated under LUT, or 18%. `[VERIFY with your CA]` |

Same total either way. Different lines on the invoice, different returns filing. Getting it wrong means reissuing invoices.

```ts
type GstBreakdown = {
  netPaise: number;
  cgstPaise: number;   // 0 on inter-state
  sgstPaise: number;   // 0 on inter-state
  igstPaise: number;   // 0 on intra-state
  totalPaise: number;
  placeOfSupply: string;   // state code, e.g. '07'
};

const SUPPLIER_STATE_CODE = process.env.SUPPLIER_STATE_CODE!;  // [CONFIRM]

function computeGst(netPaise: number, customerStateCode: string): GstBreakdown {
  const intraState = customerStateCode === SUPPLIER_STATE_CODE;

  // Round each component half-up, independently, in paise.
  const half  = Math.round(netPaise * 9  / 100);
  const full  = Math.round(netPaise * 18 / 100);

  const cgst = intraState ? half : 0;
  const sgst = intraState ? half : 0;
  const igst = intraState ? 0    : full;

  return {
    netPaise, cgstPaise: cgst, sgstPaise: sgst, igstPaise: igst,
    totalPaise: netPaise + cgst + sgst + igst,
    placeOfSupply: customerStateCode,
  };
}
```

**Worked example — Growth, 12 months, customer in Delhi, supplier in Delhi:**

```
List price      ₹1,999 × 12  = ₹23,988.00    (2,398,800 paise)
Founding rate   ₹999   × 12  = ₹11,988.00    (1,198,800 paise)
Discount shown               = ₹12,000.00

Net                          = ₹11,988.00
CGST 9%                      =  ₹1,078.92    (  107,892 paise)
SGST 9%                      =  ₹1,078.92    (  107,892 paise)
Total                        = ₹14,145.84    (1,414,584 paise)
```

Same customer in Mumbai: `IGST 18% = ₹2,157.84`, total identical at `₹14,145.84`.

**Rules:**
- Everything in **paise as integers**. One float in this path and you will be off by a rupee on some orders and unable to explain why.
- Round each tax component independently, half-up. Don't compute a total and back out the components.
- Charge the exact paise amount. Cashfree accepts two decimals; `order_amount: 14145.84`.
- The displayed total and `orders.total_paise` are the same number, computed once, server-side. The webhook re-checks it before fulfilling (`architecture_launch.md` §6.4).

### 7.2 GSTIN

Optional, but prompt for it — your buyer is a registered business and the input credit makes the tax a non-cost to them. It's also a soft qualification signal.

```ts
const GSTIN_RE =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// First two characters are the state code. Use it.
function stateFromGstin(g: string) { return g.slice(0, 2); }
```

**Nice touch:** when a valid GSTIN is entered, auto-fill the billing state from its first two digits and show a small confirmation. If it disagrees with a state they already picked, prefer the GSTIN and say so quietly — `"Billing state set to Delhi from your GSTIN."` Don't silently overwrite; don't throw an error either.

Validate format client-side for instant feedback. `[CONFIRM]` whether to verify against the GST portal API — real validation, extra dependency, probably not worth it this week.

### 7.3 Checkout rules

- **The client never sends an amount.** It sends `{ planCode, termMonths, stateCode, gstin? }`. The server computes everything from the database. Otherwise someone buys Scale for ₹1.
- **One primary button.** Label it with the real number: `Pay ₹14,145.84`. Not "Continue", not "Proceed to payment". The amount on the button is the last thing they read before committing, and matching it to what gets charged is how you avoid the most common trust failure in Indian checkout.
- **Disable on click, instantly.** Double-submit creates two orders. Show a spinner in the button, not over the page.
- **Refund line visible without scrolling.** You're pre-selling something that doesn't exist. Say the refund terms where the money decision happens, not only in the policy page.
- **No coupon field** unless you have coupons. An empty promo box makes people leave to search for a code and not come back.
- **Mobile:** summary collapses to a sticky bottom bar showing the total and the pay button, expandable to the full breakdown.

---

## 8. Steps 6–7 — Payment and confirmation

Gateway flow, return handling, and webhook fulfilment are fully specced in `architecture_launch.md` §6. What this doc adds is what the user sees.

| State | Screen |
|---|---|
| **Redirecting** | Button spinner, "Taking you to Cashfree". No full-page loader. |
| **Confirming** | Real designed state — this is where anxious people sit. Gentle spinner, "Confirming your payment with the bank. This takes a few seconds." Polls `/api/orders/:id` every 3s to 60s. |
| **Still pending at 60s** | "Your payment is still processing. We'll email you the moment it confirms — you can close this page." Not an error. UPI collect genuinely takes a minute sometimes. |
| **Success** | Receipt, invoice download, next step, countdown. |
| **Failed** | Plain, specific, **"No money was taken."** Retry button creates a fresh order. |

### The confirmation screen

```
   ✓  You're in.

   Growth plan · 12 months · ₹999/month locked
   Paid ₹14,145.84 · Invoice DW-2026-0041

   [ Download invoice ]

   ─────────────────────────────────────────

   What happens next

   1. Tell us about your WhatsApp number
      Takes about 5 minutes. Do it now and
      you'll be live on day one.

      [ Start setup ]

   2. We get you verified with Meta
      We handle the submission. It's the
      slowest part, which is why we start now.

   3. Dorway opens — 6 days, 21 hours
```

That numbered list is a real sequence, so numbering it is correct. The critical thing is the **"do it now and you'll be live on day one"** framing on step 1 — the Meta verification lead time (`dorway.txt` §9.2b) is your longest pole, and every day a customer delays setup is a day they're not live after launch. Convert the urgency honestly.

Receipt email fires from the webhook, not from this page. The user may never see this screen.

---

## 9. Step 8 — Setup

The hardest screen in the product, and the one most likely to be built wrong.

### 9.1 First: you asked for the wrong credentials

You said the customer should upload "access token, app secret". Two corrections, and they change the design:

**The app secret is yours, not theirs.** In the Tech Provider model (`dorway.txt` §2.1), *you* have one Meta app. Customers don't create Meta apps — they grant your app access to their WhatsApp Business Account. A customer who is a dentist cannot produce an app secret, and a customer who could produce one shouldn't hand it to you.

**Asking customers to generate System User tokens doesn't scale, and your own architecture doc says so.** `dorway.txt` §2.1: *"you cannot manually configure Business Manager for every business that signs up, and you should not be asking them to do it themselves."* The correct mechanism is Meta's **Embedded Signup** — a popup inside your app where the customer logs into Facebook, picks or creates their WABA, and Meta returns a code you exchange for a token. They never see a token.

**But Embedded Signup needs Tech Provider status**, which `dorway.txt` §9.2b flags as the longest lead time of all your approvals. It will not be ready on 23 September.

So for launch: **collect information, not secrets.** Enough that your team can drive the Meta setup on the customer's behalf, tracked in a status screen. Replace it with Embedded Signup when Tech Provider clears. Design it so that replacement is a screen swap, not a migration.

### 9.2 What the screen collects

Four sections, progressive, each saving on completion so the whole thing is resumable.

**A. Your WhatsApp number**

| Field | Why |
|---|---|
| Number to use for Dorway | The number that becomes your WABA |
| Is it currently on the WhatsApp app? | Decides whether it needs migration or deletion first — the #1 setup surprise |
| Is it on another platform today? (Wati, Interakt, AiSensy…) | Means it's already a WABA; needs release from the current BSP |
| A number that can receive an OTP | Meta verifies the number by call or SMS |

Then a live warning, because this catches everyone:

> **This number is on the WhatsApp app right now.** Before it can be used with Dorway, you'll need to delete that account — chats and history on it will be gone. Many businesses use a fresh number instead. We'll walk you through either.

**B. Your business, as Meta sees it**

| Field | Notes |
|---|---|
| Legal business name | Must match your documents exactly, not your brand name |
| Registered address | Must match documents |
| Business website | Meta checks it; a live site materially helps verification |
| Business email on your domain | Generic Gmail addresses weaken the application |
| Meta Business Portfolio ID | If they have one. Optional — help them find it with a screenshot. |
| Facebook Page | Required for a WABA. Offer "I don't have one" → you help create it. |
| WhatsApp display name | What customers see. Meta has naming rules — flag the obvious ones. |

**C. Documents**

For Meta business verification. `[VERIFY current list — Meta changes this and it varies by country]`:

- Certificate of Incorporation, **or** GST registration certificate, **or** Shop & Establishment licence
- Address proof: business utility bill or bank statement, recent
- Business PAN

Upload rules: PDF/JPG/PNG, 10MB max, drag-and-drop with a visible file list, delete before submit. Store in tenant-scoped paths with signed URLs, never public. Virus-scan on upload. `[ASSUMED]` S3 or R2.

Show **why** each document is needed next to it. A dentist asked to upload a PAN card with no explanation will close the tab.

**D. Existing credentials — advanced, collapsed by default**

Only for businesses already running a WABA elsewhere who want to move it. Hidden behind "I already have a WhatsApp Business API account".

| Field | Type |
|---|---|
| WABA ID | Text |
| Phone Number ID | Text |
| Current BSP / platform | Select |
| System User access token | **Secret** — see §9.4 |

Above this section, in plain words:

> Most businesses skip this. Only fill it in if you already run WhatsApp Business API through another platform and want to bring that account across.

### 9.3 The screen

```
┌─────────────────────────────────────────────────────────┐
│  ← Dashboard                                            │
│                                                         │
│  Set up WhatsApp                          Saves as      │
│                                           you go        │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  ✓  1. Your WhatsApp number                        ▾    │
│                                                         │
│  ▸  2. Your business details                       ▾    │
│     ┌───────────────────────────────────────────────┐   │
│     │ Legal business name                           │   │
│     │ ┌───────────────────────────────────────────┐ │   │
│     │ │ Sunstone Interiors Pvt Ltd                │ │   │
│     │ └───────────────────────────────────────────┘ │   │
│     │ Exactly as it appears on your GST certificate │   │
│     │ ...                                           │   │
│     └───────────────────────────────────────────────┘   │
│                                                         │
│  ○  3. Documents                                   ▾    │
│  ○  4. Existing account (most people skip this)    ▾    │
│                                                         │
│                            [ Save and continue ]        │
└─────────────────────────────────────────────────────────┘
```

- **Accordion, one open at a time.** A single scroll of thirty fields is where people quit.
- **Autosave per section**, with a quiet "Saved" confirmation. People will do this across two sittings, from a phone and then a laptop.
- **Every field has a one-line reason under it.** This form asks for unusual things; unexplained questions feel like data harvesting.
- **Nothing is required to leave.** Partial submission is fine — your team can chase the gaps. A blocking form gets abandoned; a partial one gets finished.
- **Mobile-first.** Document upload from a phone camera roll must work; most of these documents are photographed, not scanned.

### 9.4 Storing secrets

If section D collects a token, it is a long-lived credential belonging to someone else's business. Treat it accordingly.

```sql
CREATE TABLE tenant_credentials (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  kind          TEXT NOT NULL,        -- 'wa_system_user_token'
  ciphertext    BYTEA NOT NULL,       -- AES-256-GCM
  iv            BYTEA NOT NULL,       -- unique per record
  auth_tag      BYTEA NOT NULL,
  last_four     TEXT NOT NULL,        -- for display only
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ
);
```

- **AES-256-GCM**, key from KMS or a dedicated env secret, **never** the same secret as your JWT signing key. Fresh IV per record.
- **Write-only in the UI.** Once saved, render `••••••••3f2a`. There is no "reveal". If they need it, they get it from Meta.
- **Never in logs, errors, APM traces, or analytics.** Redact at the logger, not at each call site (`whatsapp.md` §9).
- **Every read writes an `audit_log` row** — who, when, why. `dorway.txt` §9.9 requires this and it's the kind of thing you cannot retrofit honestly.
- **Support "replace"**, never "edit". Tokens rotate; they don't get patched.
- Plan for revocation from day one. A customer who leaves should be able to cut your access without emailing you.

### 9.5 After submission

The setup row on the dashboard becomes a status tracker, mirroring the blocking-status UI `dorway.txt` §2.1 calls for:

```
   ✓  Setup submitted            16 Sep, 4:20 pm
   ▸  Meta business verification  In review
      Submitted 16 Sep. Meta reviews these on
      their own schedule — we'll tell you the
      moment it moves.
   ○  Number registered
   ○  Message templates approved
   ○  Your inbox
```

**Never promise a Meta timeline.** `whatsapp.md` and `otp.md` both flag this; it applies to the customer-facing UI most of all. "In review, submitted 2 days ago" is honest. "Usually takes 24 hours" is a promise you cannot keep, and the customer who waits five days will remember you made it.

---

## 10. Data model additions

```sql
CREATE TABLE onboarding_profiles (
  user_id                UUID PRIMARY KEY REFERENCES users(id),

  -- A: number
  wa_number              TEXT,
  wa_on_consumer_app     BOOLEAN,
  wa_current_platform    TEXT,
  wa_otp_reachable       TEXT,

  -- B: business
  legal_name             TEXT,
  registered_address     TEXT,
  billing_state_code     CHAR(2),
  website                TEXT,
  business_email         TEXT,
  meta_business_id       TEXT,
  facebook_page          TEXT,
  wa_display_name        TEXT,

  -- progress
  section_a_done         BOOLEAN NOT NULL DEFAULT FALSE,
  section_b_done         BOOLEAN NOT NULL DEFAULT FALSE,
  section_c_done         BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at           TIMESTAMPTZ,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE onboarding_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id),
  kind         TEXT NOT NULL,   -- 'incorporation'|'address_proof'|'pan'|'other'
  storage_key  TEXT NOT NULL,   -- tenant-scoped path, never public
  filename     TEXT NOT NULL,
  mime_type    TEXT NOT NULL,
  size_bytes   INT NOT NULL,
  scanned_ok   BOOLEAN,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN billing_state_code CHAR(2);
ALTER TABLE orders
  ADD COLUMN place_of_supply CHAR(2),
  ADD COLUMN cgst_paise BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN sgst_paise BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN igst_paise BIGINT NOT NULL DEFAULT 0;
```

Note the `orders` change: `architecture_launch.md` §4 has a single `gst_paise` column. Split it into three. A GST invoice must show the components separately, and reconstructing the split later from a total is guesswork.

---

## 11. Funnel events

Instrument from hour one or you launch blind. Hashed user ID only, never phone or email.

```
landing_cta_clicked          { placement }
otp_requested                { channel }
otp_verified                 { channel, attempts, seconds_to_verify }
profile_completed
plan_viewed
plan_selected                { plan, term }
checkout_started             { plan, term, total_paise }
gstin_entered
checkout_submitted
payment_succeeded            { plan, term, total_paise }
payment_failed               { reason }
setup_started
setup_section_completed      { section }
setup_submitted              { sections_complete }
```

The two numbers that matter in week one: **OTP request → verified** (tells you if the OTP channel is broken) and **checkout started → paid** (tells you if the payment flow is). Watch both hourly on launch day.

---

## 12. Edge cases

| Scenario | Handling |
|---|---|
| Drops after OTP, returns next day | Dashboard, "Choose a plan" still active. Nothing re-asked. |
| Two tabs, two checkouts | Both orders can exist; only one can be paid. Reconciliation handles it. |
| Early-bird sells out mid-checkout | Their order already holds the locked rate. Honour it. |
| Pays, never does setup | Nudge at +1d, +3d, +6d. Entitlement is unaffected — they paid, they're a customer. |
| Number already on another BSP | Section A catches it. Flag for manual handling; it needs release from the current provider. |
| Documents rejected by Meta | Status row shows the reason, re-upload in place, resubmit |
| Wants to change plan after paying | Manual for week one. Refund and repurchase. Don't build upgrade logic now. |
| Wrong billing state entered | Editable until payment. After payment it means reissuing an invoice — manual, and rare enough to accept. |
| Refund requested | Order `REFUNDED`, entitlement `REFUNDED`, onboarding step frozen, access never granted |
| **Launch slips** | Countdown reads from config. One UPDATE moves every `access_starts_at`. Email everyone the same day. |

---

## 13. Build priority

Map onto the seven-day plan in `architecture_launch.md` §13.

**Must ship by the 23rd**
- Identity + OTP (email channel)
- Profile capture
- Dashboard checklist with countdown
- Plan selection
- Checkout with correct GST split
- Cashfree payment, return handling, webhook fulfilment
- Confirmation screen and receipt email

**Should ship**
- Setup sections A and B
- Document upload
- Resume links from abandonment emails

**Can wait**
- Section D credentials (few customers need it; take it over email in week one)
- Status tracker (an email update is fine for the first ten customers)
- Team invites
- Invoice PDF generation — send a manual invoice for week one

**If you're behind on day 5:** cut everything after the confirmation screen. Email the first customers a Google Form for setup. Money in the bank with a manual follow-up beats a polished setup flow nobody reaches because checkout wasn't finished.

---

## 14. Open questions

| # | Question | Blocks |
|---|---|---|
| **O1** | Your GST registered state code? | Every CGST/SGST vs IGST decision |
| **O2** | Is `orders.gst_paise` split into three columns? (§10) | Invoice correctness |
| **O3** | Confirm the Meta verification document list for India | Setup section C |
| **O4** | Where do documents live — S3, R2, Supabase Storage? | Upload implementation |
| **O5** | Encryption key management — KMS or env secret? | §9.4 |
| **O6** | Phone or email as the primary identity channel at launch? | Step 1. Suggest email until `WHATSAPP_OTP_ENABLED` is true. |
| **O7** | Invoice numbering series and format? | Receipt, compliance |
| **O8** | Has Tech Provider application been started? | Whether §9 is temporary or permanent |
| W1–W3 | From `whatsapp.md` — AgentX API type, messaging tier, verification | OTP channel |
| Q11, Q13 | From `dorway.txt` — product name, who pays Meta | Copy throughout |

---

## 15. Consistency notes

Three things across the doc set now need reconciling:

1. **OTP expiry** — `architecture_launch.md` §5 says 10 minutes; `otp.md`, `whatsapp.md` and this doc say 5. Update §5.
2. **GST columns** — `architecture_launch.md` §4 has one `gst_paise`; this doc splits it into CGST/SGST/IGST. Update the schema.
3. **Pricing** — `landingpage.md` §4.10 still carries per-seat placeholders (₹1,499/₹2,999). Everything since uses flat pricing (₹999/₹1,999/₹3,999). Update `landingpage.md`.

Say the word and I'll make all three edits so the set is internally consistent.