# Dorway — Launch Site Architecture
### Pre-launch marketing site, auth, and early-bird checkout

**Target launch:** 23 September 2026
**Written:** 16 September 2026
**Runway:** 7 days

**Scope:** A standalone web app that lets a visitor explore the product, see plans, create an account, pay for an early-bird plan through Cashfree, and watch a countdown to launch day. It does **not** include the CRM itself.

**Status legend** (matching `dorway.txt`): `[BUILT]` `[SPEC]` `[ASSUMED]` `[VERIFY]` `[CONFIRM]`

---

## 0. Read this before you write any code

Seven days is enough to build this. It is not enough to *unblock* it if any of the following isn't already done. Check all four today.

### 0.1 Cashfree merchant activation — hard blocker

You cannot accept a single rupee until your Cashfree account is KYC-verified and activated for live payments. This involves business documents, bank account verification, and a website review by Cashfree's risk team. `[VERIFY]` current turnaround — it has historically run from a day to well over a week, and it is entirely outside your control.

**Check today.** If the account is not already live:
- Build against **sandbox** (`https://sandbox.cashfree.com/pg`) so the code is ready.
- Ship the launch site on day one with a **waitlist and reserved price** instead of checkout — "lock the founding rate, pay when we open" — and switch checkout on the moment activation lands.
- Do not let an unactivated gateway push the whole launch.

### 0.2 Cashfree's website requirements — hard blocker

Cashfree's review checks that your site has certain pages live and linked in the footer before they activate you. At minimum: **Terms & Conditions, Privacy Policy, Refund & Cancellation Policy, Contact Us with a real address and phone, and clear pricing.** `[VERIFY]` the current checklist in your dashboard's activation section.

These are not optional legal garnish here. They are an activation gate. Write them on day one, not day six.

### 0.3 GST — decide before the first order

SaaS sold in India attracts 18% GST. This determines the `order_amount` you send to Cashfree and is nearly impossible to fix retroactively without reissuing invoices.

`[CONFIRM]` — pick one and apply it everywhere:
- **Inclusive:** display ₹999, charge ₹999, of which ₹152.39 is GST. Simpler to sell, lower realised revenue.
- **Exclusive:** display "₹999 + GST", charge ₹1,178.82. Standard for B2B, because your buyer claims input credit.

**Recommendation:** exclusive, displayed as `₹999/month + GST`. Your buyer is a registered business and will claim the credit, so the tax is not a real cost to them. Collect GSTIN at checkout as an optional field so you can issue a proper tax invoice.

### 0.4 You are charging for something that doesn't exist yet

Money collected on the 18th for a product that opens on the 23rd is a pre-order. If the 23rd slips, you have paying customers with no product, which is both a refund liability and a reputation problem.

Mitigate in the architecture, not in the apology:
- Entitlements store `access_starts_at`, and **billing starts from actual launch**, not from payment date. If launch slips to the 30th, everyone's 12 months starts on the 30th. Build this from the start.
- Publish a plain refund promise: full refund, no questions, any time before launch plus 7 days after. Put it on the checkout page, not buried in the policy.
- The launch date lives in **config, not in code**. You will change it at least once.

---

## 1. The central architecture decision

> **The launch site is a separate application from the CRM. It shares no database, no deploy, and no release schedule.**

`dorway.txt` §7.1 is unambiguous: the multi-tenancy retrofit is the largest engineering item on your list and it blocks every other module. It will not be finished in seven days.

So the launch site's job is narrow and self-contained:

1. Convince a visitor.
2. Create an account and take money.
3. Record an **entitlement** — "this person has paid for Growth at ₹999/month, locked, access starting at launch."
4. Hold them with a countdown until the CRM is ready.
5. Hand the entitlement over when it is.

The CRM provisions tenants *later*, reading entitlements through a single one-way sync. If the CRM slips by a month, the launch site doesn't care — it keeps selling and keeps counting down.

The failure mode to avoid is building checkout *inside* the CRM codebase. That couples your revenue to your riskiest refactor and you will end up shipping neither.

```
┌─────────────────────────────────────────────────────────┐
│  LAUNCH APP  (ships in 7 days)                          │
│                                                         │
│   Next.js ──────────── Route handlers ──── Postgres     │
│   (marketing,          (auth, checkout,    (users,      │
│    pricing,             webhooks)           orders,     │
│    countdown,                               entitle-    │
│    account)                                 ments)      │
│                              │                          │
│                              ▼                          │
│                        Cashfree PG                      │
│                        (hosted checkout)                │
└────────────────────────────┬────────────────────────────┘
                             │
                   one-way entitlement sync
                   (manual CSV on day one,
                    signed API later)
                             ▼
┌─────────────────────────────────────────────────────────┐
│  CRM APP  (ships when multi-tenancy is done)            │
│   Node/Express + React + Postgres, tenant-scoped        │
└─────────────────────────────────────────────────────────┘
```

**Day-one sync is a human.** An admin screen lists paid entitlements; you provision tenants by hand as the CRM comes online. With the order volumes realistic for week one, that is correct engineering, not a shortcut. Automate it in October.

