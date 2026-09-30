# Dorway — WhatsApp OTP Integration
### Using the existing AgentX WhatsApp service as the login OTP channel

**Written:** 16 September 2026
**Companion docs:** `architecture_launch.md` (§5 Authentication), `otp.md` (template submission)
**Audience:** the developer wiring the launch app to the AgentX server

---

## 0. Answer these two questions before writing any code

### 0.1 Is AgentX on the official WhatsApp Cloud API, or an unofficial client?

This decides whether the whole plan is viable.

**If AgentX runs on the official Cloud API** (a verified WABA, a phone number ID, a System User token, `graph.facebook.com` endpoints) — proceed. The rest of this document applies.

**If AgentX runs on an unofficial library** — Baileys, `whatsapp-web.js`, `venom-bot`, a paired session on a personal number, anything that logs in by scanning a QR code — **stop. Do not send OTPs through it.**

Three reasons, in order of severity:

1. **The number will be banned.** High-volume identical automated sends to strangers is the exact signature Meta's integrity systems look for. OTP traffic is the single most ban-prone pattern on an unofficial client.
2. **It is a Terms of Service violation.** You are building a business whose entire product depends on WhatsApp access (`dorway.txt` §2.1). Getting caught running an unofficial client puts your Meta Business account at risk, not just one phone number — and that account is the thing your paid CRM sits on.
3. **You get no delivery guarantees.** No delivery receipts, no failure reasons, no retry semantics. For a login channel, "probably delivered" means "user locked out and you can't tell why."

If AgentX is unofficial: use it for whatever it currently does, and **ship email OTP for login** (already specced in `architecture_launch.md` §5). Add WhatsApp OTP in October on a proper Cloud API WABA.

### 0.2 Can your WABA actually create an authentication template?

Meta gates authentication templates behind two requirements: <cite index="28-1">your Meta Business Portfolio must be verified, and your WABA's messaging limit must be Tier 1 (2,000) or above</cite>.

A new WABA starts at **250 unique recipients per 24 hours**, which is below the gate. Tiers step up based on sending volume and quality rating over time.

**Check your messaging limit in WhatsApp Manager today.** If it's 250, you cannot create this template, and no amount of engineering will change that this week. `[VERIFY]` — confirm the current threshold in your own account, since Meta adjusts these.

> **Given that you launch in 7 days:** email OTP ships, WhatsApp OTP probably does not. Build the integration behind the interface in §2 so it's a config flip when the template clears, and do not let it block launch.

---

## 1. The rule that matters most

> **The OTP never touches the AI agent.**

AgentX is a conversational AI agent. An OTP send is a deterministic, templated, audited transaction. These must not share a code path.

Concretely:
- No LLM call anywhere in the OTP flow.
- The agent does not generate, read, interpret, format, or log the code.
- The OTP sender is a **separate module on the same server**, sharing only the WhatsApp credentials and the outbound HTTP client.

Why this matters: an LLM in the path means a model can be prompted into leaking codes, can hallucinate a code, can rewrite the message, or can retry non-deterministically. It also means your login availability is coupled to your model provider's uptime. None of that is acceptable for an auth channel.

Share the transport. Never share the brain.

---

## 2. Architecture

