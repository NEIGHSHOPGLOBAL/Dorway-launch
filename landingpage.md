# Dorway — Landing Page Specification
### Module A: WhatsApp CRM + Automation

**Scope:** This page sells the WhatsApp CRM only. GMB, Link in DM, and the AI Landing Page Builder are deliberately excluded — no nav links, no feature mentions, no "coming soon" teasers. One product, one promise.

**Source:** `dorway.txt` §2, §2.1, §7, §8, §9
**Design reference:** Ruixen "Nguyen" template — light base, soft gradient hero wash, bento feature grid where each card holds a miniature product UI.

---

## 0. Before you build: three things to lock

| # | Decision | Where it bites the page |
|---|---|---|
| 1 | **Product name** (`dorway.txt` Q11 — is Dorway the product, a module, or just a filename?) | Logo, nav, every headline, the domain, the OG image. Cheapest thing to fix now, most expensive later. |
| 2 | **Pricing model** (Q14 — per seat, per lead volume, or flat?) | The entire pricing section is built on per-seat. If you go flat or volume-based, that section gets rewritten. |
| 3 | **Who pays Meta** (Q13 — tenant attaches their own payment method, or you rebill with margin?) | Determines the message-cost copy in pricing and FAQ. Currently written for the tenant-pays model, which is simpler and more honest to sell. |

Placeholders below are marked `[Q13]`, `[Q14]`, `[VERIFY]`. Do not ship with those unresolved — several are legal-adjacent claims about a third party's platform.

---

## 1. Positioning

**Who this page talks to:** the owner or sales lead of a small-to-mid business in India that already closes deals over WhatsApp — clinics, coaching centres, real estate, interiors, D2C, service trades. They have 2–20 salespeople. Today they run on personal WhatsApp accounts, a shared phone, and a spreadsheet.

**The pain, in their words:** leads sit unanswered, nobody knows who's handling what, follow-ups get forgotten, and when a salesperson quits they walk out with the entire chat history on their personal phone.

**The promise:** every lead lands in one shared inbox on your own business number, gets assigned to someone automatically, and gets followed up whether or not anyone remembers.

**The proof:** your number, your WhatsApp Business Account, your data — not a shared pool.

**Tone:** plain, specific, slightly blunt. No hype adjectives, no "revolutionise". This buyer has been sold to badly before and reads superlatives as noise.

### A note on audience

You said "developer" when I asked who this is for, but the architecture document is unambiguous that the buyer is a business owner (`dorway.txt` D1, and the worked examples in §3.2 are dentists and plumbers). I've written for the business owner. If you actually meant *developer* — an API-first WhatsApp messaging product sold to engineering teams — that is a genuinely different page: different headline, pricing by message volume, docs and API reference in the nav, code samples instead of inbox screenshots. Say the word and I'll write that variant. Section 12 has an alternate hero for a technical buyer if you want to hedge.

---

## 2. Design system

### 2.1 Colour

Grounded in WhatsApp's own visual vernacular — the pale mint of an outgoing bubble, the deep bottle-green of the chat header — but shifted enough that it reads as your product and not an unofficial clone of Meta's. Using WhatsApp's exact `#25D366` would imply an official affiliation you do not have.

| Token | Hex | Use |
|---|---|---|
| `--paper` | `#F7F6F2` | Page background. Warm neutral with a faint green cast. |
| `--card` | `#FFFFFF` | Cards, panels, elevated surfaces. |
| `--ink` | `#12211C` | Headlines, body text. Deep bottle-green-black, never pure `#000`. |
| `--ink-soft` | `#5A6B65` | Secondary text, captions, inactive nav. |
| `--line` | `#E4E6E0` | Borders, dividers, card outlines. |
| `--green` | `#0B8A5C` | Primary buttons, links, active states, the brand mark. |
| `--green-deep` | `#065C3C` | Button hover, pressed states. |
| `--mint` | `#DCF0E4` | Quiet fills, outgoing message bubbles, hero wash, badge backgrounds. |
| `--amber` | `#C98A2E` | Pending states only — template under review, verification in progress. |
| `--clay` | `#B24A3F` | Failure and blocked states only. Never decorative. |

**Dark mode** (the reference has a theme toggle; match it):

| Token | Hex |
|---|---|
| `--paper` | `#0C1512` |
| `--card` | `#121D19` |
| `--ink` | `#EDF2EF` |
| `--ink-soft` | `#8A9A94` |
| `--line` | `#22302B` |
| `--green` | `#1FA872` (lifted for contrast on dark) |
| `--mint` | `#173A2B` |