---

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15, App Router** | Marketing pages need server rendering for SEO and fast first paint. Route handlers give you the webhook endpoint without a second service. |
| Language | TypeScript, strict | Money code. Types are not optional. |
| Hosting | Vercel | Zero infra time. Preview deploys for the design review you'll want on day five. |
| Database | Postgres — Neon or Supabase | Relational, transactional. Orders and payments are a ledger; do not put them in Firestore. |
| ORM | Prisma or Drizzle | `[ASSUMED]` — pick whichever the team knows. Do not learn one this week. |
| Auth | Custom email OTP + `jose` JWT in an httpOnly cookie | See §5. Avoids a third-party auth dependency you'd have to unwind later. |
| Payments | **Cashfree PG**, hosted checkout via `@cashfreepayments/cashfree-js` | Requested. Hosted checkout keeps you entirely out of PCI scope. |
| Email | Resend or AWS SES | Transactional OTP and receipts. Verify your sending domain today — DNS propagation is another quiet blocker. |
| Styling | Tailwind + CSS custom properties | Tokens in §8 map to CSS variables. |
| Icons | `lucide-react` only | `dorway.txt` §7.3 design system rule. No emoji anywhere. |
| Analytics | Plausible or PostHog | You need funnel data from hour one or you're launching blind. |

**If the team is strongly Express/Vite and Next.js would be a new thing this week:** use Vite + React for the frontend and your existing Express for the API. You lose SEO on the marketing page, which matters less than shipping. Do not learn a framework during a launch week.

---

## 3. Pricing model

### 3.1 Plans `[CONFIRM — supersedes the placeholders in landingpage.md]`

Flat per business, not per seat. Per-seat metering at checkout means quantity selection, proration, and mid-cycle seat changes — days of work you don't have. Sell seat *caps* inside a flat plan instead. Revisit for v2 (`dorway.txt` Q14).

| Plan | Normal | Early bird | Seats | Numbers |
|---|---|---|---|---|
| **Starter** | ₹999/mo | **₹499/mo** | 2 | 1 |
| **Growth** ★ | ₹1,999/mo | **₹999/mo** | 10 | 1 |
| **Scale** | ₹3,999/mo | **₹1,999/mo** | Unlimited | 3 |

★ Most popular. Growth is the plan the landing page sells; Starter exists to make Growth look correct, and Scale exists to give Growth a ceiling to sit below. All prices exclusive of GST.

**Feature split:**

- **Starter** — shared inbox, lead pipeline, 3 templates, manual assignment, email support
- **Growth** — everything in Starter, plus unlimited seats up to cap, auto-assignment on rotation, follow-up sequences, bulk campaigns, unlimited templates, account health monitoring, priority support
- **Scale** — everything in Growth, plus multiple numbers, role-based permissions, full audit log, API access, dedicated onboarding

Meta's per-conversation message charges sit outside the subscription in all three (`dorway.txt` Q13 — this doc assumes the tenant attaches their own payment method and pays Meta directly).

### 3.2 Sell prepaid, not recurring — this matters

**Do not build recurring mandates this week.** Cashfree's recurring product (UPI Autopay / eNACH) is a separate integration with its own activation, its own mandate lifecycle, and its own failure modes. Auto-debiting customers for a product that isn't live yet is also a chargeback magnet.

Sell **prepaid terms** at the early-bird rate instead:

| Term | Growth | Charged | Saving vs normal |
|---|---|---|---|
| 6 months | ₹999/mo | ₹5,994 + GST | ₹6,000 |
| 12 months ★ | ₹999/mo | ₹11,988 + GST | ₹12,000 |

One-time payment, no mandate, no autopay, simple refunds. Add recurring in October when you have revenue and time.

**The early-bird promise, stated exactly:** the ₹999 rate is locked for the full prepaid term, and renews at ₹999 for as long as the subscription stays active without a break. Write this into the terms in those words — it's the whole reason someone buys before launch, and vagueness here will cost you later.

### 3.3 Early-bird eligibility

Computed **server-side on every checkout**, never read from the client:

```ts
function isEarlyBirdOpen(now: Date, cfg: LaunchConfig, sold: number): boolean {
  if (cfg.earlyBirdForceClosed) return false;
  if (now >= cfg.earlyBirdEndsAt) return false;
  if (cfg.earlyBirdSeatCap !== null && sold >= cfg.earlyBirdSeatCap) return false;
  return true;
}
```

`earlyBirdEndsAt` defaults to the launch timestamp. Two knobs worth having:

- **Seat cap** (`[CONFIRM]` — suggest 100). Scarcity that is *true* converts; scarcity that is invented gets noticed. If you set a cap, show the real remaining count and honour it exactly.
- **Grace window.** Consider keeping early-bird open 48 hours *past* launch. Launch-day traffic is your highest-intent traffic, and shutting the discount off at the exact moment attention peaks is a self-inflicted wound.

---

## 4. Data model

Postgres. Money in **paise as `BIGINT`**, never floats. Every timestamp `TIMESTAMPTZ`, stored UTC.

