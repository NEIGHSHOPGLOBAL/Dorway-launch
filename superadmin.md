# Dorway Super Admin — Specification

**Purpose:** One internal panel to track everything Dorway runs today, and to take the few actions the affiliate system needs.

**Companion docs:** `partner.md` (partner program backend, tables and rules). This doc reuses its tables and does not redefine them.

---

## 0. Scope

Only three systems are live today. The panel covers exactly those.

| System | Panel does | Panel does NOT do |
|---|---|---|
| **User onboarding** | Track signups, onboarding progress and drop-off. View a user's timeline. | Edit user workspaces, impersonate users, change their settings |
| **Package purchase** | Track checkouts, payments, failures, refunds, revenue. Reconcile with the payment gateway. | Change prices or plans, issue refunds (done in the gateway; the panel records them via webhook) |
| **Affiliate system** | Track partners, referrals, commissions, bonuses and payouts. **Act on them:** process payouts, reverse commissions, attribute manually, suspend partners, review fraud flags. | Change program rules from the UI (config is versioned in code, §9) |

**Explicitly out of scope** until those modules launch:

- Shared inbox, conversations and leads
- Assignment, pipeline, follow-up sequences, campaigns
- WhatsApp template management, quality rating and sending limits
- AI usage and limits
- Seat and user management inside customer workspaces

Don't build placeholders, empty menu items or "coming soon" tabs for these. Add them as new sections when the module ships.

**Rule of thumb:** the panel is **read-mostly**. The only write actions are the ones listed in §6.8 and §7. Anything else is a request to engineering, not a button.

---

## 1. Principles

1. **One definition per metric.** Every number on screen links to its definition in the glossary (§8). If two screens show "Revenue", they compute it the same way.
2. **Test accounts are excluded everywhere by default.** Internal and test accounts carry an `is_test` flag. Every view has a "Include test accounts" toggle, off by default.
3. **Time zone is IST (Asia/Kolkata)** for all date grouping and "today". Store UTC.
4. **Money is paise (`bigint`)** in the database and API. Format in the UI as ₹ with Indian grouping (₹1,23,456).
5. **Every write is audited:** who, what, when, before and after, and a mandatory reason field.
6. **PII is masked by default.** Full phone, email, PAN and bank details are revealed per record with a click, and every reveal is logged (§10).

---

## 2. Roles

| Role | Can see | Can do |
|---|---|---|
| **Super admin** | Everything, and reveal PII | Everything in §6.8 and §7, manage admin users |
| **Finance** | Purchases, affiliate money, payouts, and reveal bank details and PAN | Process payouts (mark processing, paid or rejected), export payout CSVs |
| **Viewer** | Dashboards and lists with PII masked | Nothing. Read-only, no reveals, no exports. |

Start with these three roles hard-coded. Don't build a custom permissions editor.

---

## 3. Navigation

```
┌───────────────┬──────────────────────────────────────────────────────┐
│ dorway admin  │  [Date range ▾ Last 30 days]  [Compare ▾]  [Search…] │
│               ├──────────────────────────────────────────────────────┤
│ Home          │                                                      │
│               │                                                      │
│ Onboarding    │                                                      │
│   Funnel      │                                                      │
│   Users       │                                                      │
│               │                                                      │
│ Purchases     │                                                      │
│   Overview    │                                                      │
│   Checkouts   │                                                      │
│   Payments    │                                                      │
│               │                                                      │
│ Affiliates    │                                                      │
│   Overview    │                                                      │
│   Partners    │                                                      │
│   Referrals   │                                                      │
│   Commissions │                                                      │
│   Payouts (3) │  ← badge = payouts awaiting action                   │
│   Flags   (1) │  ← badge = open fraud flags                          │
│               │                                                      │
│ Audit log     │                                                      │
│ Settings      │  ← admin users, program config (read-only)          │
└───────────────┴──────────────────────────────────────────────────────┘
```

