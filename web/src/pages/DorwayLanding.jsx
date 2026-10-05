/**
 * Dorway — WhatsApp CRM landing page
 * ------------------------------------------------------------
 * Single-file React component. No Tailwind or build config needed:
 * all styles live in the STYLES string below (every class is prefixed "dw-").
 *
 * EDITING GUIDE
 *  - Copy, CTAs, pricing and FAQ are all in the CONFIG / content objects
 *    near the top of this file. You should rarely need to touch the JSX.
 *
 * SCOPE: WhatsApp CRM only. Keep every other product module off this page.
 *
 * Dependencies: react, lucide-react
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Menu, X, Check, CheckCheck, Clock, Play, ArrowUpRight, ChevronDown,
  Inbox, Users, GitBranch, CalendarClock, Sparkles, UserPlus, BellRing,
  UserX, MessageSquareDashed, BarChart3, FileText, Search, ListChecks,
  Target, Zap, Reply, Minus, Plus, Phone, Send, Shuffle, Megaphone,
  Briefcase, Headphones, UploadCloud, CircleSlash, CircleCheck,
  Pause, Volume2, VolumeX, Maximize2,
} from "lucide-react";

/* ============================================================
   CONFIG — edit here
   ============================================================ */

const CONFIG = {
  brand: "Dorway",
  contact: {
    email: "hello@dorwayai.com",
    phoneDisplay: "+91 830702643",
    phoneTel: "+91830702643",
    address: "Narela, Delhi 110040",
  },

  // One primary, one secondary, one high-intent action. Nothing else.
  cta: {
    primary: { label: "Get started", href: "/login" },
    secondary: { label: "Watch demo" },                    // opens the demo modal
    setup: { label: "Book setup", href: "/contact" },
    login: { label: "Log in", href: "/login" },
  },

  // Plays muted inside the hero's product frame.
  heroVideo: "https://res.cloudinary.com/jetitb2w/video/upload/v1789590019/dorway2.mp4",
  // First frame of the same video (Cloudinary generates it). Shown while the video loads.
  heroPoster: "https://res.cloudinary.com/jetitb2w/video/upload/so_0/v1789590019/dorway2.jpg",

  // "Watch demo" video. Leave empty to reuse heroVideo (with sound).
  // Accepts an .mp4 link or a YouTube/Vimeo/Loom *embed* URL.
  demoVideoUrl: "",

  // userchanges.md X-1 — there is no free trial in the real flow (login →
  // preview → paid plan), so this must not promise one.
  reassurance: ["Pay only when you're ready", "Setup done with you"],
};

/* ------------------------------------------------------------
   PRICING — userchanges.md P-1/P-5. One plan, three prepaid terms.
   Keep these numbers in sync with server/src/lib/pricing.ts
   (TERM_DISCOUNTS) if the base monthly rate ever changes.
   ------------------------------------------------------------ */
const PRICING = {
  currency: "₹",
  baseMonthly: 1999,
  terms: [
    { months: 1, discountPercent: 0, monthlyRate: 1999, badge: null, blurb: "Pay for one month and see how the team works." },
    { months: 6, discountPercent: 10, monthlyRate: 1799, badge: "Save 10%", blurb: "A lower monthly rate, paid once for half a year." },
    { months: 12, discountPercent: 25, monthlyRate: 1499, badge: "Best value", blurb: "The lowest monthly rate, paid once for the year." },
  ],
  gstPercent: 18,
  shared: {
    meta: "Billed by Meta to your own account, at Meta's rates. No markup.",
    refund: "Full refund, no questions, any time before launch.",
    access: "Your term starts on launch day, not today.",
  },
};

/* ============================================================
   STYLES
   ============================================================ */

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');

.dw {
  min-height: 100vh;
  --white: #FFFFFF;
  --paper: #F6F8F5;
  --ink: #12211C;
  --ink-soft: #56675F;
  --line: #E3E7E1;
  --green: #0B8A5C;
  --green-deep: #065C3C;
  --mint: #DCF0E4;
  --mint-soft: #EEF7F1;
  --amber: #C98A2E;
  --amber-soft: #F8EBD6;
  --clay: #B24A3F;
  --clay-soft: #F6E1DE;
  --shadow: 0 1px 2px rgba(18,33,28,.04), 0 8px 24px -12px rgba(18,33,28,.10);
  --display: 'Comfortaa', ui-rounded, 'Segoe UI', system-ui, sans-serif;
  --body: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;

  font-family: var(--body);
  color: var(--ink);
  background: var(--white);
  font-size: 16px;
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
  overflow-x: clip;
}
.dw *, .dw *::before, .dw *::after { box-sizing: border-box; }
:where(.dw) :where(h1, h2, h3, h4, p) { margin: 0; }
:where(.dw) a { color: inherit; text-decoration: none; }
:where(.dw) button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; padding: 0; }
.dw :focus-visible { outline: 2px solid var(--green); outline-offset: 3px; border-radius: 8px; }
:where(.dw) img { max-width: 100%; }

.dw-wrap { width: 100%; max-width: 1200px; margin: 0 auto; padding-inline: 24px; }
.dw-section { padding-block: 120px; }
.dw-section--tight { padding-block: 72px; }
.dw-center { text-align: center; }

/* ---------- type ---------- */
.dw-h1 { font-family: var(--display); font-weight: 700; font-size: 60px; line-height: 1.12; letter-spacing: -0.02em; }
.dw-h2 { font-family: var(--display); font-weight: 700; font-size: 42px; line-height: 1.15; letter-spacing: -0.02em; }
.dw-h2-sub { font-family: var(--display); font-weight: 500; font-size: 28px; line-height: 1.25; letter-spacing: -0.01em; color: var(--ink-soft); margin-top: 10px; }
.dw-h3 { font-family: var(--display); font-weight: 700; font-size: 26px; line-height: 1.25; letter-spacing: -0.01em; }
.dw-h4 { font-family: var(--display); font-weight: 700; font-size: 20px; line-height: 1.3; }
.dw-lead { font-size: 19px; line-height: 1.6; color: var(--ink-soft); }
.dw-body { color: var(--ink-soft); }
.dw-small { font-size: 14px; line-height: 1.5; color: var(--ink-soft); }
.dw-mono { font-family: var(--mono); font-weight: 500; font-size: 12.5px; letter-spacing: 0; }
.dw-measure { max-width: 640px; margin-inline: auto; }

