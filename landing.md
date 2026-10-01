# Dorway — Landing Page Architecture
### The `/` marketing page only

**Scope:** The public landing page at `/`. It convinces a visitor, shows the product, and shows live pricing. It does **not** include login, checkout, account, admin, the CRM, or any other route. Those are named here only as the places a click leaves for.

This is the landing-page slice of `architecture.md`, updated to what is actually built. `landingpage.md` remains the design and copy spec. Where the two disagree on price or plan shape, this document and the database win.

---

## 1. The page's job

The landing page does three things and then gets out of the way:

1. State the promise — a shared WhatsApp inbox on the business's own number.
2. Show the product, in miniature, so the promise is concrete.
3. Show the current price, computed on the server, and hand the visitor to login.

It does not create accounts, take money, or read the device clock. Pricing is the only live data on the page. Everything else is static markup.

```
┌──────────────────────────────────────────────────────────┐
│  LANDING PAGE   web/src/pages/Landing.tsx                │
│                                                          │
│   Nav + Footer (Layout)                                  │
│   Hero, proof, showcase, features, deep-dives,           │
│   health, testimonials, FAQ, final CTA                   │
│        │                                                 │
│        │  only live read                                 │
│        ▼                                                 │
│   PricingCards ── GET /api/plans?termMonths=             │
│                          │                               │
│                          ▼                               │
│                    Express ── Postgres                   │
│                    plans + launch_config                 │
│                    (+ paid early-bird count)             │
└────────────────────────────┬─────────────────────────────┘
                             │
              clicks leave the page
                             ▼
        /login          /pricing         /contact
        /login?next=/checkout/:plan?term=
```

---

## 2. Stack, for this page

| Layer | What the page actually uses |
|---|---|
| UI | Vite + React + TypeScript. `Landing` is a route inside `BrowserRouter`, wrapped by `Layout`. |
| Styling | `web/src/styles/design-system.css` and `app.css`. Tokens are CSS custom properties. No Tailwind on this page. |
| Type | Comfortaa (display), Inter (UI and body), JetBrains Mono (template variables and timestamps inside mockups). Loaded from Google Fonts in `web/index.html`. |
| Icons | Inline SVG. No emoji. |
| Data | `GET /api/plans`. Proxied from the Vite dev server (`/api` → `http://localhost:8787`) per `web/vite.config.ts`. |
| Analytics | Meta Pixel. `PageView` on navigation; `ViewContent` when plans load; `AddToCart` when a plan's button is clicked. |

The page is a client-rendered SPA route. It is not server-rendered.

---

## 3. Composition

`App` mounts `Layout` (nav, `<main>`, footer) and renders `Landing` at `/`. Section order in `Landing.tsx`:

| # | Section | Anchor | Source | Live? |
|---|---|---|---|---|
| 1 | Hero | — | `Landing` | No. Headline, two CTAs, reassurance line, looping product video. |
| 2 | Proof strip | — | `Landing` | No. Four static figures. |
| 3 | Shared team inbox | — | `TeamInboxShowcase` | No. Miniature inbox plus three feature captions. |
| 4 | Feature bento | `#features` | `Landing` | No. Assignment, follow-ups, campaigns, pipeline. |
| 5 | Your account | — | `Landing` | No. Copy plus a connection-status mock. |
| 6 | 24-hour window | — | `Landing` | No. Open vs closed composer mock. |
| 7 | Follow-up automation | — | `Landing` | No. Sequence-builder mock. |
| 8 | Account health | — | `Landing` | No. Quality, sending limit, template status. |
| 9 | Testimonials | — | `Landing` | No. Two marquee rows, six quotes, duplicated for the loop. |
| 10 | Pricing | `#pricing` | `PricingCards` | **Yes.** Plans, rate, and early-bird banner come from the API. |
| 11 | FAQ | `#faq` | `Faq` inside `Landing` | No. Eight questions, one open at a time. |
| 12 | Final CTA | — | `Landing` | No. Try now, Talk to us. |

Nav links: Features → `/#features`, Pricing → `/pricing` (a separate page that reuses `PricingCards`), FAQ → `/#faq`.

---

## 4. Components