**Global controls:**

- **Date range:** Today, Yesterday, Last 7 days, Last 30 days, This month, Last month, Custom.
- **Compare:** Previous period, or Same period last year.
- **Global search:** by phone, email, business name, partner code, order id, payment id or UTR. It returns grouped results (Users, Checkouts, Partners, Payouts).
- The URL holds all filters, so any view can be shared as a link.

---

## 4. Home

The at-a-glance page. It answers four questions: *Are people signing up? Are they finishing onboarding? Are they paying? Is the partner program healthy?*

### 4.1 KPI row

Each tile shows the value, the change vs the compare period, and a small sparkline.

| Tile | Definition (§8) |
|---|---|
| Signups | `signups` |
| Onboarding completion | `onboarding_completion_rate` |
| Paying customers (new) | `new_paying_customers` |
| Revenue (net) | `net_revenue` |
| Signup → paid conversion | `signup_to_paid_rate` |
| Revenue from referrals | `referred_net_revenue` and its % of total |

### 4.2 Panels

- **Daily trend chart:** signups, completed onboarding and new paying customers over the range. Three lines, one chart.
- **Onboarding funnel (compact):** step counts and drop-off %. Links to §5.1.
- **Revenue by plan:** bars for Starter, Growth and Scale, split monthly vs annual.
- **Needs attention.** Every row links to the filtered list:
  - Payouts waiting more than 3 working days
  - Open fraud flags
  - Payment webhook failures in the last 24 h
  - Reconciliation mismatches
  - Checkouts stuck in `started` for more than 24 h with a successful gateway payment. This last one is a sign that a webhook was lost.

---

## 5. Onboarding

### 5.1 Funnel

Onboarding steps are defined in one config so the funnel, the user list and the user timeline agree. **Confirm this list against the real product flow (§13, question 1):**

| # | Step key | Reached when |
|---|---|---|
| 1 | `signed_up` | Account created, phone verified by OTP |
| 2 | `workspace_created` | Business name and workspace saved |
| 3 | `whatsapp_connected` | WhatsApp Business number connected via Meta sign-up (if this is part of onboarding today) |
| 4 | `team_invited` | At least one teammate invited (if part of onboarding) |
| 5 | `onboarding_completed` | All required steps done |
| 6 | `purchased` | First completed checkout (links onboarding to purchases) |

**The funnel view:**

- **Horizontal funnel:** count at each step, conversion from the previous step, conversion from step 1.
- **Median time between steps.** For example, `signed_up → purchased: 2d 4h`.
- **Breakdowns** (one at a time): source (Direct, Partner referral, UTM source, UTM campaign), device (mobile or desktop), signup week (cohort).
- **Cohort table:** rows are signup weeks; columns are the % who reached each step by day 1, 7 and 30.

### 5.2 Users list

| Column | Notes |
|---|---|
| Business / name | Name masked for Viewer |
| Phone | Masked: `+91 98XXX XX207` |
| Signed up | IST date and time |
| Current step | Chip in the step's colour |
| Stuck for | Time since the last step completed. Highlighted if over 48 h and not purchased. |
| Source | Direct, Partner (code shown), UTM |
| Plan | Current paid plan, or "Not purchased" |
| Lifetime paid | ₹ |

**Filters:**

- Step reached / not reached
- Stuck longer than N hours
- Source
- Has purchased
- Signup date
- Test accounts toggle

**Export:** CSV, for Super admin only, and logged.

### 5.3 User detail

- **Header:** business, masked contacts (reveal button), signup date, source, referring partner (link), current plan, `is_test` flag.
- **Timeline** of every onboarding and purchase event, newest first. Examples:
  - OTP sent
  - OTP verified
  - Workspace created
  - Checkout started (plan, amount)
  - Payment failed (gateway reason)
  - Payment succeeded
  - Refund
- **Purchases:** that user's checkouts and payments.
- **Referral:** the partner, how they were attributed (link or code) and when, plus the commission status.
- **Notes:** internal free-text notes with author and time.