```
┌────────────────────────────────────────────────────────────┐
│  LAUNCH APP  (Next.js)                                     │
│                                                            │
│   POST /api/auth/request-otp                               │
│     ├── rate limit                                         │
│     ├── generate code (crypto.randomInt)                   │
│     ├── bcrypt hash → login_otps                           │
│     └── dispatch ────────────┐                             │
│                              │                             │
│   channel strategy:          │                             │
│     whatsapp → try first     │                             │
│     email    → always, if WA fails or is disabled           │
└──────────────────────────────┼─────────────────────────────┘
                               │  HTTPS + HMAC signed
                               │  POST /internal/otp/send
                               ▼
┌────────────────────────────────────────────────────────────┐
│  AGENTX SERVER  (existing, Node/Express)                   │
│                                                            │
│   ┌──────────────────────┐   ┌──────────────────────────┐  │
│   │  OTP SENDER MODULE   │   │  AI AGENT (existing)     │  │
│   │  · no LLM            │   │  · conversations         │  │
│   │  · template send only│   │  · never sees OTP        │  │
│   │  · deterministic     │   │                          │  │
│   └──────────┬───────────┘   └──────────────────────────┘  │
│              │                                             │
│              └──── shared WhatsApp credentials ───────┐    │
└───────────────────────────────────────────────────────┼────┘
                                                        │
                                                        ▼
                                          graph.facebook.com
                                          (WhatsApp Cloud API)
                                                        │
                            delivery status webhook ◄───┘
                                     │
                                     ▼
                            POST /api/webhooks/whatsapp
                            (launch app — updates otp_deliveries)
```

**Why AgentX sends rather than the launch app calling Meta directly:** the credentials already live there, the number is already registered there, and you avoid a second system holding a System User token. One place owns WhatsApp. `[ASSUMED]` — if AgentX is a thin wrapper and you'd rather the launch app call Meta directly, that's also fine; keep the §2.1 interface either way so the choice stays reversible.

### 2.1 The interface contract

Freeze this first. Both sides code against it, and it's what lets you swap the implementation later.

```ts
// Launch app → AgentX
POST https://agentx.internal/internal/otp/send

Headers:
  content-type:   application/json
  x-dorway-ts:    1758038400000          // epoch ms
  x-dorway-sig:   <base64 HMAC-SHA256>   // see §3
  x-idempotency-key: <uuid>

Body:
{
  "requestId":   "9f3c...",     // uuid, for correlation and logs
  "to":          "+919876543210",
  "code":        "482915",
  "expiresInMinutes": 5,
  "templateName": "dorway_login_otp",
  "languageCode": "en"
}

// 202 — accepted, handed to Meta
{ "ok": true, "requestId": "9f3c...", "waMessageId": "wamid.HBgM..." }

// 4xx — permanent, do not retry
{ "ok": false, "error": "INVALID_NUMBER",  "retryable": false }
{ "ok": false, "error": "NOT_ON_WHATSAPP", "retryable": false }
{ "ok": false, "error": "TEMPLATE_PAUSED", "retryable": false }

// 5xx / 429 — transient, retry once then fall back to email
{ "ok": false, "error": "UPSTREAM_TIMEOUT", "retryable": true }
{ "ok": false, "error": "RATE_LIMITED",     "retryable": true, "retryAfterMs": 2000 }
```

**The code crosses this boundary in plaintext over TLS.** That's unavoidable — Meta needs the literal code. What matters is that it exists nowhere else: not in logs, not in an error message, not in an APM trace, not in the AgentX conversation store.

---

## 3. Securing the internal call

The AgentX server is now an endpoint that sends WhatsApp messages on demand. Left open, it is a free spam cannon pointed at your own WABA's quality rating.

```ts
// Shared secret, 32+ random bytes, different per environment.
// Signature covers timestamp + raw body, same construction as
// the Cashfree webhook in architecture_launch.md §6.4 — one
// pattern, learned once.

function sign(ts: string, rawBody: string, secret: string): string {
  return crypto.createHmac('sha256', secret)
    .update(ts + rawBody)
    .digest('base64');
}

// AgentX side — verify before doing anything
app.post('/internal/otp/send',
  express.raw({ type: 'application/json' }),   // raw body required
  (req, res) => {
    const ts  = req.header('x-dorway-ts') ?? '';
    const sig = req.header('x-dorway-sig') ?? '';
    const raw = req.body.toString('utf8');

    if (Math.abs(Date.now() - Number(ts)) > 60_000) {
      return res.status(401).json({ ok: false, error: 'STALE_REQUEST' });
    }

    const expected = sign(ts, raw, process.env.DORWAY_OTP_SHARED_SECRET!);
    const a = Buffer.from(expected), b = Buffer.from(sig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ ok: false, error: 'BAD_SIGNATURE' });
    }

    const payload = JSON.parse(raw);
    // ... proceed
  }
);
```