Amber and clay appear only inside status chips and product mockups. If you find yourself reaching for a fifth accent, the section is doing too much.

### 2.2 Typography

**Comfortaa** — display only. Headlines, section titles, the logo lockup, pricing tier names, big numbers. Weights 500 and 700.

Comfortaa is a rounded geometric face with real constraints: one width, no italic, no monospace companion, and it turns mushy below 16px. Respect them:
- Never below 18px. Not in captions, not in badges, not in the footer.
- Tracking `-0.02em` at 40px and above; `-0.01em` at 28–39px; `0` below that. Left unadjusted, large Comfortaa reads loose and unserious.
- Line-height `1.15` for display sizes. Its round bowls need less leading than you'd expect.
- No italic exists — use weight or colour for emphasis, never faux-oblique.

**Inter** — everything under 20px. Body copy, nav, buttons, form labels, FAQ answers, footer, all UI text inside mockups. Weights 400 / 500 / 600.

**JetBrains Mono** — real data only. Template variables (`{{1}}`, `{{2}}`), phone numbers, message counts, timestamps, status codes. Not for labels, not for eyebrows, not for decoration. If it isn't machine-generated data, it isn't mono.

**Scale** (desktop; multiply by 0.72 for mobile, rounding to the nearest 2px):

| Role | Size / line-height | Family / weight |
|---|---|---|
| Hero headline | 64 / 1.1 | Comfortaa 700 |
| Section headline | 40 / 1.15 | Comfortaa 700 |
| Card title | 22 / 1.3 | Comfortaa 500 |
| Lead paragraph | 19 / 1.6 | Inter 400 |
| Body | 16 / 1.65 | Inter 400 |
| Small / caption | 14 / 1.5 | Inter 400 |
| Eyebrow | 14 / 1.4 | Inter 600, sentence case |
| Data chip | 13 / 1 | JetBrains Mono 500 |

Body copy caps at 68 characters per line.

**On eyebrows:** the reference sets them as tracked-out capitals (`SMART CONTEXT`). Keep the structural element — it genuinely helps you scan a long page — but set them in sentence case, in Inter, in `--green`. Tracked-out caps in a rounded typeface look weak, and Comfortaa has no small-caps to fall back on.

### 2.3 Layout

Content max-width 1200px, 12 columns, 24px gutters. Section vertical rhythm: 120px desktop / 72px mobile, applied as `padding-block` on the section element — never as margins on children, which is where spacing collapses go to die.

Corner radius carries hierarchy rather than being one value everywhere:
- 20px — major panels and feature cards
- 12px — inner UI elements inside mockups
- 999px — pills, badges, avatars, status chips

Elevation is a hairline `1px solid var(--line)` plus `0 1px 2px rgba(18,33,28,0.04)`. One shadow value across the whole page. Resist the urge to add a heavier one for "important" cards; use size and position for emphasis instead.

**Alignment:**
- Hero: centred, max-width 780px for the headline block.
- Section headers: centred, max-width 640px for the subhead.
- Feature card contents: left-aligned. Centred body text inside a card is hard to scan and is the tell of a template.
- Alternating deep-dive sections: text column left-aligned, visual on the opposite side, vertically centred against the text block.
- Footer: left-aligned columns.

### 2.4 Motion

One orchestrated moment, on the hero, on load: the conversation thread animates in message by message — inbound bubble, 400ms, outbound bubble, 400ms, then the status chip flips from `New` to `Contacted`. It runs once. It does not loop. It is the single thing on the page that moves without being asked.

Everything else responds to input only: accordion expansion, pricing toggle, button press, tab switch. No fade-and-slide-up on scroll for every section — that is the most recognisable AI-generated page signature there is.

`prefers-reduced-motion: reduce` disables the hero sequence entirely and renders the thread in its final state.

---

## 3. Page structure