```sql
-- Accounts ---------------------------------------------------------

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           CITEXT UNIQUE NOT NULL,
  phone           TEXT,
  full_name       TEXT,
  business_name   TEXT,
  business_city   TEXT,
  gstin           TEXT,
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at   TIMESTAMPTZ
);

CREATE TABLE login_otps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       CITEXT NOT NULL,
  code_hash   TEXT NOT NULL,          -- bcrypt. Never store the code.
  expires_at  TIMESTAMPTZ NOT NULL,   -- now() + 10 min
  attempts    SMALLINT NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON login_otps (email, created_at DESC);

-- Catalogue --------------------------------------------------------

CREATE TABLE plans (
  code                TEXT PRIMARY KEY,      -- 'starter' | 'growth' | 'scale'
  name                TEXT NOT NULL,
  normal_paise_month  BIGINT NOT NULL,
  early_paise_month   BIGINT NOT NULL,
  seat_cap            INT,                   -- NULL = unlimited
  number_cap          INT NOT NULL,
  features            JSONB NOT NULL,
  sort_order          INT NOT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE
);

-- Single-row config. Launch date lives HERE, not in code.
CREATE TABLE launch_config (
  id                     INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  launch_at              TIMESTAMPTZ NOT NULL,
  early_bird_ends_at     TIMESTAMPTZ NOT NULL,
  early_bird_seat_cap    INT,
  early_bird_force_close BOOLEAN NOT NULL DEFAULT FALSE,
  checkout_enabled       BOOLEAN NOT NULL DEFAULT TRUE,  -- kill switch
  gst_percent            NUMERIC(5,2) NOT NULL DEFAULT 18.00,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Commerce ---------------------------------------------------------

CREATE TYPE order_status AS ENUM
  ('CREATED','PENDING','PAID','FAILED','EXPIRED','REFUNDED');

CREATE TABLE orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id),
  plan_code           TEXT NOT NULL REFERENCES plans(code),
  term_months         SMALLINT NOT NULL,     -- 6 | 12
  is_early_bird       BOOLEAN NOT NULL,
  rate_paise_month    BIGINT NOT NULL,       -- the locked rate
  subtotal_paise      BIGINT NOT NULL,       -- rate * term
  gst_paise           BIGINT NOT NULL,
  total_paise         BIGINT NOT NULL,       -- what Cashfree charges
  currency            CHAR(3) NOT NULL DEFAULT 'INR',
  status              order_status NOT NULL DEFAULT 'CREATED',
  cf_order_id         TEXT UNIQUE,
  cf_payment_session_id TEXT,
  idempotency_key     UUID NOT NULL UNIQUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at             TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ NOT NULL   -- now() + 30 min
);
CREATE INDEX ON orders (user_id, created_at DESC);
CREATE INDEX ON orders (status) WHERE status IN ('CREATED','PENDING');

CREATE TABLE payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id),
  cf_payment_id TEXT UNIQUE NOT NULL,
  status        TEXT NOT NULL,     -- SUCCESS | FAILED | PENDING | USER_DROPPED
  method        TEXT,              -- upi | card | netbanking | wallet
  amount_paise  BIGINT NOT NULL,
  bank_ref      TEXT,
  raw           JSONB NOT NULL,    -- full gateway payload, always
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Webhook idempotency. Insert BEFORE processing.
CREATE TABLE webhook_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key    TEXT UNIQUE NOT NULL,  -- type + cf_payment_id + cf_order_id
  event_type    TEXT NOT NULL,
  signature_ok  BOOLEAN NOT NULL,
  raw           JSONB NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at  TIMESTAMPTZ,
  error         TEXT
);

-- What the customer actually bought -------------------------------

CREATE TYPE entitlement_status AS ENUM
  ('PENDING_LAUNCH','ACTIVE','EXPIRED','REFUNDED','CANCELLED');

CREATE TABLE entitlements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id),
  order_id         UUID NOT NULL REFERENCES orders(id) UNIQUE,
  plan_code        TEXT NOT NULL REFERENCES plans(code),
  rate_paise_month BIGINT NOT NULL,       -- locked forever
  term_months      SMALLINT NOT NULL,
  access_starts_at TIMESTAMPTZ NOT NULL,  -- = launch_at, NOT paid_at
  access_ends_at   TIMESTAMPTZ NOT NULL,  -- starts_at + term
  status           entitlement_status NOT NULL DEFAULT 'PENDING_LAUNCH',
  crm_tenant_id    UUID,                  -- filled at provisioning
  provisioned_at   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Everyone who didn't buy -----------------------------------------

CREATE TABLE waitlist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      CITEXT UNIQUE NOT NULL,
  source     TEXT,       -- 'hero' | 'pricing' | 'exit' | 'checkout_abandon'
  plan_intent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor      TEXT NOT NULL,   -- user id, 'system', or 'admin:<id>'
  action     TEXT NOT NULL,
  subject    TEXT,
  meta       JSONB,
  ip         INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Why `access_starts_at` is separate from `paid_at`:** if launch slips, you run one UPDATE to move every pending entitlement forward and nobody loses a day they paid for. This single column is the difference between a slipped launch being an inconvenience and being a refund event.

---

## 5. Authentication

**Email OTP, passwordless.** Six digits, ten-minute expiry.

Reasoning: no password reset flow to build, no password storage to get wrong, and the email is verified as a side effect — which you need, because that address is where the receipt and the launch-day access link go. Phone OTP would be more on-brand for a WhatsApp product, but it needs an SMS provider or an approved WhatsApp template, neither of which you can get in seven days.

**Flow:**

```
POST /api/auth/request-otp   { email }
  → rate limit: 3 per email per 15 min, 10 per IP per hour
  → generate 6-digit code, bcrypt it into login_otps
  → email it
  → ALWAYS return 200, regardless of whether the user exists
    (otherwise the endpoint is an account-enumeration oracle)