Layer on top of the signature:

- **Network** — if both services are on the same VPC or host, bind the OTP endpoint to a private interface and don't expose it publicly at all. Signature as defence in depth, not the only door.
- **IP allowlist** — restrict to your Vercel egress IPs if you have static ones `[VERIFY — Vercel serverless egress is not static on all plans; you may need a fixed-IP proxy or skip this layer]`.
- **Idempotency** — cache `x-idempotency-key` for 10 minutes and return the original response on a repeat. Stops a retry storm sending five messages.
- **Independent rate limit** — AgentX enforces its own ceiling regardless of what the caller claims. Suggest 10/minute per destination number, 300/minute global.

---

## 4. The send

Deterministic. No branching on model output, no retries that could double-send.

```ts
// AgentX — OTP sender module. Zero LLM involvement.

const GRAPH = 'https://graph.facebook.com/v23.0';   // [VERIFY current version]

async function sendOtp(p: OtpRequest): Promise<OtpResult> {
  const to = toE164(p.to);                 // §5
  if (!to) return { ok: false, error: 'INVALID_NUMBER', retryable: false };

  const res = await fetch(
    `${GRAPH}/${process.env.WA_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
        'content-type': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to.replace('+', ''),
        type: 'template',
        template: {
          name: p.templateName,            // dorway_login_otp
          language: { code: p.languageCode },
          components: [
            {
              type: 'body',
              parameters: [{ type: 'text', text: p.code }],
            },
            {
              // The OTP button needs the code too. Omit this and
              // the send fails with a component mismatch error.
              type: 'button',
              sub_type: 'url',             // created as 'otp', sent as 'url'
              index: '0',
              parameters: [{ type: 'text', text: p.code }],
            },
          ],
        },
      }),
    }
  );

  const json = await res.json();
  if (!res.ok) return mapGraphError(res.status, json);

  return { ok: true, waMessageId: json.messages?.[0]?.id };
}
```

**Two details that break first-time integrations:**

1. **The button parameter is required.** The code goes in *both* the body component and the button component. Send only the body and the API rejects it.
2. **The button type changes after creation.** <cite index="25-1">In the template creation request the button type is designated as `otp`, but upon creation the button type is set to `url`</cite>. So you create with `otp` and send with `sub_type: 'url'`. This trips up almost everyone once.

### 4.1 Error mapping

```ts
function mapGraphError(status: number, json: any): OtpResult {
  const code = json?.error?.code;
  const sub  = json?.error?.error_subcode;

  // [VERIFY each code against Meta's current error reference —
  //  these shift between Graph versions]
  switch (code) {
    case 131026: return { ok: false, error: 'NOT_ON_WHATSAPP',  retryable: false };
    case 131047: return { ok: false, error: 'REENGAGEMENT',     retryable: false };
    case 132000:
    case 132001:
    case 132012: return { ok: false, error: 'TEMPLATE_PROBLEM', retryable: false };
    case 131048: return { ok: false, error: 'SPAM_RATE_LIMIT',  retryable: false };
    case 130429: return { ok: false, error: 'RATE_LIMITED',     retryable: true, retryAfterMs: 2000 };
    case 133016: return { ok: false, error: 'ACCOUNT_LOCKED',   retryable: false };
    case 190:    return { ok: false, error: 'TOKEN_EXPIRED',    retryable: false };
    default:
      return status >= 500
        ? { ok: false, error: 'UPSTREAM_ERROR', retryable: true }
        : { ok: false, error: 'UNKNOWN',        retryable: false };
  }
}
```

`TOKEN_EXPIRED` and `ACCOUNT_LOCKED` should page someone immediately. Both mean every login through WhatsApp is now failing.

---

## 5. Phone numbers

Normalise to E.164 at the edge and store only that form. Mixed formats in the database will cost you an afternoon.

```ts
// Use libphonenumber-js. Do not hand-roll this.
import { parsePhoneNumberFromString } from 'libphonenumber-js';