```
┌────────────────────────────────────────────────────┐
│  NAV      logo          links        theme  CTA    │
├────────────────────────────────────────────────────┤
│                                                    │
│  HERO          headline (centred, 2 lines)         │
│                subhead                             │
│                [Start free]  [See how it works]    │
│                                                    │
│         ┌──────────────────────────┐               │
│         │  live conversation panel │               │
│         └──────────────────────────┘               │
│              (soft mint wash behind)               │
├────────────────────────────────────────────────────┤
│  PROOF STRIP    numbers, one line                  │
├────────────────────────────────────────────────────┤
│  BENTO          section header (centred)           │
│   ┌────────┬────────┐  ┌────────┬────────┬───────┐ │
│   │ inbox  │ assign │  │ follow │ campaign│ pipe │ │
│   └────────┴────────┘  └────────┴────────┴───────┘ │
├────────────────────────────────────────────────────┤
│  DEEP DIVE 1    text left   │   visual right       │
├────────────────────────────────────────────────────┤
│  DEEP DIVE 2    visual left │   text right         │
├────────────────────────────────────────────────────┤
│  DEEP DIVE 3    text left   │   visual right       │
├────────────────────────────────────────────────────┤
│  ACCOUNT HEALTH   full-width dashboard panel       │
├────────────────────────────────────────────────────┤
│  TESTIMONIALS     two marquee rows, opposite dirs  │
├────────────────────────────────────────────────────┤
│  PRICING          toggle + 3 tiers + cost note     │
├────────────────────────────────────────────────────┤
│  FAQ              accordion, single column, 720px  │
├────────────────────────────────────────────────────┤
│  FINAL CTA        centred on mint panel            │
├────────────────────────────────────────────────────┤
│  FOOTER           4 columns + legal bar            │
└────────────────────────────────────────────────────┘
```

---

## 4. Section-by-section copy

### 4.1 Navigation

Sticky. Transparent over hero, gains `--card` background and a bottom hairline after 40px of scroll.

- **Left:** logo lockup `[ASSET 01]`, 32px tall
- **Centre:** Features · Pricing · FAQ (Inter 500, 16px, `--ink-soft`, `--ink` on hover)
- **Right:** theme toggle (lucide `sun` / `moon`, 20px) · "Log in" text link · **"Start free"** button, `--green` fill, white text, 12px radius

Mobile: logo left, hamburger right. Drawer slides from the right with the same links stacked and the CTA full-width at the bottom.

---

### 4.2 Hero

Centred. `--paper` background with the mint wash `[ASSET 02]` bleeding from the top edge, fading to transparent by 70% height.

> # Your team already sells on WhatsApp.
> # Now you can actually run it.

Two lines, hard break after "WhatsApp." Comfortaa 700, 64px, `--ink`. No coloured word, no gradient text — the type does the work.

**Subhead** (Inter 400, 19px, `--ink-soft`, max-width 620px, centred):

> Every enquiry lands in one shared inbox on your own WhatsApp Business number. Leads get assigned the moment they arrive, follow-ups run on their own, and nothing lives on anyone's personal phone.

**Buttons** (side by side, 16px gap, centred):
- Primary: **"Start free"** — `--green` fill, white, Inter 600, 16px, 14px radius, 14px×28px padding
- Secondary: **"See how it works"** — transparent, 1px `--line` border, `--ink` text. Scrolls to the bento grid.

**Reassurance line** below buttons (Inter 400, 14px, `--ink-soft`):

> No card required · Bring your own WhatsApp number · Set up in a day

**Hero visual** `[ASSET 03]`, centred below, max-width 940px, overlapping the section boundary by 80px so it breaks into the proof strip.

---

### 4.3 Proof strip

Single row, four items, centred, separated by a hairline vertical rule. Numbers in Comfortaa 700 32px `--ink`; labels Inter 400 14px `--ink-soft`.

> **Under 60 sec** average first response · **100%** of chats kept on the business account · **Zero** leads assigned by hand · **Your** number, your data

`[VERIFY]` — replace the first figure with a real measured number before launch, or cut the item. An invented performance statistic is the fastest way to lose a buyer who checks.

---

### 4.4 Feature bento grid

**Section header** (centred, max-width 640px):

> ## Everything your team needs to close on WhatsApp
>
> Built for the way small sales teams actually work — one number, several people, and a lot of conversations that can't be dropped.

**Grid:** row one is two cards at 50/50; row two is three cards at 33/33/33. 24px gap. Each card is `--card`, 20px radius, hairline border, 32px padding. Card title in Comfortaa 500 22px, body in Inter 400 16px `--ink-soft`, and a miniature product UI filling the upper two-thirds.

**Card 1 — Shared team inbox** `[ASSET 04]`
> Every conversation in one place. Your whole team works from the same WhatsApp number, sees the full history on every lead, and picks up where someone else left off. Nothing is trapped on a personal phone.

**Card 2 — Leads assign themselves** `[ASSET 05]`
> New enquiry arrives, the next salesperson in the rotation gets it. No manager forwarding numbers at midnight, no two people calling the same lead, no lead sitting untouched because everyone assumed someone else had it.