| Component | File | Role on this page |
|---|---|---|
| `Layout` | `web/src/components/Layout.tsx` | Nav, outlet, footer. |
| `Nav` | `web/src/components/Nav.tsx` | Logo, anchors, theme toggle, Log in / Account, Try now, mobile drawer. Scroll past 40px adds `.scrolled`. |
| `Footer` | `web/src/components/Footer.tsx` | Product, resources, company columns. Legal links. Meta trademark line. |
| `Landing` | `web/src/pages/Landing.tsx` | Every section except the inbox showcase and the pricing cards. Owns `Faq` and `HeroVideo`. |
| `TeamInboxShowcase` | `web/src/components/TeamInboxShowcase.tsx` | Static shared-inbox panel. |
| `PricingCards` | `web/src/components/PricingCards.tsx` | Term toggle, early-bird banner, plan card, checkout handoff. Also used on `/pricing`. |
| `usePlans` | `web/src/lib/usePlans.ts` | Fetches `/plans?termMonths=` and formats paise as rupees. |

`HeroVideo` plays `https://res.cloudinary.com/jetitb2w/video/upload/v1789590019/dorway2.mp4`, muted, looping, inline. If `prefers-reduced-motion: reduce` matches, it does not call `play()`.

---

## 5. The only API the page reads

```
GET /api/plans?termMonths=1|6|12
```

Default term on the page is **12**. An unrecognised value is treated as 12 on the server.

```json
{
  "earlyBirdOpen": true,
  "gstPercent": 18,
  "plans": [
    {
      "code": "growth",
      "name": "Dorway",
      "normalPaiseMonth": 199900,
      "earlyPaiseMonth": 99900,
      "ratePaiseMonth": 99900,
      "isEarlyBirdRate": true,
      "seatCap": null,
      "numberCap": 1,
      "features": ["Shared team inbox", "..."],
      "sortOrder": 1
    }
  ]
}
```

The client sends a term. It never sends an amount. `ratePaiseMonth` is what the card displays.

### 5.1 How the rate is chosen

Server-side, on every request (`server/src/lib/pricing.ts`):

```ts
function isEarlyBirdOpen(now: Date, cfg: LaunchConfig, sold: number): boolean {
  if (cfg.earlyBirdForceClose) return false;
  if (now >= cfg.earlyBirdEndsAt) return false;
  if (cfg.earlyBirdSeatCap !== null && sold >= cfg.earlyBirdSeatCap) return false;
  return true;
}

function effectiveRatePaise(plan, termMonths, earlyBirdOpen): bigint {
  if (termMonths === 1) return plan.normalPaiseMonth;
  return earlyBirdOpen ? plan.earlyPaiseMonth : plan.normalPaiseMonth;
}
```

`sold` is the count of orders with `isEarlyBird = true` and `status = PAID`.

Consequences for the card:

- **1 month** always shows the normal rate, with a line that the early-bird rate is for 6 and 12 month terms.
- **6 and 12 months** show the early rate while the window is open, with the normal rate struck through.
- The early-bird banner renders only when `earlyBirdOpen` is true.

### 5.2 Catalogue

One active plan, seeded in `server/prisma/seed.ts`. Starter and Scale stay in the table with `isActive: false` so old orders still resolve; the landing page never receives them.

| | Normal | Early bird (6 & 12 mo) | Seats | Numbers |
|---|---|---|---|---|
| **Dorway** (`growth`) | ₹1,999/mo | ₹999/mo | Unlimited (`seatCap` null) | 1 |

Prices are exclusive of GST. The card shows the monthly rate, not the GST-inclusive total. `gstPercent` comes back on the payload and is not drawn on the landing card.

Money is stored as paise (`BIGINT`). The page converts at display time with `formatRupees` (`en-IN`, no fraction digits).

### 5.3 What the page does while plans load

- Loading: "Loading pricing…"
- Error or empty payload: "Couldn't load pricing right now. Refresh to try again."
- Success: banner (if early bird is open), term toggle, one card.

Changing the term refetches. It does not recompute the price in the browser.

---

## 6. Where clicks go

The landing page does not complete these flows. It only starts them.

| Control | Destination |
|---|---|
| Hero "Try now", nav "Try now", final "Try now" | `/login` if signed out, `/dashboard` if signed in. |
| Hero "See how it works" | `#features` on the same page. |
| Plan card "Try now" | `/checkout/:planCode?term=` if signed in, otherwise `/login?next=` with that path encoded. Fires `AddToCart` first. |
| Final "Talk to us" | `/contact`. |
| Nav "Pricing" | `/pricing`. |
| Footer legal links | `/legal/privacy`, `/legal/terms`, `/legal/refund`. |