function toE164(input: string, defaultCountry = 'IN'): string | null {
  const n = parsePhoneNumberFromString(input, defaultCountry);
  return n?.isValid() ? n.number : null;    // '+919876543210'
}
```

- Default country `IN`, but show a country selector — you will get NRI customers.
- Meta's API wants the number **without** the leading `+`. Strip it at the boundary only.
- Reject landlines and VOIP ranges; `libphonenumber` can tell you the type.
- `users.phone` gets a unique constraint. One account per number, or account recovery becomes ambiguous.

**A number being valid does not mean it's on WhatsApp.** There is no reliable pre-check — you find out from the send result or the delivery webhook. This is the main reason email must stay in the loop.

---

## 6. Channel strategy

**Never make WhatsApp the only way in.** A user whose number isn't on WhatsApp, or who is reading on WhatsApp Web, or who hits a template pause, is locked out of an account they paid for.

```ts
async function dispatchOtp(user: User, code: string) {
  const useWhatsApp =
    flags.whatsappOtpEnabled &&      // config, flippable without deploy
    Boolean(user.phone) &&
    !circuitBreaker.isOpen('whatsapp-otp');

  if (useWhatsApp) {
    const r = await agentx.sendOtp({ to: user.phone!, code, expiresInMinutes: 5 });
    if (r.ok) {
      await recordDelivery(user.id, 'whatsapp', r.waMessageId);
      // Email also goes out if WhatsApp isn't confirmed delivered
      // within 20s — see below.
      scheduleEmailFallback(user.id, code, 20_000);
      return { channel: 'whatsapp' };
    }
    if (r.retryable) circuitBreaker.recordFailure('whatsapp-otp');
  }

  await sendEmailOtp(user.email, code);
  return { channel: 'email' };
}
```

**The 20-second fallback is the important part.** A WhatsApp send returning `202` only means Meta accepted it — not that it arrived. If no `delivered` status webhook lands within 20 seconds, send the email anyway. Same code, both channels, one `login_otps` row. A user getting the code twice is a minor annoyance; a user getting it zero times is a lost customer.

**Circuit breaker:** five consecutive retryable failures opens it for 60 seconds, during which everything goes to email. Half-open probe on the next request. This stops a Meta outage from turning into a full login outage.

**In the UI:** show which channel was used, and always offer the other. "Code sent to your WhatsApp on ****3210. **Send to email instead.**"

---

## 7. Delivery status

Register a webhook for message status callbacks so you can tell delivered from accepted.

```ts
// POST /api/webhooks/whatsapp
// GET on the same path handles Meta's hub.challenge verification.

// Verify X-Hub-Signature-256: sha256=<hex HMAC of raw body with app secret>
const expected = 'sha256=' + crypto
  .createHmac('sha256', process.env.WA_APP_SECRET!)
  .update(rawBody)
  .digest('hex');
// timingSafeEqual against the header, reject on mismatch.
```

Statuses arrive as `sent` → `delivered` → `read`, or `failed`. Store them:

```sql
CREATE TABLE otp_deliveries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  otp_id        UUID NOT NULL REFERENCES login_otps(id),
  channel       TEXT NOT NULL,          -- 'whatsapp' | 'email'
  wa_message_id TEXT UNIQUE,
  status        TEXT NOT NULL,          -- accepted|sent|delivered|read|failed
  error_code    INT,
  error_title   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Watch two things on a dashboard from day one: **delivery rate** (delivered ÷ accepted) and **time to delivered, p95**. If either degrades, cut over to email before users start complaining.