**Actions allowed here:**

| Action | Who | Effect |
|---|---|---|
| Add note | Super admin | Audit-logged |
| Mark / unmark as test account | Super admin | Excludes from all metrics; audit-logged with reason |

Nothing else. No editing the user's data and no impersonation.

---

## 6. Purchases

### 6.1 Overview

**KPI tiles:**
- Gross revenue
- Refunds
- Net revenue
- New paying customers
- Checkout conversion (`checkout_conversion_rate`)
- Average order value
- Payment failure rate

**Charts:**
- Net revenue per day
- Orders by plan and billing
- Payment failure reasons (top 5)

**Table:** revenue by plan × billing, with rows Starter, Growth and Scale and columns Monthly, Annual and Total.

### 6.2 Checkouts

Every checkout session, whether or not it was paid.

| Column | Notes |
|---|---|
| Checkout id | Monospace |
| Business | Masked |
| Plan / billing | e.g. `Growth · annual` |
| Amount | Base, GST and total shown on hover |
| Status | `started` · `abandoned` · `completed` · `failed` · `refunded` · `partially_refunded` |
| Furthest step | `plan_selected` · `payment_page` · `payment_failed` |
| Partner | Code, if attributed |
| Started / completed | IST |

**Filters:**
- Status
- Plan
- Billing
- Has partner
- Amount range
- Date

**Abandoned-checkout view:** a saved filter showing abandoned checkouts with value and time since abandonment. It is for tracking only. Don't build a "message this customer" button here (see §0).

### 6.3 Payments

Gateway-level records, one row per payment attempt.

| Column | Notes |
|---|---|
| Payment id (gateway) | Links out to the gateway dashboard |
| Checkout id | Links to the checkout |
| Method | UPI, card, netbanking |
| Amount | |
| Status | `captured` · `failed` · `refunded` |
| Failure reason | Gateway code and text |
| Webhook received | Yes/no, and when |

### 6.4 Reconciliation

A daily job compares gateway settlements and captured payments against `completed` checkouts. The view shows:

- **Matched** count and amount.
- **In gateway, missing in Dorway.** A payment was captured but the checkout isn't `completed`, usually because a webhook was lost.
- **In Dorway, missing in gateway.** A checkout is `completed` with no captured payment. This should be 0; treat any row as critical.
- **Amount mismatches.**

**Action:** Super admin can **re-sync a single payment** from the gateway. This re-fetches the payment and replays the webhook handler. It is idempotent and audit-logged. This is the only write action in Purchases.

### 6.5 Subscriptions (if renewals are live)

Only build this section if packages auto-renew today. If they don't, skip it (§13, question 3).

- Active subscriptions by plan.
- Renewals due in the next 7 and 30 days.
- Failed renewals.
- Cancellations and reasons.
- MRR, if billing is recurring.

---

## 7. Affiliates

Built on the `partner.md` tables:

- `partners`
- `referral_events`
- `referrals`
- `checkouts_ref`
- `commissions`
- `bonuses`
- `payouts`
- `ledger_entries`

### 7.1 Overview

**KPI tiles:**

| Tile | Definition |
|---|---|
| Active partners | `active_partners` (at least 1 link click or code use in the period) |
| New partners | Registered in the period |
| Referred signups | `referrals` created in the period |
| Referred paying customers | `referrals` that converted in the period |
| Referred net revenue | And its % of total net revenue |
| Commission earned | Commissions and bonuses created in the period, excluding reversed |
| **Liability** | `on_hold` + `approved` not yet paid. **This is money Dorway owes.** |
| Paid out | Payouts `paid` in the period |
| Effective payout rate | Commission earned ÷ referred net revenue. It should sit near 10% plus the bonus effect. A big drift means a bug or abuse. |

**Panels:**