POST /api/auth/verify-otp    { email, code }
  → fetch newest unconsumed, unexpired OTP for that email
  → attempts >= 5 → reject and consume
  → bcrypt.compare
  → upsert user, set email_verified
  → mark OTP consumed
  → issue JWT, set cookie
```

**Session cookie:**

```
name:     dw_session
value:    JWT (HS256, jose), { sub, email, iat, exp }
httpOnly: true
secure:   true
sameSite: 'lax'     // 'lax' not 'strict' — the Cashfree return redirect
                    // is a cross-site navigation and strict will drop it
path:     '/'
maxAge:   30 days
```

That `sameSite` note is the single most common way this integration breaks. A user pays successfully, gets redirected back, and appears logged out. `lax` allows the cookie on top-level GET navigations, which is exactly what the return URL is.

Add Google OAuth only if there's time on day six. It is a conversion improvement, not a requirement.

---

## 6. Payments — Cashfree

### 6.1 Integration shape

**Hosted checkout**, via the JS SDK. Cashfree renders the payment page; card data never touches your servers, which keeps you out of PCI scope entirely. Do not use the seamless/element flow this week.

```
Environment  Base URL
sandbox      https://sandbox.cashfree.com/pg
production   https://api.cashfree.com/pg

Headers on every API call:
  x-client-id:      $CASHFREE_APP_ID
  x-client-secret:  $CASHFREE_SECRET_KEY
  x-api-version:    2026-01-01        [VERIFY — pin it explicitly]
  x-idempotency-key: <uuid>           on create-order retries
  Content-Type:     application/json
```

`[VERIFY]` — pin the API version and do not use "latest". A gateway silently changing response shape under a live checkout is a bad afternoon. Confirm `2026-01-01` is current in your dashboard before you pin it; `2025-01-01` and `2023-08-01` are the prior versions and are still supported.

### 6.2 The flow

```
 BROWSER                    YOUR SERVER                  CASHFREE
    │                            │                           │
    │  POST /api/checkout        │                           │
    │  { planCode, termMonths }  │                           │
    ├───────────────────────────►│                           │
    │                            │ 1. auth from cookie       │
    │                            │ 2. load plan from DB      │
    │                            │ 3. eligibility server-side│
    │                            │ 4. compute price + GST    │
    │                            │ 5. INSERT orders (CREATED)│
    │                            │                           │
    │                            │  POST /pg/orders          │
    │                            ├──────────────────────────►│
    │                            │◄──────────────────────────┤
    │                            │  { cf_order_id,           │
    │                            │    payment_session_id }   │
    │                            │ 6. store both             │
    │  { paymentSessionId }      │                           │
    │◄───────────────────────────┤                           │
    │                            │                           │
    │  cashfree.checkout({ paymentSessionId })                │
    ├────────────────────────────────────────────────────────►│
    │                        [ user pays ]                    │
    │                            │                           │
    │                            │◄──── WEBHOOK ─────────────┤   ← truth
    │                            │  PAYMENT_SUCCESS_WEBHOOK  │
    │                            │                           │
    │◄─── redirect to return_url ─────────────────────────────┤
    │  GET /checkout/return?order_id=...                      │
    ├───────────────────────────►│                           │
    │                            │  GET /pg/orders/{id}      │   ← confirm
    │                            ├──────────────────────────►│
    │                            │◄──────────────────────────┤
    │  success / pending / fail  │                           │
    │◄───────────────────────────┤                           │
```

**Two rules that are not negotiable:**

1. **Price is computed on the server, from the database.** The client sends a plan code and a term. It never sends an amount. If it does, someone will buy Scale for ₹1.
2. **The webhook is the source of truth, not the browser redirect.** A user can close the tab, lose signal, or hit back. Payment still succeeded. The return page is a *convenience*; the webhook is the ledger entry.

### 6.3 Create order

```ts
// POST /api/checkout
const plan = await db.plan.findUnique({ where: { code: body.planCode } });
const cfg  = await db.launchConfig.get();
if (!plan?.isActive || !cfg.checkoutEnabled) throw new BadRequest();
if (![6, 12].includes(body.termMonths))      throw new BadRequest();

const sold  = await db.order.count({ where: { isEarlyBird: true, status: 'PAID' }});
const early = isEarlyBirdOpen(new Date(), cfg, sold);

const ratePaise = early ? plan.earlyPaiseMonth : plan.normalPaiseMonth;
const subtotal  = ratePaise * body.termMonths;
const gst       = Math.round(subtotal * Number(cfg.gstPercent) / 100);
const total     = subtotal + gst;

const order = await db.order.create({ data: {
  userId: session.sub, planCode: plan.code, termMonths: body.termMonths,
  isEarlyBird: early, ratePaiseMonth: ratePaise,
  subtotalPaise: subtotal, gstPaise: gst, totalPaise: total,
  idempotencyKey: crypto.randomUUID(),
  expiresAt: new Date(Date.now() + 30 * 60_000),
}});