**Card 3 — Follow-ups that happen** `[ASSET 06]`
> Set the rule once — day two, day five, day ten. The system sends it whether or not anyone remembered. Most deals are lost to silence, not to a competitor.

**Card 4 — Campaigns to your whole list** `[ASSET 07]`
> Send an approved template to a filtered segment — everyone marked Interested in Jaipur, say — and watch delivery, reads and replies come back into the same inbox.

**Card 5 — Pipeline you can see** `[ASSET 08]`
> New, Contacted, Interested, Negotiating, Won, Lost. Every lead sits in exactly one column, and you can tell at a glance where the month is going.

---

### 4.5 Deep dive 1 — Onboarding and ownership

Text left (6 cols), visual right (6 cols). This is the most important section on the page: it is the thing competitors selling shared-number tools cannot say.

**Eyebrow:** Your account, not ours

> ## Your business number. Your WhatsApp account.

**Body** (Inter 400, 19px, `--ink-soft`, max-width 520px):

> You connect your own WhatsApp Business Account through Meta's official sign-up flow — a few screens, inside Dorway, no Business Manager spelunking. The number stays yours. The account stays in your name. If you ever leave, you keep both.
>
> We track the two parts everyone gets stuck on: Meta's verification of your business, and approval of your message templates. You get a plain-English status for each and a clear list of what's blocking you, instead of an error code and a shrug.

**"See also" links** (Inter 500, 15px, `--green`, lucide `arrow-up-right` icon at 14px preceding the text):
- What business verification involves
- How message templates get approved

**Visual** `[ASSET 09]` — the connection status panel.

---

### 4.6 Deep dive 2 — The conversation window

Visual left, text right. Mirrors section 4.5.

**Eyebrow:** Built around WhatsApp's rules

> ## Know exactly what you can send, and when

**Body:**

> WhatsApp gives you a 24-hour window to reply freely after a customer messages you. Outside it, you need an approved template. Most teams learn this by having a message silently fail.
>
> Dorway shows the window counting down on every open chat. Inside it, type whatever you want. Outside it, the composer switches to your approved templates and fills in the customer's details for you. Your team never has to think about the rule — they just see the right composer.

**"See also" links:**
- How the 24-hour window works
- Managing your template library

**Visual** `[ASSET 10]` — chat composer with the countdown state.

> **`[VERIFY]` before this ships:** `dorway.txt` §2 records that from 1 October 2026, free-form service replies inside the 24-hour window stop being free and become billable at the utility rate. That is weeks away from now. Check Meta's current pricing changelog and make sure no copy on this page — here, in pricing, or in the FAQ — implies in-window replies are free. This section as written says "reply freely", meaning *without a template*, not *without cost*. Keep that distinction watertight.

---

### 4.7 Deep dive 3 — Automation

Text left, visual right.

**Eyebrow:** Follow-up automation

> ## The deal you lost was probably just forgotten

**Body:**

> A lead goes quiet on day three. Everyone means to check back. Nobody does. Two weeks later they've bought from someone who did.
>
> Build the sequence once and it runs on every lead that matches — a nudge on day two, a template on day five, a status change and a reminder to the salesperson on day ten. Anyone replies, the sequence stops and the chat lands back in the inbox as a live conversation.

**"See also" links:**
- Building a follow-up sequence
- Bulk campaigns and segments

**Visual** `[ASSET 11]` — sequence builder.

---

### 4.8 Account health

Full-width `--card` panel, 20px radius, 48px padding, centred header.

> ## Your account health, in the open
>
> Meta rates every WhatsApp Business Account on quality and gives it a sending limit. Most tools hide this. If your rating drops or your limit changes, you find out here first — not when your campaign stops going out.

**Visual** `[ASSET 12]` — health dashboard strip, full panel width.

Three supporting items below, in a row, each with a lucide icon at 20px in `--green`, a title in Comfortaa 500 18px, body in Inter 400 15px:

- **Quality rating** (`activity`) — See your current rating and what moved it, per number.
- **Sending limit** (`gauge`) — Know how many business-initiated conversations you can start in 24 hours, and when the tier steps up.
- **Template status** (`file-check`) — Every template, its approval state, and the reason if it was rejected.

---

### 4.9 Testimonials

**Section header** (centred):

> ## Teams that stopped losing leads

Two marquee rows scrolling in opposite directions, 40s duration, paused on hover and on focus-within. Cards are 340px wide, `--card`, 20px radius, hairline border, 24px padding.