- **Top partners table:**
  - Partner and code
  - Clicks, signups and paid customers
  - Conversion %
  - Referred revenue
  - Commission earned
  - Liability
- **Funnel:** clicks → signups → checkouts started → completed.
- **Bonus activity:**
  - Bonuses earned in the period.
  - Partners currently mid-sprint: count 7–9 of 10, with the window ending soon.
- **Liability ageing:** on-hold amounts, grouped by days until approval.

### 7.2 Partners list

| Column | Notes |
|---|---|
| Name | |
| Phone | Masked |
| Code | Monospace |
| Status | `active` · `suspended` · `closed` |
| Joined | |
| Clicks / signups / paid | Period-filtered |
| Referred revenue | |
| On hold / approved / paid | ₹ |
| Payout method | ✓ / missing; PAN ✓ / missing |
| Flags | Count of open fraud flags |

**Filters:**
- Status
- Has payout method
- Has an open flag
- Earned more than ₹X
- Joined date

### 7.3 Partner detail

- **Header:** name, masked contacts (reveal), code, status, joined, and consent (terms version and timestamp, WhatsApp opt-in).
- **Balances:** on hold, approved, in process, paid, reversed (lifetime).
- **Tabs:**
  - Activity: `referral_events`
  - Referrals: each referred account, with status and rejection reason
  - Commissions
  - Bonuses: with the 10 commission ids behind each
  - Payouts
  - Ledger: every balance change
  - Notes
- **Payout method:** masked, with reveal for Finance and Super admin. Shows the verification status.

**Actions (Super admin, reason required):**

| Action | Effect |
|---|---|
| Suspend / unsuspend | Suspended partners can log in and see the dashboard. New clicks and codes are not attributed. Existing approved balance stays payable unless you also reverse it. |
| Close | Permanent. The code stops working; the remaining approved balance is paid out. |
| Add note | Audit-logged |

### 7.4 Referrals

All attributed customer accounts.

| Column | Notes |
|---|---|
| Customer | Masked; links to the user detail |
| Partner | |
| Via | `link` · `code` |
| Attributed at | |
| Status | `signed_up` · `converted` · `rejected` |
| Rejection reason | `self_referral` · `existing_customer` · `fraud` · `manual` |

**Actions (Super admin, reason required):**

| Action | Effect |
|---|---|
| **Reject referral** | Marks the referral `rejected`. Any `on_hold` commission becomes `reversed` and any bonus using it is re-evaluated, following the `partner.md` §7.4 rule. |
| **Manual attribution** | Assign an unattributed customer to a partner, for example when a partner proves a customer forgot the code. If the customer already paid, this creates the commission as `on_hold` from the original `paid_at`. It cannot reassign a customer already attributed to another partner; that needs an engineering request. |

### 7.5 Commissions and bonuses

One list with a type filter (Commission / Bonus).

| Column | Notes |
|---|---|
| Id | |
| Partner | |
| Customer / checkout | Masked and linked, for commissions |
| Amount | |
| Status | `on_hold` · `approved` · `paid` · `reversed` |
| Hold until | |
| Payout | Linked when paid |

**Action (Super admin, reason required):**
- **Reverse:** only for `on_hold` or `approved` items. A `paid` item can't be reversed in the panel; that needs a finance process (§13, question 6).

### 7.6 Payouts queue

This is the main working screen for Finance.

**Default view:** status `requested`, oldest first.

| Column | Notes |
|---|---|
| Requested | With age; red if over the 7-working-day SLA |
| Partner | |
| Amount (gross) | |
| TDS | Computed at request time; confirm the rule (§13, question 5) |
| Net | |
| Method | UPI / Bank, masked; reveal for Finance |
| Method verified | ✓ / ✗ |
| Checks | Auto-checks below, all must pass |
| Status | `requested` · `processing` · `paid` · `rejected` |