> **Linked device security.** Meta now delivers authentication messages only to a user's **primary** WhatsApp device; <cite index="27-1">messages sent to linked devices are masked with a prompt telling the user to view the message on their primary device</cite>. Someone signing up on a laptop with WhatsApp Web open will not see the code there — they have to pick up their phone. Say so in the UI, or you'll get support tickets about codes that "never arrived."

---

## 8. Abuse and cost

Every OTP send is a billed authentication conversation on your WABA. An open endpoint is someone else's fun and your invoice.

| Control | Setting |
|---|---|
| Per-number | 3 sends / 15 min, 10 / day |
| Per-IP | 10 / hour |
| Per-email | 3 / 15 min (from `architecture_launch.md` §5) |
| Global circuit | Alert at 2× the trailing 7-day hourly mean; auto-disable at 5× |
| Verify attempts | 5 per code, then burn it |
| Code | 6 digits, `crypto.randomInt`, never `Math.random` |
| Expiry | **5 minutes** |
| Reuse | Single-use. Consume on success. |

**Enumeration.** `request-otp` returns `200` whether or not the account exists, always. Identical response body, and add a small random delay so timing doesn't leak either.

**Quality rating is the real cost.** Users who receive unexpected OTPs block or report the number. That drops your WABA quality rating, which throttles your messaging tier — and per `dorway.txt` §2.1 that same rating governs the CRM product you're selling. Abuse on the login endpoint degrades the product your customers paid for. Treat the rate limits as production-critical, not as hardening you'll add later.

**Consider a separate number for transactional sends.** If your WABA supports more than one phone number, isolating OTP traffic from the CRM demo number means an OTP-driven quality drop doesn't touch the number you demo on. `[CONFIRM]` — depends on your WABA setup and adds cost.

---

## 9. What never gets logged

```ts
// Redact at the logger level, not at each call site.
const REDACT = ['code', 'otp', 'verificationCode', 'x-dorway-sig', 'authorization'];
```

- **Never log the plaintext code.** Not at debug level, not in development, not in an error object that gets serialised to Sentry.
- **Never return the code in an API response.** Not even in a dev-only branch — dev-only branches ship.
- **Never store it plaintext.** `login_otps.code_hash` is bcrypt. The row is worthless to a database reader.
- **Never put it in an AgentX conversation record.** The OTP module writes to its own log stream, not the agent's message store.
- **Scrub analytics.** Phone numbers are PII; send a hashed ID to Plausible or PostHog, not the number.

For local development, set `OTP_DEV_MODE=true` to write codes to a single gitignored file instead of sending. Guard it with `NODE_ENV !== 'production'` **and** a runtime assertion that throws on boot if both are set in production.

---

## 10. Environment

```bash
# ── Launch app ──────────────────────────────────────────
AGENTX_OTP_URL=https://agentx.internal/internal/otp/send
DORWAY_OTP_SHARED_SECRET=              # 32+ random bytes
WHATSAPP_OTP_ENABLED=false             # ship false, flip when approved
OTP_TEMPLATE_NAME=dorway_login_otp
OTP_TEMPLATE_LANG=en
OTP_EXPIRY_MINUTES=5
WA_APP_SECRET=                         # webhook signature verification
WA_WEBHOOK_VERIFY_TOKEN=

# ── AgentX server ───────────────────────────────────────
DORWAY_OTP_SHARED_SECRET=              # same value
WA_PHONE_NUMBER_ID=
WA_ACCESS_TOKEN=                       # System User token
WA_GRAPH_VERSION=v23.0
```

`WHATSAPP_OTP_ENABLED` defaults to `false`. The integration ships dark and turns on with a config change once the template is approved and the delivery rate looks healthy in staging. No deploy required, and no deploy required to turn it off at 2am either.

---

## 11. Failure modes