const res = await fetch(`${CF_BASE}/orders`, {
  method: 'POST',
  headers: {
    'x-client-id':       process.env.CASHFREE_APP_ID!,
    'x-client-secret':   process.env.CASHFREE_SECRET_KEY!,
    'x-api-version':     '2026-01-01',
    'x-idempotency-key': order.idempotencyKey,
    'Content-Type':      'application/json',
  },
  body: JSON.stringify({
    order_id:       order.id,                  // your UUID, your reference
    order_amount:   Number((total / 100).toFixed(2)),  // RUPEES, 2dp
    order_currency: 'INR',
    customer_details: {
      customer_id:    user.id,
      customer_email: user.email,
      customer_phone: user.phone ?? '',        // [VERIFY] if required
      customer_name:  user.fullName ?? '',
    },
    order_meta: {
      return_url: `${APP_URL}/checkout/return?order_id={order_id}`,
      notify_url: `${APP_URL}/api/webhooks/cashfree`,
    },
    order_expiry_time: order.expiresAt.toISOString(),
    order_note: `${plan.name} · ${body.termMonths} months`,
  }),
});
```

**The paise/rupees trap.** You store paise as integers. Cashfree's `order_amount` is **rupees with up to two decimals**. Convert at exactly one place — the boundary above — and never anywhere else. `11988 * 100` sent by mistake is a ₹11,98,800 charge attempt.

### 6.4 Webhook handler

```ts
// POST /api/webhooks/cashfree
// Next.js App Router gives you the raw body via req.text().
// On Express you MUST use express.raw({ type: 'application/json' })
// for this route only — express.json() reformats the body and the
// signature will never match.