**Auto-checks shown on every payout** (the server computes them; the panel doesn't):

- Balance still covers the amount.
- PAN present.
- Payout method present and verified.
- Partner not suspended.
- No open fraud flag on the partner.
- No commission in this payout has been reversed since the request.

**Actions (Finance or Super admin):**

| Action | From → to | Requires |
|---|---|---|
| Start processing | `requested` → `processing` | All checks pass (or Super admin override with a reason) |
| Mark paid | `processing` → `paid` | UTR / reference, paid date. Triggers the partner notification. |
| Reject | `requested` or `processing` → `rejected` | Reason shown to the partner. The amount returns to their available balance. |
| Export batch | — | A CSV of the selected `processing` payouts in the bank bulk-upload format. Logged. |

### 7.7 Fraud flags

Flags are **created automatically** by jobs. The panel only reviews them.

| Rule | Trigger (suggested defaults, configurable) |
|---|---|
| Self-referral match | Customer phone, email, PAN, GSTIN or payment instrument matches the partner |
| Signup burst | More than 5 referred signups from one IP or device in 24 h |
| Fast conversion cluster | More than 3 referred checkouts completed under 10 min after signup, in 24 h |
| Refund cluster | More than 30% of a partner's referred checkouts refunded in 30 days |
| Bonus edge | Partner hits exactly 10 in 7 days with more than 50% of those refunded later |
| Shared payout method | Same UPI ID or bank account on more than one partner |

**Flag view:**
- The partner.
- The rule that fired.
- The evidence: linked records.
- Status: `open` · `dismissed` · `actioned`.

**Actions (Super admin):**
- Dismiss, with a reason.
- Mark actioned, with a reason, usually after reversing referrals or suspending the partner from the partner page.

An open flag blocks that partner's payouts from being processed without an override.

---

## 8. Metric glossary

Each metric is implemented once, in the backend (a SQL view or a metrics module). The UI never computes metrics itself. All metrics exclude `is_test` unless the toggle is on.

| Key | Definition |
|---|---|
| `signups` | Accounts reaching `signed_up` in the period |
| `onboarding_completion_rate` | Of accounts that signed up in the period, the % that reached `onboarding_completed` (cohort-based, not same-period) |
| `new_paying_customers` | Accounts whose **first** completed checkout falls in the period |
| `gross_revenue` | Sum of captured payment amounts in the period, **excluding GST** |
| `refunds` | Sum of refunds processed in the period, excluding GST |
| `net_revenue` | `gross_revenue − refunds` |
| `aov` | `gross_revenue ÷ completed checkouts` |
| `checkout_conversion_rate` | Completed ÷ checkouts started, in the period |
| `payment_failure_rate` | Failed payment attempts ÷ all attempts |
| `signup_to_paid_rate` | Of accounts signed up in the period, the % with a completed checkout within 30 days (cohort) |
| `referred_net_revenue` | `net_revenue` from accounts with a `converted` referral |
| `active_partners` | Partners with at least 1 `link_opened` or `code_applied` event in the period |
| `commission_earned` | Commissions and bonuses created in the period, excluding `reversed` |
| `liability` | Sum of `on_hold` and `approved` commissions and bonuses not in a `paid` payout, at the end of the period |
| `effective_payout_rate` | `commission_earned ÷ referred_net_revenue` |

If a definition changes, version it. Add a `definition_changed_at` note on the metric so historical comparisons are visibly marked.

---

## 9. Settings

- **Admin users:** invite by email; assign role; deactivate. Require 2FA before first use.
- **Program config (read-only):** shows the live `PROGRAM` values from `partner.md`, the version, and when each changed:
  - Commission rate
  - Bonus
  - Minimum payout
  - Hold days
  - Attribution window

  Changes happen in code or config deploys, not from this screen. This avoids a mis-click changing everyone's commission.
- **Onboarding step config (read-only):** the step list from §5.1.
- **Fraud rule thresholds (read-only):** as §7.7.

---

## 10. Security and audit

- **Access:**
  - Admin panel on a separate subdomain (`admin.dorway.in`).
  - SSO or email + password with mandatory TOTP 2FA.
  - Optional IP allowlist.
- **Sessions:** 12 h expiry; re-authenticate before payout actions and PII reveals if the last auth was more than 30 min ago.
- **Audit log** (`admin_audit_log`), append-only, one row per write, reveal or export:
  ```
  id, admin_id, action, entity_type, entity_id, reason, before jsonb, after jsonb, ip, user_agent, created_at
  ```
  - Searchable in the Audit log screen by admin, action, entity and date.
  - Nobody can edit or delete audit rows, including Super admins.
- **PII reveal:** every reveal writes `action = pii_reveal` with the field name. Viewer can't reveal.
- **Exports:** watermark the CSV header with the admin's email and timestamp; log the export filters.
- **Rate-limit** admin API endpoints and alert on unusual export volume.

---

## 11. Admin API

Base path `/api/admin`, with a session cookie scoped to the admin subdomain. The error format is the same as `partner.md` §4.1.

**Read:**

```
GET  /metrics/home?from&to&compare
GET  /metrics/onboarding/funnel?from&to&breakdown
GET  /metrics/onboarding/cohorts?from&to
GET  /metrics/purchases?from&to
GET  /metrics/affiliates?from&to

GET  /users?step&stuckHours&source&purchased&from&to&includeTest&cursor
GET  /users/:id                     (includes timeline, purchases, referral, notes)
GET  /checkouts?status&plan&billing&hasPartner&from&to&cursor
GET  /payments?status&method&from&to&cursor
GET  /reconciliation?date

GET  /partners?status&hasMethod&flagged&cursor
GET  /partners/:id                  (balances, tabs via ?tab=)
GET  /referrals?status&partnerId&cursor
GET  /commissions?type&status&partnerId&cursor
GET  /payouts?status&partnerId&olderThanDays&cursor
GET  /flags?status&rule&cursor

GET  /audit-log?adminId&action&entityType&from&to&cursor
GET  /search?q=
```

**Write.** Every body includes `reason` (required). Every write returns the updated entity and writes to the audit log.

```
POST /users/:id/notes                       { text }
POST /users/:id/test-flag                   { isTest, reason }
POST /payments/:id/resync                   { reason }

POST /partners/:id/status                   { status: "active"|"suspended"|"closed", reason }
POST /partners/:id/notes                    { text }
POST /referrals/:id/reject                  { reason }
POST /referrals/manual                      { accountId, partnerId, reason }
POST /commissions/:id/reverse               { reason }
POST /bonuses/:id/reverse                   { reason }

POST /payouts/:id/processing                { reason?, override?: true }
POST /payouts/:id/paid                      { reference, paidAt, reason? }
POST /payouts/:id/reject                    { reason }
POST /payouts/export                        { ids: [] }   → CSV

POST /flags/:id/dismiss                     { reason }
POST /flags/:id/actioned                    { reason }

POST /pii/reveal                            { entityType, entityId, field }  → { value }
```

All money-moving writes (reverse, manual attribution, payout transitions):

- Run in a transaction with a row lock on the partner.
- Write `ledger_entries`.
- Accept an `Idempotency-Key` header.

---

## 12. Data needed beyond `partner.md`

The panel reads from the main app's existing tables. It needs these to exist, or equivalent views of them:

```sql
users / accounts (
  id, business_name, phone_e164, email, created_at,
  is_test boolean not null default false,
  source text,                 -- direct | partner | utm
  utm_source text, utm_medium text, utm_campaign text,
  device text                  -- mobile | desktop, at signup
)

onboarding_events (            -- append-only; powers funnel, timeline, "stuck for"
  id, account_id, step text, created_at, meta jsonb
)
-- unique (account_id, step) for the first occurrence; keep repeats in meta if needed

checkouts (                    -- main-app checkout sessions (checkouts_ref mirrors the referred subset)
  id, account_id, plan, billing, base_amount, gst_amount, total_amount,
  status, furthest_step, started_at, completed_at
)

payments (
  id, gateway_payment_id, checkout_id, method, amount, status,
  failure_code, failure_reason, captured_at, webhook_received_at
)

refunds (
  id, payment_id, amount, reason, gateway_refund_id, processed_at
)

admin_users (id, email, role, totp_secret_enc, active, created_at, last_login_at)
admin_audit_log (see §10)
admin_notes (id, entity_type, entity_id, admin_id, text, created_at)
fraud_flags (id, partner_id, rule, evidence jsonb, status, resolved_by, resolved_reason, created_at, resolved_at)
reconciliation_runs (id, run_date, matched_count, matched_amount, issues jsonb, created_at)
```

**Scheduled jobs** (in addition to `partner.md` §7.6):

| Job | Frequency | Does |
|---|---|---|
| `reconcile_payments` | Daily, 06:00 IST | §6.4. Alerts on any "missing in gateway" row. |
| `fraud_rules` | Hourly | Evaluates §7.7 rules and creates flags; never duplicates an open flag for the same rule and partner |
| `metrics_rollup` | Hourly | Optional daily aggregates so the Home page loads fast |

**Alerts** (Slack or email to Super admins):

- Webhook failures (more than 3 in 15 min)
- Reconciliation critical rows
- Payout older than the SLA
- A new fraud flag
- OTP send spike
- Export volume spike

---

## 13. Open questions

1. **Onboarding steps:** is the §5.1 list the real flow today? In particular, are "WhatsApp connected" and "team invited" part of onboarding, or later?
2. **Payment gateway:** which one (Razorpay, Cashfree, other)? It decides §6.3 fields, links and the reconciliation source.
3. **Renewals:** do packages auto-renew today? If not, skip §6.5.
4. **Revenue basis:** confirm that revenue excludes GST, and that commission uses the same base (see `partner.md` §12, question 3).
5. **TDS on payouts:** rate, threshold and whether it is deducted per payout or annually. Confirm with your CA before Finance processes the first payout.
6. **Paid commission, later refunded:** absorb it, or claw it back from future earnings? The panel currently blocks reversing `paid` items.
7. **Who is Finance:** is it a separate person from Super admin today? If not, still create the role so it's ready.

---

## 14. Build order

| Phase | Ships | Why first |
|---|---|---|
| **1** | Auth + roles + audit log; Affiliates → Payouts queue; Partners list and detail; Commissions list with reverse | Partners can request money from day one. Someone must be able to pay them safely. |
| **2** | Purchases → Checkouts, Payments, Reconciliation; Home KPI row | Revenue truth and catching lost webhooks |
| **3** | Onboarding funnel, Users list and detail with timeline | Growth insight |
| **4** | Fraud flags, Affiliates overview, cohorts, alerts, exports | Hardening once there's volume |

## 15. Acceptance checklist

- [ ] Test accounts excluded from every metric by default; toggle works on every view
- [ ] Same metric shows the same value on Home and on its section page for the same range
- [ ] All dates grouped in IST; "Today" rolls over at IST midnight
- [ ] Viewer can't reveal PII, export or see any write button
- [ ] Every write requires a reason and appears in the audit log with before and after
- [ ] Payout can't move to `processing` with a failing check unless a Super admin overrides with a reason
- [ ] Marking a payout paid requires a UTR and sends the partner notification
- [ ] Rejecting a payout returns the amount to the partner's available balance
- [ ] Reversing a commission inside a bonus set re-evaluates that bonus
- [ ] Payment re-sync is idempotent (running it twice changes nothing the second time)
- [ ] Reconciliation catches a captured payment whose webhook was dropped (test on staging)
- [ ] No menu items, routes or placeholders for out-of-scope modules (§0)
- [ ] Responsive enough for a laptop (1280px) and a tablet; phone is view-only and doesn't need to be polished