Card structure: quote in Inter 400 16px `--ink`; below it an avatar `[ASSET 13]` at 36px round, name in Inter 600 15px, role and company in Inter 400 14px `--ink-soft`.

> **Placeholder copy — replace before launch.** Fabricated testimonials are a legal problem, not a copy problem. If you have no customers yet, cut this section entirely and move pricing up. An empty page is better than an invented one.

Six placeholders, written to show the *shape* real ones should take — specific, concrete, one claim each:

1. "Four salespeople were running four WhatsApp accounts. When one left, we lost six months of conversations. That can't happen now." — Rohit Agarwal, Director, Sunstone Interiors
2. "The rotation alone paid for it. Nobody argues about who got which lead anymore." — Meera Shah, Sales Head, Vedant Diagnostics
3. "We were forgetting follow-ups on maybe a third of enquiries. Now it just happens on day two and day five." — Karan Malhotra, Founder, Loop Fitness
4. "Our old tool put everything on a shared number we didn't control. Owning the account was non-negotiable for us." — Priya Nair, Operations, Anand Realty
5. "Setup took a day, including the Meta verification wait. I'd budgeted a week." — Sanjay Gupta, Partner, Gupta & Sons Traders
6. "I can see the whole month's pipeline on one screen at 8am. That's the entire product for me." — Anjali Desai, Business Head, Coastline Travel

---

### 4.10 Pricing

**Section header** (centred):

> ## Simple pricing, per salesperson
>
> Start free with one seat. Add people as your team grows.

**Billing toggle** — Monthly / Annual, with a `--mint` pill reading "2 months free" beside the annual option.

Three cards, 24px gap, equal height. Middle card is emphasised by a `--green` 2px border and a "Most popular" pill in `--green` at the top edge — not by being larger, which breaks the grid.

Tier name in Comfortaa 500 22px; price in Comfortaa 700 40px; the `/month` suffix in Inter 400 16px `--ink-soft`; feature list in Inter 400 15px with lucide `check` at 16px in `--green`.

`[Q14]` — **every number below is a placeholder.** Per-seat pricing is assumed. Confirm the model before this section goes near a designer.

**Starter — ₹0**
For one person testing the waters.
- 1 salesperson seat
- 1 WhatsApp Business number
- Shared inbox and full chat history
- Lead pipeline and statuses
- 3 message templates
- Email support
- *Meta message charges billed separately*

**Growth — ₹1,499 / month per seat** · *Most popular*
For teams that live in WhatsApp all day.
- Everything in Starter
- Unlimited seats
- Automatic lead assignment on rotation
- Follow-up sequences
- Bulk campaigns and segments
- Unlimited templates with approval tracking
- Account health and quality monitoring
- Priority support

**Scale — ₹2,999 / month per seat**
For multi-team and multi-number operations.
- Everything in Growth
- Multiple WhatsApp numbers
- Role-based permissions
- Full audit log of every message sent on your behalf
- API access
- Dedicated onboarding
- Named account manager

**Cost note** — full width below the cards, `--mint` background, 12px radius, 20px padding, Inter 400 15px:

> **About WhatsApp message charges.** Meta charges for conversations separately from your Dorway subscription. You attach your own payment method to your own WhatsApp Business Account and pay Meta directly at their published rates — we don't mark it up or resell it. Your usage is visible inside Dorway so there are no surprises.

`[Q13]` — that paragraph assumes tenant-pays. If you decide to hold the credit line and rebill with a margin, this becomes a different paragraph *and* a much larger product: usage metering, per-tenant cost attribution, prepaid credits, dunning, float risk. Rewrite here only after that decision is made.

---

### 4.11 FAQ

Single column, 720px, centred. Accordion, one open at a time, first item open by default. Question in Comfortaa 500 20px; answer in Inter 400 16px `--ink-soft`. Chevron rotates 180° on open, 200ms.

**Do I need my own WhatsApp number?**
Yes, and that's deliberate. You connect your own WhatsApp Business Account, so the number and the customer relationships stay yours. A fresh number works, or you can move an existing one — though a number currently on the consumer WhatsApp app has to be migrated, which we walk you through.

**How long does setup take?**
Connecting the account takes a few minutes. The wait is on Meta's side: your business needs to be verified, and your message templates need to be approved. Both are Meta's processes with Meta's timelines, and we can't promise a date — but we show you exactly which step you're on and what's blocking it. `[VERIFY]` — do not add an estimate here unless you have real onboarding data.