| Scenario | Handling |
|---|---|
| Number not on WhatsApp | `NOT_ON_WHATSAPP`, immediate email fallback, remember the preference on the user |
| Template gets paused by Meta | `TEMPLATE_PROBLEM` → circuit opens → all email. Page someone. |
| Access token expired | `TOKEN_EXPIRED`. Page immediately — every WhatsApp login is down. |
| AgentX server down | 8s timeout → circuit opens → email. Login keeps working. |
| Accepted but never delivered | 20s scheduler fires email fallback |
| User on WhatsApp Web only | Linked-device masking. UI tells them to check their phone; email fallback covers it. |
| Duplicate submit, two codes | Newest unconsumed code wins; older ones expire naturally |
| Meta rate limit hit | Back off per `retryAfterMs`, one retry, then email |
| WABA quality drops to Low | Alert. Consider pausing WhatsApp OTP entirely until it recovers. |
| Someone floods the endpoint | Per-number and per-IP limits, then the global circuit auto-disables |

---

## 12. Testing

1. **Unit** — signature generation and verification both directions; `toE164` against a fixture set of Indian mobile, landline, malformed, and international inputs; error-code mapping.
2. **Sandbox** — send to Meta's test number, confirm the template renders and the copy-code button copies the right value.
3. **Real device, Android** — a real mid-range phone on mobile data. Tap the copy-code button, paste into the OTP input, confirm auto-advance and paste-all work.
4. **Real device, iOS** — confirm the copy-code button appears (one-tap autofill is Android-only; iOS falls back to copy code).
5. **WhatsApp Web** — confirm the linked-device masking behaviour and that the email fallback lands.
6. **Fallback** — point `AGENTX_OTP_URL` at a dead host, confirm login still completes by email within 20 seconds.
7. **Abuse** — hammer `request-otp`, confirm limits hold and the global circuit trips.
8. **Redaction** — grep the full log output from a successful login for the code. Zero hits, or fix it before shipping.

---

## 13. Rollout

| Stage | Gate |
|---|---|
| 1 | Integration shipped with `WHATSAPP_OTP_ENABLED=false`. Email-only login live. |
| 2 | Template approved (`otp.md`). Enable in staging, send 50 test logins across devices. |
| 3 | Enable for internal team accounts only, one week. |
| 4 | Enable for 10% of signups. Watch delivery rate and p95 latency. |
| 5 | Full rollout. Email stays as fallback permanently — it never gets removed. |

Do not attempt stages 2–5 before 23 September. Email OTP is a complete, shippable login. WhatsApp OTP is an upgrade, and treating it as a launch requirement is how the launch slips.

---

## 14. Open questions

| # | Question | Blocks |
|---|---|---|
| **W1** | Is AgentX on the official Cloud API, or an unofficial client? | Whether any of this is viable (§0.1) |
| **W2** | What is your WABA's current messaging limit? If 250, you cannot create the template. | Template creation (§0.2) |
| **W3** | Is the Meta Business Portfolio verified? | Template creation |
| **W4** | Does AgentX run on the same host/VPC as the launch app? | Whether the OTP endpoint can stay private |
| **W5** | Separate phone number for transactional OTP, or share the CRM number? | Quality-rating isolation (§8) |
| **W6** | Is AgentX Node/Express? (`dorway.txt` Q12 is still open) | Code samples above assume it is |
| **W7** | Hindi template alongside English? | `otp.md` language submission |

---
si
## 15. Consistency note

`architecture_launch.md` §5 specifies a **10-minute** OTP expiry. This document and `otp.md` use **5 minutes**, per your instruction. Five is the better choice for an auth code — update `architecture_launch.md` §5 and the `login_otps.expires_at` default to match, and make sure the number in the template (`code_expiration_minutes: 5`) is the same number the backend actually enforces. A message that says five minutes while the code lives for ten is a small lie your users will eventually notice.