export async function POST(req: Request) {
  const rawBody   = await req.text();
  const signature = req.headers.get('x-webhook-signature') ?? '';
  const timestamp = req.headers.get('x-webhook-timestamp') ?? '';

  const expected = crypto
    .createHmac('sha256', process.env.CASHFREE_SECRET_KEY!)
    .update(timestamp + rawBody)
    .digest('base64');

  const ok =
    expected.length === signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));

  if (!ok) {
    await logRejectedWebhook(rawBody);
    return new Response('invalid signature', { status: 401 });
  }

  // Replay protection: reject anything older than 5 minutes.
  if (Math.abs(Date.now() - Number(timestamp)) > 5 * 60_000) {
    return new Response('stale', { status: 400 });
  }

  const evt = JSON.parse(rawBody);
  const dedupeKey = [
    evt.type,
    evt.data?.payment?.cf_payment_id,
    evt.data?.order?.order_id,
  ].join(':');

  // Idempotency: unique index makes the duplicate insert fail.
  try {
    await db.webhookEvent.create({
      data: { dedupeKey, eventType: evt.type, signatureOk: true, raw: evt },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return new Response('ok', { status: 200 });
    throw e;
  }

  await processEvent(evt);           // see below
  return new Response('ok', { status: 200 });
}
```

Signature scheme confirmed against Cashfree's current docs: <cite index="15-1">the timestamp is in the `x-webhook-timestamp` header and the signature in `x-webhook-signature`, computed as `Base64Encode(HMACSHA256(timestamp + payload, merchantSecretKey))`</cite>, and <cite index="16-1">the raw request body must be used rather than a parsed JSON object, or the signature will not match</cite>.

**Events to handle** `[VERIFY the exact set enabled in your dashboard]`:

| Event | Action |
|---|---|
| `PAYMENT_SUCCESS_WEBHOOK` | Record payment, order → `PAID`, create entitlement, email receipt |
| `PAYMENT_FAILED_WEBHOOK` | Record payment, order → `FAILED`, email a retry link |
| `PAYMENT_USER_DROPPED_WEBHOOK` | Order → `FAILED`, queue a recovery email for +2h |
| `REFUND_STATUS_WEBHOOK` | Order → `REFUNDED`, entitlement → `REFUNDED` |

**Fulfilment must be a single transaction:**

```ts
await db.$transaction(async (tx) => {
  const order = await tx.order.findUnique({
    where: { id: evt.data.order.order_id },
  });
  if (!order || order.status === 'PAID') return;      // already done

  // Amount check. If the paid amount doesn't match what you asked
  // for, do NOT fulfil. Flag it and stop.
  const paidPaise = Math.round(Number(evt.data.payment.payment_amount) * 100);
  if (paidPaise !== order.totalPaise) {
    await flagForReview(order.id, 'amount_mismatch', evt);
    return;
  }

  await tx.payment.create({ data: { /* ... */ raw: evt } });
  await tx.order.update({
    where: { id: order.id },
    data: { status: 'PAID', paidAt: new Date() },
  });

  const cfg = await tx.launchConfig.get();
  const starts = cfg.launchAt;                        // NOT paidAt
  await tx.entitlement.create({ data: {
    userId: order.userId, orderId: order.id, planCode: order.planCode,
    ratePaiseMonth: order.ratePaiseMonth, termMonths: order.termMonths,
    accessStartsAt: starts,
    accessEndsAt: addMonths(starts, order.termMonths),
    status: 'PENDING_LAUNCH',
  }});
});

await sendReceipt(order);   // outside the transaction — email can fail
```

Always return `200` once you've durably stored the event. A non-2xx triggers a retry, and retries against a half-processed order are how people accidentally create two entitlements from one payment. Store first, process second.

### 6.5 Return page

`/checkout/return?order_id=...` does **not** trust the query string. It calls `GET /pg/orders/{order_id}` server-side to read the authoritative status, then renders:

- **PAID** → success, receipt, countdown, "what happens next"
- **ACTIVE / PENDING** → "we're confirming your payment", poll your own `/api/orders/{id}` every 3 seconds for up to 60 seconds. UPI collect requests can take a minute to settle.
- **FAILED / EXPIRED** → plain failure, a retry button that creates a fresh order, and a note that no money was taken.

Never show "success" from the redirect alone.

### 6.6 Reconciliation

A cron every 15 minutes (Vercel Cron or `node-cron`):

- Orders stuck in `CREATED`/`PENDING` past `expires_at` → fetch from Cashfree → mark `PAID` or `EXPIRED` accordingly.
- Any `PAID` order with no entitlement → alert loudly.
- Daily 23:00 IST: total of `PAID` orders vs Cashfree's settlement report. `[VERIFY]` — can be manual for week one.

Webhooks get lost. Reconciliation is what stops a lost webhook becoming a customer who paid and got nothing.

---

## 7. Countdown

**Server-authoritative. Never trust the device clock** — a meaningful share of phones have wrong time, and a countdown reading `-4:12:09` on launch morning looks broken.

```ts
// GET /api/launch-state  (cache: 60s, stale-while-revalidate)
{
  serverTime:        "2026-09-16T14:22:03.120Z",
  launchAt:          "2026-09-23T05:30:00.000Z",   // 11:00 IST
  earlyBirdEndsAt:   "2026-09-23T05:30:00.000Z",
  earlyBirdOpen:     true,
  earlyBirdRemaining: 63,        // null if no cap
  phase:             "PRE_LAUNCH"
}
```

Client computes an offset once on mount and applies it to every tick:

```ts
const offset = Date.parse(res.serverTime) - Date.now();
const remaining = Date.parse(res.launchAt) - (Date.now() + offset);
```

**Phases** — driven by config, so flipping them is a database write, not a deploy:

| Phase | Condition | Site behaviour |
|---|---|---|
| `PRE_LAUNCH` | `now < launchAt` | Countdown, early-bird pricing, "Reserve your rate" |
| `LAUNCH_DAY` | within 24h after | "We're live", early-bird grace if configured |
| `LIVE` | after grace | Countdown removed, normal pricing, "Open your inbox" CTA |

Build all three on day one. Launch day is not when you want to be writing the launch-day state.

**Ticks:** `requestAnimationFrame` throttled to 1Hz, not `setInterval` — background tabs throttle intervals and the display drifts. Re-sync with the server on `visibilitychange`.

**Reduced motion:** the digits still update; only the flip animation is suppressed.

---

## 8. Design system

Same tokens as `landingpage.md`, so the marketing page and the checkout feel like one product. WhatsApp's visual vernacular — the pale mint of an outgoing bubble, the deep bottle-green of the chat header — shifted enough that it reads as yours and not an unofficial Meta clone.

### 8.1 Tokens

```css
:root {
  --paper:     #F7F6F2;   /* page background, warm neutral, faint green cast */
  --card:      #FFFFFF;
  --ink:       #12211C;   /* headings and body — never pure black */
  --ink-soft:  #5A6B65;
  --line:      #E4E6E0;
  --green:     #0B8A5C;   /* primary actions, brand */
  --green-deep:#065C3C;   /* hover, pressed */
  --mint:      #DCF0E4;   /* quiet fills, bubbles, badges, hero wash */
  --amber:     #C98A2E;   /* pending only — payment confirming, OTP sent */
  --clay:      #B24A3F;   /* failure only */

  --radius-panel: 20px;
  --radius-ui:    12px;
  --radius-pill:  999px;
  --shadow:       0 1px 2px rgba(18,33,28,.04);
  --section-y:    120px;
}

:root:not([data-theme="light"]) { /* under prefers-color-scheme: dark */
  --paper: #0C1512; --card: #121D19; --ink: #EDF2EF;
  --ink-soft: #8A9A94; --line: #22302B;
  --green: #1FA872; --mint: #173A2B;
}
```

One shadow value across the entire app. Radius carries hierarchy instead — 20px panels, 12px inner UI, 999px pills.

### 8.2 Type

- **Comfortaa** 500/700 — display only, never below 18px. Tracking `-0.02em` above 40px. No italic exists; use weight or colour.
- **Inter** 400/500/600 — everything under 20px. All UI, all body, all form labels.
- **JetBrains Mono** 500 — real data only: order IDs, amounts, countdown digits, OTP input, phone numbers. Not labels, not decoration.

Countdown digits in **JetBrains Mono, tabular figures** (`font-variant-numeric: tabular-nums`). Proportional digits make the whole block jitter every second, and it's the most-watched element on the page.

### 8.3 Interface principles

**Money UI earns trust through boringness.** The checkout page should be the least designed thing you build. Every gradient, animation, or clever layout on a payment screen reads as less legitimate, not more. Spend the visual budget on the landing page.

- **Buttons** — `--green` fill, white text, Inter 600, 14px radius. One primary per screen. Disabled and loading states designed, not afterthoughts. The pay button must be unclickable the instant it's pressed.
- **Inputs** — 48px tall minimum, 1px `--line` border, `--green` focus ring at 2px with a visible offset. 16px font on mobile, always — anything smaller triggers iOS auto-zoom on focus.
- **OTP input** — six separate boxes, mono, auto-advance on keystroke, backspace moves back, full paste supported. `inputMode="numeric"` and `autoComplete="one-time-code"` so iOS offers the code from the notification.
- **Errors** — inline under the field, `--clay`, specific. "That code has expired — request a new one", not "Invalid input".
- **Empty and waiting states** — the "confirming your payment" state needs a real design. It is where anxious people sit.
- **Motion** — one orchestrated moment on the hero (the conversation thread animating in, once, on load). Everything else responds to input only. No scroll-triggered fades on every section; that is the clearest tell of a generated page.
- **Icons** — `lucide-react` only, 20px default. **No emoji anywhere**, per `dorway.txt` §7.3.

### 8.4 Mobile

Most of your traffic will be Android phones on mobile data, arriving from a WhatsApp forward.

- 375px is the design width, not an afterthought.
- Sticky bottom CTA bar on the pricing page — price left, "Get started" right.
- Test the full checkout on a real mid-range Android over 4G, not just Chrome devtools. UPI flows leave the browser and come back; that transition is where things break.
- Hero wash as WebP with a JPG fallback; preload the LCP image.
- Ship under 200KB of JS on the marketing route.

---

## 9. Routes

### 9.1 Pages

| Route | Auth | Purpose |
|---|---|---|
| `/` | — | Landing page, per `landingpage.md`. Countdown in hero. |
| `/pricing` | — | Three plans, term toggle, early-bird banner, FAQ |
| `/login` | — | Email entry → OTP. Doubles as signup. |
| `/checkout/[plan]` | ✓ | Order summary, term choice, GSTIN field, pay button |
| `/checkout/return` | ✓ | Server-verified payment result |
| `/account` | ✓ | Plan, countdown to access, receipt, invoice download |
| `/legal/terms` | — | **Required for Cashfree activation** |
| `/legal/privacy` | — | **Required** |
| `/legal/refund` | — | **Required** |
| `/contact` | — | **Required** — real address, phone, email |
| `/admin/orders` | admin | Order list, entitlements, manual provisioning |

Unauthenticated hit on `/checkout/[plan]` → `/login?next=/checkout/growth`. Preserve intent through login or you lose the buyer at the highest-intent moment in the funnel.

### 9.2 API

```
POST   /api/auth/request-otp      { email }
POST   /api/auth/verify-otp       { email, code }        → sets cookie
POST   /api/auth/logout
GET    /api/me

GET    /api/plans                                        → plans + live pricing
GET    /api/launch-state                                 → §7

POST   /api/checkout              { planCode, termMonths }
                                                         → { paymentSessionId, orderId }
GET    /api/orders/:id                                   → status (polling)
POST   /api/webhooks/cashfree                            → signed, public

POST   /api/waitlist              { email, source }

GET    /api/admin/orders          admin
POST   /api/admin/provision/:entitlementId   admin
POST   /api/admin/launch-config   admin                  → move the date
```

**Rate limits** (Upstash Redis or Vercel KV):

| Endpoint | Limit |
|---|---|
| `request-otp` | 3 / email / 15min · 10 / IP / hour |
| `verify-otp` | 5 attempts / OTP, then burn it |
| `checkout` | 5 / user / 10min |
| `waitlist` | 5 / IP / hour |

---

## 10. Security

- **Secrets server-side only.** `CASHFREE_SECRET_KEY` is never in a `NEXT_PUBLIC_` variable, never in client bundle, never in a log line. The only thing the browser receives is `payment_session_id`.
- **Amount integrity.** Server computes price from the DB; the webhook re-checks the paid amount against `orders.total_paise` before fulfilling. Mismatch → flag, don't fulfil.
- **Webhook auth** — signature verified with `timingSafeEqual`, replay window 5 minutes. Optionally whitelist Cashfree's production IPs `[VERIFY current list — as documented: 52.66.101.190, 3.109.102.144, 18.60.134.245, 18.60.183.142]`. Treat IP allowlisting as defence in depth, never as a substitute for the signature check.
- **Idempotency everywhere** — unique `dedupe_key` on webhook events, unique `idempotency_key` on orders, unique `order_id` on entitlements.
- **PII** — you are storing emails, phones, GSTINs, business names. Encrypt at rest (managed Postgres does this), TLS in transit, and no PII in application logs or analytics events.
- **Headers** — HSTS, `X-Content-Type-Options: nosniff`, a CSP that allows the Cashfree SDK origin `[VERIFY the exact origin]`, `X-Frame-Options: DENY` on everything except what Cashfree's SDK needs.
- **Admin** — separate allowlist of emails, every action written to `audit_log`. Do not ship a self-serve admin role this week.
- **Cookies** — `httpOnly`, `secure`, `sameSite=lax` (see §5 on why not `strict`).

---

## 11. Environment

```bash
DATABASE_URL=

APP_URL=https://dorway.app
JWT_SECRET=                      # 32+ random bytes
ADMIN_EMAILS=you@dorway.app

CASHFREE_ENV=sandbox             # sandbox | production
CASHFREE_APP_ID=
CASHFREE_SECRET_KEY=
CASHFREE_API_VERSION=2026-01-01

RESEND_API_KEY=
EMAIL_FROM="Dorway <hello@dorway.app>"

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

NEXT_PUBLIC_PLAUSIBLE_DOMAIN=dorway.app
```

Separate Cashfree credentials per environment. A production key in a preview deploy is how test orders become real charges.

---

## 12. Failure modes

| Scenario | Handling |
|---|---|
| User pays, closes tab before redirect | Webhook fulfils. Receipt email carries the news. |
| Webhook never arrives | Reconciliation cron catches it within 15 min. |
| Webhook arrives twice | `dedupe_key` unique constraint. Second is a no-op 200. |
| Webhook arrives before redirect | Normal. Return page reads `PAID` and shows success. |
| Duplicate tabs, two orders | Both can be created; only one can be paid. Allow it, reconcile. |
| Paid amount ≠ order amount | Do not fulfil. Flag for manual review. |
| UPI pending for 2 minutes | Return page polls to 60s, then "we'll email you when it confirms". |
| Payment succeeds, entitlement insert fails | Same transaction, so it can't half-happen. Alert on any `PAID` order with no entitlement. |
| Early-bird cap hit mid-checkout | Order already created holds its locked rate. Honour it. Cap applies at order creation, not at payment. |
| **Launch slips** | Update `launch_config.launch_at`. One UPDATE moves every `PENDING_LAUNCH` entitlement's `access_starts_at` forward. Email everyone the same day. |
| Cashfree down on launch day | `checkout_enabled = false` kills checkout and falls back to the waitlist form. Site stays up. |
| User requests a refund | Cashfree refund API, order → `REFUNDED`, entitlement → `REFUNDED`. Manual for week one. |

---

## 13. Seven-day plan

**Day 1 — unblock, don't build**
Cashfree activation status checked and application submitted if needed. Domain and DNS. Email sending domain verified. Postgres provisioned, schema migrated, plans seeded. Legal pages drafted. Repo and deploy pipeline live.

**Day 2 — auth**
OTP request/verify, email delivery, JWT cookie, `/login`, session middleware, rate limiting. Test the cookie survives a cross-site redirect.

**Day 3 — payments**
Create-order endpoint, Cashfree SDK on the client, webhook handler with signature verification, entitlement creation, reconciliation cron. **Test in sandbox end to end today.** This is the highest-risk day — do not let it slide to day five.

**Day 4 — marketing surface**
Landing page from `landingpage.md`, pricing page, countdown component, waitlist capture. Design tokens applied.

**Day 5 — checkout and account**
`/checkout/[plan]`, return page with polling, `/account`, receipt email, minimal `/admin/orders`.

**Day 6 — harden**
Full sandbox run-through on a real Android over mobile data. Mobile layout pass at 375px. Error and loading states. Accessibility pass — keyboard focus, contrast, reduced motion. Analytics events. **Switch to production Cashfree keys and put through one real ₹1 order, then refund it.**

**Day 7 — launch**
Legal pages final. Meta trademark disclaimer in the footer. Monitoring and alerts on. Kill switch tested. Soft launch to a small list first; watch the first ten orders complete before opening the tap.

**If you are behind on day 5:** cut `/account` and the admin screen. Ship landing + pricing + login + checkout + webhook. Everything else can be a manual process and an email for a week. Do not cut the webhook, the reconciliation cron, or the legal pages.

---

## 14. After launch

1. **Provisioning** — manual on day one: admin opens `/admin/orders`, creates the CRM tenant, writes `crm_tenant_id` back. Automate once volume justifies it.
2. **Recurring billing** — Cashfree Subscriptions (UPI Autopay / eNACH) for renewals. Start in October, well before the first 6-month terms expire in March.
3. **Entitlement API** — replace the manual handoff with a signed endpoint the CRM calls to check a user's plan.
4. **Invoices** — GST-compliant PDF with your GSTIN, the customer's GSTIN, HSN/SAC code, and tax split. `[VERIFY]` requirements with your accountant. Manual for week one is fine; it won't be fine in November.
5. **Merge or keep separate** — keep the launch app separate. It's your marketing site and billing surface, and it should not be coupled to the CRM's release cycle ever again.

---

## 15. Open questions

Carrying forward from `dorway.txt`, plus the new ones this document raises.

| # | Question | Blocks |
|---|---|---|
| **L1** | Is Cashfree already KYC-activated for live payments? | Everything. Answer today. |
| **L2** | GST inclusive or exclusive? | Every price on the site, every order amount. |
| **L3** | Early-bird seat cap — a number, or purely date-based? | Pricing copy, scarcity display |
| **L4** | Does early-bird stay open past launch? Suggest 48h grace. | Launch-day conversion |
| **L5** | Are the three tiers and prices in §3.1 confirmed? | Pricing page, `landingpage.md` |
| **L6** | Prepaid terms — 6 and 12 months, or also 3? | Checkout options |
| **L7** | Refund window — suggest "any time before launch + 7 days" | Refund policy page |
| **L8** | Registered business address and phone for `/contact`? | Cashfree activation |
| **L9** | Domain — is `dorway.app` registered and pointed? | Deploy, email, return URLs |
| Q11 | Is "Dorway" the product name? (`dorway.txt`) | Logo, domain, every headline |
| Q13 | Who pays Meta for messages? (`dorway.txt`) | Pricing copy, FAQ |
| Q14 | Per-seat or flat? This doc assumes **flat**. (`dorway.txt`) | Plan structure |

---

## 16. Consistency note

`landingpage.md` §4.10 currently carries placeholder pricing of ₹1,499 / ₹2,999 **per seat**. This document supersedes it with flat per-business pricing at ₹999 / ₹1,999 / ₹3,999 normal and ₹499 / ₹999 / ₹1,999 early-bird.

Update `landingpage.md` to match before either page is built. Two documents disagreeing about price is how a wrong number reaches production. 