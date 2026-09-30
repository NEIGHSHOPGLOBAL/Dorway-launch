# Dorway launch site

Built per `architecture.md`: a standalone pre-launch marketing + auth + checkout
app, separate from the CRM itself. Two services:

- **`web/`** — Vite + React + TypeScript. The landing page, pricing, login,
  checkout, account, and legal pages. Talks to the API through `/api`
  (proxied to the server in dev, see `web/vite.config.ts`).
- **`server/`** — Express + TypeScript + Prisma + Postgres. Email-OTP auth,
  Cashfree checkout + webhook, plans, launch countdown, waitlist, admin.

The old static prototype (`index.html`, `css/`, `js/`, `assets/` at the repo
root) is still here for reference but is no longer the active build.

## Run it

**1. Postgres** (already running locally via `brew services start postgresql@16`,
database `dorway` already created and migrated):

```bash
psql -h localhost -d dorway -c "\dt"   # sanity check
```

**2. API server**

```bash
cd server
cp .env.example .env   # fill in JWT_SECRET at minimum
npm install
npm run seed            # plans + launch_config
npm run dev              # http://localhost:8787
```

**3. Web app**

```bash
cd web
npm install
npm run dev               # http://localhost:5173
```

Open http://localhost:5173.

## What's stubbed pending real credentials

- **`CASHFREE_APP_ID` / `CASHFREE_SECRET_KEY`** — not set. `/api/checkout`
  returns `503 payments_not_configured` and the Checkout page shows a plain
  "payments aren't live yet, join the waitlist" state instead of crashing.
  Drop the sandbox keys into `server/.env` and it starts working immediately
  — no code changes needed.
- **`RESEND_API_KEY`** — not set. OTP codes and receipts print to the server
  console instead of emailing (`[dev email] OTP for x@y.com: 123456`). Same
  deal: add the key and `lib/email.ts` starts sending for real.
- **Rate limiting** is in-memory (single process). Fine for one instance;
  swap `lib/rateLimit.ts` for Upstash Redis before running more than one.
- **`/contact`** has placeholder address/phone — Cashfree's activation
  review requires the real ones (architecture.md §9.1, §L8).
- **Legal pages** (`/legal/terms`, `/privacy`, `/refund`) are drafts marked
  as such — get them counsel-reviewed before taking real payment.

## What's real right now

Full OTP login (request → console-logged code → verify → httpOnly JWT
session cookie), live pricing/early-bird logic read from Postgres, the
server-authoritative countdown, checkout order creation with correct
paise/GST math and idempotency, the signed-webhook handler with replay
protection and transactional fulfilment — all wired and smoke-tested
end-to-end. It just needs Cashfree sandbox keys to actually take a payment.