Unauthenticated plan choice preserves the plan and the term through login via `next`. That is the whole handoff contract this page has with checkout.

---

## 7. Design system

Same tokens the rest of the marketing surface uses, defined in `web/src/styles/design-system.css`. WhatsApp's visual vernacular — pale mint, deep bottle green — shifted so it reads as Dorway and not an unofficial Meta clone.

### 7.1 Tokens

```css
:root {
  --paper:      #FBFCF8;
  --card:       #FFFFFF;
  --ink:        #12211C;
  --ink-soft:   #5A6B65;
  --line:       #E4E6E0;
  --green:      #0BA36A;
  --green-deep: #067A4F;
  --mint:       #CDF3DD;
  --lime:       #B7E85C;
  --sun:        #FFD866;
  --amber:      #C98A2E;   /* pending only — template in review */
  --clay:       #B24A3F;   /* failure only */

  --radius-lg:    20px;    /* panels */
  --radius-md:    12px;    /* inner UI */
  --radius-full:  999px;   /* pills */
  --section-pad:  120px;
  --container-max: 1200px;
}

:root[data-theme="dark"] {
  --paper: #0C1512; --card: #121D19; --ink: #EDF2EF;
  --ink-soft: #8A9A94; --line: #22302B;
  --green: #2BC786; --green-deep: #1FA872; --mint: #173A2B;
}
```

Dark mode follows `prefers-color-scheme` unless the nav toggle has stored an explicit choice (`data-theme="light"` or `"dark"` on `:root`). Amber and clay appear only inside status chips and product mockups.

### 7.2 Type

- **Comfortaa** 500/700 — headlines, the logo, tier name, the price amount. Never below 18px. No italic; use weight or colour.
- **Inter** 400/500/600 — body, nav, buttons, FAQ, footer, mockup UI.
- **JetBrains Mono** 500 — template variables (`{{1}}`), timestamps, and other machine-looking data inside mockups. Not labels.

### 7.3 Motion

One looping hero video, two testimonial marquees, FAQ height, and the nav background on scroll. Marquee tracks duplicate their cards and mark the copy `aria-hidden`. Reduced motion suppresses hero autoplay. There is no countdown on this page.

### 7.4 Mobile

Nav collapses to a hamburger and a full-height drawer. Anchors and Try now are repeated inside it. The page is built for a phone-width first read: hero headline stacks, bento cards drop to a single column, the pricing card is one column (`pricing-grid single`).

---

## 8. Analytics on this page

Meta Pixel, via `web/src/lib/pixel.ts`. The base snippet in `web/index.html` sends the first `PageView`. Later SPA navigations send another after a short delay on the first paint, immediately after that.

| Event | When |
|---|---|
| `PageView` | Route change, including landing on `/`. |
| `ViewContent` | Plans payload arrives. Deduped per set of plan codes, so toggling the term does not refire for the same set. |
| `AddToCart` | Plan card "Try now". Value is `ratePaiseMonth * termMonths / 100`, currency INR. |

`Lead`, `InitiateCheckout`, `Purchase`, and the rest belong to other pages.

---

## 9. What stays static on purpose

FAQ answers, testimonials, proof numbers, feature copy, and every product mock are hardcoded in `Landing.tsx` and `TeamInboxShowcase.tsx`. They are not CMS-backed and they do not change when `launch_config` changes.

The Meta trademark line in the footer is required and fixed:

> Not affiliated with or endorsed by Meta Platforms, Inc. WhatsApp is a trademark of Meta Platforms, Inc.

Footer items that still point at `/#` (Integrations, Changelog, Help centre, About, Careers, and the social icons) are placeholders. They are not routes.

---

## 10. Out of scope

Documented in `architecture.md`, not here:

- Email OTP, session cookie, and `/login`.
- Cashfree checkout, webhooks, entitlements, refunds.
- `/checkout`, `/checkout/return`, `/dashboard`, onboarding, admin.
- `GET /api/launch-state` and any countdown. The landing page does not call it.
- `POST /api/waitlist`. The landing page does not collect emails.
- The CRM, and any sync of a paid plan into it.

If the early-bird window, the seat cap, or the rupee amounts change, that is a database write to `plans` / `launch_config` (or a re-seed). The landing page picks it up on the next `/api/plans` response. No landing deploy is required for a price change.