**What is the 24-hour window?**
When a customer messages you, you can reply with anything you like for 24 hours. After that, you need a message template that Meta has approved in advance. Dorway shows the countdown on every chat and switches the composer to your templates automatically when the window closes.

**What do WhatsApp messages cost?**
Meta charges per conversation at rates that vary by country and message category. You pay Meta directly from your own account, at their rates, with no markup from us. Your subscription covers the software. `[VERIFY against Meta's current pricing before publishing — the free-tier rules around in-window service replies change on 1 October 2026.]`

**Can other businesses on Dorway see my leads?**
No. Every business on the platform is isolated at the database level — separate data, separate connected accounts, separate real-time channels. Your leads and conversations are visible only to the users you invite.

**What happens when a salesperson leaves?**
Their access is revoked and every conversation stays in the shared inbox where their replacement picks it up. Because chats run through your business account rather than their personal phone, nothing walks out the door.

**Can I import my existing leads?**
Yes — upload a CSV with names, numbers and any fields you're tracking, and map them to your pipeline stages during import.

**Is there a contract?**
No. Monthly plans cancel any time. Annual plans are billed upfront for the year. You can export your leads and chat history whenever you like.

---

### 4.12 Final CTA

Centred on a `--mint` panel, 20px radius, 80px vertical padding, 1000px max-width.

> ## Stop losing leads to a forgotten follow-up
>
> Connect your WhatsApp number and run your first sequence today. Free for one seat, no card required.
>
> **[Start free]**  **[Talk to us]**

Primary button `--green` fill; secondary transparent with `--ink` border.

---

### 4.13 Footer

`--paper` background, hairline top border, 64px vertical padding.

Left column (4 cols wide): logo mark `[ASSET 01b]`, then in Inter 400 15px `--ink-soft`:

> WhatsApp CRM for teams that sell through conversations. Your number, your data, your customers.

Below it, three social icons (lucide `linkedin`, `twitter`, `instagram`), 20px, `--ink-soft`.

Three link columns (Inter 400 15px, headers in Comfortaa 500 16px):

- **Product** — Features · Pricing · Integrations · Changelog
- **Resources** — Help centre · Setting up WhatsApp · Message templates · Contact support
- **Company** — About · Careers · Privacy policy · Terms of service

**Legal bar** — hairline top border, 24px padding, Inter 400 14px `--ink-soft`, space-between:

> © 2026 Dorway. All rights reserved.
>
> *Not affiliated with or endorsed by Meta Platforms, Inc. WhatsApp is a trademark of Meta Platforms, Inc.*

That disclaimer is not optional. You are building on Meta's platform and using their trademark to describe your product; say plainly that you are not them.

---

## 5. Image and asset manifest

**Read this first.** Split your assets into three buckets, because generating them the wrong way will cost you a week:

| Bucket | Method | Why |
|---|---|---|
| **Build in code or Figma** | HTML/CSS or a Figma frame, exported at 2× PNG | Anything containing readable UI text. Image generators produce garbled letterforms and invented interface conventions. Every product mockup here falls in this bucket. |
| **Generate with AI** | Any image model | Backgrounds, abstract washes, textures. No text, no UI. |
| **Source or photograph** | Stock, licensed, or real people | Avatars. Use real photos of real customers with permission, or a licensed portrait set — not AI faces, which read as fake to exactly the buyer you want. |

The generation prompts below are written for the AI bucket. For the build bucket, the description *is* the spec — hand it to whoever builds the mockup.

---

### ASSET 01 — Logo lockup
**Bucket:** Design (not generation) · **Placement:** Nav left, footer · **Size:** SVG, renders at 32px height
**Spec:** Wordmark in Comfortaa 700, `--ink` on light theme and `--paper` on dark, paired with a mark. The mark should suggest a conversation without drawing a speech bubble, which every messaging product already uses — consider a doorway/arch form, which the name supports, with the negative space reading as an opening. Needs a light variant, a dark variant, and a square mark-only version.

### ASSET 01b — Logo mark, square
**Bucket:** Design · **Placement:** Footer, favicon, app icon · **Size:** 512×512 SVG + PNG
**Spec:** Mark only, no wordmark, on a transparent background. Must stay legible at 16px.