/* ---------- buttons ---------- */
.dw-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  height: 52px; padding: 0 28px; border-radius: 10px;
  font-weight: 600; font-size: 16px; white-space: nowrap;
  transition: background .15s ease, border-color .15s ease, transform .1s ease;
}
.dw-btn:active { transform: translateY(1px); }
.dw-btn--primary { background: var(--ink); color: var(--white); }
.dw-btn--primary:hover { background: #1D3129; }
.dw-btn--ghost { background: rgba(255,255,255,.6); border: 1px solid #CDD4CE; color: var(--ink); }
.dw-btn--ghost:hover { background: var(--white); border-color: var(--ink); }
.dw-btn--light { background: var(--white); color: var(--ink); }
.dw-btn--light:hover { background: var(--mint); }
.dw-btn--outline-light { border: 1px solid rgba(255,255,255,.35); color: var(--white); }
.dw-btn--outline-light:hover { border-color: var(--white); }
.dw-btn--sm { height: 42px; padding: 0 20px; font-size: 15px; }
.dw-btn-row { display: flex; gap: 14px; flex-wrap: wrap; }
.dw-center .dw-btn-row { justify-content: center; }
.dw-textlink { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: var(--green); }
.dw-textlink:hover { color: var(--green-deep); }

/* ---------- chips ---------- */
.dw-pill {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 7px 16px; border-radius: 999px; border: 1px solid var(--line);
  background: rgba(255,255,255,.75); font-size: 15px; font-weight: 500; color: var(--ink);
}
.dw-chip { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; line-height: 1.5; white-space: nowrap; }
.dw-chip--green { background: var(--mint); color: var(--green-deep); }
.dw-chip--amber { background: var(--amber-soft); color: #8A5A15; }
.dw-chip--clay { background: var(--clay-soft); color: var(--clay); }
.dw-chip--grey { background: var(--paper); color: var(--ink-soft); border: 1px solid var(--line); }
.dw-flag {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px;
  background: var(--amber-soft); color: #7A4F12; font-size: 12px; font-weight: 600;
  border: 1px dashed var(--amber);
}

/* ---------- nav ---------- */
.dw-nav { position: sticky; top: 0; z-index: 50; transition: background .2s ease, box-shadow .2s ease; }
.dw-nav.is-scrolled { background: rgba(255,255,255,.92); backdrop-filter: saturate(1.4) blur(10px); box-shadow: 0 1px 0 var(--line); }
.dw-nav__inner { display: flex; align-items: center; justify-content: space-between; height: 76px; gap: 24px; }
.dw-logo { display: inline-flex; align-items: center; gap: 10px; font-family: var(--display); font-weight: 700; font-size: 26px; letter-spacing: -0.02em; }
.dw-nav__links { display: flex; gap: 34px; font-weight: 500; font-size: 15.5px; }
.dw-nav__links a { color: var(--ink); opacity: .82; }
.dw-nav__links a:hover { opacity: 1; }
.dw-nav__right { display: flex; align-items: center; gap: 22px; }
.dw-nav__login { font-weight: 500; font-size: 15.5px; }
.dw-nav__burger { display: none; width: 42px; height: 42px; border-radius: 10px; align-items: center; justify-content: center; border: 1px solid var(--line); background: var(--white); }
.dw-drawer { position: fixed; inset: 0; z-index: 60; background: rgba(18,33,28,.3); }
.dw-drawer__panel { position: absolute; right: 0; top: 0; bottom: 0; width: min(340px, 88vw); background: var(--white); padding: 20px 24px 28px; display: flex; flex-direction: column; gap: 6px; }
.dw-drawer__panel a.dw-drawer__link { padding: 14px 0; border-bottom: 1px solid var(--line); font-weight: 500; font-size: 17px; }
.dw-drawer__panel .dw-btn { margin-top: auto; width: 100%; }

/* ---------- hero ---------- */
.dw-hero { position: relative; padding-top: 72px; padding-bottom: 0; isolation: isolate; }
.dw-hero__bg { position: absolute; inset: -76px 0 30% 0; z-index: -1;
  background:
    radial-gradient(60% 70% at 50% 35%, rgba(255,255,255,.95) 0%, rgba(255,255,255,0) 70%),
    linear-gradient(180deg, #E3F2E8 0%, #EDF6EF 55%, #FFFFFF 100%);
}
.dw-hero__pattern { position: absolute; inset: 0; color: var(--green-deep); opacity: .055;
  -webkit-mask-image: linear-gradient(180deg, #000 0%, #000 45%, transparent 95%);
          mask-image: linear-gradient(180deg, #000 0%, #000 45%, transparent 95%);
}
.dw-hero__head { max-width: 860px; margin: 0 auto; text-align: center; }
.dw-hero__head .dw-lead { max-width: 640px; margin: 24px auto 0; }
.dw-hero__head .dw-btn-row { margin-top: 36px; }
.dw-reassure { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px 22px; margin-top: 20px; font-size: 14px; color: var(--ink-soft); }
.dw-reassure span { display: inline-flex; align-items: center; gap: 6px; }
.dw-reassure svg { color: var(--green); }
.dw-hero__stage { position: relative; max-width: 1000px; margin: 64px auto 0; }

/* ---------- app mockup frame ---------- */
.dw-frame { background: var(--white); border: 1px solid var(--line); border-radius: 22px; box-shadow: 0 30px 80px -30px rgba(18,33,28,.25), var(--shadow); padding: 10px; }
.dw-app { display: grid; grid-template-columns: 196px 1fr; border-radius: 14px; overflow: hidden; background: var(--paper); min-height: 470px; font-size: 13px; }
.dw-app__side { background: var(--white); border-right: 1px solid var(--line); padding: 16px 12px; display: flex; flex-direction: column; gap: 3px; }
.dw-app__brand { display: flex; align-items: center; gap: 8px; font-family: var(--display); font-weight: 700; font-size: 18px; padding: 2px 8px 14px; }
.dw-app__nav { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 9px; color: var(--ink-soft); font-weight: 500; }
.dw-app__nav.is-active { background: var(--paper); color: var(--ink); border: 1px solid var(--line); }
.dw-app__nav .dw-app__count { margin-left: auto; font-size: 11px; font-weight: 600; background: var(--green); color: #fff; border-radius: 999px; padding: 0 7px; }
.dw-app__main { padding: 18px 18px 18px; display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.dw-app__top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.dw-app__greet { font-family: var(--display); font-weight: 700; font-size: 18px; }
.dw-app__stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.dw-stat { background: var(--white); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }
.dw-stat__label { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--ink-soft); }
.dw-stat__icon { width: 20px; height: 20px; border-radius: 6px; display: grid; place-items: center; }
.dw-stat__num { font-family: var(--display); font-weight: 700; font-size: 24px; margin-top: 6px; letter-spacing: -0.01em; }
.dw-app__work { display: grid; grid-template-columns: 1fr 230px; gap: 10px; flex: 1; min-height: 0; }
.dw-convo { background: var(--white); border: 1px solid var(--line); border-radius: 12px; display: flex; flex-direction: column; min-width: 0; }
.dw-convo__head { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--line); }
.dw-convo__body { padding: 14px; display: flex; flex-direction: column; gap: 8px; flex: 1; background: #FAFBF9; }
.dw-bubble { max-width: 78%; padding: 8px 12px; border-radius: 12px; line-height: 1.45; font-size: 13px; }
.dw-bubble--in { background: var(--white); border: 1px solid var(--line); align-self: flex-start; border-top-left-radius: 4px; }
.dw-bubble--out { background: var(--mint); align-self: flex-end; border-top-right-radius: 4px; }
.dw-bubble__meta { display: flex; justify-content: flex-end; align-items: center; gap: 3px; font-size: 10.5px; color: var(--ink-soft); margin-top: 2px; }
.dw-bubble.is-hidden { visibility: hidden; }
.dw-bubble.is-entering { animation: dw-pop .35s ease-out both; }
@keyframes dw-pop { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.dw-composer { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--line); }
.dw-composer__field { flex: 1; height: 34px; border-radius: 9px; background: var(--paper); border: 1px solid var(--line); display: flex; align-items: center; padding: 0 12px; color: var(--ink-soft); font-size: 12.5px; }
.dw-composer__send { width: 34px; height: 34px; border-radius: 9px; background: var(--green); color: #fff; display: grid; place-items: center; }
.dw-leadcard { background: var(--white); border: 1px solid var(--line); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.dw-kv { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 12px; }
.dw-kv > span:first-child { color: var(--ink-soft); }
.dw-avatar { width: 28px; height: 28px; border-radius: 999px; display: grid; place-items: center; font-size: 11px; font-weight: 600; color: var(--white); flex-shrink: 0; }
.dw-avatar--sm { width: 22px; height: 22px; font-size: 10px; }
.dw-status-flip { transition: background .3s ease, color .3s ease; }

.dw-float { position: absolute; background: var(--white); border: 1px solid var(--line); border-radius: 14px; box-shadow: 0 18px 40px -18px rgba(18,33,28,.35); padding: 12px 14px; display: flex; align-items: center; gap: 12px; font-size: 13px; }
.dw-float--left { left: -56px; bottom: 120px; }
.dw-float__icon { width: 36px; height: 36px; border-radius: 10px; background: var(--ink); color: #fff; display: grid; place-items: center; flex-shrink: 0; }

/* ---------- trust bar ---------- */
.dw-trust { padding-block: 88px 24px; text-align: center; }
.dw-trust__row { display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; margin-top: 22px; }
.dw-trust__row .dw-pill { background: var(--paper); }

/* ---------- panel (concentro-style big card) ---------- */
.dw-panel { background: var(--paper); border: 1px solid var(--line); border-radius: 28px; padding: 64px; display: grid; grid-template-columns: 1fr 1.15fr; gap: 40px; align-items: center; margin-top: 64px; }
.dw-panel__icon { width: 76px; height: 76px; border-radius: 999px; background: var(--mint-soft); border: 1px solid var(--line); display: grid; place-items: center; margin-bottom: 40px; }
.dw-panel__icon > span { width: 44px; height: 44px; border-radius: 999px; background: var(--ink); color: #fff; display: grid; place-items: center; }

/* problem story */
.dw-story { display: flex; flex-direction: column; gap: 14px; }
.dw-story p { font-size: 19px; line-height: 1.5; color: var(--ink); }
.dw-story .dw-story__muted { color: var(--ink-soft); }
.dw-story__punch { font-family: var(--display); font-weight: 700; font-size: 26px; line-height: 1.3; letter-spacing: -0.01em; margin-top: 18px; }

/* node graph */
.dw-graph { position: relative; min-height: 420px; }
.dw-graph__grid { position: absolute; inset: 0; background-image: linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px); background-size: 96px 96px; opacity: .55;
  -webkit-mask-image: radial-gradient(closest-side, #000 55%, transparent 100%); mask-image: radial-gradient(closest-side, #000 55%, transparent 100%); }
.dw-graph svg.dw-graph__lines { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.dw-node { position: absolute; display: flex; align-items: center; gap: 12px; background: var(--white); border: 1px solid var(--line); border-radius: 999px; padding: 9px 22px 9px 9px; box-shadow: 0 14px 30px -18px rgba(18,33,28,.35); min-width: 210px; transition: border-color .2s ease, box-shadow .2s ease; }
.dw-node.is-active { border-color: var(--green); box-shadow: 0 0 0 4px rgba(11,138,92,.12), 0 14px 30px -18px rgba(18,33,28,.35); }
.dw-node__dot { width: 40px; height: 40px; border-radius: 999px; display: grid; place-items: center; flex-shrink: 0; }
.dw-node__dot--done { background: var(--ink); color: #fff; }
.dw-node__dot--now { background: var(--mint); color: var(--green-deep); box-shadow: inset 0 0 0 2px var(--green); }
.dw-node__dot--later { background: var(--paper); color: var(--ink-soft); border: 1px solid var(--line); }
.dw-node__dot--bad { background: var(--clay-soft); color: var(--clay); }
.dw-node__title { font-weight: 600; font-size: 15px; line-height: 1.3; white-space: nowrap; }
.dw-node__sub { font-size: 12.5px; color: var(--ink-soft); white-space: nowrap; }

/* workflow step list */
.dw-steps { display: flex; flex-direction: column; gap: 6px; margin-top: 32px; }
.dw-step { display: grid; grid-template-columns: 36px 1fr; gap: 14px; text-align: left; padding: 14px 16px; border-radius: 16px; border: 1px solid transparent; transition: background .15s ease, border-color .15s ease; }
.dw-step:hover { background: rgba(255,255,255,.6); }
.dw-step.is-active { background: var(--white); border-color: var(--line); }
.dw-step__num { width: 36px; height: 36px; border-radius: 999px; border: 1px solid var(--line); display: grid; place-items: center; font-weight: 600; font-size: 14px; background: var(--white); }
.dw-step.is-active .dw-step__num { background: var(--ink); color: #fff; border-color: var(--ink); }
.dw-step__title { font-family: var(--display); font-weight: 700; font-size: 20px; line-height: 1.3; }
.dw-step__text { color: var(--ink-soft); font-size: 15.5px; margin-top: 4px; }

/* ---------- split sections (for reps / for managers) ---------- */
.dw-split { display: grid; grid-template-columns: 1fr 1.1fr; gap: 88px; align-items: center; }
.dw-split--flip { grid-template-columns: 1.1fr 1fr; }
.dw-split__visual { position: relative; border-radius: 26px; overflow: hidden; padding: 48px 40px; min-height: 480px; display: flex; align-items: center; justify-content: center;
  background: radial-gradient(90% 80% at 20% 10%, #CFE9D9 0%, rgba(207,233,217,0) 60%), radial-gradient(80% 80% at 90% 100%, #E7EFE2 0%, rgba(231,239,226,0) 60%), #DDEBE2; }
.dw-split__visual--dusk { background: radial-gradient(90% 80% at 80% 10%, #D9E7DF 0%, rgba(217,231,223,0) 60%), radial-gradient(80% 80% at 10% 100%, #C8DDD2 0%, rgba(200,221,210,0) 60%), #D3E3DA; }
.dw-split__text .dw-lead { margin-top: 20px; max-width: 520px; }
.dw-seelist { list-style: none; padding: 0; margin: 28px 0 0; display: flex; flex-direction: column; gap: 12px; }
.dw-seelist li { display: flex; align-items: center; gap: 12px; font-size: 17px; font-weight: 500; }
.dw-seelist__tick { width: 26px; height: 26px; border-radius: 999px; background: var(--mint); color: var(--green-deep); display: grid; place-items: center; flex-shrink: 0; }
.dw-quoteline { margin-top: 28px; padding-left: 18px; border-left: 3px solid var(--green); font-size: 17px; color: var(--ink-soft); }
.dw-quoteline strong { color: var(--ink); font-weight: 600; }
.dw-split__text .dw-btn-row { margin-top: 32px; }

.dw-card { background: var(--white); border: 1px solid var(--line); border-radius: 18px; box-shadow: 0 24px 60px -30px rgba(18,33,28,.35); width: 100%; max-width: 440px; }
.dw-card__head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid var(--line); }
.dw-row { display: flex; align-items: center; gap: 12px; padding: 12px 18px; border-bottom: 1px solid var(--line); font-size: 13.5px; }
.dw-row:last-child { border-bottom: 0; }
.dw-row.is-selected { background: var(--mint-soft); }
.dw-row__main { flex: 1; min-width: 0; }
.dw-row__name { font-weight: 600; display: flex; align-items: center; gap: 8px; }
.dw-row__preview { color: var(--ink-soft); font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dw-row__icon { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; flex-shrink: 0; }
.dw-row__count { font-family: var(--display); font-weight: 700; font-size: 20px; }
.dw-card-float { position: absolute; background: var(--white); border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; box-shadow: 0 18px 40px -18px rgba(18,33,28,.35); font-size: 13px; }

.dw-closing { margin-top: 28px; font-family: var(--display); font-weight: 700; font-size: 22px; line-height: 1.35; letter-spacing: -0.01em; }
.dw-closing span { display: block; color: var(--ink-soft); font-weight: 500; }

/* ---------- AI ---------- */
.dw-ai { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: start; margin-top: 64px; }
.dw-ask { background: var(--ink); color: #E8F0EC; border-radius: 26px; padding: 32px; }
.dw-ask__input { display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.14); border-radius: 12px; padding: 12px 14px; font-size: 15px; }
.dw-ask__chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.dw-ask__chip { padding: 8px 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,.18); font-size: 14px; color: #E8F0EC; text-align: left; transition: background .15s ease, border-color .15s ease; }
.dw-ask__chip:hover { border-color: rgba(255,255,255,.4); }
.dw-ask__chip.is-active { background: #fff; color: var(--ink); border-color: #fff; }
.dw-ask__answer { margin-top: 20px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12); border-radius: 14px; padding: 16px; font-size: 14.5px; line-height: 1.55; min-height: 150px; }
.dw-ask__answer ul { margin: 8px 0 0; padding-left: 18px; }
.dw-ask__answer li { margin: 4px 0; }
.dw-features { display: grid; grid-template-columns: 1fr 1fr; gap: 40px 36px; }
.dw-feature__icon { color: var(--green); margin-bottom: 14px; }
.dw-feature .dw-h4 { margin-bottom: 8px; }
.dw-feature p { color: var(--ink-soft); font-size: 15.5px; }
.dw-ai__tagline { grid-column: 1 / -1; text-align: center; margin-top: 16px; font-family: var(--display); font-weight: 700; font-size: 26px; line-height: 1.35; letter-spacing: -0.01em; }
.dw-ai__tagline span { display: block; color: var(--ink-soft); }

/* ---------- before/after ---------- */
.dw-ba { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 56px; }
.dw-ba__col { border-radius: 26px; padding: 40px; border: 1px solid var(--line); }
.dw-ba__col--before { background: var(--paper); }
.dw-ba__col--after { background: var(--white); border-color: #BFDCCB; box-shadow: 0 0 0 6px var(--mint-soft); }
.dw-ba__list { list-style: none; padding: 0; margin: 24px 0 0; display: flex; flex-direction: column; gap: 14px; }
.dw-ba__list li { display: grid; grid-template-columns: 26px 1fr; gap: 12px; font-size: 16.5px; line-height: 1.5; }
.dw-ba__mark { width: 26px; height: 26px; border-radius: 999px; display: grid; place-items: center; margin-top: 0; }
.dw-ba__col--before .dw-ba__mark { background: var(--clay-soft); color: var(--clay); }
.dw-ba__col--before li { color: var(--ink-soft); }
.dw-ba__col--after .dw-ba__mark { background: var(--mint); color: var(--green-deep); }
.dw-ba__foot { text-align: center; margin-top: 40px; font-size: 19px; color: var(--ink-soft); }

/* ---------- agencies radial ---------- */
.dw-radial { position: relative; margin-top: 56px; border-radius: 28px; overflow: hidden; height: 520px; border: 1px solid var(--line);
  background: radial-gradient(circle at 50% 50%, #CDEBD7 0%, #E4F3E9 35%, #F3F9F4 65%, #FAFCFA 100%); }
.dw-radial__rings { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); }
.dw-radial__ring { position: absolute; left: 50%; top: 50%; border-radius: 999px; transform: translate(-50%, -50%); border: 1px solid rgba(11,138,92,.14); background: rgba(11,138,92,.035); }
.dw-radial__core { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 124px; height: 124px; border-radius: 999px; background: var(--ink); display: grid; place-items: center; box-shadow: 0 0 0 10px rgba(255,255,255,.55), 0 20px 50px -10px rgba(18,33,28,.45); }
.dw-radial__pill { position: absolute; transform: translate(-50%, -50%); display: inline-flex; align-items: center; gap: 10px; background: var(--white); border: 1px solid var(--line); border-radius: 999px; padding: 12px 20px; font-weight: 500; font-size: 16px; white-space: nowrap; box-shadow: 0 10px 24px -14px rgba(18,33,28,.4); }
.dw-radial__pill svg { color: var(--green); }
.dw-radial__mobile { display: none; }
.dw-agency-q { text-align: center; margin-top: 44px; }
.dw-agency-q p:first-child { color: var(--ink-soft); font-size: 17px; }
.dw-agency-q p:last-child { font-family: var(--display); font-weight: 700; font-size: 26px; margin-top: 10px; letter-spacing: -0.01em; }

/* ---------- onboarding ---------- */
.dw-onb { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 64px; position: relative; }
.dw-onb__step { position: relative; background: var(--white); border: 1px solid var(--line); border-radius: 22px; padding: 32px; }
.dw-onb__num { width: 44px; height: 44px; border-radius: 999px; background: var(--ink); color: #fff; display: grid; place-items: center; font-weight: 600; margin-bottom: 26px; }
.dw-onb__step:nth-child(1) .dw-onb__num { background: var(--ink); }
.dw-onb__step .dw-h4 { margin-bottom: 8px; }
.dw-onb__foot { display: flex; align-items: center; justify-content: center; gap: 20px; flex-wrap: wrap; margin-top: 40px; }
.dw-onb__foot p { font-size: 17px; color: var(--ink-soft); }

/* ---------- migration band ---------- */
.dw-migrate { display: grid; grid-template-columns: 1.3fr 1fr; gap: 48px; align-items: center; background: var(--mint-soft); border: 1px solid #CFE6D8; border-radius: 28px; padding: 56px 64px; }
.dw-migrate__good { font-family: var(--display); font-weight: 700; font-size: 26px; margin-top: 18px; }
.dw-migrate__list { display: flex; flex-direction: column; gap: 12px; }
.dw-migrate__item { display: flex; align-items: center; gap: 12px; background: var(--white); border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; font-weight: 500; }
.dw-migrate__item svg { color: var(--green); }

/* ---------- proof ---------- */
.dw-proof { display: grid; grid-template-columns: 1.2fr 1fr; gap: 0; margin-top: 56px; border: 1px solid var(--line); border-radius: 28px; overflow: hidden; }
.dw-proof__quote { padding: 56px; background: var(--white); display: flex; flex-direction: column; justify-content: space-between; gap: 32px; }
.dw-proof__quote blockquote { margin: 0; font-family: var(--display); font-weight: 700; font-size: 28px; line-height: 1.35; letter-spacing: -0.01em; }
.dw-proof__logo { height: 36px; width: 140px; border-radius: 8px; border: 1px dashed #BAC4BD; display: grid; place-items: center; font-size: 12px; color: var(--ink-soft); }
.dw-proof__facts { background: var(--paper); padding: 56px 48px; display: flex; flex-direction: column; gap: 26px; border-left: 1px solid var(--line); }
.dw-proof__fact dt { font-size: 14px; color: var(--ink-soft); font-weight: 500; }
.dw-proof__fact dd { margin: 4px 0 0; font-size: 17px; font-weight: 500; }

/* ---------- pricing ---------- */
.dw-plans { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 56px; align-items: stretch; }
.dw-plan { position: relative; background: var(--white); border: 1px solid var(--line); border-radius: 24px; padding: 28px 26px 24px; display: flex; flex-direction: column; box-shadow: var(--shadow); }
.dw-plan.is-popular { border: 2px solid var(--ink); padding: 27px 25px 23px; background: linear-gradient(180deg, var(--mint-soft) 0%, var(--white) 148px); }
.dw-plan__badge { position: absolute; top: -12px; left: 24px; background: var(--ink); color: #fff; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 999px; }
.dw-plan__badge--soft { background: var(--mint); color: var(--green-deep); }
.dw-plan__name { font-family: var(--display); font-weight: 700; font-size: 22px; }
.dw-plan__for { color: var(--ink-soft); font-size: 14.5px; line-height: 1.45; margin-top: 8px; min-height: 42px; }
.dw-plan__price { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px; margin-top: 20px; }
.dw-plan__amount { font-family: var(--display); font-weight: 700; font-size: 40px; letter-spacing: -0.03em; line-height: 1; }
.dw-plan.is-popular .dw-plan__amount { color: var(--green-deep); }
.dw-plan__per { color: var(--ink-soft); font-size: 15px; }
.dw-plan__was { color: var(--ink-soft); font-size: 15px; text-decoration: line-through; margin-left: 2px; }
.dw-plan__facts { list-style: none; padding: 0; margin: 22px 0 18px; display: flex; flex-direction: column; border-top: 1px solid var(--line); }
.dw-plan__facts li { display: flex; justify-content: space-between; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--line); font-size: 14.5px; }
.dw-plan__facts li span:first-child { color: var(--ink-soft); }
.dw-plan__facts li span:last-child { font-weight: 600; text-align: right; }
.dw-plan__facts li.is-save span:last-child { color: var(--green-deep); }
.dw-plan__facts li.is-total { font-size: 15.5px; }
.dw-plan__facts li.is-total span { color: var(--ink); font-weight: 700; }
.dw-plan .dw-btn { width: 100%; margin-top: auto; }
.dw-plan__trial { text-align: center; font-size: 13px; color: var(--ink-soft); margin-top: 10px; }

.dw-table-wrap { margin-top: 56px; border: 1px solid var(--line); border-radius: 24px; overflow-x: auto; background: var(--white); }
.dw-table { width: 100%; border-collapse: collapse; min-width: 760px; font-size: 15px; }
.dw-table caption { text-align: left; padding: 24px 28px 8px; font-family: var(--display); font-weight: 700; font-size: 22px; }
.dw-table th, .dw-table td { padding: 15px 28px; text-align: left; border-bottom: 1px solid var(--line); vertical-align: top; }
.dw-table thead th { font-family: var(--display); font-weight: 700; font-size: 18px; background: var(--white); }
.dw-table tbody th { font-weight: 500; color: var(--ink-soft); width: 26%; }
.dw-table tbody tr:last-child th, .dw-table tbody tr:last-child td { border-bottom: 0; }
.dw-table td.is-shared { color: var(--ink); }
.dw-table .dw-muted { color: var(--ink-soft); }

.dw-meta-note { display: grid; grid-template-columns: 48px 1fr; gap: 18px; margin-top: 24px; background: var(--mint-soft); border: 1px solid #CFE6D8; border-radius: 20px; padding: 24px 28px; }
.dw-meta-note__icon { width: 48px; height: 48px; border-radius: 14px; background: var(--white); border: 1px solid var(--line); display: grid; place-items: center; color: var(--green); }
.dw-meta-note p { color: var(--ink-soft); font-size: 15.5px; }
.dw-meta-note strong { color: var(--ink); }

/* ---------- founder ---------- */
.dw-founder { display: grid; grid-template-columns: auto 1fr; gap: 40px; align-items: center; max-width: 920px; margin: 0 auto; }
.dw-founder__faces { display: flex; }
.dw-founder__faces .dw-avatar { width: 72px; height: 72px; font-size: 20px; border: 4px solid var(--white); }
.dw-founder__faces .dw-avatar + .dw-avatar { margin-left: -18px; }
.dw-founder__sig { margin-top: 18px; font-weight: 600; color: var(--green-deep); }

/* ---------- FAQ ---------- */
.dw-faq { max-width: 780px; margin: 56px auto 0; border-top: 1px solid var(--line); }
.dw-faq__item { border-bottom: 1px solid var(--line); }
.dw-faq__q { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 24px; text-align: left; padding: 24px 4px; font-family: var(--display); font-weight: 700; font-size: 19px; line-height: 1.4; }
.dw-faq__q svg { flex-shrink: 0; transition: transform .2s ease; color: var(--ink-soft); }
.dw-faq__item.is-open .dw-faq__q svg { transform: rotate(180deg); }
.dw-faq__a { padding: 0 4px 26px; color: var(--ink-soft); max-width: 680px; }

/* ---------- final CTA ---------- */
.dw-final { position: relative; overflow: hidden; background: var(--ink); color: #fff; border-radius: 32px; padding: 96px 48px; text-align: center; isolation: isolate; }
.dw-final__pattern { position: absolute; inset: 0; z-index: -1; color: #fff; opacity: .06; }
.dw-final__glow { position: absolute; inset: auto 0 -40% 0; height: 90%; z-index: -1; background: radial-gradient(50% 60% at 50% 100%, rgba(31,168,114,.45) 0%, rgba(31,168,114,0) 70%); }
.dw-final .dw-h2-sub { color: #A9C2B7; }
.dw-final__lines { display: flex; justify-content: center; flex-wrap: wrap; gap: 10px 28px; margin: 36px auto 0; max-width: 760px; font-size: 16.5px; color: #D5E3DC; }
.dw-final__lines span { display: inline-flex; align-items: center; gap: 8px; }
.dw-final__lines svg { color: #5FD3A1; }
.dw-final .dw-btn-row { margin-top: 40px; }
.dw-final .dw-reassure { color: #A9C2B7; }
.dw-final .dw-reassure svg { color: #5FD3A1; }

/* ---------- footer ---------- */
.dw-footer { border-top: 1px solid var(--line); padding-block: 64px 32px; margin-top: 120px; }
.dw-footer__grid { display: grid; grid-template-columns: 1.6fr repeat(3, 1fr); gap: 40px; }
.dw-footer__col h4 { font-family: var(--display); font-weight: 700; font-size: 18px; margin-bottom: 14px; }
.dw-footer__col a { display: block; color: var(--ink-soft); font-size: 15px; padding: 5px 0; }
.dw-footer__col a:hover { color: var(--ink); }
.dw-footer__legal { display: flex; justify-content: space-between; gap: 24px; flex-wrap: wrap; border-top: 1px solid var(--line); margin-top: 48px; padding-top: 24px; font-size: 13.5px; color: var(--ink-soft); }

/* ---------- modal ---------- */
.dw-modal { position: fixed; inset: 0; z-index: 70; background: rgba(12,21,18,.7); display: grid; place-items: center; padding: 24px; }
.dw-modal__box { position: relative; width: min(960px, 100%); background: var(--ink); border-radius: 20px; overflow: hidden; }
.dw-modal__close { position: absolute; top: 12px; right: 12px; width: 40px; height: 40px; border-radius: 999px; background: rgba(255,255,255,.12); color: #fff; display: grid; place-items: center; z-index: 2; }
.dw-modal__video { aspect-ratio: 16 / 9; width: 100%; display: grid; place-items: center; color: #CFE0D8; text-align: center; padding: 24px; }
.dw-modal__video iframe { width: 100%; height: 100%; border: 0; }

/* ---------- responsive ---------- */
@media (max-width: 1080px) {
  .dw-float--left { left: -12px; }
  .dw-panel { padding: 48px; }
  .dw-split, .dw-split--flip { gap: 56px; }
}
@media (max-width: 960px) {
  .dw-section { padding-block: 88px; }
  .dw-nav__links, .dw-nav__login { display: none; }
  .dw-nav__burger { display: inline-flex; }
  .dw-h1 { font-size: 46px; }
  .dw-h2 { font-size: 34px; }
  .dw-h2-sub { font-size: 22px; }
  .dw-app { grid-template-columns: 1fr; }
  .dw-app__side { display: none; }
  .dw-app__work { grid-template-columns: 1fr; }
  .dw-leadcard { display: none; }
  .dw-float--left { display: none; }
  .dw-panel { grid-template-columns: 1fr; padding: 36px 28px; }
  .dw-graph { min-height: 400px; }
  .dw-split, .dw-split--flip { grid-template-columns: 1fr; gap: 40px; }
  .dw-ai { grid-template-columns: 1fr; }
  .dw-ba { grid-template-columns: 1fr; }
  .dw-onb { grid-template-columns: 1fr; }
  .dw-migrate { grid-template-columns: 1fr; padding: 40px 28px; }
  .dw-proof { grid-template-columns: 1fr; }
  .dw-proof__facts { border-left: 0; border-top: 1px solid var(--line); }
  .dw-founder { grid-template-columns: 1fr; text-align: center; justify-items: center; }
  .dw-footer__grid { grid-template-columns: 1fr 1fr; }
  .dw-radial { height: auto; padding: 48px 20px; }
  .dw-radial__rings, .dw-radial__pill, .dw-radial__core { display: none; }
  .dw-radial__mobile { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
  .dw-radial__mobile .dw-radial__pill { display: inline-flex; position: static; transform: none; }
}
@media (max-width: 780px) {
  .dw-plans { grid-template-columns: 1fr; max-width: 420px; margin-inline: auto; }
  .dw-plan__for { min-height: 0; }
}
@media (max-width: 640px) {
  .dw-section { padding-block: 72px; }
  .dw-h1 { font-size: 36px; }
  .dw-h2 { font-size: 28px; }
  .dw-h3 { font-size: 22px; }
  .dw-lead { font-size: 17px; }
  .dw-btn-row .dw-btn { width: 100%; }
  .dw-app__stats { grid-template-columns: 1fr 1fr; }
  .dw-app__stats .dw-stat:nth-child(3) { display: none; }
  .dw-convo__head .dw-chip { display: none; }
  .dw-split__visual { padding: 28px 16px; min-height: 0; }
  .dw-features { grid-template-columns: 1fr; }
  .dw-ba__col { padding: 28px 22px; }
  .dw-proof__quote, .dw-proof__facts { padding: 32px 24px; }
  .dw-proof__quote blockquote { font-size: 22px; }
  .dw-final { padding: 64px 22px; border-radius: 24px; }
  .dw-footer__grid { grid-template-columns: 1fr; }
  .dw-node { min-width: 0; padding-right: 16px; }
  .dw-graph { min-height: 0; display: flex; flex-direction: column; gap: 12px; }
  .dw-graph .dw-node { position: static; }
  .dw-graph svg.dw-graph__lines, .dw-graph__grid { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .dw *, .dw *::before, .dw *::after { animation: none !important; transition: none !important; }
}
`;

/* ============================================================
   CONTENT — edit copy here
   ============================================================ */

const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "For managers", href: "#managers" },
  { label: "AI", href: "#ai" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

const FAQS = [
  {
    q: "Is Dorway just a WhatsApp shared inbox?",
    a: "No. Conversations are one part of Dorway. The CRM layer adds lead ownership, pipeline stages, follow-ups, team visibility and sales context around those conversations.",
  },
  {
    q: "Does Dorway use the official WhatsApp Business Platform?",
    // TODO(launch): confirm this matches the real implementation. Do not claim BSP / Meta partner status unless you have it.
    a: "Yes. You connect your own WhatsApp Business Account through Meta's official sign-up flow, inside Dorway. The number and the account stay in your name, and if you ever leave, you keep both.",
  },
  {
    q: "Can multiple salespeople use Dorway?",
    a: "Yes. Dorway is designed for teams where several people handle incoming leads from the same WhatsApp Business number. Every lead has one owner, and everyone can see who that is.",
  },
  {
    q: "What happens when a salesperson leaves?",
    a: "You remove their access and every conversation stays in the shared workspace, where their replacement picks it up. Because chats run through your business number rather than someone's personal phone, nothing walks out the door.",
  },
  {
    q: "Will customers know we're using a CRM?",
    a: "No. Your customer keeps having a normal WhatsApp conversation with your business. Dorway is the workspace your team uses behind the scenes.",
  },
  {
    q: "What do WhatsApp messages cost?",
    // TODO(launch): verify against Meta's current pricing page. Meta's rules for in-window replies changed on 1 Oct 2026 — do not imply any message type is free.
    a: "Meta charges for WhatsApp messages separately from your Dorway plan, at rates that vary by country and message type. You pay Meta directly from your own account, at their published rates. We don't resell or mark up messaging, and your usage is visible inside Dorway.",
  },
  {
    q: "Do I need to change the way my entire team works?",
    a: "That's exactly what we're trying to avoid. Dorway sits around the way your salespeople already sell on WhatsApp, instead of asking them to keep a separate reporting workflow up to date.",
  },
  {
    q: "We already use a CRM. Why would we need Dorway?",
    a: "If your current CRM already captures your WhatsApp conversations, ownership and follow-ups well, you may not. Dorway is most useful when the sales conversation happens on WhatsApp while the sales process is tracked somewhere else, or not tracked consistently at all.",
  },
  {
    q: "Is Dorway only for agencies?",
    a: "Agencies are our first focus because their sales workflows make this problem especially visible. Dorway also works for any team that receives and closes a meaningful amount of business on WhatsApp.",
  },
  {
    q: "Can you help us set everything up?",
    a: "Yes. Early customers get hands-on help setting up their first pipeline, owners and follow-up process, and getting the team live.",
  },
  {
    q: "What happens after I pay?",
    a: "Our team reviews your account and WhatsApps you within 1 working day to book a setup call. Your term starts on launch day, not the day you pay.",
  },
  {
    q: "Can I try it before paying?",
    a: "Create an account to see the locked workspace. Purchase a plan to unlock Dorway and connect your real WhatsApp number.",
  },
];

/* ============================================================
   PRIMITIVES
   ============================================================ */

const AVATAR_COLORS = ["#0B8A5C", "#3C6E91", "#7A5A9E", "#C98A2E", "#B24A3F", "#2F4F46"];
function Avatar({ name, i = 0, size }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return (
    <span className={`dw-avatar ${size === "sm" ? "dw-avatar--sm" : ""}`} style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }} aria-hidden="true">
      {initials}
    </span>
  );
}

/** Doorway mark: used in logo, app mockups, radial core. */
function Mark({ size = 36 }) {
  return (
    <img
      src="/logo.png"
      width={size}
      height={size}
      alt=""
      style={{ display: "block", borderRadius: size * 0.275, objectFit: "contain" }}
    />
  );
}

function Logo() {
  return (
    <a href="#top" className="dw-logo" aria-label={`${CONFIG.brand} home`}>
      <Mark size={38} />
      <span>{CONFIG.brand.toLowerCase()}</span>
    </a>
  );
}

/** Tiled doorway-arch pattern, the page's signature texture (hero + final CTA). */
function ArchPattern({ className, id }) {
  return (
    <svg className={className} aria-hidden="true" width="100%" height="100%">
      <defs>
        <pattern id={id} width="64" height="72" patternUnits="userSpaceOnUse">
          <path d="M14 62V32a18 18 0 0 1 36 0v30" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
          <path d="M46 26V-4a18 18 0 0 1 36 0v30" transform="translate(-64 0)" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

function PrimaryCTA({ className = "" }) {
  return <a href={CONFIG.cta.primary.href} className={`dw-btn dw-btn--primary ${className}`}>{CONFIG.cta.primary.label}</a>;
}
function DemoCTA({ onOpen, className = "dw-btn--ghost" }) {
  return (
    <button type="button" onClick={onOpen} className={`dw-btn ${className}`}>
      <Play size={16} fill="currentColor" />{CONFIG.cta.secondary.label}
    </button>
  );
}
function SetupCTA({ className = "dw-btn--ghost" }) {
  return <a href={CONFIG.cta.setup.href} className={`dw-btn ${className}`}><Headphones size={17} />{CONFIG.cta.setup.label}</a>;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = (e) => setReduced(e.matches);
    mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
    return () => (mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on));
  }, []);
  return reduced;
}

/* ============================================================
   NAV
   ============================================================ */

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={`dw-nav ${scrolled ? "is-scrolled" : ""}`}>
      <div className="dw-wrap dw-nav__inner">
        <Logo />
        <nav className="dw-nav__links" aria-label="Main">
          {NAV_LINKS.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
        </nav>
        <div className="dw-nav__right">
          <a className="dw-nav__login" href={CONFIG.cta.login.href}>{CONFIG.cta.login.label}</a>
          <PrimaryCTA className="dw-btn--sm" />
          <button className="dw-nav__burger" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
        </div>
      </div>
      {open && (
        <div className="dw-drawer" onClick={() => setOpen(false)}>
          <div className="dw-drawer__panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Menu">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Logo />
              <button className="dw-nav__burger" style={{ display: "inline-flex" }} onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button>
            </div>
            {NAV_LINKS.map((l) => <a key={l.href} className="dw-drawer__link" href={l.href} onClick={() => setOpen(false)}>{l.label}</a>)}
            <a className="dw-drawer__link" href={CONFIG.cta.login.href}>{CONFIG.cta.login.label}</a>
            <PrimaryCTA />
          </div>
        </div>
      )}
    </header>
  );
}

/* ============================================================
   HERO
   ============================================================ */

const HERO_THREAD = [
  { dir: "in", text: "Hi, saw your ad. What's the price for a 2BHK modular kitchen?", time: "7:42 PM" },
  { dir: "out", text: "Hi Neha! Packages start at ₹1.8L including installation. Shall I send the catalogue?", time: "7:43 PM" },
  { dir: "in", text: "Yes please. Can someone visit this Saturday?", time: "7:51 PM" },
  { dir: "out", text: "Done. Saturday 11 AM works. Priya will confirm the visit tonight.", time: "7:52 PM" },
];

function HeroMockup() {
  const reduced = usePrefersReducedMotion();
  // step: how many messages are visible; status flips once the last reply is sent.
  const [step, setStep] = useState(2);
  useEffect(() => {
    if (reduced) { setStep(5); return; }
    const t = [
      setTimeout(() => setStep(3), 900),
      setTimeout(() => setStep(4), 1500),
      setTimeout(() => setStep(5), 2100),
    ];
    return () => t.forEach(clearTimeout);
  }, [reduced]);
  const contacted = step >= 5;

  return (
    <div className="dw-frame" role="img" aria-label="Dorway workspace showing a WhatsApp conversation with a new lead, its owner and status">
      <div className="dw-app">
        <aside className="dw-app__side">
          <div className="dw-app__brand"><Mark size={24} /> dorway</div>
          <div className="dw-app__nav is-active"><Inbox size={16} /> Inbox <span className="dw-app__count">12</span></div>
          <div className="dw-app__nav"><Users size={16} /> Leads</div>
          <div className="dw-app__nav"><GitBranch size={16} /> Pipeline</div>
          <div className="dw-app__nav"><CalendarClock size={16} /> Follow-ups</div>
          <div className="dw-app__nav"><Megaphone size={16} /> Campaigns</div>
          <div className="dw-app__nav"><Sparkles size={16} /> Ask Dorway</div>
          <div style={{ marginTop: "auto", padding: "10px", borderRadius: 10, background: "var(--mint-soft)", border: "1px solid #CFE6D8", fontSize: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}><Shuffle size={13} /> Round-robin on</div>
            <div style={{ color: "var(--ink-soft)", marginTop: 2 }}>Next lead goes to Arjun</div>
          </div>
        </aside>

        <div className="dw-app__main">
          <div className="dw-app__top">
            <div>
              <div className="dw-app__greet">Good evening, Kapoor Interiors</div>
              <div className="dw-small" style={{ fontSize: 12.5 }}>Here's what needs attention before you log off</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--ink-soft)" }}>
              <Search size={16} /><BellRing size={16} />
              <Avatar name="Rohan Kapoor" i={5} size="sm" />
            </div>
          </div>

          <div className="dw-app__stats">
            <div className="dw-stat">
              <div className="dw-stat__label"><span className="dw-stat__icon" style={{ background: "var(--mint)", color: "var(--green-deep)" }}><UserPlus size={12} /></span>New leads today</div>
              <div className="dw-stat__num">18</div>
            </div>
            <div className="dw-stat">
              <div className="dw-stat__label"><span className="dw-stat__icon" style={{ background: "var(--amber-soft)", color: "#8A5A15" }}><CalendarClock size={12} /></span>Follow-ups due</div>
              <div className="dw-stat__num">7</div>
            </div>
            <div className="dw-stat">
              <div className="dw-stat__label"><span className="dw-stat__icon" style={{ background: "var(--clay-soft)", color: "var(--clay)" }}><UserX size={12} /></span>No owner</div>
              <div className="dw-stat__num">0</div>
            </div>
          </div>

          <div className="dw-app__work">
            <div className="dw-convo">
              <div className="dw-convo__head">
                <Avatar name="Neha Sharma" i={1} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>Neha Sharma</div>
                  <div className="dw-mono" style={{ color: "var(--ink-soft)", fontSize: 11.5 }}>+91 98XXX 41207</div>
                </div>
                <span className="dw-chip dw-chip--grey dw-mono" style={{ marginLeft: "auto", fontSize: 11 }}><Clock size={11} /> 23:41 left in window</span>
              </div>
              <div className="dw-convo__body">
                {HERO_THREAD.map((m, idx) => {
                  const visible = idx < step;
                  const entering = visible && idx >= 2 && !reduced;
                  return (
                    <div key={idx} className={`dw-bubble dw-bubble--${m.dir} ${visible ? "" : "is-hidden"} ${entering ? "is-entering" : ""}`}>
                      {m.text}
                      <div className="dw-bubble__meta">{m.time}{m.dir === "out" && <CheckCheck size={13} color="#3C8FD6" />}</div>
                    </div>
                  );
                })}
              </div>
              <div className="dw-composer">
                <div className="dw-composer__field">Type a reply…</div>
                <div className="dw-composer__send"><Send size={15} /></div>
              </div>
            </div>

            <div className="dw-leadcard">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: 13 }}>Lead</strong>
                <span className={`dw-chip dw-status-flip ${contacted ? "dw-chip--amber" : "dw-chip--green"}`} aria-live="polite">
                  {contacted ? "Site visit booked" : "New"}
                </span>
              </div>
              <div className="dw-kv"><span>Source</span><span>Click-to-WhatsApp ad</span></div>
              <div className="dw-kv"><span>Interest</span><span>2BHK kitchen</span></div>
              <div className="dw-kv"><span>Owner</span><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Avatar name="Priya Nair" i={0} size="sm" /> Priya</span></div>
              <div className="dw-kv"><span>Next follow-up</span><span className="dw-mono">Sat 11:00</span></div>
              <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
                <div style={{ display: "flex", gap: 8 }}><CircleCheck size={14} color="var(--green)" /> Assigned to Priya · 7:42 PM</div>
                <div style={{ display: "flex", gap: 8 }}><CircleCheck size={14} color="var(--green)" /> First reply in 1 min</div>
                <div style={{ display: "flex", gap: 8, color: contacted ? "var(--ink)" : "var(--ink-soft)" }}>
                  {contacted ? <CircleCheck size={14} color="var(--green)" /> : <Clock size={14} />} Visit reminder scheduled
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   HERO VIDEO — plays muted in the product frame, pauses when off
   screen, falls back to the static mockup if the video fails.
   ------------------------------------------------------------ */
function HeroVideo({ onExpand }) {
  const wrapRef = useRef(null);
  const videoRef = useRef(null);
  const barRef = useRef(null);
  const wantPlay = useRef(true);
  const reduced = usePrefersReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true; // React doesn't always reflect `muted` to the DOM; autoplay needs it.
    if (reduced) { wantPlay.current = false; v.pause(); return; }
    wantPlay.current = true;
    if (!("IntersectionObserver" in window)) { v.play().catch(() => {}); return; }
    const io = new IntersectionObserver(([en]) => {
      if (en.isIntersecting && wantPlay.current) v.play().catch(() => {});
      else v.pause();
    }, { threshold: 0.25 });
    io.observe(v);
    return () => io.disconnect();
  }, [reduced]);

  const togglePlay = () => {
    const v = videoRef.current; if (!v) return;
    if (v.paused) { wantPlay.current = true; v.play().catch(() => {}); }
    else { wantPlay.current = false; v.pause(); }
  };
  const toggleMute = () => {
    const v = videoRef.current; if (!v) return;
    v.muted = !v.muted; setMuted(v.muted);
  };
  const onMeta = (e) => {
    const v = e.currentTarget;
    if (v.videoWidth && v.videoHeight && wrapRef.current) wrapRef.current.style.aspectRatio = `${v.videoWidth} / ${v.videoHeight}`;
    setReady(true);
  };
  const onTime = (e) => {
    const v = e.currentTarget;
    if (barRef.current && v.duration) barRef.current.style.transform = `scaleX(${v.currentTime / v.duration})`;
  };

  if (failed) return <HeroMockup />;

  return (
    <div className="dw-frame dw-frame--video">
      <div className="dw-video" ref={wrapRef}>
        {!ready && <div className="dw-video__loading" aria-hidden="true" />}
        <video
          ref={videoRef}
          className={ready ? "is-ready" : ""}
          src={CONFIG.heroVideo}
          poster={CONFIG.heroPoster || undefined}
          muted loop playsInline autoPlay={!reduced} preload="auto"
          onLoadedMetadata={onMeta}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={onTime}
          onError={() => setFailed(true)}
          onClick={togglePlay}
          aria-label={`${CONFIG.brand} product tour: a WhatsApp lead being captured, assigned and followed up`}
        />
        <div className="dw-video__bar">
          <span className="dw-video__tag"><span className={`dw-live-dot ${playing ? "is-on" : ""}`} />Product tour</span>
          <div className="dw-video__ctrls">
            <button type="button" onClick={togglePlay} aria-label={playing ? "Pause video" : "Play video"}>
              {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
            </button>
            <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute video" : "Mute video"}>
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <button type="button" onClick={onExpand} aria-label="Open full demo">
              <Maximize2 size={15} />
            </button>
          </div>
        </div>
        <div className="dw-video__progress" aria-hidden="true"><span ref={barRef} /></div>
      </div>
    </div>
  );
}

/* Floating notifications that cycle next to the product frame. Click to see the next one. */
const HERO_EVENTS = [
  { icon: <Zap size={18} />, title: "New lead assigned", text: "Neha Sharma went to Priya" },
  { icon: <CalendarClock size={18} />, title: "Follow-up sent", text: "Day 2 reminder to Vikram Joshi" },
  { icon: <Target size={18} />, title: "Deal moved to Won", text: "Farah Khan, ₹2.4L kitchen" },
];

function Hero({ onDemo }) {
  const heroRef = useRef(null);
  const raf = useRef(0);
  const reduced = usePrefersReducedMotion();
  const [evt, setEvt] = useState(0);
  const [holdEvents, setHoldEvents] = useState(false);

  useEffect(() => {
    if (reduced || holdEvents) return;
    const t = setInterval(() => setEvt((e) => (e + 1) % HERO_EVENTS.length), 3800);
    return () => clearInterval(t);
  }, [reduced, holdEvents]);

  // Cursor-driven tilt, parallax and spotlight. Mouse only; touch and reduced motion get a still hero.
  const onMove = (e) => {
    if (reduced || e.pointerType !== "mouse") return;
    const el = heroRef.current; if (!el) return;
    const { clientX: x, clientY: y } = e;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--px", ((x - r.left) / r.width - 0.5).toFixed(3));
      el.style.setProperty("--py", ((y - r.top) / r.height - 0.5).toFixed(3));
      el.style.setProperty("--sx", `${Math.round(x - r.left)}px`);
      el.style.setProperty("--sy", `${Math.round(y - r.top)}px`);
      el.classList.add("is-pointer");
    });
  };
  const onLeave = () => {
    const el = heroRef.current; if (!el) return;
    cancelAnimationFrame(raf.current);
    el.style.setProperty("--px", "0");
    el.style.setProperty("--py", "0");
    el.classList.remove("is-pointer");
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const ev = HERO_EVENTS[evt];

  return (
    <section className="dw-hero" id="top" ref={heroRef} onPointerMove={onMove} onPointerLeave={onLeave}>
      <div className="dw-hero__bg" aria-hidden="true">
        <ArchPattern className="dw-hero__pattern" id="dw-arch-hero" />
      </div>
      <div className="dw-hero__spot" aria-hidden="true" />
      <div className="dw-wrap">
        <div className="dw-hero__head">
          <span className="dw-pill dw-hero__eyebrow" style={{ marginBottom: 28 }}><Briefcase size={16} /> WhatsApp-first CRM for agencies and sales teams</span>
          <h1 className="dw-h1">Stop losing sales leads between your team's WhatsApp chats.</h1>
          <p className="dw-lead">
            {CONFIG.brand} gives your whole sales team one place to capture WhatsApp leads, assign ownership, manage conversations, track follow-ups and know exactly what needs attention next.
          </p>
          <div className="dw-btn-row" style={{ justifyContent: "center" }}>
            <PrimaryCTA />
            <DemoCTA onOpen={onDemo} />
          </div>
          <div className="dw-reassure">
            {CONFIG.reassurance.map((r) => <span key={r}><Check size={15} strokeWidth={2.5} />{r}</span>)}
          </div>
        </div>

        <div className="dw-hero__stage">
          <div className="dw-tilt">
            <HeroVideo onExpand={onDemo} />
          </div>

          <button
            type="button"
            className="dw-float dw-float--left"
            onClick={() => setEvt((e) => (e + 1) % HERO_EVENTS.length)}
            onMouseEnter={() => setHoldEvents(true)}
            onMouseLeave={() => setHoldEvents(false)}
            aria-label={`${ev.title}: ${ev.text}. Show next update`}
          >
            <span className="dw-float__icon">{ev.icon}</span>
            <span key={evt} className="dw-float__text">
              <span style={{ display: "block", fontWeight: 600 }}>{ev.title}</span>
              <span style={{ display: "block", color: "var(--ink-soft)", fontSize: 12.5 }}>{ev.text}</span>
            </span>
            <span className="dw-float__dots" aria-hidden="true">
              {HERO_EVENTS.map((_, i) => <span key={i} className={i === evt ? "is-on" : ""} />)}
            </span>
          </button>

          <div className="dw-float dw-float--right" aria-hidden="true">
            <span className="dw-float__faces">
              <Avatar name="Priya Nair" i={0} size="sm" />
              <Avatar name="Arjun Rao" i={2} size="sm" />
              <Avatar name="Rahul Das" i={4} size="sm" />
              <Avatar name="Aman Gill" i={3} size="sm" />
            </span>
            <span>
              <span style={{ display: "block", fontWeight: 600 }}>Round-robin on</span>
              <span style={{ display: "block", color: "var(--ink-soft)", fontSize: 12.5 }}>Next lead goes to Arjun</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}


const STYLES_TIMELINE = `
.dw-graph { min-height: 0; padding: 12px 0; }
.dw-tl { position: relative; padding: 8px 0; }
.dw-tl::before { content: ""; position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: #A9BBB2; }
.dw-tl__row { position: relative; display: grid; grid-template-columns: 1fr 1fr; align-items: center; min-height: 88px; }
.dw-tl__row::after { content: ""; position: absolute; left: 50%; top: 50%; width: 9px; height: 9px; background: var(--paper); border: 1px solid #6F857B; transform: translate(-50%, -50%) rotate(45deg); }
.dw-tl__arm { position: absolute; top: 50%; height: 1px; width: 24px; background: #A9BBB2; }
.dw-tl__arm--l { right: 50%; }
.dw-tl__arm--r { left: 50%; }
.dw-tl__row .dw-node { position: relative; min-width: 0; max-width: 260px; }
.dw-tl__row--l .dw-node { grid-column: 1; justify-self: end; margin-right: 24px; }
.dw-tl__row--r .dw-node { grid-column: 2; justify-self: start; margin-left: 24px; }
button.dw-node { font: inherit; text-align: left; cursor: pointer; }
@media (max-width: 640px) {
  .dw-tl::before { left: 18px; }
  .dw-tl__row { grid-template-columns: 1fr; min-height: 76px; }
  .dw-tl__row::after { left: 18px; }
  .dw-tl__arm, .dw-tl__arm--l, .dw-tl__arm--r { left: 18px; right: auto; width: 26px; }
  .dw-tl__row--l .dw-node, .dw-tl__row--r .dw-node { grid-column: 1; justify-self: start; margin: 0 0 0 44px; }
}
`;

/** Alternating vertical timeline of pill nodes (Concentro-style). */
function Timeline({ items, activeIndex, onSelect }) {
  return (
    <div className="dw-graph">
      <div className="dw-graph__grid" aria-hidden="true" />
      <div className="dw-tl">
        {items.map((it, i) => {
          const side = i % 2 === 0 ? "r" : "l";
          const Tag = onSelect ? "button" : "div";
          return (
            <div key={it.title} className={`dw-tl__row dw-tl__row--${side}`}>
              <span className={`dw-tl__arm dw-tl__arm--${side}`} aria-hidden="true" />
              <Tag
                className={`dw-node ${activeIndex === i ? "is-active" : ""}`}
                {...(onSelect ? { type: "button", onClick: () => onSelect(i), "aria-pressed": activeIndex === i } : {})}
              >
                <span className={`dw-node__dot dw-node__dot--${it.state}`}>{it.icon}</span>
                <span>
                  <span className="dw-node__title" style={{ display: "block" }}>{it.title}</span>
                  <span className="dw-node__sub">{it.sub}</span>
                </span>
              </Tag>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   TRUST BAR
   ============================================================ */

const TRUST_SEGMENTS = [
  { label: "WhatsApp leads", icon: <Phone size={15} /> },
  { label: "Sales teams", icon: <Users size={15} /> },
  { label: "Agencies", icon: <Briefcase size={15} /> },
  { label: "Follow-ups", icon: <CalendarClock size={15} /> },
  { label: "Pipeline", icon: <GitBranch size={15} /> },
];

function TrustBar() {
  // TODO(launch): replace this row with real customer logos once you have permission to use them.
  return (
    <section className="dw-trust">
      <div className="dw-wrap">
        <p className="dw-body" style={{ fontSize: 17 }}>Built for teams where selling happens in conversations.</p>
        <div className="dw-trust__row">
          {TRUST_SEGMENTS.map((s) => <span key={s.label} className="dw-pill">{s.icon}{s.label}</span>)}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   PROBLEM
   ============================================================ */

const PROBLEM_STORY = [
  { title: "A new lead messages", sub: "Mon, 10:02 AM", state: "now", icon: <Phone size={17} /> },
  { title: "Rahul replies", sub: "Mon, 10:20 AM", state: "done", icon: <Reply size={17} /> },
  { title: "Aman thinks it's his", sub: "Mon, 10:35 AM", state: "later", icon: <Users size={17} /> },
  { title: "Follow-up gets buried", sub: "Tue, under 40 newer chats", state: "later", icon: <MessageSquareDashed size={17} /> },
  { title: "Marked as a bad lead", sub: "Thu, no one followed up", state: "bad", icon: <CircleSlash size={17} /> },
];

function Problem() {
  return (
    <section className="dw-section" aria-labelledby="problem-h">
      <div className="dw-wrap">
        <div className="dw-center dw-measure" style={{ maxWidth: 820 }}>
          <h2 id="problem-h" className="dw-h2">WhatsApp works brilliantly for selling.</h2>
          <p className="dw-h2-sub">Until five people start selling from it.</p>
        </div>

        <div className="dw-panel">
          <div>
            <div className="dw-panel__icon"><span><Shuffle size={20} /></span></div>
            <div className="dw-story">
              <p>A new lead messages. Someone replies. Someone else thinks they own it.</p>
              <p className="dw-story__muted">The manager can't see what happened. The follow-up gets buried under newer conversations. Three days later, everyone calls it a bad lead.</p>
              <div className="dw-story__punch">
                The problem wasn't the lead.<br />The system around the conversation was missing.
              </div>
            </div>
          </div>
          <Timeline items={PROBLEM_STORY} />
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   CORE WORKFLOW
   ============================================================ */

const WORKFLOW = [
  { title: "Capture", text: "Every enquiry on your WhatsApp Business number lands in Dorway the moment it arrives, with the full chat attached.", sub: "Lead lands in the inbox", icon: <Inbox size={17} /> },
  { title: "Assign", text: "Give every conversation a clear owner, by hand or on rotation, so your team always knows who is responsible.", sub: "Owner set automatically", icon: <UserPlus size={17} /> },
  { title: "Follow up", text: "See what's due, what's untouched and which conversations have gone quiet, before they go cold.", sub: "Next action scheduled", icon: <CalendarClock size={17} /> },
  { title: "Close", text: "Move leads through a real sales pipeline without asking your reps to maintain another spreadsheet.", sub: "Stage moves to Won", icon: <Target size={17} /> },
];

function Workflow({ onDemo }) {
  const [active, setActive] = useState(1);
  const nodes = WORKFLOW.map((w, i) => ({
    title: w.title,
    sub: w.sub,
    state: i < active ? "done" : i === active ? "now" : "later",
    icon: i < active ? <Check size={18} strokeWidth={2.5} /> : w.icon,
  }));
  return (
    <section className="dw-section" id="how-it-works" aria-labelledby="flow-h" style={{ paddingTop: 0 }}>
      <div className="dw-wrap">
        <div className="dw-center">
          <h2 id="flow-h" className="dw-h2">Every lead gets somewhere to go.</h2>
        </div>
        <div className="dw-panel" style={{ background: "var(--white)" }}>
          <div>
            <p className="dw-lead" style={{ maxWidth: 460 }}>Four steps every WhatsApp lead moves through, whoever on your team picks it up.</p>
            <div className="dw-steps" role="list">
              {WORKFLOW.map((w, i) => (
                <button key={w.title} type="button" role="listitem" className={`dw-step ${active === i ? "is-active" : ""}`} onClick={() => setActive(i)} aria-pressed={active === i}>
                  <span className="dw-step__num">{i + 1}</span>
                  <span>
                    <span className="dw-step__title" style={{ display: "block" }}>{w.title}</span>
                    {active === i && <span className="dw-step__text" style={{ display: "block" }}>{w.text}</span>}
                  </span>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 28 }}>
              <button type="button" className="dw-textlink" onClick={onDemo}><Play size={15} fill="currentColor" /> {CONFIG.cta.secondary.label}</button>
            </div>
          </div>
          <Timeline items={nodes} activeIndex={active} onSelect={setActive} />
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   SHARED WORKSPACE (for reps)
   ============================================================ */

const INBOX_ROWS = [
  { name: "Neha Sharma", preview: "Can someone visit this Saturday?", owner: "Priya", stage: "Site visit", chip: "amber", time: "7:51 PM", unread: true, i: 1 },
  { name: "Vikram Joshi", preview: "Please share the 3BHK quotation", owner: "Arjun", stage: "Quoted", chip: "grey", time: "7:30 PM", unread: true, i: 2 },
  { name: "Farah Khan", preview: "Thanks, will discuss with family", owner: "Priya", stage: "Negotiating", chip: "green", time: "6:12 PM", i: 3 },
  { name: "Suresh Menon", preview: "Is the offer still valid?", owner: "Rahul", stage: "Interested", chip: "green", time: "Yesterday", i: 4 },
];

function Workspace() {
  return (
    <section className="dw-section" aria-labelledby="ws-h" style={{ paddingTop: 0 }}>
      <div className="dw-wrap dw-split dw-split--flip">
        <div className="dw-split__visual" aria-hidden="true">
          <div className="dw-card">
            <div className="dw-card__head">
              <strong>Shared inbox</strong>
              <span className="dw-chip dw-chip--grey"><Phone size={11} /> <span className="dw-mono" style={{ fontSize: 11 }}>+91 80XXX 20115</span></span>
            </div>
            {INBOX_ROWS.map((r, idx) => (
              <div key={r.name} className={`dw-row ${idx === 0 ? "is-selected" : ""}`}>
                <Avatar name={r.name} i={r.i} />
                <div className="dw-row__main">
                  <div className="dw-row__name">{r.name}{r.unread && <span style={{ width: 7, height: 7, borderRadius: 9, background: "var(--green)" }} />}</div>
                  <div className="dw-row__preview">{r.preview}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <span className={`dw-chip dw-chip--${r.chip}`}>{r.stage}</span>
                    <span className="dw-chip dw-chip--grey">Owner: {r.owner}</span>
                  </div>
                </div>
                <span className="dw-small" style={{ fontSize: 11.5, alignSelf: "flex-start" }}>{r.time}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="dw-split__text">
          <h2 id="ws-h" className="dw-h2">Your team talks. {CONFIG.brand} keeps the sales process together.</h2>
          <p className="dw-lead">One shared workspace on your WhatsApp Business number gives sales reps the conversation and managers the context around it.</p>
          <ul className="dw-seelist">
            {["See the customer.", "See the conversation.", "See the owner.", "See the stage.", "See the next follow-up."].map((t) => (
              <li key={t}><span className="dw-seelist__tick"><Check size={15} strokeWidth={2.5} /></span>{t}</li>
            ))}
          </ul>
          <p className="dw-quoteline">Without asking <strong>"Who was handling this lead?"</strong> again.</p>
          <div className="dw-btn-row"><PrimaryCTA /></div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   MANAGER VIEW
   ============================================================ */

const ATTENTION = [
  { label: "Untouched leads", text: "New enquiries nobody has replied to yet.", count: 3, icon: <MessageSquareDashed size={17} />, tone: "clay" },
  { label: "No owner", text: "Leads that haven't been assigned to anyone.", count: 1, icon: <UserX size={17} />, tone: "clay" },
  { label: "Follow-ups due", text: "Prospects your team needs to contact today.", count: 7, icon: <CalendarClock size={17} />, tone: "amber" },
  { label: "Stalled conversations", text: "Promising chats that suddenly went silent.", count: 4, icon: <Clock size={17} />, tone: "amber" },
  { label: "Pipeline visibility", text: "Where every opportunity stands right now.", count: 42, icon: <BarChart3 size={17} />, tone: "green" },
];
const TONE = {
  clay: { background: "var(--clay-soft)", color: "var(--clay)" },
  amber: { background: "var(--amber-soft)", color: "#8A5A15" },
  green: { background: "var(--mint)", color: "var(--green-deep)" },
};

function ManagerView() {
  return (
    <section className="dw-section" id="managers" aria-labelledby="mgr-h" style={{ paddingTop: 0 }}>
      <div className="dw-wrap dw-split">
        <div className="dw-split__text">
          <h2 id="mgr-h" className="dw-h2">Open {CONFIG.brand} at 6 PM and know exactly what needs attention.</h2>
          <p className="dw-lead">No end-of-day calls asking for updates. The things that are slipping are already on one screen, with names next to them.</p>
          <div className="dw-closing">
            Your CRM should tell you what to do next.
            <span>Not just show you what happened last month.</span>
          </div>
          <div className="dw-btn-row"><PrimaryCTA /></div>
        </div>
        <div className="dw-split__visual dw-split__visual--dusk">
          <div className="dw-card" role="img" aria-label="Manager view listing untouched leads, unassigned leads, follow-ups due, stalled conversations and pipeline totals">
            <div className="dw-card__head">
              <strong>Needs attention</strong>
              <span className="dw-chip dw-chip--grey dw-mono" style={{ fontSize: 11 }}>Today, 18:00</span>
            </div>
            {ATTENTION.map((a) => (
              <div key={a.label} className="dw-row">
                <span className="dw-row__icon" style={TONE[a.tone]}>{a.icon}</span>
                <div className="dw-row__main">
                  <div className="dw-row__name">{a.label}</div>
                  <div className="dw-row__preview" style={{ whiteSpace: "normal" }}>{a.text}</div>
                </div>
                <span className="dw-row__count">{a.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   AI
   ============================================================ */

const ASK_EXAMPLES = [
  {
    q: "Which leads haven't been followed up today?",
    a: <>4 leads are due today with no follow-up yet:<ul><li><strong>Vikram Joshi</strong>, Arjun. Quote sent 2 days ago, no reply.</li><li><strong>Suresh Menon</strong>, Rahul. Asked if the offer is still valid.</li><li><strong>Kavya Rao</strong>, Priya. Requested a callback.</li><li><strong>Imran Sheikh</strong>, unassigned.</li></ul></>,
  },
  {
    q: "Show me prospects asking about pricing.",
    a: <>9 conversations this week mention price, budget or quotation. 6 have an owner and a follow-up scheduled. <strong>3 don't</strong>: Vikram Joshi, Deepa Iyer and Imran Sheikh.</>,
  },
  {
    q: "Which conversations look ready for a call?",
    a: <><strong>Farah Khan</strong> and <strong>Neha Sharma</strong>. Both have confirmed budget, asked about timelines and replied within an hour of the last message.</>,
  },
  {
    q: "Summarise what happened with this lead.",
    a: <><strong>Neha Sharma</strong> came in from a Click-to-WhatsApp ad on Monday asking about a 2BHK modular kitchen. Priya shared the catalogue and ₹1.8L starting price. A site visit is booked for Saturday, 11 AM.</>,
  },
  {
    q: "Which salesperson has untouched leads?",
    a: <><strong>Arjun</strong> has 2 untouched leads from this afternoon. Everyone else has replied to all new enquiries.</>,
  },
];

const AI_ASSIST = [
  { icon: <FileText size={22} />, title: "Summarise long chats", text: "Get the gist of a 200-message conversation before you pick it up." },
  { icon: <Search size={22} />, title: "Surface context", text: "Budget, location and timeline pulled out of the chat and onto the lead." },
  { icon: <Reply size={22} />, title: "Assist with replies", text: "Draft a reply in your team's tone. Your rep edits and sends it." },
  { icon: <ListChecks size={22} />, title: "Qualify enquiries", text: "Flag which new leads look serious and which need more questions." },
  { icon: <Target size={22} />, title: "Prioritise leads", text: "See which conversations are worth your team's next hour." },
  { icon: <Zap size={22} />, title: "Trigger the right follow-up", text: "Suggest the next step and schedule it with the lead's owner." },
];

function AISection() {
  const [idx, setIdx] = useState(0);
  return (
    <section className="dw-section" id="ai" aria-labelledby="ai-h" style={{ background: "var(--paper)" }}>
      <div className="dw-wrap">
        <div className="dw-center" style={{ maxWidth: 820, margin: "0 auto" }}>
          <h2 id="ai-h" className="dw-h2">AI that does the boring work around the conversation.</h2>
          <p className="dw-lead" style={{ marginTop: 16 }}>Not another chatbot your salespeople have to babysit. {CONFIG.brand} AI helps your team understand conversations, retrieve context and act faster.</p>
        </div>
        <div className="dw-ai">
          <div className="dw-ask">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <Mark size={28} />
              <strong style={{ fontFamily: "var(--display)", fontSize: 20 }}>Ask {CONFIG.brand}</strong>
            </div>
            <div className="dw-ask__input"><Sparkles size={17} color="#5FD3A1" /><span>{ASK_EXAMPLES[idx].q}</span></div>
            <div className="dw-ask__answer" aria-live="polite">{ASK_EXAMPLES[idx].a}</div>
            <div className="dw-ask__chips">
              {ASK_EXAMPLES.map((e, i) => (
                <button key={e.q} type="button" className={`dw-ask__chip ${i === idx ? "is-active" : ""}`} onClick={() => setIdx(i)} aria-pressed={i === idx}>{e.q}</button>
              ))}
            </div>
          </div>
          <div className="dw-features">
            {AI_ASSIST.map((f) => (
              <div key={f.title} className="dw-feature">
                <div className="dw-feature__icon">{f.icon}</div>
                <h3 className="dw-h4">{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
          <p className="dw-ai__tagline">Your salespeople stay human.<span>The repetitive work doesn't have to.</span></p>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   BEFORE / AFTER
   ============================================================ */

const BEFORE = [
  "Five salespeople handling leads differently.",
  "Chats scattered across personal phones.",
  "Lead ownership decided in a WhatsApp group.",
  "Follow-ups remembered manually.",
  "Customer details copied into spreadsheets.",
  "Manager chasing everyone for updates.",
  "CRM updated after the conversation, if at all.",
];
const AFTER = [
  "Every lead enters one workspace.",
  "Every lead has an owner.",
  "Every conversation carries its context.",
  "Every follow-up has a next action.",
  "Every opportunity has a pipeline stage.",
  "Every manager can see what is slipping.",
];

function BeforeAfter() {
  return (
    <section className="dw-section" aria-labelledby="ba-h">
      <div className="dw-wrap">
        <div className="dw-center"><h2 id="ba-h" className="dw-h2">Replace the sales process you already hate.</h2></div>
        <div className="dw-ba">
          <div className="dw-ba__col dw-ba__col--before">
            <h3 className="dw-h3">Before {CONFIG.brand}</h3>
            <ul className="dw-ba__list">
              {BEFORE.map((t) => <li key={t}><span className="dw-ba__mark"><X size={14} strokeWidth={2.5} /></span>{t}</li>)}
            </ul>
          </div>
          <div className="dw-ba__col dw-ba__col--after">
            <h3 className="dw-h3">With {CONFIG.brand}</h3>
            <ul className="dw-ba__list">
              {AFTER.map((t) => <li key={t}><span className="dw-ba__mark"><Check size={14} strokeWidth={2.5} /></span>{t}</li>)}
            </ul>
          </div>
        </div>
        <p className="dw-ba__foot">And your team spends more time selling than reporting that they sold.</p>
      </div>
    </section>
  );
}

/* ============================================================
   AGENCIES (radial)
   ============================================================ */

const AGENCY_USES = [
  { label: "Inbound enquiries", icon: <Inbox size={18} />, x: 22, y: 20 },
  { label: "Performance marketing leads", icon: <BarChart3 size={18} />, x: 77, y: 20 },
  { label: "Click-to-WhatsApp campaigns", icon: <Megaphone size={18} />, x: 17, y: 52 },
  { label: "Lead-generation clients", icon: <Briefcase size={18} />, x: 83, y: 52 },
  { label: "Sales development teams", icon: <Users size={18} />, x: 26, y: 83 },
  { label: "Multiple salespeople or closers", icon: <UserPlus size={18} />, x: 74, y: 83 },
];

function Agencies() {
  return (
    <section className="dw-section" aria-labelledby="ag-h" style={{ paddingTop: 0 }}>
      <div className="dw-wrap">
        <div className="dw-center" style={{ maxWidth: 820, margin: "0 auto" }}>
          <span className="dw-pill" style={{ marginBottom: 24 }}><Briefcase size={16} /> Built for agencies</span>
          <h2 id="ag-h" className="dw-h2">Your agency doesn't need another tool your team forgets to update.</h2>
          <p className="dw-lead" style={{ marginTop: 16 }}>You need one place to see what happens after the WhatsApp leads start arriving.</p>
        </div>
        <div className="dw-radial">
          <div aria-hidden="true">
            {[560, 430, 310, 200].map((s) => <span key={s} className="dw-radial__ring" style={{ width: s, height: s }} />)}
            <span className="dw-radial__core"><Mark size={64} /></span>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {AGENCY_USES.map((u) => (
              <li key={u.label} className="dw-radial__pill" style={{ left: `${u.x}%`, top: `${u.y}%` }}>{u.icon}{u.label}</li>
            ))}
          </ul>
          <div className="dw-radial__mobile" aria-hidden="true">
            {AGENCY_USES.map((u) => <span key={u.label} className="dw-radial__pill">{u.icon}{u.label}</span>)}
          </div>
        </div>
        <div className="dw-agency-q">
          <p>Whether three people sell or thirty, the question stays the same:</p>
          <p>Who owns the lead, what happened, and what happens next?</p>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   ONBOARDING + MIGRATION
   ============================================================ */

const ONBOARDING = [
  { title: "Create your workspace", text: "Set up your company and invite your sales team." },
  { title: "Connect your WhatsApp number", text: "Link your WhatsApp Business number, then set up your pipeline, owners and follow-up rules." },
  { title: "Start managing real conversations", text: "New leads start arriving in one workspace your team can actually work from." },
];

function Onboarding() {
  return (
    <section className="dw-section" aria-labelledby="onb-h" style={{ background: "var(--paper)" }}>
      <div className="dw-wrap">
        <div className="dw-center"><h2 id="onb-h" className="dw-h2">From scattered WhatsApp leads to one pipeline.</h2></div>
        <ol className="dw-onb" style={{ listStyle: "none", padding: 0 }}>
          {ONBOARDING.map((s, i) => (
            <li key={s.title} className="dw-onb__step">
              <span className="dw-onb__num">{i + 1}</span>
              <h3 className="dw-h4">{s.title}</h3>
              <p className="dw-body">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="dw-onb__foot">
          <p>Need help? We'll set up your first workflow with you.</p>
          <div className="dw-btn-row"><PrimaryCTA /><SetupCTA /></div>
        </div>
      </div>
    </section>
  );
}

function Migration() {
  return (
    <section className="dw-section" aria-labelledby="mig-h">
      <div className="dw-wrap">
        <div className="dw-migrate">
          <div>
            <h2 id="mig-h" className="dw-h3" style={{ fontSize: 32 }}>Already using spreadsheets, another CRM or another WhatsApp tool?</h2>
            <p className="dw-migrate__good">Good.</p>
            <p className="dw-body" style={{ marginTop: 12, fontSize: 17 }}>You don't need to redesign your business around {CONFIG.brand}. We'll help recreate your existing pipeline, import what can be moved and get your team working inside {CONFIG.brand}.</p>
            <div className="dw-btn-row" style={{ marginTop: 28 }}><SetupCTA className="dw-btn--primary" /></div>
          </div>
          <div className="dw-migrate__list" aria-label="What we help move">
            <div className="dw-migrate__item"><UploadCloud size={18} /> Leads and contacts, from CSV or your old tool</div>
            <div className="dw-migrate__item"><GitBranch size={18} /> Your pipeline stages, recreated as they are</div>
            <div className="dw-migrate__item"><Users size={18} /> Team, owners and assignment rules</div>
            <div className="dw-migrate__item"><CalendarClock size={18} /> Follow-up process, turned into sequences</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   PRICING
   ============================================================ */

const fmt = (n) => `${PRICING.currency}${Math.round(n).toLocaleString("en-IN")}`;

function Pricing() {
  const included = [
    "Shared team inbox",
    "Automatic lead assignment",
    "Follow-up sequences",
    "Pipeline for every lead",
    "Hands-on setup with our team",
    "Priority support",
  ];

  return (
    <section className="dw-section" id="pricing" aria-labelledby="price-h" style={{ background: "var(--paper)" }}>
      <div className="dw-wrap">
        <div className="dw-center dw-measure" style={{ maxWidth: 760 }}>
          <h2 id="price-h" className="dw-h2">One plan. Everything your team needs.</h2>
          <p className="dw-lead" style={{ marginTop: 16 }}>Pick how long. Longer terms cost less per month.</p>
        </div>

        <div className="dw-plans">
          {PRICING.terms.map((t) => {
            const subtotal = t.monthlyRate * t.months;
            const gst = Math.round((subtotal * PRICING.gstPercent) / 100);
            const total = subtotal + gst;
            const savings = (PRICING.baseMonthly - t.monthlyRate) * t.months;
            const popular = t.months === 12;
            const href = `/login?next=${encodeURIComponent(`/checkout/growth?term=${t.months}`)}`;
            const label = `${t.months} month${t.months > 1 ? "s" : ""}`;
            return (
              <article key={t.months} className={`dw-plan${popular ? " is-popular" : ""}`} aria-label={`${label} plan`}>
                {t.badge && <span className={`dw-plan__badge${popular ? "" : " dw-plan__badge--soft"}`}>{t.badge}</span>}
                <h3 className="dw-plan__name">{label}</h3>
                <p className="dw-plan__for">{t.blurb}</p>
                <div className="dw-plan__price">
                  <span className="dw-plan__amount">{fmt(t.monthlyRate)}</span>
                  <span className="dw-plan__per">/ month</span>
                  {savings > 0 && <span className="dw-plan__was">{fmt(PRICING.baseMonthly)}</span>}
                </div>
                <ul className="dw-plan__facts">
                  <li><span>Billed today</span><span>{fmt(subtotal)}</span></li>
                  <li><span>GST (18%)</span><span>{fmt(gst)}</span></li>
                  {savings > 0 && <li className="is-save"><span>You save</span><span>{fmt(savings)}</span></li>}
                  <li className="is-total"><span>Total due</span><span>{fmt(total)}</span></li>
                </ul>
                <a href={href} className={`dw-btn ${popular ? "dw-btn--primary" : "dw-btn--ghost"}`}>{CONFIG.cta.primary.label}</a>
              </article>
            );
          })}
        </div>
        <p className="dw-plan__trial" style={{ marginTop: 20 }}>{PRICING.shared.access}</p>

        <ul className="dw-seelist" style={{ maxWidth: 480, margin: "32px auto 0" }}>
          {included.map((f) => (
            <li key={f}><span className="dw-seelist__tick"><Check size={15} strokeWidth={2.5} /></span>{f}</li>
          ))}
        </ul>

        <div className="dw-meta-note">
          <span className="dw-meta-note__icon"><Phone size={20} /></span>
          <p>
            <strong>About WhatsApp message charges.</strong> No per-message markup from us — WhatsApp's own message
            charges are billed by Meta to your account, at their published rates. You add your own payment method to
            your own WhatsApp Business Account and pay Meta directly.
          </p>
        </div>
        <p className="dw-lead" style={{ textAlign: "center", marginTop: 16, fontSize: 15 }}>{PRICING.shared.refund}</p>
      </div>
    </section>
  );
}

/* ============================================================
   FOUNDER SUPPORT
   ============================================================ */

function FounderSupport() {
  // TODO(launch): replace initials with founder photos.
  return (
    <section className="dw-section" aria-labelledby="founder-h">
      <div className="dw-wrap">
        <div className="dw-founder">
          <div className="dw-founder__faces" aria-hidden="true">
            <Avatar name="Founder One" i={5} />
            <Avatar name="Founder Two" i={0} />
          </div>
          <div>
            <h2 id="founder-h" className="dw-h3" style={{ fontSize: 32 }}>Early {CONFIG.brand} customers don't get sent into a support maze.</h2>
            <p className="dw-lead" style={{ marginTop: 16 }}>We're still close enough to the product that the people building {CONFIG.brand} can help you implement it. For early customers, that means help setting up your pipeline, understanding your current sales workflow and getting the team live.</p>
            <p className="dw-founder__sig">Built with agencies, not just sold to them.</p>
            <div className="dw-btn-row" style={{ marginTop: 24, justifyContent: "inherit" }}><SetupCTA /></div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   FAQ
   ============================================================ */

function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <section className="dw-section" id="faq" aria-labelledby="faq-h" style={{ paddingTop: 0 }}>
      <div className="dw-wrap">
        <div className="dw-center"><h2 id="faq-h" className="dw-h2">Questions teams ask before switching</h2></div>
        <div className="dw-faq">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className={`dw-faq__item ${isOpen ? "is-open" : ""}`}>
                <h3 style={{ margin: 0 }}>
                  <button type="button" className="dw-faq__q" aria-expanded={isOpen} aria-controls={`faq-${i}`} id={`faq-q-${i}`} onClick={() => setOpen(isOpen ? -1 : i)}>
                    {f.q}<ChevronDown size={20} />
                  </button>
                </h3>
                <div id={`faq-${i}`} role="region" aria-labelledby={`faq-q-${i}`} className="dw-faq__panel" aria-hidden={!isOpen}>
                  <div className="dw-faq__inner"><p className="dw-faq__a">{f.a}</p></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   FINAL CTA + FOOTER
   ============================================================ */

function FinalCTA() {
  return (
    <section aria-labelledby="final-h">
      <div className="dw-wrap">
        <div className="dw-final">
          <ArchPattern className="dw-final__pattern" id="dw-arch-final" />
          <div className="dw-final__glow" aria-hidden="true" />
          <h2 id="final-h" className="dw-h2">Your team is already selling on WhatsApp.</h2>
          <p className="dw-h2-sub">Give those conversations a sales system.</p>
          <div className="dw-final__lines">
            {["Capture every lead.", "Assign every owner.", "Know every follow-up.", "See what's slipping before the deal disappears."].map((t) => (
              <span key={t}><Check size={16} strokeWidth={2.5} />{t}</span>
            ))}
          </div>
          <div className="dw-btn-row" style={{ justifyContent: "center" }}>
            <a href={CONFIG.cta.primary.href} className="dw-btn dw-btn--light">{CONFIG.cta.primary.label}</a>
            <SetupCTA className="dw-btn--outline-light" />
          </div>
          <div className="dw-reassure">
            {CONFIG.reassurance.map((r) => <span key={r}><Check size={15} strokeWidth={2.5} />{r}</span>)}
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const cols = [
    { h: "Product", links: [["How it works", "#how-it-works"], ["For managers", "#managers"], ["AI", "#ai"], ["Pricing", "#pricing"], ["FAQ", "#faq"]] },
    { h: "Resources", links: [["Setting up WhatsApp", "#"], ["Help centre", "#"], ["Contact support", "/contact"]] },
    { h: "Company", links: [["About", "#"], ["Become a partner", "/partners"], ["Privacy policy", "/legal/privacy"], ["Terms of service", "/legal/terms"], ["Refund policy", "/legal/refund"]] },
  ];
  return (
    <footer className="dw-footer">
      <div className="dw-wrap">
        <div className="dw-footer__grid">
          <div>
            <Logo />
            <p className="dw-body" style={{ marginTop: 16, maxWidth: 320, fontSize: 15 }}>WhatsApp CRM for teams that sell through conversations. Your number, your data, your customers.</p>
            <p className="dw-small" style={{ marginTop: 18, display: "grid", gap: 4 }}>
              <a href={`mailto:${CONFIG.contact.email}`}>{CONFIG.contact.email}</a>
              <a href={`tel:${CONFIG.contact.phoneTel}`}>{CONFIG.contact.phoneDisplay}</a>
              <span>{CONFIG.contact.address}</span>
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.h} className="dw-footer__col">
              <h4>{c.h}</h4>
              {c.links.map(([l, h]) => <a key={l} href={h}>{l}</a>)}
            </div>
          ))}
        </div>
        <div className="dw-footer__legal">
          <span>© {new Date().getFullYear()} {CONFIG.brand}. All rights reserved.</span>
          <span>Not affiliated with or endorsed by Meta Platforms, Inc. WhatsApp is a trademark of Meta Platforms, Inc.</span>
        </div>
      </div>
    </footer>
  );
}

/* ============================================================
   DEMO MODAL
   ============================================================ */

function DemoModal({ onClose }) {
  const demoUrl = CONFIG.demoVideoUrl || CONFIG.heroVideo;
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="dw-modal" onClick={onClose}>
      <div className="dw-modal__box" role="dialog" aria-modal="true" aria-label="Product demo" onClick={(e) => e.stopPropagation()}>
        <button className="dw-modal__close" onClick={onClose} aria-label="Close demo" autoFocus><X size={20} /></button>
        <div className="dw-modal__video" style={demoUrl ? { padding: 0 } : undefined}>
          {demoUrl && /\.(mp4|webm|mov)(\?|$)/i.test(demoUrl) ? (
            <video src={demoUrl} controls autoPlay playsInline style={{ width: "100%", height: "100%", background: "#000" }} />
          ) : demoUrl ? (
            <iframe src={demoUrl} title={`${CONFIG.brand} demo`} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
          ) : (
            <div>
              <Play size={40} style={{ opacity: .6 }} />
              <p style={{ marginTop: 12 }}>Add your demo video embed URL to <code>CONFIG.demoVideoUrl</code>.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   MOTION — scroll reveals, hero interaction, smoothing
   Everything here switches off under prefers-reduced-motion.
   ============================================================ */

// Elements that fade up as they scroll into view. Siblings stagger automatically.
const REVEAL_SELECTORS = [
  ".dw-trust > .dw-wrap",
  ".dw-section .dw-center",
  ".dw-panel", ".dw-tl__row",
  ".dw-split__text", ".dw-split__visual",
  ".dw-ask", ".dw-feature", ".dw-ai__tagline",
  ".dw-ba__col", ".dw-ba__foot",
  ".dw-radial", ".dw-agency-q",
  ".dw-onb__step", ".dw-onb__foot",
  ".dw-migrate", ".dw-proof",
  ".dw-plan", ".dw-table-wrap", ".dw-meta-note",
  ".dw-founder", ".dw-faq", ".dw-final", ".dw-footer__grid",
];

function useScrollReveal(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof window === "undefined") return;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) return;

    const els = Array.from(root.querySelectorAll(REVEAL_SELECTORS.join(",")));
    const perParent = new Map();
    els.forEach((el) => {
      const p = el.parentElement;
      const i = perParent.get(p) || 0;
      perParent.set(p, i + 1);
      el.classList.add("dw-rv");
      el.style.setProperty("--rv-i", String(Math.min(i, 6)));
    });
    root.classList.add("rv-ready");

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        io.unobserve(el);
        el.classList.add("is-in");
        // Once revealed, drop the reveal classes so hover effects use their own snappy timing.
        const done = (e) => {
          if (e.target !== el || e.propertyName !== "opacity") return;
          el.removeEventListener("transitionend", done);
          el.classList.remove("dw-rv", "is-in");
        };
        el.addEventListener("transitionend", done);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [rootRef]);
}

const STYLES_MOTION = `
html:has(.dw) { scroll-behavior: smooth; }
.dw section[id] { scroll-margin-top: 84px; }
.dw { --ease: cubic-bezier(.22,.8,.24,1); }

/* ---- scroll reveal ---- */
.dw.rv-ready .dw-rv {
  opacity: 0; translate: 0 32px;
  transition: opacity .9s var(--ease), translate .9s var(--ease);
  transition-delay: calc(var(--rv-i, 0) * 90ms);
}
.dw.rv-ready .dw-rv.is-in { opacity: 1; translate: 0 0; }
.dw.rv-ready .dw-split__visual.dw-rv { translate: 0 40px; scale: .97; transition-property: opacity, translate, scale; }
.dw.rv-ready .dw-split__visual.dw-rv.is-in { translate: 0 0; scale: 1; }
.dw.rv-ready .dw-tl__row.dw-rv { translate: 0 16px; transition-delay: calc(var(--rv-i, 0) * 110ms + 250ms); }
.dw.rv-ready .dw-tl__row.dw-rv.is-in { translate: 0 0; }

/* radial: rings breathe out, pills pop from the centre */
.dw-radial__ring { transition: scale 1.2s var(--ease), opacity 1.2s var(--ease); }
.dw-radial ul .dw-radial__pill { transition: opacity .6s var(--ease), scale .7s var(--ease), box-shadow .3s ease; }
.dw.rv-ready .dw-radial.dw-rv:not(.is-in) .dw-radial__ring { scale: .55; opacity: 0; }
.dw.rv-ready .dw-radial.dw-rv:not(.is-in) ul .dw-radial__pill { opacity: 0; scale: .7; }
.dw-radial ul li:nth-child(1) { transition-delay: .25s !important; }
.dw-radial ul li:nth-child(2) { transition-delay: .35s !important; }
.dw-radial ul li:nth-child(3) { transition-delay: .45s !important; }
.dw-radial ul li:nth-child(4) { transition-delay: .55s !important; }
.dw-radial ul li:nth-child(5) { transition-delay: .65s !important; }
.dw-radial ul li:nth-child(6) { transition-delay: .75s !important; }
.dw-radial__ring:nth-child(1) { transition-delay: .3s !important; }
.dw-radial__ring:nth-child(2) { transition-delay: .2s !important; }
.dw-radial__ring:nth-child(3) { transition-delay: .1s !important; }
.dw-radial__core { animation: dw-breathe 5s ease-in-out infinite; }
@keyframes dw-breathe { 50% { box-shadow: 0 0 0 18px rgba(255,255,255,.35), 0 20px 50px -10px rgba(18,33,28,.45); } }

/* ---- hero load sequence ---- */
.dw-hero__head > * { animation: dw-rise 1s var(--ease) both; }
.dw-hero__head > *:nth-child(1) { animation-delay: .05s; }
.dw-hero__head > *:nth-child(2) { animation-delay: .15s; }
.dw-hero__head > *:nth-child(3) { animation-delay: .28s; }
.dw-hero__head > *:nth-child(4) { animation-delay: .4s; }
.dw-hero__head > *:nth-child(5) { animation-delay: .5s; }
.dw-hero__stage { animation: dw-stage 1.3s var(--ease) .45s both; }
.dw-float--left { animation: dw-rise .9s var(--ease) 1.1s both; }
.dw-float--right { animation: dw-rise .9s var(--ease) 1.3s both; }
@keyframes dw-rise { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: none; } }
@keyframes dw-stage { from { opacity: 0; transform: translateY(60px) scale(.96); } to { opacity: 1; transform: none; } }

/* ---- hero interaction ---- */
.dw-hero { --px: 0; --py: 0; }
.dw-hero__spot { position: absolute; inset: -76px 0 0 0; z-index: -1; pointer-events: none; opacity: 0; transition: opacity .6s var(--ease);
  background: radial-gradient(480px circle at var(--sx, 50%) calc(var(--sy, 30%) + 76px), rgba(11,138,92,.13), rgba(11,138,92,0) 70%); }
.dw-hero.is-pointer .dw-hero__spot { opacity: 1; }
.dw-hero__pattern { translate: calc(var(--px) * -18px) calc(var(--py) * -14px); transition: translate .8s var(--ease); }
.dw-tilt { transform: perspective(1800px) rotateX(calc(var(--py) * -5deg)) rotateY(calc(var(--px) * 6deg)); transition: transform .8s var(--ease); will-change: transform; }
.dw-float--left, .dw-float--right { translate: calc(var(--px) * -34px) calc(var(--py) * -26px); transition: translate .8s var(--ease), box-shadow .3s ease, border-color .3s ease; }
.dw-float--right { top: 70px; right: -64px; }
.dw-float--left { cursor: pointer; text-align: left; font: inherit; color: inherit; min-width: 270px; }
.dw-float--left:hover { border-color: #BFDCCB; box-shadow: 0 22px 50px -18px rgba(18,33,28,.45); }
.dw-float__text { animation: dw-swap .5s var(--ease) both; }
.dw-float__dots { display: flex; gap: 4px; margin-left: auto; align-self: center; }
.dw-float__dots span { width: 5px; height: 5px; border-radius: 9px; background: var(--line); transition: background .3s ease, width .3s var(--ease); }
.dw-float__dots span.is-on { background: var(--green); width: 14px; }
.dw-float__faces { display: flex; }
.dw-float__faces .dw-avatar { border: 2px solid var(--white); width: 28px; height: 28px; }
.dw-float__faces .dw-avatar + .dw-avatar { margin-left: -9px; }
@keyframes dw-swap { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

/* ---- hero video ---- */
.dw-frame--video { padding: 10px; }
.dw-video { position: relative; border-radius: 14px; overflow: hidden; background: var(--paper); aspect-ratio: 16 / 9; }
.dw-video video { display: block; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity .8s var(--ease); cursor: pointer; }
.dw-video video.is-ready { opacity: 1; }
.dw-video__loading { position: absolute; inset: 0; background: linear-gradient(100deg, var(--paper) 30%, #EAF1EC 50%, var(--paper) 70%); background-size: 300% 100%; animation: dw-shimmer 1.6s linear infinite; }
@keyframes dw-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
.dw-video__bar { position: absolute; left: 14px; right: 14px; bottom: 14px; display: flex; justify-content: space-between; align-items: center; pointer-events: none; opacity: .0; translate: 0 6px; transition: opacity .4s var(--ease), translate .4s var(--ease); }
.dw-video:hover .dw-video__bar, .dw-video:focus-within .dw-video__bar { opacity: 1; translate: 0 0; }
.dw-video__tag, .dw-video__ctrls { pointer-events: auto; display: inline-flex; align-items: center; gap: 8px; background: rgba(18,33,28,.78); color: #fff; backdrop-filter: blur(8px); border-radius: 999px; font-size: 13px; font-weight: 500; }
.dw-video__tag { padding: 7px 14px; }
.dw-video__ctrls { padding: 4px; gap: 2px; }
.dw-video__ctrls button { width: 34px; height: 34px; border-radius: 999px; display: grid; place-items: center; color: #fff; transition: background .2s ease; }
.dw-video__ctrls button:hover { background: rgba(255,255,255,.16); }
.dw-live-dot { width: 7px; height: 7px; border-radius: 9px; background: #8A9A94; }
.dw-live-dot.is-on { background: #5FD3A1; animation: dw-pulse 1.8s ease-in-out infinite; }
@keyframes dw-pulse { 50% { box-shadow: 0 0 0 5px rgba(95,211,161,.25); } }
.dw-video__progress { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: rgba(18,33,28,.08); }
.dw-video__progress span { display: block; height: 100%; background: var(--green); transform-origin: left; transform: scaleX(0); transition: transform .25s linear; }
@media (hover: none) { .dw-video__bar { opacity: 1; translate: 0 0; } }

/* ---- general smoothing ---- */
.dw-btn { transition: background .25s var(--ease), border-color .25s var(--ease), color .25s var(--ease), translate .25s var(--ease), box-shadow .25s var(--ease); }
.dw-btn:hover { translate: 0 -1px; }
.dw-btn--primary:hover { box-shadow: 0 10px 24px -12px rgba(18,33,28,.55); }
.dw-nav { transition: background .35s var(--ease), box-shadow .35s var(--ease); }
.dw-plan, .dw-onb__step, .dw-migrate__item, .dw-ba__col { transition: translate .4s var(--ease), box-shadow .4s var(--ease), border-color .4s var(--ease), opacity .9s var(--ease); }
.dw-plan:hover, .dw-onb__step:hover { translate: 0 -4px; box-shadow: 0 24px 50px -30px rgba(18,33,28,.35); }
.dw-migrate__item:hover { translate: 4px 0; border-color: #BFDCCB; }
.dw-plan__amount { display: inline-block; animation: dw-swap .45s var(--ease) both; }
.dw-step__text { animation: dw-swap .4s var(--ease) both; }
.dw-node { transition: border-color .3s var(--ease), box-shadow .3s var(--ease), scale .3s var(--ease); }
button.dw-node:hover { scale: 1.03; }
.dw-ask__answer > * , .dw-ask__answer { animation: none; }
.dw-ask__answer { transition: opacity .3s ease; }
.dw-drawer { animation: dw-fade .3s ease both; }
.dw-drawer__panel { animation: dw-slide .4s var(--ease) both; }
.dw-modal { animation: dw-fade .3s ease both; }
.dw-modal__box { animation: dw-stage .5s var(--ease) both; }
@keyframes dw-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes dw-slide { from { transform: translateX(100%); } to { transform: none; } }

/* FAQ: animated height */
.dw-faq__panel { display: grid; grid-template-rows: 0fr; opacity: 0; transition: grid-template-rows .45s var(--ease), opacity .35s ease; }
.dw-faq__item.is-open .dw-faq__panel { grid-template-rows: 1fr; opacity: 1; }
.dw-faq__inner { overflow: hidden; min-height: 0; }
.dw-faq__q { transition: color .2s ease; }
.dw-faq__q:hover { color: var(--green-deep); }

@media (max-width: 1080px) { .dw-float--right { right: -12px; } }
@media (max-width: 960px) { .dw-float--right { display: none; } .dw-tilt { transform: none; } }
@media (prefers-reduced-motion: reduce) {
  html:has(.dw) { scroll-behavior: auto; }
  .dw-tilt, .dw-hero__pattern, .dw-float--left, .dw-float--right { transform: none !important; translate: none !important; }
}
`;

/* ============================================================
   PAGE
   ============================================================ */

export default function DorwayLanding() {
  const [demoOpen, setDemoOpen] = useState(false);
  const openDemo = () => setDemoOpen(true);
  const rootRef = useRef(null);
  useScrollReveal(rootRef);
  return (
    <div className="dw" ref={rootRef}>
      <style>{STYLES + STYLES_TIMELINE + STYLES_MOTION}</style>
      <Nav />
      <main>
        <Hero onDemo={openDemo} />
        <TrustBar />
        <Problem />
        <Workflow onDemo={openDemo} />
        <Workspace />
        <ManagerView />
        <AISection />
        <BeforeAfter />
        <Agencies />
        <Onboarding />
        <Migration />
        <Pricing />
        <FounderSupport />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
      {demoOpen && <DemoModal onClose={() => setDemoOpen(false)} />}
    </div>
  );
}