### ASSET 02 — Hero background wash
**Bucket:** AI generation · **Placement:** Behind hero, full-bleed, fading to transparent at 70% height · **Size:** 2880×1400 JPG, under 300KB
**Prompt:** `Soft abstract watercolour gradient background, pale mint green blending into warm off-white and a hint of pale sage, organic diffused edges, no defined shapes, no text, no objects, very light and airy, high key, subtle paper grain texture, horizontal composition, gradient fading toward the bottom edge`
**Note:** Also produce a dark variant — same wash on a deep bottle-green base — or apply a CSS multiply blend to the light version.

### ASSET 03 — Hero product panel
**Bucket:** Build in code · **Placement:** Hero, centred, overlapping into the next section · **Size:** 1880×1180 @2x
**Spec:** Three-pane inbox in a browser-chrome-free rounded frame with a hairline border and the standard shadow.
- **Left rail (220px):** avatar list of five teammates with unread count badges; a "Rotation on" toggle in `--green`.
- **Centre (620px):** an open conversation. Inbound bubbles white with a hairline; outbound bubbles `--mint`. Four messages, realistic Indian SMB sales content — a customer asking about a price for a service, the salesperson answering, a follow-up question. Below, the composer with a `--green` send button and a small mono chip reading `23:41 left in window`.
- **Right rail (260px):** lead card — name, phone in JetBrains Mono, source "WhatsApp", status pill reading `Contacted` in `--amber`, assigned-to avatar, and three timeline entries.
This panel is the animated hero: the last two bubbles and the status pill are what move on load.

### ASSET 04 — Shared inbox mini-UI
**Bucket:** Build in code · **Placement:** Bento card 1, upper two-thirds · **Size:** 960×540 @2x
**Spec:** Cropped conversation list — four rows, each with avatar, contact name, message preview truncated, timestamp, and on two rows a small `--green` unread dot. One row highlighted as selected with a `--mint` fill. Text small but legible.

### ASSET 05 — Auto-assignment mini-UI
**Bucket:** Build in code · **Placement:** Bento card 2 · **Size:** 960×540 @2x
**Spec:** A single incoming lead card at the top, with a thin `--green` connector line curving down to one of four teammate avatars arranged in a row. The receiving avatar has a `--green` ring; the other three are at 40% opacity. A small mono chip beside the row reads `next: Priya`.

### ASSET 06 — Follow-up sequence mini-UI
**Bucket:** Build in code · **Placement:** Bento card 3 · **Size:** 960×540 @2x
**Spec:** Vertical timeline, three nodes down the left connected by a hairline. Node 1 filled `--green` with a `check`, labelled "Day 2 · Sent". Node 2 filled `--green` with a `check`, "Day 5 · Sent". Node 3 hollow with an `--amber` ring, "Day 10 · Scheduled". Each node has a one-line message preview to its right.

### ASSET 07 — Campaign mini-UI
**Bucket:** Build in code · **Placement:** Bento card 4 · **Size:** 960×540 @2x
**Spec:** A template card at the top showing message body with `{{1}}` and `{{2}}` variables in JetBrains Mono, and an "Approved" pill in `--green`. Below, three stat blocks: `1,240 sent`, `1,190 delivered`, `312 replied`, numbers in Comfortaa 700, labels in Inter.

### ASSET 08 — Pipeline mini-UI
**Bucket:** Build in code · **Placement:** Bento card 5 · **Size:** 960×540 @2x
**Spec:** Five narrow kanban columns headed New, Contacted, Interested, Won, Lost, with a count under each header. Two or three compact lead cards per column showing name and assignee avatar only. Won column tinted `--mint`.

### ASSET 09 — Connection status panel
**Bucket:** Build in code · **Placement:** Deep dive 1, right side · **Size:** 1200×900 @2x
**Spec:** A settings panel titled "WhatsApp connection" with four status rows, each with an icon, a label, a status pill, and a one-line detail:
1. Business account connected — `--green` "Connected" — shows a masked number in mono
2. Business verification — `--amber` "In review" — "Submitted 2 days ago"
3. Message templates — `--green` "4 of 5 approved" — one row expandable
4. Payment method — `--green` "Attached"
Below, a "What's blocking me" link in `--green`. This panel is the section's whole argument, so it needs to look like a real screen, not a diagram.

### ASSET 10 — Composer window states
**Bucket:** Build in code · **Placement:** Deep dive 2, left side · **Size:** 1200×900 @2x
**Spec:** Two composer states stacked with a small gap, clearly labelled:
- **Top, window open:** free-text composer, a mono countdown chip `23:41 left`, `--green` send button, placeholder "Type a message".
- **Bottom, window closed:** the composer replaced by a template picker — a dropdown showing a template name, a preview of the body with `{{1}}` filled in as "Rahul", and a note reading "Window closed — send an approved template".
The contrast between the two is the point; keep them visually parallel so the difference reads instantly.

### ASSET 11 — Sequence builder
**Bucket:** Build in code · **Placement:** Deep dive 3, right side · **Size:** 1200×900 @2x
**Spec:** A rule builder. Top row: trigger condition — "When lead status is Contacted and no reply for 2 days". Below, three stacked action cards connected by hairlines: send template, wait 3 days, notify assignee. Each card has a drag handle (lucide `grip-vertical`), an icon, and editable-looking fields. A `--green` "Sequence active" toggle top-right.

### ASSET 12 — Account health strip
**Bucket:** Build in code · **Placement:** Account health section, full panel width · **Size:** 2000×600 @2x
**Spec:** Horizontal dashboard strip, three panels divided by hairlines:
1. **Quality rating** — a large "High" in Comfortaa 700 with a `--green` dot, and a small 14-day sparkline below.
2. **Sending limit** — "1,000 / 24h" in Comfortaa 700, with a progress bar at about 40% in `--green` and a caption "Next tier at 10,000".
3. **Templates** — a compact list of four template names with status pills: three `--green` "Approved", one `--amber` "In review".

### ASSET 13 — Testimonial avatars (×6)
**Bucket:** Source, do not generate · **Placement:** Testimonial cards · **Size:** 200×200 each, round crop
**Spec:** Six portraits, warm natural light, plain uncluttered backgrounds, business-casual, consistent treatment across all six. Indian SMB owners and sales leads, mixed gender, ages roughly 28–50.
**Do not use AI-generated faces.** The uncanny quality is widely recognised now and it undermines the exact section whose job is credibility. Use real customers with written permission, or a licensed stock portrait set.

### ASSET 14 — Open Graph image
**Bucket:** Design · **Placement:** Social share meta tag · **Size:** 1200×630 PNG
**Spec:** Mint wash background, logo top-left, the hero headline set in Comfortaa 700 at roughly 56px, and a cropped corner of the hero inbox panel bleeding off the bottom-right. Must stay readable as a small thumbnail in a WhatsApp forward — which is, appropriately, where most of these links will be shared.

### ASSET 15 — Favicon set
**Bucket:** Design · **Size:** 32×32, 180×180 (Apple touch), 512×512 (manifest)
**Spec:** Square mark from ASSET 01b on a `--green` fill with the mark knocked out in `--paper`.

---

## 6. Build checklist

- [ ] Product name confirmed (Q11) and applied everywhere
- [ ] Pricing model confirmed (Q14); real numbers replace placeholders
- [ ] Message-cost model confirmed (Q13); pricing note and FAQ rewritten to match
- [ ] Meta's 1 Oct 2026 pricing change verified; no copy implies in-window replies are free
- [ ] Testimonials replaced with real ones, or the section removed
- [ ] Proof-strip statistics real or removed
- [ ] Meta trademark disclaimer present in footer
- [ ] No emoji anywhere on the page (`dorway.txt` design system rule); lucide-react icons only
- [ ] No claims about Meta approval timelines
- [ ] Comfortaa never rendered below 18px
- [ ] Responsive at 375px, 768px, 1024px, 1440px
- [ ] `prefers-reduced-motion` disables the hero sequence
- [ ] Keyboard focus visible on every interactive element
- [ ] Contrast: `--ink-soft` on `--paper` verified at 4.5:1
- [ ] Marquee pauses on hover and on focus-within
- [ ] All images have alt text; decorative wash marked `alt=""`
- [ ] OG and Twitter meta tags set with ASSET 14
- [ ] Hero LCP image preloaded; wash served as WebP with a JPG fallback

---

## 7. Alternate hero for a technical buyer

If the audience really is developers rather than business owners, swap section 4.2 for this and rebuild pricing around message volume rather than seats. The rest of the page changes too, but this shows the direction:

> # A WhatsApp Business API you can ship on this week
>
> Embedded signup, per-tenant WABA provisioning, template management and webhook delivery — behind one REST API and one dashboard. Bring your own Meta app or use ours.
>
> **[Read the docs]**  **[Get an API key]**
>
> `npm i @dorway/sdk`

Nav gains Docs and API Reference. The hero visual becomes a code sample beside a live webhook payload rather than an inbox. Tell me if you want this version written out in full — it's a different page, not a variant.
