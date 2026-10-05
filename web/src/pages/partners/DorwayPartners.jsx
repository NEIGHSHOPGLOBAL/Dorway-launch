/**
 * Dorway Partner Program — landing page + sign-up (WhatsApp OTP) + partner dashboard
 * ---------------------------------------------------------------------------------
 * Same design system as pages/DorwayLanding.jsx (Comfortaa / Inter / JetBrains
 * Mono, bottle-green palette, doorway-arch pattern). Mounted at /partners/*
 * in App.tsx, outside the shared <Layout> — this page owns its own nav/footer
 * the same way the main landing page does.
 *
 * Talks to the real server/src/routes/partners.ts API (no more mock data —
 * see partners.md for the contract this was built against).
 */

import { useCallback, useEffect, useRef, useState, createContext, useContext } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import {
  Menu, X, Check, Copy, Share2, MessageCircle, Link2, Wallet, Gift, Timer,
  ShoppingCart, CircleCheck, Clock, LogOut, Settings, LayoutDashboard,
  Activity, ShieldCheck, Phone, Mail, User, ChevronDown, Landmark, IndianRupee,
  Sparkles, Briefcase, Megaphone, GraduationCap, Building2, Info, AlertCircle,
  Lock, RefreshCw, Eye, Hourglass, Ban, Send,
} from "lucide-react";
import { api as http } from "../../lib/api";
import { usePlans } from "../../lib/usePlans";

/* ============================================================
   PROGRAM RULES — copy/display only. The server (partnerProgram.ts)
   is the source of truth every route actually enforces.
   ============================================================ */

const PROGRAM = {
  brand: "Dorway",
  siteUrl: "https://dorwayai.com",
  currency: "₹",

  commissionRate: 0.10,
  commissionOn: "first completed checkout",
  minPayoutPaise: 200000, // ₹2,000
  bonus: { amountPaise: 100000, every: 10, withinDays: 7 }, // ₹1,000

  holdDays: 30,
  attributionDays: 60,
  payoutSla: "7 working days",
  otp: { length: 6, resendSeconds: 30, expiresMinutes: 5 },
};

/* ============================================================
   HELPERS
   ============================================================ */

// Everything server-side is paise (integers) — divide by 100 here, once.
const money = (paise) => `${PROGRAM.currency}${Math.round(paise / 100).toLocaleString("en-IN")}`;
const DAY = 86400000;
const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const fmtDateTime = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
function ago(d) {
  const s = Math.max(1, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} hr ago`;
  const dd = Math.round(h / 24); return dd === 1 ? "yesterday" : `${dd} days ago`;
}
const referralLink = (code) => `${PROGRAM.siteUrl}/?ref=${code}`;
const isPhone = (p) => /^[6-9]\d{9}$/.test(p);
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    try { document.execCommand("copy"); return true; } catch { return false; } finally { t.remove(); }
  }
}
const waShare = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/* ============================================================
   API — real calls to /api/partners/*. The server generates the
   referral code and holds the session cookie; nothing here is mocked.
   ============================================================ */

function qs(params) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ""));
  const s = new URLSearchParams(clean).toString();
  return s ? `?${s}` : "";
}

const api = {
  sendOtp: (f, purpose) =>
    purpose === "register"
      ? http.post("/partners/register/start", { name: f.name.trim(), phone: f.phone, email: f.email.trim() })
      : http.post("/partners/login/start", { phone: f.phone }),
  verify: (f, code, purpose) =>
    purpose === "register"
      ? http.post("/partners/register/verify", { name: f.name.trim(), phone: f.phone, email: f.email.trim(), code, acceptedTerms: true })
      : http.post("/partners/login/verify", { phone: f.phone, code }),
  me: () => http.get("/partners/me"),
  logout: () => http.post("/partners/logout"),
  getDashboard: () => http.get("/partners/me/dashboard"),
  getActivity: (cursor, type) => http.get(`/partners/me/activity${qs({ cursor, type })}`),
  getCheckouts: (status, cursor) => http.get(`/partners/me/checkouts${qs({ status, cursor })}`),
  getPayouts: (cursor) => http.get(`/partners/me/payouts${qs({ cursor })}`),
  requestPayout: (amountPaise, idempotencyKey) => http.post("/partners/me/payouts", { amount: amountPaise }, { "Idempotency-Key": idempotencyKey }),
  savePayoutMethod: (method) => http.put("/partners/me/payout-method", method),
  saveNotifications: (n) => http.put("/partners/me/notifications", n),
};

/* ============================================================
   STYLES — unchanged from the design that shipped with DorwayLanding.jsx
   ============================================================ */

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');

.dw {
  --white: #FFFFFF; --paper: #F6F8F5; --ink: #12211C; --ink-soft: #56675F; --line: #E3E7E1;
  --green: #0B8A5C; --green-deep: #065C3C; --mint: #DCF0E4; --mint-soft: #EEF7F1;
  --amber: #C98A2E; --amber-soft: #F8EBD6; --clay: #B24A3F; --clay-soft: #F6E1DE;
  --blue: #3C6E91; --blue-soft: #E3EDF4;
  --ease: cubic-bezier(.22,.8,.24,1);
  --display: 'Comfortaa', ui-rounded, 'Segoe UI', system-ui, sans-serif;
  --body: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-family: var(--body); color: var(--ink); background: var(--white);
  font-size: 16px; line-height: 1.65; -webkit-font-smoothing: antialiased; overflow-x: clip; min-height: 100vh;
}
.dw *, .dw *::before, .dw *::after { box-sizing: border-box; }
:where(.dw) :where(h1, h2, h3, h4, p) { margin: 0; }
:where(.dw) a { color: inherit; text-decoration: none; }
:where(.dw) button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; padding: 0; }
.dw :focus-visible { outline: 2px solid var(--green); outline-offset: 3px; border-radius: 8px; }
html:has(.dw) { scroll-behavior: smooth; }
.dw section[id] { scroll-margin-top: 84px; }

.dw-wrap { width: 100%; max-width: 1200px; margin: 0 auto; padding-inline: 24px; }
.dw-section { padding-block: 112px; }
.dw-center { text-align: center; }
.dw-h1 { font-family: var(--display); font-weight: 700; font-size: 58px; line-height: 1.12; letter-spacing: -0.02em; }
.dw-h2 { font-family: var(--display); font-weight: 700; font-size: 40px; line-height: 1.15; letter-spacing: -0.02em; }
.dw-h3 { font-family: var(--display); font-weight: 700; font-size: 24px; line-height: 1.25; letter-spacing: -0.01em; }
.dw-h4 { font-family: var(--display); font-weight: 700; font-size: 19px; line-height: 1.3; }
.dw-lead { font-size: 19px; line-height: 1.6; color: var(--ink-soft); }
.dw-body { color: var(--ink-soft); }
.dw-small { font-size: 14px; line-height: 1.5; color: var(--ink-soft); }
.dw-mono { font-family: var(--mono); font-weight: 500; }
.dw-num { font-family: var(--display); font-weight: 700; letter-spacing: -0.02em; }

.dw-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 52px; padding: 0 26px; border-radius: 10px; font-weight: 600; font-size: 16px; white-space: nowrap;
  transition: background .25s var(--ease), border-color .25s var(--ease), color .25s var(--ease), translate .25s var(--ease), box-shadow .25s var(--ease), opacity .2s; }
.dw-btn:hover:not(:disabled) { translate: 0 -1px; }
.dw-btn:disabled { opacity: .45; cursor: not-allowed; }
.dw-btn--primary { background: var(--ink); color: #fff; }
.dw-btn--primary:hover:not(:disabled) { background: #1D3129; box-shadow: 0 10px 24px -12px rgba(18,33,28,.55); }
.dw-btn--green { background: var(--green); color: #fff; }
.dw-btn--green:hover:not(:disabled) { background: var(--green-deep); }
.dw-btn--ghost { background: rgba(255,255,255,.7); border: 1px solid #CDD4CE; color: var(--ink); }
.dw-btn--ghost:hover:not(:disabled) { background: #fff; border-color: var(--ink); }
.dw-btn--light { background: #fff; color: var(--ink); }
.dw-btn--outline-light { border: 1px solid rgba(255,255,255,.35); color: #fff; }
.dw-btn--sm { height: 40px; padding: 0 16px; font-size: 14.5px; border-radius: 9px; }
.dw-btn--block { width: 100%; }
.dw-btn-row { display: flex; gap: 12px; flex-wrap: wrap; }
.dw-textlink { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: var(--green); }
.dw-textlink:hover { color: var(--green-deep); }
.dw-spin { width: 16px; height: 16px; border-radius: 99px; border: 2px solid currentColor; border-right-color: transparent; animation: dw-rot .7s linear infinite; }
@keyframes dw-rot { to { transform: rotate(360deg); } }

.dw-pill { display: inline-flex; align-items: center; gap: 8px; padding: 7px 16px; border-radius: 999px; border: 1px solid var(--line); background: rgba(255,255,255,.75); font-size: 15px; font-weight: 500; }
.dw-chip { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 999px; font-size: 12.5px; font-weight: 600; line-height: 1.5; white-space: nowrap; }
.dw-chip--green { background: var(--mint); color: var(--green-deep); }
.dw-chip--amber { background: var(--amber-soft); color: #8A5A15; }
.dw-chip--clay { background: var(--clay-soft); color: var(--clay); }
.dw-chip--blue { background: var(--blue-soft); color: var(--blue); }
.dw-chip--grey { background: var(--paper); color: var(--ink-soft); border: 1px solid var(--line); }
.dw-avatar { width: 36px; height: 36px; border-radius: 999px; display: grid; place-items: center; font-size: 13px; font-weight: 600; color: #fff; flex-shrink: 0; }

.dw-nav { position: sticky; top: 0; z-index: 50; transition: background .35s var(--ease), box-shadow .35s var(--ease); }
.dw-nav.is-scrolled { background: rgba(255,255,255,.92); backdrop-filter: saturate(1.4) blur(10px); box-shadow: 0 1px 0 var(--line); }
.dw-nav__inner { display: flex; align-items: center; justify-content: space-between; height: 76px; gap: 24px; }
.dw-logo svg { flex-shrink: 0; }
.dw-logo { display: inline-flex; align-items: center; gap: 10px; font-family: var(--display); font-weight: 700; font-size: 24px; letter-spacing: -0.02em; }
.dw-logo__tag { font-family: var(--body); font-size: 12.5px; font-weight: 600; letter-spacing: 0; padding: 3px 9px; border-radius: 999px; background: var(--mint); color: var(--green-deep); }
.dw-nav__links { display: flex; gap: 32px; font-weight: 500; font-size: 15.5px; }
.dw-nav__links a { opacity: .82; transition: opacity .2s; }
.dw-nav__links a:hover { opacity: 1; }
.dw-nav__right { display: flex; align-items: center; gap: 20px; }
.dw-nav__login { font-weight: 500; font-size: 15.5px; }
.dw-burger { display: none; width: 42px; height: 42px; border-radius: 10px; align-items: center; justify-content: center; border: 1px solid var(--line); background: #fff; }
.dw-drawer { position: fixed; inset: 0; z-index: 60; background: rgba(18,33,28,.3); animation: dw-fade .3s ease both; }
.dw-drawer__panel { position: absolute; right: 0; top: 0; bottom: 0; width: min(340px, 88vw); background: #fff; padding: 20px 24px 28px; display: flex; flex-direction: column; gap: 4px; animation: dw-slide .4s var(--ease) both; }
.dw-drawer__link { padding: 14px 0; border-bottom: 1px solid var(--line); font-weight: 500; font-size: 17px; }
.dw-drawer__panel .dw-btn { margin-top: auto; }

.dw-hero { position: relative; padding-top: 56px; padding-bottom: 96px; isolation: isolate; --px: 0; --py: 0; }
.dw-hero__bg { position: absolute; inset: -76px 0 0 0; z-index: -1; background: radial-gradient(60% 70% at 30% 30%, rgba(255,255,255,.9) 0%, rgba(255,255,255,0) 70%), linear-gradient(180deg, #E3F2E8 0%, #EDF6EF 60%, #FFFFFF 100%); }
.dw-hero__pattern { position: absolute; inset: 0; color: var(--green-deep); opacity: .055; translate: calc(var(--px) * -16px) calc(var(--py) * -12px); transition: translate .8s var(--ease);
  -webkit-mask-image: linear-gradient(180deg, #000 0%, #000 50%, transparent 100%); mask-image: linear-gradient(180deg, #000 0%, #000 50%, transparent 100%); }
.dw-hero__grid { display: grid; grid-template-columns: 1.05fr 1fr; gap: 64px; align-items: center; }
.dw-hero__text .dw-lead { margin-top: 22px; max-width: 540px; }
.dw-hero__text .dw-btn-row { margin-top: 34px; }
.dw-hero__facts { display: flex; flex-wrap: wrap; gap: 8px 22px; margin-top: 22px; font-size: 14px; color: var(--ink-soft); }
.dw-hero__facts span { display: inline-flex; align-items: center; gap: 6px; }
.dw-hero__facts svg { color: var(--green); }
.dw-hero__text > * { animation: dw-rise 1s var(--ease) both; }
.dw-hero__text > *:nth-child(2) { animation-delay: .1s; } .dw-hero__text > *:nth-child(3) { animation-delay: .2s; }
.dw-hero__text > *:nth-child(4) { animation-delay: .3s; } .dw-hero__text > *:nth-child(5) { animation-delay: .4s; }
.dw-calc-wrap { animation: dw-stage 1.2s var(--ease) .35s both; }
.dw-tilt { transform: perspective(1800px) rotateX(calc(var(--py) * -4deg)) rotateY(calc(var(--px) * 5deg)); transition: transform .8s var(--ease); }

.dw-calc { background: #fff; border: 1px solid var(--line); border-radius: 24px; box-shadow: 0 30px 80px -30px rgba(18,33,28,.28); padding: 28px; }
.dw-calc__row { margin-top: 22px; }
.dw-calc__label { display: flex; justify-content: space-between; align-items: baseline; font-weight: 500; font-size: 15px; }
.dw-calc__label strong { font-family: var(--display); font-size: 22px; }
.dw-range { width: 100%; margin-top: 12px; accent-color: var(--green); height: 6px; }
.dw-seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 4px; margin-top: 10px; background: var(--paper); border: 1px solid var(--line); border-radius: 12px; }
.dw-seg button { padding: 8px 6px; border-radius: 9px; font-size: 14px; font-weight: 600; color: var(--ink-soft); transition: background .25s var(--ease), color .25s; line-height: 1.3; }
.dw-seg button small { display: block; font-weight: 500; font-size: 12px; }
.dw-seg button.is-on { background: #fff; color: var(--ink); box-shadow: 0 1px 3px rgba(18,33,28,.12); }
.dw-calc__out { margin-top: 24px; border-radius: 18px; background: var(--ink); color: #fff; padding: 22px; position: relative; overflow: hidden; isolation: isolate; }
.dw-calc__out .dw-arch { position: absolute; inset: 0; z-index: -1; color: #fff; opacity: .05; }
.dw-calc__total { font-family: var(--display); font-weight: 700; font-size: 44px; letter-spacing: -0.02em; line-height: 1.1; margin-top: 4px; }
.dw-calc__split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,.14); font-size: 13.5px; color: #B9CEC4; }
.dw-calc__split strong { display: block; color: #fff; font-size: 17px; font-weight: 600; }
.dw-swap { display: inline-block; animation: dw-swap .45s var(--ease) both; }

.dw-rules { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 56px; }
.dw-rule { background: var(--paper); border: 1px solid var(--line); border-radius: 24px; padding: 32px; transition: translate .4s var(--ease), box-shadow .4s var(--ease); }
.dw-rule:hover { translate: 0 -4px; box-shadow: 0 24px 50px -30px rgba(18,33,28,.35); }
.dw-rule__big { font-family: var(--display); font-weight: 700; font-size: 52px; letter-spacing: -0.03em; line-height: 1; margin: 28px 0 12px; }
.dw-rule__icon { width: 48px; height: 48px; border-radius: 14px; background: #fff; border: 1px solid var(--line); display: grid; place-items: center; color: var(--green); }
.dw-rule--dark { background: var(--ink); color: #fff; border-color: var(--ink); }
.dw-rule--dark .dw-body { color: #B9CEC4; }
.dw-rule--dark .dw-rule__icon { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.14); color: #5FD3A1; }

.dw-panel { background: var(--paper); border: 1px solid var(--line); border-radius: 28px; padding: 56px; margin-top: 56px; }
.dw-steps3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; position: relative; }
.dw-steps3::before { content: ""; position: absolute; left: 16.6%; right: 16.6%; top: 28px; height: 1px; background: #A9BBB2; }
.dw-step3 { position: relative; text-align: center; padding: 0 20px; }
.dw-step3__dot { width: 56px; height: 56px; border-radius: 999px; background: #fff; border: 1px solid var(--line); display: grid; place-items: center; margin: 0 auto 22px; position: relative; box-shadow: 0 14px 30px -18px rgba(18,33,28,.35); }
.dw-step3__dot span { width: 40px; height: 40px; border-radius: 999px; background: var(--ink); color: #fff; display: grid; place-items: center; }
.dw-step3 .dw-h4 { margin-bottom: 8px; }
.dw-step3 p { color: var(--ink-soft); max-width: 300px; margin: 0 auto; font-size: 15.5px; }
.dw-otp-mini { display: inline-flex; gap: 5px; margin-top: 16px; }
.dw-otp-mini span { width: 28px; height: 34px; border-radius: 8px; background: #fff; border: 1px solid var(--line); display: grid; place-items: center; font-family: var(--mono); font-size: 14px; }
.dw-codepills { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin-top: 16px; }
.dw-codepill { padding: 4px 10px; border-radius: 999px; background: var(--mint); color: var(--green-deep); font-family: var(--mono); font-size: 13px; }

.dw-split { display: grid; grid-template-columns: 1fr 1.1fr; gap: 80px; align-items: center; }
.dw-split__visual { position: relative; border-radius: 26px; padding: 44px 36px; display: flex; justify-content: center;
  background: radial-gradient(90% 80% at 20% 10%, #CFE9D9 0%, rgba(207,233,217,0) 60%), radial-gradient(80% 80% at 90% 100%, #E7EFE2 0%, rgba(231,239,226,0) 60%), #DDEBE2; }
.dw-seelist { list-style: none; padding: 0; margin: 28px 0 0; display: flex; flex-direction: column; gap: 14px; }
.dw-seelist li { display: grid; grid-template-columns: 26px 1fr; gap: 12px; font-size: 16.5px; }
.dw-seelist li strong { display: block; font-weight: 600; }
.dw-seelist li span.dw-body { font-size: 15px; }
.dw-tick { width: 26px; height: 26px; border-radius: 999px; background: var(--mint); color: var(--green-deep); display: grid; place-items: center; }

.dw-who { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 56px; }
.dw-who__card { border: 1px solid var(--line); border-radius: 22px; padding: 28px; background: #fff; transition: translate .4s var(--ease), border-color .3s; }
.dw-who__card:hover { translate: 0 -4px; border-color: #BFDCCB; }
.dw-who__card svg { color: var(--green); margin-bottom: 18px; }
.dw-who__card .dw-h4 { margin-bottom: 6px; }

.dw-fair { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 48px; }
.dw-fair__col { border-radius: 24px; padding: 32px; border: 1px solid var(--line); }
.dw-fair__col ul { list-style: none; padding: 0; margin: 18px 0 0; display: flex; flex-direction: column; gap: 12px; }
.dw-fair__col li { display: grid; grid-template-columns: 24px 1fr; gap: 10px; font-size: 15.5px; }
.dw-fair__mark { width: 24px; height: 24px; border-radius: 99px; display: grid; place-items: center; margin-top: 1px; }

.dw-faq { max-width: 780px; margin: 48px auto 0; border-top: 1px solid var(--line); }
.dw-faq__item { border-bottom: 1px solid var(--line); }
.dw-faq__q { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 24px; text-align: left; padding: 22px 4px; font-family: var(--display); font-weight: 700; font-size: 18.5px; line-height: 1.4; transition: color .2s; }
.dw-faq__q:hover { color: var(--green-deep); }
.dw-faq__q svg { flex-shrink: 0; transition: transform .3s var(--ease); color: var(--ink-soft); }
.dw-faq__item.is-open .dw-faq__q svg { transform: rotate(180deg); }
.dw-faq__panel { display: grid; grid-template-rows: 0fr; opacity: 0; transition: grid-template-rows .45s var(--ease), opacity .35s ease; }
.dw-faq__item.is-open .dw-faq__panel { grid-template-rows: 1fr; opacity: 1; }
.dw-faq__inner { overflow: hidden; min-height: 0; }
.dw-faq__a { padding: 0 4px 24px; color: var(--ink-soft); max-width: 680px; }

.dw-final { position: relative; overflow: hidden; background: var(--ink); color: #fff; border-radius: 32px; padding: 88px 48px; text-align: center; isolation: isolate; }
.dw-final .dw-arch { position: absolute; inset: 0; z-index: -1; color: #fff; opacity: .06; }
.dw-final__glow { position: absolute; inset: auto 0 -40% 0; height: 90%; z-index: -1; background: radial-gradient(50% 60% at 50% 100%, rgba(31,168,114,.45) 0%, rgba(31,168,114,0) 70%); }
.dw-final p { color: #A9C2B7; }
.dw-footer { border-top: 1px solid var(--line); padding-block: 40px; margin-top: 112px; }
.dw-footer__row { display: flex; justify-content: space-between; align-items: center; gap: 24px; flex-wrap: wrap; font-size: 14px; color: var(--ink-soft); }
.dw-footer__row nav { display: flex; gap: 22px; }
.dw-footer__row nav a:hover { color: var(--ink); }

.dw-auth { min-height: 100vh; display: grid; grid-template-columns: 1fr 1fr; }
.dw-auth__side { position: relative; overflow: hidden; isolation: isolate; background: var(--ink); color: #fff; padding: 40px 56px; display: flex; flex-direction: column; justify-content: space-between; }
.dw-auth__side--art { align-items: center; justify-content: center; gap: 8px; }
.dw-auth__side--art .dw-logo { align-self: flex-start; }
.dw-auth__side--art img { width: min(82%, 480px); height: auto; max-height: 68%; object-fit: contain; margin: auto; filter: drop-shadow(0 24px 40px rgba(0,0,0,.28)); }
.dw-auth__side .dw-arch { position: absolute; inset: 0; z-index: -1; color: #fff; opacity: .05; }
.dw-auth__side .dw-final__glow { inset: auto -20% -30% -20%; }
.dw-auth__side .dw-logo { color: #fff; }
.dw-auth__points { list-style: none; padding: 0; margin: 32px 0 0; display: flex; flex-direction: column; gap: 16px; }
.dw-auth__points li { display: grid; grid-template-columns: 28px 1fr; gap: 12px; color: #CFE0D8; font-size: 16px; }
.dw-auth__points li svg { color: #5FD3A1; margin-top: 3px; }
.dw-auth__main { display: flex; flex-direction: column; padding: 32px 24px; }
.dw-auth__top { display: flex; justify-content: space-between; align-items: center; max-width: 460px; width: 100%; margin: 0 auto; }
.dw-auth__box { width: 100%; max-width: 460px; margin: auto; padding-block: 40px; }
.dw-auth__box > * { animation: dw-swap .5s var(--ease) both; }
.dw-progress { display: flex; gap: 6px; margin-bottom: 28px; }
.dw-progress span { height: 4px; flex: 1; border-radius: 9px; background: var(--line); transition: background .4s var(--ease); }
.dw-progress span.is-on { background: var(--green); }
.dw-field { display: flex; flex-direction: column; gap: 7px; margin-top: 18px; }
.dw-field label { font-weight: 500; font-size: 14.5px; }
.dw-input { height: 52px; border-radius: 12px; border: 1px solid #CDD4CE; background: #fff; padding: 0 16px; font: inherit; font-size: 16px; color: var(--ink); width: 100%; transition: border-color .2s, box-shadow .2s; }
.dw-input:focus { outline: none; border-color: var(--green); box-shadow: 0 0 0 4px rgba(11,138,92,.12); }
.dw-input.is-error { border-color: var(--clay); }
.dw-inputgroup { display: flex; align-items: stretch; border: 1px solid #CDD4CE; border-radius: 12px; overflow: hidden; background: #fff; transition: border-color .2s, box-shadow .2s; }
.dw-inputgroup:focus-within { border-color: var(--green); box-shadow: 0 0 0 4px rgba(11,138,92,.12); }
.dw-inputgroup.is-error { border-color: var(--clay); }
.dw-inputgroup__pre { display: flex; align-items: center; gap: 6px; padding: 0 14px; background: var(--paper); border-right: 1px solid var(--line); font-weight: 500; color: var(--ink-soft); }
.dw-inputgroup .dw-input { border: 0; border-radius: 0; box-shadow: none; }
.dw-err { color: var(--clay); font-size: 13.5px; display: flex; align-items: center; gap: 6px; }
.dw-hint { font-size: 13.5px; color: var(--ink-soft); }
.dw-check { display: grid; grid-template-columns: 20px 1fr; gap: 10px; align-items: start; margin-top: 20px; font-size: 14px; color: var(--ink-soft); cursor: pointer; }
.dw-check input { width: 18px; height: 18px; margin-top: 2px; accent-color: var(--green); }
.dw-otp { display: grid; gap: 10px; margin-top: 24px; }
.dw-otp input { height: 60px; text-align: center; font-family: var(--mono); font-size: 24px; border-radius: 12px; border: 1px solid #CDD4CE; width: 100%; min-width: 0; transition: border-color .2s, box-shadow .2s, scale .2s var(--ease); }
.dw-otp input:focus { outline: none; border-color: var(--green); box-shadow: 0 0 0 4px rgba(11,138,92,.12); scale: 1.04; }
.dw-otp.is-error input { border-color: var(--clay); animation: dw-shake .4s ease; }
@keyframes dw-shake { 25% { translate: -4px 0; } 75% { translate: 4px 0; } }
.dw-waline { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 12px; background: var(--mint-soft); border: 1px solid #CFE6D8; font-size: 14px; margin-top: 18px; }
.dw-waline svg { color: var(--green); flex-shrink: 0; }

.dw-reveal { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 24px; }
.dw-reveal__word { padding: 10px 16px; border-radius: 12px; background: var(--ink); color: #fff; font-family: var(--mono); font-size: 18px; animation: dw-flip .7s var(--ease) both; }
.dw-reveal__word:nth-child(2) { animation-delay: .12s; } .dw-reveal__word:nth-child(3) { animation-delay: .24s; }
.dw-reveal__word:nth-child(4) { animation-delay: .36s; } .dw-reveal__word:nth-child(5) { animation-delay: .48s; }
@keyframes dw-flip { from { opacity: 0; transform: perspective(400px) rotateX(-80deg) translateY(10px); } to { opacity: 1; transform: none; } }
.dw-success-ring { width: 64px; height: 64px; border-radius: 999px; background: var(--mint); color: var(--green-deep); display: grid; place-items: center; margin-bottom: 22px; animation: dw-pop .6s var(--ease) both; }
@keyframes dw-pop { from { scale: .4; opacity: 0; } 70% { scale: 1.08; } to { scale: 1; opacity: 1; } }

.dw-app { display: grid; grid-template-columns: 248px 1fr; min-height: 100vh; background: var(--paper); }
.dw-side { position: sticky; top: 0; height: 100vh; background: #fff; border-right: 1px solid var(--line); padding: 22px 16px; display: flex; flex-direction: column; gap: 4px; }
.dw-side .dw-logo { padding: 0 8px 22px; font-size: 22px; }
.dw-side__link { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; font-weight: 500; font-size: 15px; color: var(--ink-soft); transition: background .2s, color .2s; width: 100%; text-align: left; }
.dw-side__link:hover { background: var(--paper); color: var(--ink); }
.dw-side__link.is-active { background: var(--mint-soft); color: var(--ink); box-shadow: inset 0 0 0 1px #CFE6D8; }
.dw-side__link.is-active svg { color: var(--green); }
.dw-side__badge { margin-left: auto; font-size: 11.5px; font-weight: 600; background: var(--amber-soft); color: #8A5A15; border-radius: 999px; padding: 1px 8px; }
.dw-side__foot { margin-top: auto; border-top: 1px solid var(--line); padding-top: 16px; display: flex; align-items: center; gap: 10px; }
.dw-main { min-width: 0; padding: 28px 36px 64px; }
.dw-topbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 28px; }
.dw-topbar h1 { font-family: var(--display); font-weight: 700; font-size: 28px; letter-spacing: -0.01em; }
.dw-view { animation: dw-swap .45s var(--ease) both; }
.dw-grid { display: grid; gap: 20px; }
.dw-grid--2 { grid-template-columns: 1.35fr 1fr; }
.dw-grid--4 { grid-template-columns: repeat(4, 1fr); }
.dw-box { background: #fff; border: 1px solid var(--line); border-radius: 20px; padding: 24px; min-width: 0; }
.dw-box__head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; }
.dw-box__title { font-family: var(--display); font-weight: 700; font-size: 18px; }
.dw-stat__label { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--ink-soft); font-weight: 500; }
.dw-stat__icon { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; }
.dw-stat__num { font-family: var(--display); font-weight: 700; font-size: 32px; letter-spacing: -0.02em; margin-top: 12px; line-height: 1.1; }
.dw-stat__sub { font-size: 13px; color: var(--ink-soft); margin-top: 6px; }

.dw-codecard { position: relative; overflow: hidden; isolation: isolate; background: var(--ink); color: #fff; border-radius: 20px; padding: 26px; }
.dw-codecard .dw-arch { position: absolute; inset: 0; z-index: -1; color: #fff; opacity: .05; }
.dw-codecard .dw-final__glow { inset: auto -20% -60% 30%; }
.dw-codecard__words { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.dw-codecard__words span { padding: 8px 14px; border-radius: 10px; background: rgba(255,255,255,.09); border: 1px solid rgba(255,255,255,.14); font-family: var(--mono); font-size: 22px; letter-spacing: 0.04em; }
.dw-linkfield { display: flex; align-items: center; gap: 8px; margin-top: 16px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.14); border-radius: 12px; padding: 6px 6px 6px 14px; }
.dw-linkfield code { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--mono); font-size: 13px; color: #CFE0D8; }
.dw-iconbtn { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px; border-radius: 9px; font-size: 13.5px; font-weight: 600; transition: background .2s; }
.dw-iconbtn--light { background: #fff; color: var(--ink); }
.dw-iconbtn--light:hover { background: var(--mint); }
.dw-iconbtn--ghost { border: 1px solid var(--line); background: #fff; }
.dw-iconbtn--ghost:hover { border-color: var(--ink); }
.dw-iconbtn--dark { border: 1px solid rgba(255,255,255,.2); color: #fff; }
.dw-iconbtn--dark:hover { background: rgba(255,255,255,.1); }

.dw-ring { position: relative; width: 132px; height: 132px; flex-shrink: 0; }
.dw-ring svg { transform: rotate(-90deg); }
.dw-ring circle { transition: stroke-dashoffset 1.2s var(--ease); }
.dw-ring__label { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; line-height: 1.1; }
.dw-ring__label strong { font-family: var(--display); font-size: 30px; display: block; }

.dw-bar { height: 10px; border-radius: 99px; background: var(--paper); border: 1px solid var(--line); overflow: hidden; }
.dw-bar span { display: block; height: 100%; background: linear-gradient(90deg, var(--green), #1FA872); border-radius: 99px; transition: width 1.2s var(--ease); }

.dw-feed { display: flex; flex-direction: column; }
.dw-feed__item { display: grid; grid-template-columns: 34px 1fr auto; gap: 12px; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--line); font-size: 14.5px; }
.dw-feed__item:last-child { border-bottom: 0; }
.dw-feed__icon { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; }

.dw-tabs { display: inline-flex; gap: 4px; padding: 4px; border-radius: 12px; background: #fff; border: 1px solid var(--line); }
.dw-tabs button { height: 36px; padding: 0 14px; border-radius: 9px; font-weight: 600; font-size: 14px; color: var(--ink-soft); display: inline-flex; align-items: center; gap: 8px; transition: background .25s var(--ease), color .2s; }
.dw-tabs button.is-on { background: var(--ink); color: #fff; }
.dw-tabs button .dw-count { font-size: 12px; padding: 0 7px; border-radius: 99px; background: var(--paper); color: var(--ink-soft); }
.dw-tabs button.is-on .dw-count { background: rgba(255,255,255,.18); color: #fff; }

.dw-tablewrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 18px; background: #fff; }
.dw-table { width: 100%; border-collapse: collapse; min-width: 720px; font-size: 14.5px; }
.dw-table th { text-align: left; font-weight: 600; font-size: 13px; color: var(--ink-soft); padding: 13px 18px; background: var(--paper); border-bottom: 1px solid var(--line); white-space: nowrap; }
.dw-table td { padding: 14px 18px; border-bottom: 1px solid var(--line); vertical-align: middle; }
.dw-table tr:last-child td { border-bottom: 0; }
.dw-table tbody tr { transition: background .2s; }
.dw-table tbody tr:hover { background: #FBFCFA; }
.dw-table .dw-right { text-align: right; }
.dw-empty { padding: 48px 24px; text-align: center; color: var(--ink-soft); }
.dw-empty svg { color: var(--green); margin-bottom: 12px; }

.dw-callout { display: grid; grid-template-columns: 22px 1fr; gap: 12px; padding: 14px 16px; border-radius: 14px; background: var(--mint-soft); border: 1px solid #CFE6D8; font-size: 14.5px; color: var(--ink-soft); }
.dw-callout svg { color: var(--green); margin-top: 2px; }
.dw-callout--amber { background: var(--amber-soft); border-color: #EBD3AC; }
.dw-callout--amber svg { color: var(--amber); }
.dw-callout strong { color: var(--ink); }

.dw-share { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.dw-share__msg { background: var(--paper); border: 1px solid var(--line); border-radius: 14px; padding: 14px; font-size: 14.5px; white-space: pre-wrap; margin: 12px 0 16px; min-height: 150px; }

.dw-toggle { position: relative; width: 44px; height: 26px; border-radius: 99px; background: #CDD4CE; transition: background .25s var(--ease); flex-shrink: 0; }
.dw-toggle::after { content: ""; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 99px; background: #fff; transition: translate .25s var(--ease); box-shadow: 0 1px 3px rgba(0,0,0,.2); }
.dw-toggle.is-on { background: var(--green); }
.dw-toggle.is-on::after { translate: 18px 0; }

.dw-modal { position: fixed; inset: 0; z-index: 80; background: rgba(12,21,18,.55); display: grid; place-items: center; padding: 20px; animation: dw-fade .25s ease both; }
.dw-modal__box { width: min(480px, 100%); background: #fff; border-radius: 22px; padding: 28px; animation: dw-stage .45s var(--ease) both; }
.dw-toast { position: fixed; left: 50%; bottom: 28px; translate: -50% 0; z-index: 90; background: var(--ink); color: #fff; padding: 12px 18px; border-radius: 12px; font-size: 14.5px; display: flex; align-items: center; gap: 10px; box-shadow: 0 20px 40px -16px rgba(0,0,0,.5); animation: dw-toast .4s var(--ease) both; }
.dw-toast svg { color: #5FD3A1; }
@keyframes dw-toast { from { opacity: 0; translate: -50% 16px; } to { opacity: 1; translate: -50% 0; } }

.dw-skel { border-radius: 12px; background: linear-gradient(100deg, #EEF2EE 30%, #F7F9F6 50%, #EEF2EE 70%); background-size: 300% 100%; animation: dw-shimmer 1.4s linear infinite; }
@keyframes dw-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
.dw-tabbar { display: none; }

@keyframes dw-rise { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: none; } }
@keyframes dw-stage { from { opacity: 0; transform: translateY(40px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes dw-swap { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes dw-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes dw-slide { from { transform: translateX(100%); } to { transform: none; } }
.dw.rv-ready .dw-rv { opacity: 0; translate: 0 30px; transition: opacity .9s var(--ease), translate .9s var(--ease); transition-delay: calc(var(--rv-i, 0) * 90ms); }
.dw.rv-ready .dw-rv.is-in { opacity: 1; translate: 0 0; }

@media (max-width: 1100px) {
  .dw-grid--4 { grid-template-columns: repeat(2, 1fr); }
  .dw-share { grid-template-columns: 1fr; }
}
@media (max-width: 960px) {
  .dw-section { padding-block: 84px; }
  .dw-nav__links, .dw-nav__login { display: none; }
  .dw-burger { display: inline-flex; }
  .dw-h1 { font-size: 44px; } .dw-h2 { font-size: 32px; }
  .dw-hero__grid, .dw-split { grid-template-columns: 1fr; gap: 48px; }
  .dw-tilt { transform: none; }
  .dw-rules, .dw-fair { grid-template-columns: 1fr; }
  .dw-who { grid-template-columns: 1fr 1fr; }
  .dw-panel { padding: 36px 24px; }
  .dw-steps3 { grid-template-columns: 1fr; gap: 36px; }
  .dw-steps3::before { left: 50%; right: auto; top: 28px; bottom: 28px; width: 1px; height: auto; }
  .dw-auth { grid-template-columns: 1fr; }
  .dw-auth__side { display: none; }
  .dw-app { grid-template-columns: 1fr; }
  .dw-side { display: none; }
  .dw-main { padding: 20px 16px 110px; }
  .dw-grid--2 { grid-template-columns: 1fr; }
  .dw-tabbar { display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; background: rgba(255,255,255,.96); backdrop-filter: blur(10px); border-top: 1px solid var(--line); padding: 6px 6px calc(6px + env(safe-area-inset-bottom)); justify-content: space-around; }
  .dw-tabbar button { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 11px; font-weight: 600; color: var(--ink-soft); padding: 6px 4px; border-radius: 10px; flex: 1; }
  .dw-tabbar button.is-on { color: var(--green-deep); background: var(--mint-soft); }
}
@media (max-width: 640px) {
  .dw-h1 { font-size: 36px; } .dw-h2 { font-size: 28px; }
  .dw-btn-row .dw-btn { width: 100%; }
  .dw-who { grid-template-columns: 1fr; }
  .dw-grid--4 { grid-template-columns: 1fr 1fr; gap: 12px; }
  .dw-box { padding: 18px; }
  .dw-stat__num { font-size: 26px; }
  .dw-final { padding: 64px 22px; border-radius: 24px; }
  .dw-calc__total { font-size: 36px; }
  .dw-topbar h1 { font-size: 22px; }
}
@media (prefers-reduced-motion: reduce) {
  html:has(.dw) { scroll-behavior: auto; }
  .dw *, .dw *::before, .dw *::after { animation: none !important; transition: none !important; }
  .dw-tilt, .dw-hero__pattern { transform: none !important; translate: none !important; }
}
`;

const STYLES_EXTRA = `
.dw-mobile-only { display: none !important; }
.dw-auth__mlogo { visibility: hidden; }
@media (max-width: 960px) {
  .dw-mobile-only { display: inline-flex !important; }
  .dw-auth__mlogo { visibility: visible; }
  .dw-auth__top { flex-wrap: wrap; gap: 12px; }
}
.dw-sprint { display: flex; gap: 22px; align-items: center; }
@media (max-width: 640px) {
  .dw-nav__right .dw-btn { display: none; }
  .dw-topbar .dw-btn-row { flex-wrap: nowrap; }
  .dw-topbar .dw-btn-row .dw-btn { width: auto; }
  .dw-sprint { flex-direction: column; text-align: center; }
  .dw-sprint .dw-chip { white-space: normal; }
  .dw-topbar { align-items: flex-start; }
}
`;

/* ============================================================
   PRIMITIVES
   ============================================================ */

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

function Logo({ dark = true, to = "/partners" }) {
  return (
    <Link to={to} className="dw-logo" aria-label={`${PROGRAM.brand} Partners home`}>
      <Mark size={36} />
      <span>{PROGRAM.brand.toLowerCase()}</span>
      <span className="dw-logo__tag">Partners</span>
    </Link>
  );
}

function ArchPattern({ id, className = "dw-arch" }) {
  return (
    <svg className={className} aria-hidden="true" width="100%" height="100%">
      <defs>
        <pattern id={id} width="64" height="72" patternUnits="userSpaceOnUse">
          <path d="M14 62V32a18 18 0 0 1 36 0v30" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

const AVATAR_COLORS = ["#0B8A5C", "#3C6E91", "#7A5A9E", "#C98A2E", "#B24A3F", "#2F4F46"];
function Avatar({ name, i = 0, size = 36 }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return <span className="dw-avatar" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length], width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">{initials}</span>;
}

function usePrefersReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(mq.matches);
    const on = (e) => setR(e.matches);
    mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
    return () => (mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on));
  }, []);
  return r;
}

function useScrollReveal(rootRef, selectors, deps = []) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) return;
    const els = Array.from(root.querySelectorAll(selectors.join(",")));
    const per = new Map();
    els.forEach((el) => {
      const p = el.parentElement; const i = per.get(p) || 0; per.set(p, i + 1);
      el.classList.add("dw-rv"); el.style.setProperty("--rv-i", String(Math.min(i, 6)));
    });
    root.classList.add("rv-ready");
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target; io.unobserve(el); el.classList.add("is-in");
      const done = (e) => { if (e.target !== el || e.propertyName !== "opacity") return; el.removeEventListener("transitionend", done); el.classList.remove("dw-rv", "is-in"); };
      el.addEventListener("transitionend", done);
    }), { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    els.forEach((el) => io.observe(el));
    return () => { io.disconnect(); root.classList.remove("rv-ready"); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

const ToastCtx = createContext({ show: () => {} });
function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const t = useRef(0);
  const show = useCallback((m) => { setMsg({ m, k: Date.now() }); clearTimeout(t.current); t.current = setTimeout(() => setMsg(null), 2400); }, []);
  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      {msg && <div key={msg.k} className="dw-toast" role="status"><CircleCheck size={17} />{msg.m}</div>}
    </ToastCtx.Provider>
  );
}
const useToast = () => useContext(ToastCtx);

function CopyBtn({ text, label = "Copy", done = "Copied", className = "dw-iconbtn dw-iconbtn--ghost", toastMsg }) {
  const [ok, setOk] = useState(false);
  const toast = useToast();
  return (
    <button type="button" className={className} onClick={async () => {
      if (await copyText(text)) { setOk(true); toast.show(toastMsg || "Copied to clipboard"); setTimeout(() => setOk(false), 1600); }
    }}>
      {ok ? <Check size={15} /> : <Copy size={15} />}{ok ? done : label}
    </button>
  );
}

/* ============================================================
   LANDING PAGE
   ============================================================ */

const LANDING_LINKS = [
  { label: "How it works", href: "#how" },
  { label: "Earnings", href: "#earnings" },
  { label: "Rules", href: "#rules" },
  { label: "FAQ", href: "#faq" },
];

function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24); on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`dw-nav ${scrolled ? "is-scrolled" : ""}`}>
      <div className="dw-wrap dw-nav__inner">
        <Logo />
        <nav className="dw-nav__links" aria-label="Main">{LANDING_LINKS.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}</nav>
        <div className="dw-nav__right">
          <Link className="dw-nav__login" to="/partners/login">Log in</Link>
          <Link className="dw-btn dw-btn--primary dw-btn--sm" to="/partners/join">Become a partner</Link>
          <button className="dw-burger" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
        </div>
      </div>
      {open && (
        <div className="dw-drawer" onClick={() => setOpen(false)}>
          <div className="dw-drawer__panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Menu">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Logo /><button className="dw-burger" style={{ display: "inline-flex" }} onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button>
            </div>
            {LANDING_LINKS.map((l) => <a key={l.href} className="dw-drawer__link" href={l.href} onClick={() => setOpen(false)}>{l.label}</a>)}
            <Link className="dw-drawer__link" to="/partners/login" onClick={() => setOpen(false)}>Log in</Link>
            <Link className="dw-btn dw-btn--primary" to="/partners/join" onClick={() => setOpen(false)}>Become a partner</Link>
          </div>
        </div>
      )}
    </header>
  );
}

/** Real single-plan pricing from /api/plans — no more 3-tier picker. */
function EarningsCalculator() {
  const [teams, setTeams] = useState(10);
  const [annual, setAnnual] = useState(false);
  const { data } = usePlans(annual ? 12 : 1);
  const plan = data?.plans?.[0];
  const value = plan ? (annual ? plan.ratePaiseMonth * 12 : plan.normalPaiseMonth) : 0;
  const commission = teams * value * PROGRAM.commissionRate;
  const bonus = Math.floor(teams / PROGRAM.bonus.every) * PROGRAM.bonus.amountPaise;
  const total = commission + bonus;
  const key = `${teams}-${annual}-${plan?.code ?? ""}`;
  return (
    <div className="dw-calc" aria-label="Earnings calculator">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="dw-h4">What you could earn</h2>
        <span className="dw-chip dw-chip--green"><IndianRupee size={12} /> Estimate</span>
      </div>

      <div className="dw-calc__row">
        <label className="dw-calc__label" htmlFor="calc-teams">Teams you refer in a month <strong key={teams} className="dw-swap">{teams}</strong></label>
        <input id="calc-teams" className="dw-range" type="range" min="1" max="30" value={teams} onChange={(e) => setTeams(+e.target.value)} />
      </div>

      <div className="dw-calc__row">
        <div className="dw-calc__label">They pay</div>
        <div className="dw-seg" style={{ gridTemplateColumns: "1fr 1fr" }} role="group" aria-label="Billing">
          <button type="button" className={!annual ? "is-on" : ""} aria-pressed={!annual} onClick={() => setAnnual(false)}>Monthly</button>
          <button type="button" className={annual ? "is-on" : ""} aria-pressed={annual} onClick={() => setAnnual(true)}>Annual</button>
        </div>
        {plan && <p className="dw-small" style={{ marginTop: 10 }}>Every referral is on {plan.name} — {money(value)} {annual ? "for the year" : "a month"}.</p>}
      </div>

      <div className="dw-calc__out">
        <ArchPattern id="dw-arch-calc" />
        <div style={{ fontSize: 14, color: "#B9CEC4" }}>You'd earn</div>
        <div key={key} className="dw-calc__total dw-swap">{money(total)}</div>
        <div className="dw-calc__split">
          <div>10% commission<strong key={`c${key}`} className="dw-swap">{money(commission)}</strong></div>
          <div>Speed bonus<strong key={`b${key}`} className="dw-swap">{money(bonus)}</strong></div>
        </div>
      </div>
      <p className="dw-small" style={{ marginTop: 12, fontSize: 13 }}>
        Commission is paid on each team's {PROGRAM.commissionOn}. The bonus assumes every {PROGRAM.bonus.every} checkouts land within {PROGRAM.bonus.withinDays} days.
      </p>
    </div>
  );
}

function LandingHero() {
  const ref = useRef(null);
  const raf = useRef(0);
  const reduced = usePrefersReducedMotion();
  const onMove = (e) => {
    if (reduced || e.pointerType !== "mouse" || !ref.current) return;
    const { clientX: x, clientY: y } = e;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const r = ref.current.getBoundingClientRect();
      ref.current.style.setProperty("--px", ((x - r.left) / r.width - 0.5).toFixed(3));
      ref.current.style.setProperty("--py", ((y - r.top) / r.height - 0.5).toFixed(3));
    });
  };
  const onLeave = () => { ref.current?.style.setProperty("--px", "0"); ref.current?.style.setProperty("--py", "0"); };
  return (
    <section className="dw-hero" ref={ref} onPointerMove={onMove} onPointerLeave={onLeave}>
      <div className="dw-hero__bg" aria-hidden="true"><ArchPattern id="dw-arch-hero" className="dw-hero__pattern" /></div>
      <div className="dw-wrap dw-hero__grid">
        <div className="dw-hero__text">
          <span className="dw-pill" style={{ marginBottom: 26 }}><Gift size={16} /> {PROGRAM.brand} Partner Program</span>
          <h1 className="dw-h1">Bring a team to {PROGRAM.brand}. Earn 10% of what they pay.</h1>
          <p className="dw-lead">
            Share your 5-character code with businesses that sell on WhatsApp. When they check out, you earn {PROGRAM.commissionRate * 100}%, plus {money(PROGRAM.bonus.amountPaise)} for every {PROGRAM.bonus.every} teams you bring in within {PROGRAM.bonus.withinDays} days.
          </p>
          <div className="dw-btn-row">
            <Link className="dw-btn dw-btn--primary" to="/partners/join">Become a partner</Link>
            <Link className="dw-btn dw-btn--ghost" to="/partners/login">Log in</Link>
          </div>
          <div className="dw-hero__facts">
            <span><Check size={15} strokeWidth={2.5} />Join with a WhatsApp OTP</span>
            <span><Check size={15} strokeWidth={2.5} />Free to join</span>
            <span><Check size={15} strokeWidth={2.5} />Paid to UPI or bank</span>
          </div>
        </div>
        <div className="dw-calc-wrap"><div className="dw-tilt"><EarningsCalculator /></div></div>
      </div>
    </section>
  );
}

function RulesTrio() {
  return (
    <section className="dw-section" id="earnings" aria-labelledby="earn-h" style={{ paddingTop: 24 }}>
      <div className="dw-wrap">
        <div className="dw-center" style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2 id="earn-h" className="dw-h2">Three numbers to remember.</h2>
          <p className="dw-lead" style={{ marginTop: 14 }}>That's the whole program. No tiers to climb, no points to convert.</p>
        </div>
        <div className="dw-rules">
          <article className="dw-rule">
            <span className="dw-rule__icon"><IndianRupee size={22} /></span>
            <div className="dw-rule__big">{PROGRAM.commissionRate * 100}%</div>
            <h3 className="dw-h4">Of every completed checkout</h3>
            <p className="dw-body" style={{ marginTop: 8 }}>Calculated on the {PROGRAM.commissionOn} of every team that joins through your link or code.</p>
          </article>
          <article className="dw-rule dw-rule--dark">
            <span className="dw-rule__icon"><Timer size={22} /></span>
            <div className="dw-rule__big">{money(PROGRAM.bonus.amountPaise)}</div>
            <h3 className="dw-h4">For every {PROGRAM.bonus.every} in {PROGRAM.bonus.withinDays} days</h3>
            <p className="dw-body" style={{ marginTop: 8 }}>Land {PROGRAM.bonus.every} completed checkouts within any {PROGRAM.bonus.withinDays}-day stretch and the bonus is added on top. It repeats every time you do it.</p>
          </article>
          <article className="dw-rule">
            <span className="dw-rule__icon"><Wallet size={22} /></span>
            <div className="dw-rule__big">{money(PROGRAM.minPayoutPaise)}</div>
            <h3 className="dw-h4">Minimum to withdraw</h3>
            <p className="dw-body" style={{ marginTop: 8 }}>Once your approved balance crosses {money(PROGRAM.minPayoutPaise)}, request a payout. It reaches your UPI or bank within {PROGRAM.payoutSla}.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="dw-section" id="how" aria-labelledby="how-h" style={{ paddingTop: 0 }}>
      <div className="dw-wrap">
        <div className="dw-center"><h2 id="how-h" className="dw-h2">From sign-up to first payout</h2></div>
        <div className="dw-panel">
          <ol className="dw-steps3" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            <li className="dw-step3">
              <div className="dw-step3__dot"><span><Phone size={18} /></span></div>
              <h3 className="dw-h4">Join with WhatsApp</h3>
              <p>Add your name, phone and email. We send a one-time code on WhatsApp to confirm it's you.</p>
              <div className="dw-otp-mini" aria-hidden="true">{"482915".split("").map((d, i) => <span key={i}>{d}</span>)}</div>
            </li>
            <li className="dw-step3">
              <div className="dw-step3__dot"><span><Sparkles size={18} /></span></div>
              <h3 className="dw-h4">Get your referral code</h3>
              <p>Easy to say on a call, hard to mistype. It comes with a link that tracks every click for {PROGRAM.attributionDays} days.</p>
              <div className="dw-codepills" aria-hidden="true">{["maple", "river", "quiet", "orbit", "lotus"].map((w) => <span key={w} className="dw-codepill">{w}</span>)}</div>
            </li>
            <li className="dw-step3">
              <div className="dw-step3__dot"><span><Wallet size={18} /></span></div>
              <h3 className="dw-h4">Share it and get paid</h3>
              <p>Watch uses, checkouts and payouts in your dashboard. Commission is approved after the {PROGRAM.holdDays}-day refund window.</p>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}

function DashboardPreview() {
  return (
    <section className="dw-section" aria-labelledby="dash-h" style={{ paddingTop: 0 }}>
      <div className="dw-wrap dw-split">
        <div>
          <h2 id="dash-h" className="dw-h2">See every rupee before it lands.</h2>
          <p className="dw-lead" style={{ marginTop: 18 }}>Your partner dashboard shows exactly where each referral stands, so you know who to nudge and what's on its way.</p>
          <ul className="dw-seelist">
            <li><span className="dw-tick"><Eye size={14} /></span><span><strong>Code and link usage</strong><span className="dw-body">Every click, sign-up and code applied at checkout.</span></span></li>
            <li><span className="dw-tick"><ShoppingCart size={14} /></span><span><strong>Abandoned checkouts</strong><span className="dw-body">Teams that started paying and stopped, so you can follow up.</span></span></li>
            <li><span className="dw-tick"><CircleCheck size={14} /></span><span><strong>Completed checkouts</strong><span className="dw-body">Plan, amount and your commission on each one.</span></span></li>
            <li><span className="dw-tick"><Wallet size={14} /></span><span><strong>Pending and approved payouts</strong><span className="dw-body">What's on hold, what's ready to withdraw, what's been paid.</span></span></li>
          </ul>
        </div>
        <div className="dw-split__visual" aria-hidden="true">
          <div style={{ width: "100%", maxWidth: 460, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="dw-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[["Code uses", "164", <Eye size={15} />, "var(--blue-soft)", "var(--blue)"], ["Completed", "11", <CircleCheck size={15} />, "var(--mint)", "var(--green-deep)"],
                ["On hold", money(269900), <Hourglass size={15} />, "var(--amber-soft)", "#8A5A15"], ["Approved", money(399900), <Wallet size={15} />, "var(--mint)", "var(--green-deep)"]].map(([l, n, ic, bg, fg]) => (
                <div key={l} className="dw-box" style={{ padding: 16, boxShadow: "0 18px 40px -26px rgba(18,33,28,.35)" }}>
                  <div className="dw-stat__label"><span className="dw-stat__icon" style={{ background: bg, color: fg }}>{ic}</span>{l}</div>
                  <div className="dw-stat__num" style={{ fontSize: 26 }}>{n}</div>
                </div>
              ))}
            </div>
            <div className="dw-box" style={{ padding: 18, boxShadow: "0 18px 40px -26px rgba(18,33,28,.35)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600 }}><span>Speed bonus</span><span>6 of 10 · 2 days left</span></div>
              <div className="dw-bar" style={{ marginTop: 10 }}><span style={{ width: "60%" }} /></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhoFor() {
  const items = [
    { icon: <Megaphone size={24} />, t: "Marketing agencies", d: "Your clients already get leads on WhatsApp. Give them a way to handle them." },
    { icon: <Briefcase size={24} />, t: "Consultants and freelancers", d: "Recommend the tool you'd set up for them anyway, and get paid for it." },
    { icon: <GraduationCap size={24} />, t: "Trainers and communities", d: "Teach sales or run a founder group? One code for your whole audience." },
    { icon: <Building2 size={24} />, t: `${PROGRAM.brand} customers`, d: "Know another business drowning in WhatsApp chats? Send them your code." },
  ];
  return (
    <section className="dw-section" aria-labelledby="who-h" style={{ background: "var(--paper)" }}>
      <div className="dw-wrap">
        <div className="dw-center"><h2 id="who-h" className="dw-h2">Made for people businesses already listen to</h2></div>
        <div className="dw-who">
          {items.map((i) => <div key={i.t} className="dw-who__card">{i.icon}<h3 className="dw-h4">{i.t}</h3><p className="dw-body" style={{ fontSize: 15.5 }}>{i.d}</p></div>)}
        </div>
      </div>
    </section>
  );
}

function FairPlay() {
  const yes = [
    "A new business signs up through your link or types your code at checkout.",
    `They complete checkout within ${PROGRAM.attributionDays} days of clicking your link.`,
    `They stay on a paid plan past the ${PROGRAM.holdDays}-day refund window.`,
  ];
  const no = [
    "Your own business, or accounts you control.",
    `Checkouts refunded or cancelled within ${PROGRAM.holdDays} days.`,
    `Ads bidding on "${PROGRAM.brand}" or its misspellings.`,
    "Spam, bulk unsolicited messages, or promising discounts we don't offer.",
  ];
  return (
    <section className="dw-section" id="rules" aria-labelledby="rules-h">
      <div className="dw-wrap">
        <div className="dw-center" style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2 id="rules-h" className="dw-h2">What counts, and what doesn't</h2>
          <p className="dw-lead" style={{ marginTop: 14 }}>Clear rules so nobody is surprised when a commission is approved or reversed.</p>
        </div>
        <div className="dw-fair">
          <div className="dw-fair__col" style={{ background: "var(--mint-soft)", borderColor: "#CFE6D8" }}>
            <h3 className="dw-h3">Counts as a referral</h3>
            <ul>{yes.map((t) => <li key={t}><span className="dw-fair__mark" style={{ background: "var(--mint)", color: "var(--green-deep)" }}><Check size={13} strokeWidth={2.5} /></span>{t}</li>)}</ul>
          </div>
          <div className="dw-fair__col" style={{ background: "var(--paper)" }}>
            <h3 className="dw-h3">Doesn't count</h3>
            <ul>{no.map((t) => <li key={t} style={{ color: "var(--ink-soft)" }}><span className="dw-fair__mark" style={{ background: "var(--clay-soft)", color: "var(--clay)" }}><X size={13} strokeWidth={2.5} /></span>{t}</li>)}</ul>
          </div>
        </div>
      </div>
    </section>
  );
}

const PARTNER_FAQS = [
  { q: "How do I join?", a: "Tap Become a partner, add your name, phone and email, and enter the code we send on WhatsApp. Your 5-character referral code is ready straight away." },
  { q: "Is there a fee to join?", a: "No. The program is free and you don't need to be a Dorway customer." },
  { q: "How is a referral tracked?", a: `Two ways. A click on your link is remembered for ${PROGRAM.attributionDays} days on that device. Or the customer types your 5-character code at checkout. If both exist, the code typed at checkout wins.` },
  { q: "When does my commission become payable?", a: `Each commission sits on hold for ${PROGRAM.holdDays} days, which is the customer's refund window. After that it moves to approved and counts toward your withdrawable balance. If the customer is refunded inside the window, that commission is reversed.` },
  { q: "How does the speed bonus work?", a: `Every time ${PROGRAM.bonus.every} of your referrals complete checkout within a ${PROGRAM.bonus.withinDays}-day stretch, you earn ${money(PROGRAM.bonus.amountPaise)} on top of your commission. Your dashboard shows how many you've landed in the current stretch and how long is left. The bonus follows the same hold rules as the checkouts behind it.` },
  { q: "When and how do I get paid?", a: `Once your approved balance is at least ${money(PROGRAM.minPayoutPaise)}, request a payout from your dashboard. We pay to your UPI ID or bank account within ${PROGRAM.payoutSla}. A PAN is needed for payouts, and tax is deducted at source where the law requires it.` },
  { q: "What is an abandoned checkout?", a: "A business that used your code or link, picked a plan and started paying, but didn't finish. You'll see the plan and value in your dashboard so you can follow up with them yourself." },
  { q: "Can I refer my own business?", a: "No. Self-referrals and accounts you control are excluded, and commissions on them are reversed." },
];

function PartnerFAQ() {
  const [open, setOpen] = useState(0);
  return (
    <section className="dw-section" id="faq" aria-labelledby="pfaq-h" style={{ paddingTop: 0 }}>
      <div className="dw-wrap">
        <div className="dw-center"><h2 id="pfaq-h" className="dw-h2">Partner questions</h2></div>
        <div className="dw-faq">
          {PARTNER_FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className={`dw-faq__item ${isOpen ? "is-open" : ""}`}>
                <h3 style={{ margin: 0 }}>
                  <button type="button" className="dw-faq__q" aria-expanded={isOpen} aria-controls={`pf-${i}`} onClick={() => setOpen(isOpen ? -1 : i)}>{f.q}<ChevronDown size={20} /></button>
                </h3>
                <div id={`pf-${i}`} className="dw-faq__panel" role="region" aria-hidden={!isOpen}><div className="dw-faq__inner"><p className="dw-faq__a">{f.a}</p></div></div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PartnerFinal() {
  return (
    <section aria-labelledby="pfinal-h">
      <div className="dw-wrap">
        <div className="dw-final">
          <ArchPattern id="dw-arch-pfinal" />
          <div className="dw-final__glow" aria-hidden="true" />
          <h2 id="pfinal-h" className="dw-h2">Your referral code is one WhatsApp message away.</h2>
          <p style={{ fontSize: 19, marginTop: 14 }}>Join in under a minute. Start sharing today.</p>
          <div className="dw-btn-row" style={{ justifyContent: "center", marginTop: 36 }}>
            <Link className="dw-btn dw-btn--light" to="/partners/join">Become a partner</Link>
            <Link className="dw-btn dw-btn--outline-light" to="/partners/login">Log in</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function PartnerLanding() {
  const root = useRef(null);
  useScrollReveal(root, [".dw-section .dw-center", ".dw-rule", ".dw-panel", ".dw-step3", ".dw-split > *", ".dw-who__card", ".dw-fair__col", ".dw-faq", ".dw-final"]);
  return (
    <div ref={root}>
      <LandingNav />
      <main>
        <LandingHero />
        <RulesTrio />
        <HowItWorks />
        <DashboardPreview />
        <WhoFor />
        <FairPlay />
        <PartnerFAQ />
        <PartnerFinal />
      </main>
      <footer className="dw-footer">
        <div className="dw-wrap dw-footer__row">
          <Logo />
          <nav aria-label="Footer">
            <Link to="/">{PROGRAM.brand} home</Link>
            <Link to="/legal/terms">Partner terms</Link>
            <Link to="/legal/privacy">Privacy policy</Link>
          </nav>
        </div>
        <div className="dw-wrap dw-footer__row" style={{ marginTop: 20, fontSize: 13 }}>
          <span>© {new Date().getFullYear()} {PROGRAM.brand}. All rights reserved.</span>
          <span>Not affiliated with or endorsed by Meta Platforms, Inc. WhatsApp is a trademark of Meta Platforms, Inc.</span>
        </div>
      </footer>
    </div>
  );
}

/* ============================================================
   AUTH — register & login with WhatsApp OTP
   ============================================================ */

function OtpInput({ value, onChange, onComplete, error, disabled }) {
  const refs = useRef([]);
  const len = PROGRAM.otp.length;
  const digits = value.padEnd(len, " ").slice(0, len).split("");
  useEffect(() => { refs.current[0]?.focus(); }, []);
  const set = (next) => { onChange(next); if (next.length === len && !next.includes(" ")) onComplete(next); };
  const handle = (i, v) => {
    const d = v.replace(/\D/g, "");
    if (!d) return;
    if (d.length > 1) { const full = (value.slice(0, i) + d).slice(0, len); set(full); refs.current[Math.min(full.length, len - 1)]?.focus(); return; }
    const arr = digits.slice(); arr[i] = d; const next = arr.join("").replace(/\s+$/, "");
    set(next); if (i < len - 1) refs.current[i + 1]?.focus();
  };
  const onKey = (i, e) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const arr = digits.slice();
      if (arr[i].trim()) { arr[i] = " "; } else if (i > 0) { arr[i - 1] = " "; refs.current[i - 1]?.focus(); }
      onChange(arr.join("").replace(/\s+$/, ""));
    } else if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === "ArrowRight" && i < len - 1) refs.current[i + 1]?.focus();
  };
  return (
    <div className={`dw-otp ${error ? "is-error" : ""}`} style={{ gridTemplateColumns: `repeat(${len}, 1fr)` }} role="group" aria-label="One-time code">
      {digits.map((d, i) => (
        <input key={i} ref={(el) => (refs.current[i] = el)} value={d.trim()} disabled={disabled}
          inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} maxLength={len} aria-label={`Digit ${i + 1}`}
          onChange={(e) => handle(i, e.target.value)} onKeyDown={(e) => onKey(i, e)} onFocus={(e) => e.target.select()}
          onPaste={(e) => { e.preventDefault(); handle(0, e.clipboardData.getData("text")); }} />
      ))}
    </div>
  );
}

function AuthSide({ art = false }) {
  if (art) {
    return (
      <aside className="dw-auth__side dw-auth__side--art">
        <ArchPattern id="dw-arch-auth-art" />
        <div className="dw-final__glow" aria-hidden="true" />
        <Logo dark={false} />
        <img src="/partner-left.png" alt="Share a code. Get paid for every team that joins. 10% of every completed checkout you refer. ₹1,000 bonus for every 10 checkouts in 7 days. Withdraw to UPI or bank once you reach ₹2,000." />
      </aside>
    );
  }
  return (
    <aside className="dw-auth__side">
      <ArchPattern id="dw-arch-auth" />
      <div className="dw-final__glow" aria-hidden="true" />
      <Logo dark={false} />
      <div>
        <h2 className="dw-h2" style={{ fontSize: 36 }}>Share a code. Get paid for every team that joins.</h2>
        <ul className="dw-auth__points">
          <li><IndianRupee size={18} /><span>{PROGRAM.commissionRate * 100}% of every completed checkout you refer</span></li>
          <li><Timer size={18} /><span>{money(PROGRAM.bonus.amountPaise)} bonus for every {PROGRAM.bonus.every} checkouts in {PROGRAM.bonus.withinDays} days</span></li>
          <li><Wallet size={18} /><span>Withdraw to UPI or bank once you reach {money(PROGRAM.minPayoutPaise)}</span></li>
        </ul>
      </div>
      <p style={{ color: "#8FA89C", fontSize: 13.5 }}>Your number is only used to verify you and send program updates on WhatsApp.</p>
    </aside>
  );
}

function Auth({ mode, onAuthed }) {
  const isJoin = mode === "join";
  const [step, setStep] = useState("details"); // details -> otp -> done
  const [f, setF] = useState({ name: "", phone: "", email: "", terms: false });
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [otp, setOtp] = useState("");
  const [devCode, setDevCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [left, setLeft] = useState(0);
  const [partner, setPartner] = useState(null);

  useEffect(() => { setStep("details"); setOtp(""); setOtpError(""); setFormError(""); setErrs({}); }, [mode]);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const validate = () => {
    const e = {};
    if (isJoin && f.name.trim().length < 2) e.name = "Enter your full name.";
    if (!isPhone(f.phone)) e.phone = "Enter a 10-digit Indian mobile number.";
    if (isJoin && !isEmail(f.email)) e.email = "Enter a valid email address.";
    if (isJoin && !f.terms) e.terms = "Accept the partner terms to continue.";
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const sendOtp = async (ev) => {
    ev?.preventDefault();
    setFormError("");
    if (!validate()) return;
    setBusy(true);
    try {
      const sent = await api.sendOtp(f, isJoin ? "register" : "login");
      setDevCode(sent?.devCode ?? "");
      setStep("otp"); setOtp(""); setOtpError(""); setLeft(PROGRAM.otp.resendSeconds);
    } catch (e) { setFormError(e.message || "Couldn't send the code. Try again in a moment."); }
    finally { setBusy(false); }
  };

  const verify = async (code) => {
    if (busy) return;
    setBusy(true); setOtpError("");
    try {
      const p = await api.verify(f, code, isJoin ? "register" : "login");
      if (isJoin) { setPartner(p); setStep("done"); }
      else onAuthed(p);
    } catch (e) { setOtpError(e.message); setOtp(""); }
    finally { setBusy(false); }
  };

  const stepIndex = { details: 0, otp: 1, done: 2 }[step];
  const upd = (k) => (e) => { const v = e.target.type === "checkbox" ? e.target.checked : e.target.value; setF((s) => ({ ...s, [k]: k === "phone" ? v.replace(/\D/g, "").slice(0, 10) : v })); setErrs((s) => ({ ...s, [k]: undefined })); };

  return (
    <div className="dw-auth">
      <AuthSide art={!isJoin} />
      <div className="dw-auth__main">
        <div className="dw-auth__top">
          <span className="dw-auth__mlogo"><Logo /></span>
          <span className="dw-small">{isJoin ? <>Already a partner? <Link className="dw-textlink" to="/partners/login">Log in</Link></> : <>New here? <Link className="dw-textlink" to="/partners/join">Become a partner</Link></>}</span>
        </div>

        <div className="dw-auth__box" key={`${mode}-${step}`}>
          {isJoin && <div className="dw-progress" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} className={i <= stepIndex ? "is-on" : ""} />)}</div>}

          {step === "details" && (
            <form onSubmit={sendOtp} noValidate>
              <h1 className="dw-h3" style={{ fontSize: 30 }}>{isJoin ? "Join the partner program" : "Log in to your partner account"}</h1>
              <p className="dw-body" style={{ marginTop: 8 }}>{isJoin ? "Takes under a minute. We'll verify your number on WhatsApp." : "We'll send a one-time code to your WhatsApp."}</p>

              {isJoin && (
                <div className="dw-field">
                  <label htmlFor="f-name">Full name</label>
                  <input id="f-name" className={`dw-input ${errs.name ? "is-error" : ""}`} value={f.name} onChange={upd("name")} autoComplete="name" placeholder="Aarav Mehta" autoFocus />
                  {errs.name && <span className="dw-err"><AlertCircle size={14} />{errs.name}</span>}
                </div>
              )}
              <div className="dw-field">
                <label htmlFor="f-phone">WhatsApp number</label>
                <div className={`dw-inputgroup ${errs.phone ? "is-error" : ""}`}>
                  <span className="dw-inputgroup__pre">+91</span>
                  <input id="f-phone" className="dw-input" inputMode="numeric" autoComplete="tel-national" value={f.phone} onChange={upd("phone")} placeholder="98765 43210" autoFocus={!isJoin} />
                </div>
                {errs.phone ? <span className="dw-err"><AlertCircle size={14} />{errs.phone}</span> : <span className="dw-hint">The code arrives on WhatsApp on this number.</span>}
              </div>
              {isJoin && (
                <div className="dw-field">
                  <label htmlFor="f-email">Email</label>
                  <input id="f-email" type="email" className={`dw-input ${errs.email ? "is-error" : ""}`} value={f.email} onChange={upd("email")} autoComplete="email" placeholder="you@company.com" />
                  {errs.email && <span className="dw-err"><AlertCircle size={14} />{errs.email}</span>}
                </div>
              )}
              {isJoin && (
                <>
                  <label className="dw-check">
                    <input type="checkbox" checked={f.terms} onChange={upd("terms")} />
                    <span>I agree to the <Link className="dw-textlink" to="/legal/terms">partner terms</Link> and to receive program updates on WhatsApp.</span>
                  </label>
                  {errs.terms && <span className="dw-err" style={{ marginTop: 8 }}><AlertCircle size={14} />{errs.terms}</span>}
                </>
              )}
              {formError && <div className="dw-callout dw-callout--amber" style={{ marginTop: 18 }}><AlertCircle size={18} /><span>{formError}</span></div>}
              <button type="submit" className="dw-btn dw-btn--primary dw-btn--block" style={{ marginTop: 26 }} disabled={busy}>
                {busy ? <span className="dw-spin" /> : <MessageCircle size={18} />}{busy ? "Sending code" : "Send code on WhatsApp"}
              </button>
            </form>
          )}

          {step === "otp" && (
            <div>
              <h1 className="dw-h3" style={{ fontSize: 30 }}>Enter the code</h1>
              <div className="dw-waline"><MessageCircle size={18} /><span>{devCode ? "WhatsApp isn't connected in this environment, so the code is shown here." : "Sent on WhatsApp"} to <strong className="dw-mono">+91 {f.phone.slice(0, 5)} {f.phone.slice(5)}</strong>. <button type="button" className="dw-textlink" onClick={() => setStep("details")}>Change</button></span></div>
              {devCode && <div className="dw-callout" style={{ marginTop: 16 }}><span>Your code is <strong className="dw-mono">{devCode}</strong></span></div>}
              <OtpInput value={otp} onChange={(v) => { setOtp(v); setOtpError(""); }} onComplete={verify} error={!!otpError} disabled={busy} />
              {otpError && <p className="dw-err" style={{ marginTop: 12 }}><AlertCircle size={14} />{otpError}</p>}
              <button type="button" className="dw-btn dw-btn--primary dw-btn--block" style={{ marginTop: 22 }} disabled={busy || otp.replace(/\s/g, "").length < PROGRAM.otp.length} onClick={() => verify(otp)}>
                {busy ? <span className="dw-spin" /> : <ShieldCheck size={18} />}{busy ? "Verifying" : isJoin ? "Verify and create account" : "Verify and log in"}
              </button>
              <p className="dw-small" style={{ marginTop: 16, textAlign: "center" }}>
                {left > 0 ? <>Resend code in <span className="dw-mono">0:{String(left).padStart(2, "0")}</span></> :
                  <button type="button" className="dw-textlink" onClick={sendOtp}><RefreshCw size={14} /> Resend code</button>}
              </p>
              <p className="dw-small" style={{ textAlign: "center", marginTop: 4, fontSize: 13 }}>Codes expire after {PROGRAM.otp.expiresMinutes} minutes.</p>
            </div>
          )}

          {step === "done" && partner && (
            <div>
              <div className="dw-success-ring"><Check size={30} strokeWidth={2.5} /></div>
              <h1 className="dw-h3" style={{ fontSize: 30 }}>You're in, {partner.name.split(" ")[0]}.</h1>
              <p className="dw-body" style={{ marginTop: 8 }}>This is your referral code. Customers can type it at checkout, or you can share your link.</p>
              <div className="dw-reveal" aria-label={`Your code: ${partner.code}`}>
                {[...partner.code].map((ch, i) => <span key={i} className="dw-reveal__word">{ch}</span>)}
              </div>
              <div className="dw-btn-row" style={{ marginTop: 20 }}>
                <CopyBtn text={partner.code} label="Copy code" toastMsg="Code copied" />
                <CopyBtn text={referralLink(partner.code)} label="Copy link" toastMsg="Link copied" />
              </div>
              <button type="button" className="dw-btn dw-btn--primary dw-btn--block" style={{ marginTop: 28 }} onClick={() => onAuthed(partner)}>
                <LayoutDashboard size={18} /> Go to your dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   DASHBOARD
   ============================================================ */

const TABS = [
  { id: "overview", label: "Overview", short: "Home", icon: LayoutDashboard },
  { id: "activity", label: "Code activity", short: "Activity", icon: Activity },
  { id: "checkouts", label: "Checkouts", short: "Checkouts", icon: ShoppingCart },
  { id: "payouts", label: "Payouts", short: "Payouts", icon: Wallet },
  { id: "share", label: "Share kit", short: "Share", icon: Share2 },
  { id: "settings", label: "Settings", short: "Settings", icon: Settings },
];

function timeLeft(ts) {
  const ms = Math.max(0, ts - Date.now());
  const d = Math.floor(ms / DAY); const h = Math.floor((ms % DAY) / 3600000);
  return d > 0 ? `${d} day${d > 1 ? "s" : ""} ${h} hr` : `${h} hr`;
}

const STATUS = {
  on_hold: { label: "On hold", cls: "dw-chip--amber", icon: Hourglass },
  approved: { label: "Approved", cls: "dw-chip--green", icon: CircleCheck },
  paid: { label: "Paid", cls: "dw-chip--blue", icon: Wallet },
  reversed: { label: "Reversed", cls: "dw-chip--clay", icon: Ban },
  requested: { label: "Requested", cls: "dw-chip--amber", icon: Clock },
  processing: { label: "Processing", cls: "dw-chip--amber", icon: Hourglass },
  rejected: { label: "Rejected", cls: "dw-chip--clay", icon: Ban },
};
function StatusChip({ s }) { const x = STATUS[s] ?? STATUS.on_hold; const I = x.icon; return <span className={`dw-chip ${x.cls}`}><I size={12} />{x.label}</span>; }

function shareText(code) {
  return `I've been recommending ${PROGRAM.brand} to teams that sell on WhatsApp. One shared inbox, every lead gets an owner, and follow-ups don't get forgotten.\n\nTry it here: ${referralLink(code)}\nOr use my code at checkout: ${code}`;
}

function Ring({ value, max }) {
  const r = 56, c = 2 * Math.PI * r;
  const [shown, setShown] = useState(0);
  useEffect(() => { const t = setTimeout(() => setShown(value), 120); return () => clearTimeout(t); }, [value]);
  return (
    <div className="dw-ring" role="img" aria-label={`${value} of ${max}`}>
      <svg width="132" height="132" viewBox="0 0 132 132">
        <circle cx="66" cy="66" r={r} fill="none" stroke="var(--paper)" strokeWidth="12" />
        <circle cx="66" cy="66" r={r} fill="none" stroke="var(--green)" strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - shown / max)} />
      </svg>
      <div className="dw-ring__label"><span><strong>{value}</strong><span className="dw-small">of {max}</span></span></div>
    </div>
  );
}

function Stat({ label, value, sub, icon, tone = "green" }) {
  const tones = { green: ["var(--mint)", "var(--green-deep)"], amber: ["var(--amber-soft)", "#8A5A15"], blue: ["var(--blue-soft)", "var(--blue)"], clay: ["var(--clay-soft)", "var(--clay)"] };
  const [bg, fg] = tones[tone];
  return (
    <div className="dw-box">
      <div className="dw-stat__label"><span className="dw-stat__icon" style={{ background: bg, color: fg }}>{icon}</span>{label}</div>
      <div className="dw-stat__num">{value}</div>
      {sub && <div className="dw-stat__sub">{sub}</div>}
    </div>
  );
}

function CodeCard({ code }) {
  return (
    <div className="dw-codecard">
      <ArchPattern id="dw-arch-code" />
      <div className="dw-final__glow" aria-hidden="true" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span style={{ color: "#B9CEC4", fontSize: 14, fontWeight: 500 }}>Your referral code</span>
        <CopyBtn text={code} label="Copy code" className="dw-iconbtn dw-iconbtn--dark" toastMsg="Code copied" />
      </div>
      <div className="dw-codecard__words">{[...code].map((ch, i) => <span key={i}>{ch}</span>)}</div>
      <div className="dw-linkfield">
        <Link2 size={15} color="#8FA89C" />
        <code>{referralLink(code)}</code>
        <CopyBtn text={referralLink(code)} label="Copy link" className="dw-iconbtn dw-iconbtn--light" toastMsg="Link copied" />
      </div>
      <a className="dw-btn dw-btn--green dw-btn--sm" style={{ marginTop: 14 }} href={waShare(shareText(code))} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Share on WhatsApp</a>
    </div>
  );
}

const EVENT_LABEL = { link_opened: "Link opened", code_applied: "Code applied", signed_up: "Signed up", checkout_started: "Checkout started" };
const EVENT_ICON = { link_opened: <Link2 size={16} />, code_applied: <Sparkles size={16} />, signed_up: <User size={16} />, checkout_started: <ShoppingCart size={16} /> };
const EVENT_TONE = { link_opened: ["var(--blue-soft)", "var(--blue)"], code_applied: ["var(--mint)", "var(--green-deep)"], signed_up: ["var(--mint)", "var(--green-deep)"], checkout_started: ["var(--amber-soft)", "#8A5A15"] };

function Overview({ d, e, go }) {
  const { bonus } = PROGRAM;
  const pct = Math.min(100, (e.available / PROGRAM.minPayoutPaise) * 100);

  return (
    <div className="dw-grid" style={{ gap: 20 }}>
      <div className="dw-grid dw-grid--2">
        <CodeCard code={d.partner.code} />
        <div className="dw-box dw-sprint">
          <Ring value={d.sprint.count} max={bonus.every} />
          <div>
            <div className="dw-box__title">Speed bonus</div>
            <p className="dw-body" style={{ fontSize: 14.5, marginTop: 6 }}>
              {d.sprint.count > 0
                ? <>Land {bonus.every - d.sprint.count} more checkout{bonus.every - d.sprint.count > 1 ? "s" : ""} in the next <strong style={{ color: "var(--ink)" }}>{d.sprint.windowEndsAt ? timeLeft(new Date(d.sprint.windowEndsAt).getTime()) : "—"}</strong> to earn {money(bonus.amountPaise)}.</>
                : <>Your next completed checkout starts a {bonus.withinDays}-day window. Land {bonus.every} inside it for {money(bonus.amountPaise)}.</>}
            </p>
            <span className="dw-chip dw-chip--green" style={{ marginTop: 12 }}><Gift size={12} /> {d.sprint.bonusesEarned} bonus{d.sprint.bonusesEarned === 1 ? "" : "es"} earned so far</span>
          </div>
        </div>
      </div>

      <div className="dw-grid dw-grid--4">
        <Stat label="Code uses" value={d.usage.clicks} sub={`${d.usage.signups} sign-ups from them`} icon={<Eye size={15} />} tone="blue" />
        <Stat label="Completed" value={d.counts.completed} sub={`${money(d.counts.completedValue)} in checkouts`} icon={<CircleCheck size={15} />} />
        <Stat label="Abandoned" value={d.counts.abandoned} sub={`${money(d.counts.abandonedValue)} left in carts`} icon={<ShoppingCart size={15} />} tone="amber" />
        <Stat label="Lifetime earned" value={money(e.lifetime)} sub={`${money(e.paidOut)} already paid out`} icon={<IndianRupee size={15} />} />
      </div>

      <div className="dw-grid dw-grid--2">
        <div className="dw-box">
          <div className="dw-box__head">
            <span className="dw-box__title">Ready to withdraw</span>
            <button type="button" className="dw-textlink" onClick={() => go("payouts")}>Payouts</button>
          </div>
          <div className="dw-stat__num" style={{ marginTop: 0 }}>{money(e.available)}</div>
          <div className="dw-bar" style={{ marginTop: 16 }}><span style={{ width: `${pct}%` }} /></div>
          <p className="dw-small" style={{ marginTop: 10 }}>
            {d.canRequestPayout ? <>You've crossed the {money(PROGRAM.minPayoutPaise)} minimum. Request a payout whenever you like.</> : <>{money(Math.max(0, PROGRAM.minPayoutPaise - e.available))} more approved commission and you can withdraw.</>}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)", fontSize: 14 }}>
            <span className="dw-body">On hold: <strong style={{ color: "var(--ink)" }}>{money(e.onHold)}</strong></span>
            {d.nextApprovalAt && <span className="dw-body">Next approval {fmtDate(d.nextApprovalAt)}</span>}
          </div>
          <button type="button" className="dw-btn dw-btn--primary dw-btn--sm" style={{ marginTop: 16 }} disabled={!d.canRequestPayout} onClick={() => go("payouts", { openRequest: true })}>
            <Send size={15} /> Request payout
          </button>
        </div>
        <div className="dw-box">
          <div className="dw-box__head">
            <span className="dw-box__title">Recent activity</span>
            <button type="button" className="dw-textlink" onClick={() => go("activity")}>See all</button>
          </div>
          <div className="dw-feed">
            {d.recentActivity.length === 0 && <p className="dw-body" style={{ fontSize: 14.5 }}>Nothing yet — share your link or code to get started.</p>}
            {d.recentActivity.map((f) => (
              <div key={f.id} className="dw-feed__item">
                <span className="dw-feed__icon" style={{ background: EVENT_TONE[f.event][0], color: EVENT_TONE[f.event][1] }}>{EVENT_ICON[f.event]}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block" }}>{f.businessMasked ? <strong>{f.businessMasked}</strong> : "Someone"} {EVENT_LABEL[f.event].toLowerCase()}</span>
                  <span className="dw-small" style={{ fontSize: 12.5 }}>{ago(f.at)}</span>
                </span>
                <span />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const ACTIVITY_FILTERS = [
  { label: "All", type: undefined },
  { label: "Link opened", type: "link_opened" },
  { label: "Code applied", type: "code_applied" },
  { label: "Signed up", type: "signed_up" },
  { label: "Checkout started", type: "checkout_started" },
];
const SOURCE_LABEL = { link: "Referral link", code: "Code at checkout" };

function ActivityView({ usage }) {
  const [filter, setFilter] = useState("All");
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (reset, afterCursor) => {
    setLoading(true);
    const type = ACTIVITY_FILTERS.find((f) => f.label === filter)?.type;
    const res = await api.getActivity(reset ? null : afterCursor, type);
    setItems((prev) => (reset ? res.items : [...prev, ...res.items]));
    setCursor(res.nextCursor);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  const counts = {
    All: usage.clicks + usage.codeApplied + usage.signups + usage.checkoutsStarted,
    "Link opened": usage.clicks, "Code applied": usage.codeApplied, "Signed up": usage.signups, "Checkout started": usage.checkoutsStarted,
  };

  return (
    <div className="dw-grid" style={{ gap: 18 }}>
      <div style={{ overflowX: "auto" }}>
        <div className="dw-tabs">{ACTIVITY_FILTERS.map((f) => <button key={f.label} type="button" className={filter === f.label ? "is-on" : ""} onClick={() => setFilter(f.label)}>{f.label}<span className="dw-count">{counts[f.label]}</span></button>)}</div>
      </div>
      <div className="dw-tablewrap">
        <table className="dw-table">
          <thead><tr><th>When</th><th>What happened</th><th>How</th><th>Business</th></tr></thead>
          <tbody key={filter} className="dw-view">
            {items.map((u) => (
              <tr key={u.id}>
                <td className="dw-mono" style={{ fontSize: 13 }}>{fmtDateTime(u.at)}</td>
                <td><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{EVENT_ICON[u.event]}{EVENT_LABEL[u.event]}</span></td>
                <td><span className="dw-chip dw-chip--grey">{SOURCE_LABEL[u.source]}</span></td>
                <td>{u.businessMasked ? u.businessMasked : <span className="dw-body">Not signed up yet</span>}</td>
              </tr>
            ))}
            {items.length === 0 && !loading && <tr><td colSpan={4}><div className="dw-empty"><Activity size={28} /><div>No activity yet.</div></div></td></tr>}
          </tbody>
        </table>
      </div>
      {cursor && <button type="button" className="dw-btn dw-btn--ghost dw-btn--sm" onClick={() => load(false, cursor)} disabled={loading} style={{ justifySelf: "center" }}>{loading ? <span className="dw-spin" /> : "Load more"}</button>}
      <p className="dw-small">Clicks are counted once per device per day. Business names appear once they sign up.</p>
    </div>
  );
}

const STOPPED_LABEL = { plan_selected: "Plan selected", payment_page: "Payment page", payment_failed: "Payment failed" };

function CheckoutsView({ partnerCode, abandonedCount }) {
  const [tab, setTab] = useState("completed");
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = useCallback(async (reset, afterCursor) => {
    setLoading(true);
    const res = await api.getCheckouts(tab, reset ? null : afterCursor);
    setItems((prev) => (reset ? res.items : [...prev, ...res.items]));
    setCursor(res.nextCursor);
    setLoading(false);
  }, [tab]);

  useEffect(() => { load(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab]);

  const followUp = (c) => `Hi! Saw you were setting up ${PROGRAM.brand} on the ${c.plan} plan. Anything I can help with before you finish? You can pick up where you left off here: ${referralLink(partnerCode)}`;

  return (
    <div className="dw-grid" style={{ gap: 18 }}>
      <div className="dw-tabs" style={{ justifySelf: "start" }}>
        <button type="button" className={tab === "completed" ? "is-on" : ""} onClick={() => setTab("completed")}>Completed</button>
        <button type="button" className={tab === "abandoned" ? "is-on" : ""} onClick={() => setTab("abandoned")}>Abandoned{abandonedCount > 0 && <span className="dw-count">{abandonedCount}</span>}</button>
      </div>

      {tab === "completed" ? (
        <>
          <div className="dw-tablewrap dw-view" key="c">
            <table className="dw-table">
              <thead><tr><th>Business</th><th>Plan</th><th className="dw-right">Paid</th><th>Date</th><th className="dw-right">Your 10%</th><th>Status</th></tr></thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id}>
                    <td><strong style={{ fontWeight: 600 }}>{c.businessMasked}</strong>{c.phoneMasked && <div className="dw-small dw-mono" style={{ fontSize: 12 }}>{c.phoneMasked}</div>}</td>
                    <td>{c.plan} · {c.billing}</td>
                    <td className="dw-right">{money(c.amount)}</td>
                    <td>{fmtDate(c.paidAt)}</td>
                    <td className="dw-right"><strong style={{ fontWeight: 600 }}>{money(c.commission)}</strong></td>
                    <td><StatusChip s={c.status} />{c.status === "on_hold" && c.holdUntil && <div className="dw-small" style={{ fontSize: 12, marginTop: 4 }}>Approves {fmtDate(c.holdUntil)}</div>}</td>
                  </tr>
                ))}
                {items.length === 0 && !loading && <tr><td colSpan={6}><div className="dw-empty"><CircleCheck size={28} /><div>No completed checkouts yet.</div></div></td></tr>}
              </tbody>
            </table>
          </div>
          <div className="dw-callout"><Info size={18} /><span>Commission stays <strong>on hold</strong> for {PROGRAM.holdDays} days while the customer can still ask for a refund, then moves to <strong>approved</strong>.</span></div>
        </>
      ) : (
        <>
          <div className="dw-tablewrap dw-view" key="a">
            <table className="dw-table">
              <thead><tr><th>Business</th><th>Plan</th><th className="dw-right">Cart value</th><th>Stopped at</th><th>When</th><th className="dw-right">You'd earn</th><th></th></tr></thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id}>
                    <td><strong style={{ fontWeight: 600 }}>{c.businessMasked}</strong>{c.phoneMasked && <div className="dw-small dw-mono" style={{ fontSize: 12 }}>{c.phoneMasked}</div>}</td>
                    <td>{c.plan} · {c.billing}</td>
                    <td className="dw-right">{money(c.amount)}</td>
                    <td><span className={`dw-chip ${c.stoppedAt === "payment_failed" ? "dw-chip--clay" : "dw-chip--amber"}`}>{STOPPED_LABEL[c.stoppedAt]}</span></td>
                    <td>{ago(c.startedAt)}</td>
                    <td className="dw-right"><strong style={{ fontWeight: 600 }}>{money(c.potentialCommission)}</strong></td>
                    <td className="dw-right">
                      <button type="button" className="dw-iconbtn dw-iconbtn--ghost" onClick={async () => { if (await copyText(followUp(c))) toast.show("Follow-up message copied"); }}><Copy size={14} /> Follow-up</button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && !loading && <tr><td colSpan={7}><div className="dw-empty"><ShoppingCart size={28} /><div>No abandoned checkouts.</div></div></td></tr>}
              </tbody>
            </table>
          </div>
          <div className="dw-callout dw-callout--amber"><Info size={18} /><span>These teams started checkout with your code but didn't pay. <strong>Follow up personally</strong>, since you know them. Please don't add them to bulk message lists.</span></div>
        </>
      )}
      {cursor && <button type="button" className="dw-btn dw-btn--ghost dw-btn--sm" onClick={() => load(false, cursor)} disabled={loading} style={{ justifySelf: "center" }}>{loading ? <span className="dw-spin" /> : "Load more"}</button>}
    </div>
  );
}

function PayoutsView({ e, payoutMethod, canRequestPayout, payoutBlockedReason, openRequest, onRequested, go }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(!!openRequest && canRequestPayout);
  const [amount, setAmount] = useState(e.available);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const toast = useToast();

  const load = useCallback(async (reset, afterCursor) => {
    setLoading(true);
    const res = await api.getPayouts(reset ? null : afterCursor);
    setItems((prev) => (reset ? res.items : [...prev, ...res.items]));
    setCursor(res.nextCursor);
    setLoading(false);
  }, []);
  useEffect(() => { load(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const blockedMessage = {
    BELOW_MINIMUM: `You need ${money(PROGRAM.minPayoutPaise)} approved to withdraw. ${money(Math.max(0, PROGRAM.minPayoutPaise - e.available))} to go.`,
    METHOD_MISSING: "Add a UPI ID or bank account in Settings first.",
    PAN_REQUIRED: "Add your PAN in Settings first.",
  }[payoutBlockedReason] || "";

  const submit = async () => {
    setErr("");
    if (amount < PROGRAM.minPayoutPaise) return setErr(`The minimum payout is ${money(PROGRAM.minPayoutPaise)}.`);
    if (amount > e.available) return setErr(`You can withdraw up to ${money(e.available)}.`);
    setBusy(true);
    try {
      await api.requestPayout(amount, crypto.randomUUID());
      setModal(false); toast.show(`Payout of ${money(amount)} requested`); onRequested(); load(true);
    } catch (x) { setErr(x.message || "Couldn't request the payout. Try again."); }
    finally { setBusy(false); }
  };

  return (
    <div className="dw-grid" style={{ gap: 20 }}>
      <div className="dw-grid dw-grid--4">
        <Stat label="On hold" value={money(e.onHold)} sub={`In the ${PROGRAM.holdDays}-day refund window`} icon={<Hourglass size={15} />} tone="amber" />
        <Stat label="Approved" value={money(e.available)} sub="Ready to withdraw" icon={<CircleCheck size={15} />} />
        <Stat label="In process" value={money(e.inProcess)} sub={`Reaches you within ${PROGRAM.payoutSla}`} icon={<Clock size={15} />} tone="blue" />
        <Stat label="Paid out" value={money(e.paidOut)} sub="Lifetime" icon={<Wallet size={15} />} />
      </div>

      <div className="dw-box" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="dw-box__title">Withdraw your approved balance</div>
          <p className="dw-body" style={{ fontSize: 14.5, marginTop: 4 }}>{blockedMessage || (payoutMethod.hasMethod ? `Paid to your ${payoutMethod.type === "upi" ? `UPI ID ${payoutMethod.upiId}` : "bank account"}.` : "Add a payout method to get started.")}</p>
        </div>
        <div className="dw-btn-row">
          {!payoutMethod.hasMethod && <button type="button" className="dw-btn dw-btn--ghost dw-btn--sm" onClick={() => go("settings")}><Landmark size={15} /> Add payout method</button>}
          <button type="button" className="dw-btn dw-btn--primary dw-btn--sm" disabled={!canRequestPayout} onClick={() => { setAmount(e.available); setErr(""); setModal(true); }}><Send size={15} /> Request payout</button>
        </div>
      </div>

      <div className="dw-tablewrap">
        <table className="dw-table">
          <thead><tr><th>Requested</th><th className="dw-right">Amount</th><th>To</th><th>Status</th><th>Reference</th></tr></thead>
          <tbody>
            {items.length === 0 && !loading && <tr><td colSpan={5}><div className="dw-empty"><Wallet size={28} /><div>No payouts yet. Your first one appears here once you request it.</div></div></td></tr>}
            {items.map((p) => (
              <tr key={p.id}>
                <td>{fmtDate(p.requestedAt)}</td>
                <td className="dw-right"><strong style={{ fontWeight: 600 }}>{money(p.amount)}</strong></td>
                <td>{p.method}</td>
                <td><StatusChip s={p.status} /></td>
                <td className="dw-mono" style={{ fontSize: 12.5 }}>{p.reference || (p.paidAt ? fmtDate(p.paidAt) : "Pending")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cursor && <button type="button" className="dw-btn dw-btn--ghost dw-btn--sm" onClick={() => load(false, cursor)} disabled={loading} style={{ justifySelf: "center" }}>{loading ? <span className="dw-spin" /> : "Load more"}</button>}
      <div className="dw-callout"><Info size={18} /><span>Minimum payout is <strong>{money(PROGRAM.minPayoutPaise)}</strong>. A PAN is needed before your first payout, and tax is deducted at source where the law requires it.</span></div>

      {modal && (
        <div className="dw-modal" onClick={() => !busy && setModal(false)}>
          <div className="dw-modal__box" role="dialog" aria-modal="true" aria-labelledby="po-h" onClick={(ev) => ev.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 id="po-h" className="dw-h3">Request payout</h2>
              <button type="button" className="dw-burger" style={{ display: "inline-flex" }} onClick={() => setModal(false)} aria-label="Close"><X size={18} /></button>
            </div>
            <p className="dw-body" style={{ marginTop: 8 }}>Available: <strong style={{ color: "var(--ink)" }}>{money(e.available)}</strong></p>
            <div className="dw-field">
              <label htmlFor="po-amt">Amount</label>
              <div className={`dw-inputgroup ${err ? "is-error" : ""}`}>
                <span className="dw-inputgroup__pre">{PROGRAM.currency}</span>
                <input id="po-amt" className="dw-input" inputMode="numeric" value={Math.round(amount / 100)} onChange={(ev) => { setAmount((+ev.target.value.replace(/\D/g, "") || 0) * 100); setErr(""); }} autoFocus />
              </div>
              {err ? <span className="dw-err"><AlertCircle size={14} />{err}</span> : <span className="dw-hint">Between {money(PROGRAM.minPayoutPaise)} and {money(e.available)}.</span>}
            </div>
            <div className="dw-callout" style={{ marginTop: 18 }}><Landmark size={18} /><span>Goes to {payoutMethod.type === "upi" ? <strong>{payoutMethod.upiId}</strong> : <strong>bank account {payoutMethod.accountNumberMasked}</strong>} within {PROGRAM.payoutSla}.</span></div>
            <button type="button" className="dw-btn dw-btn--primary dw-btn--block" style={{ marginTop: 22 }} disabled={busy} onClick={submit}>
              {busy ? <span className="dw-spin" /> : <Send size={16} />}{busy ? "Requesting" : `Request ${money(amount)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ShareView({ d }) {
  const code = d.partner.code;
  const link = referralLink(code);
  const msgs = [
    { t: "WhatsApp message", icon: <MessageCircle size={18} />, body: shareText(code), wa: true },
    { t: "Email", icon: <Mail size={18} />, body: `Subject: The tool I use for WhatsApp leads\n\nHi,\n\nIf your team handles enquiries on WhatsApp, have a look at ${PROGRAM.brand}. Every lead lands in one shared inbox, gets an owner, and follow-ups run on their own.\n\n${link}\n\nUse my code at checkout: ${code}` },
    { t: "LinkedIn post", icon: <Megaphone size={18} />, body: `Most small sales teams don't lose deals to competitors. They lose them to a follow-up nobody sent.\n\n${PROGRAM.brand} puts every WhatsApp lead in one place, gives it an owner and reminds your team when it goes quiet.\n\nWorth a look if you sell on WhatsApp: ${link}` },
  ];
  return (
    <div className="dw-grid" style={{ gap: 20 }}>
      <div className="dw-grid dw-grid--2">
        <CodeCard code={code} />
        <div className="dw-box">
          <div className="dw-box__title">What works best</div>
          <ul className="dw-seelist" style={{ marginTop: 14, gap: 12 }}>
            {["Share with teams that already get leads on WhatsApp, not everyone.", "Say your code out loud on calls. Five characters are easy to type.", "Follow up on abandoned checkouts within a day or two.", `Plan a busy week: ${PROGRAM.bonus.every} checkouts in ${PROGRAM.bonus.withinDays} days earns ${money(PROGRAM.bonus.amountPaise)}.`].map((t) => (
              <li key={t} style={{ fontSize: 15 }}><span className="dw-tick"><Check size={13} strokeWidth={2.5} /></span><span>{t}</span></li>
            ))}
          </ul>
        </div>
      </div>
      <div className="dw-share">
        {msgs.map((m) => (
          <div key={m.t} className="dw-box">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ color: "var(--green)" }}>{m.icon}</span><span className="dw-box__title">{m.t}</span></div>
            <div className="dw-share__msg">{m.body}</div>
            <div className="dw-btn-row" style={{ gap: 8 }}>
              <CopyBtn text={m.body} label="Copy" toastMsg={`${m.t} copied`} />
              {m.wa && <a className="dw-iconbtn dw-iconbtn--ghost" href={waShare(m.body)} target="_blank" rel="noreferrer"><Send size={14} /> Open WhatsApp</a>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsView({ partner, payoutMethod, notifications, onSaved }) {
  const toast = useToast();
  const [type, setType] = useState(payoutMethod.type || "upi");
  const [upiId, setUpiId] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [pan, setPan] = useState("");
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [notif, setNotif] = useState(notifications);

  const save = async (ev) => {
    ev.preventDefault();
    const e = {};
    if (type === "upi" && !/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(upiId)) e.upiId = "Enter a UPI ID like name@okhdfcbank.";
    if (type === "bank") {
      if (accountName.trim().length < 2) e.accountName = "Enter the name on the account.";
      if (!/^\d{9,18}$/.test(accountNumber)) e.accountNumber = "Enter a 9 to 18 digit account number.";
      if (confirm !== accountNumber) e.confirm = "Account numbers don't match.";
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) e.ifsc = "Enter an 11-character IFSC, like HDFC0001234.";
    }
    if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) e.pan = "Enter a 10-character PAN, like ABCDE1234F.";
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const payload = type === "upi" ? { type: "upi", upiId, pan } : { type: "bank", accountName, accountNumber, ifsc, pan };
      await api.savePayoutMethod(payload);
      toast.show("Payout details saved");
      onSaved();
    } catch (x) {
      setErrs({ pan: x.message || "Couldn't save. Check the details and try again." });
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (k) => { const n = { ...notif, [k]: !notif[k] }; setNotif(n); await api.saveNotifications(n); toast.show("Preferences updated"); };
  const Field = ({ id, label, value, onChange, k, ...rest }) => (
    <div className="dw-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className={`dw-input ${errs[k] ? "is-error" : ""}`} value={value} onChange={onChange} {...rest} />
      {errs[k] && <span className="dw-err"><AlertCircle size={14} />{errs[k]}</span>}
    </div>
  );

  return (
    <div className="dw-grid dw-grid--2" style={{ alignItems: "start" }}>
      <form className="dw-box" onSubmit={save} noValidate>
        <div className="dw-box__title">Payout details</div>
        <p className="dw-body" style={{ fontSize: 14.5, marginTop: 4 }}>Where your approved commission is paid.</p>
        {payoutMethod.hasMethod && (
          <div className="dw-callout" style={{ marginTop: 14 }}>
            <Landmark size={18} />
            <span>Currently on file: <strong>{payoutMethod.type === "bank" ? `Bank ${payoutMethod.accountNumberMasked}` : payoutMethod.upiId}</strong> · PAN {payoutMethod.panMasked}. Save below to replace it.</span>
          </div>
        )}
        <div className="dw-seg" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 16 }} role="group" aria-label="Payout method">
          <button type="button" className={type === "upi" ? "is-on" : ""} onClick={() => setType("upi")}>UPI</button>
          <button type="button" className={type === "bank" ? "is-on" : ""} onClick={() => setType("bank")}>Bank account</button>
        </div>
        <div key={type} className="dw-view">
          {type === "upi" ? (
            <Field id="s-upi" label="UPI ID" k="upiId" value={upiId} onChange={(ev) => setUpiId(ev.target.value)} placeholder="name@okhdfcbank" autoComplete="off" />
          ) : (
            <>
              <Field id="s-an" label="Account holder name" k="accountName" value={accountName} onChange={(ev) => setAccountName(ev.target.value)} autoComplete="name" />
              <Field id="s-acc" label="Account number" k="accountNumber" value={accountNumber} onChange={(ev) => setAccountNumber(ev.target.value.replace(/\D/g, ""))} inputMode="numeric" autoComplete="off" />
              <Field id="s-acc2" label="Confirm account number" k="confirm" value={confirm} onChange={(ev) => setConfirm(ev.target.value.replace(/\D/g, ""))} inputMode="numeric" autoComplete="off" />
              <Field id="s-ifsc" label="IFSC" k="ifsc" value={ifsc} onChange={(ev) => setIfsc(ev.target.value.toUpperCase())} maxLength={11} autoComplete="off" />
            </>
          )}
        </div>
        <Field id="s-pan" label="PAN" k="pan" value={pan} onChange={(ev) => setPan(ev.target.value.toUpperCase())} maxLength={10} autoComplete="off" placeholder="ABCDE1234F" />
        <p className="dw-hint" style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center" }}><Lock size={13} /> Stored securely. Only used for payouts and tax records.</p>
        <button type="submit" className="dw-btn dw-btn--primary" style={{ marginTop: 22 }} disabled={busy}>{busy ? <span className="dw-spin" /> : <Check size={16} />}{busy ? "Saving" : "Save payout details"}</button>
      </form>

      <div className="dw-grid" style={{ gap: 20 }}>
        <div className="dw-box">
          <div className="dw-box__title">Profile</div>
          <div className="dw-feed" style={{ marginTop: 8 }}>
            <div className="dw-feed__item" style={{ gridTemplateColumns: "34px 1fr auto" }}><span className="dw-feed__icon" style={{ background: "var(--paper)" }}><User size={16} /></span><span>{partner.name}</span><span /></div>
            <div className="dw-feed__item" style={{ gridTemplateColumns: "34px 1fr auto" }}><span className="dw-feed__icon" style={{ background: "var(--paper)" }}><Phone size={16} /></span><span className="dw-mono" style={{ fontSize: 14 }}>+{partner.phone}</span><span className="dw-chip dw-chip--green"><ShieldCheck size={12} /> Verified</span></div>
            <div className="dw-feed__item" style={{ gridTemplateColumns: "34px 1fr auto" }}><span className="dw-feed__icon" style={{ background: "var(--paper)" }}><Mail size={16} /></span><span>{partner.email}</span><span /></div>
          </div>
          <p className="dw-hint" style={{ marginTop: 10 }}>To change your number, contact partner support. It's tied to your OTP login.</p>
        </div>
        <div className="dw-box">
          <div className="dw-box__title">Notifications</div>
          {[["whatsapp", "WhatsApp updates", "New checkouts, approvals and payouts"], ["email", "Email summary", "A weekly roundup of your referrals"]].map(([k, t, s]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginTop: 16 }}>
              <span><span style={{ display: "block", fontWeight: 500 }}>{t}</span><span className="dw-small">{s}</span></span>
              <button type="button" role="switch" aria-checked={notif[k]} aria-label={t} className={`dw-toggle ${notif[k] ? "is-on" : ""}`} onClick={() => toggle(k)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="dw-grid" style={{ gap: 20 }} aria-busy="true" aria-label="Loading dashboard">
      <div className="dw-grid dw-grid--2"><div className="dw-skel" style={{ height: 230 }} /><div className="dw-skel" style={{ height: 230 }} /></div>
      <div className="dw-grid dw-grid--4">{[0, 1, 2, 3].map((i) => <div key={i} className="dw-skel" style={{ height: 130 }} />)}</div>
    </div>
  );
}

function Dashboard({ partner, onLogout }) {
  const [tab, setTab] = useState("overview");
  const [opts, setOpts] = useState({});
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { setError(""); setD(await api.getDashboard()); }
    catch { setError("Couldn't load your dashboard. Check your connection and try again."); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const e = d ? {
    onHold: d.balances.onHold, available: d.balances.available, inProcess: d.balances.inProcess,
    paidOut: d.balances.paidOut, lifetime: d.balances.lifetime,
  } : null;
  const go = (t, o = {}) => { setTab(t); setOpts(o); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const current = TABS.find((t) => t.id === tab);

  return (
    <div className="dw-app">
      <aside className="dw-side">
        <Logo to="/partners/dashboard" />
        {TABS.map((t) => {
          const I = t.icon;
          return (
            <button key={t.id} type="button" className={`dw-side__link ${tab === t.id ? "is-active" : ""}`} onClick={() => go(t.id)} aria-current={tab === t.id ? "page" : undefined}>
              <I size={18} />{t.label}
              {t.id === "checkouts" && d && d.counts.abandoned > 0 && <span className="dw-side__badge">{d.counts.abandoned}</span>}
            </button>
          );
        })}
        <div className="dw-side__foot">
          <Avatar name={partner.name} i={0} />
          <span style={{ minWidth: 0, flex: 1 }}><span style={{ display: "block", fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{partner.name}</span><span className="dw-small" style={{ fontSize: 12.5 }}>Partner</span></span>
          <button type="button" className="dw-iconbtn dw-iconbtn--ghost" style={{ padding: "0 10px" }} onClick={onLogout} aria-label="Log out"><LogOut size={15} /></button>
        </div>
      </aside>

      <main className="dw-main">
        <div className="dw-topbar">
          <div>
            <p className="dw-small">{tab === "overview" ? `Hi ${partner.name.split(" ")[0]}, here's how your referrals are doing` : `${PROGRAM.brand} Partners`}</p>
            <h1>{current.label}</h1>
          </div>
          <div className="dw-btn-row" style={{ gap: 8 }}>
            <a className="dw-btn dw-btn--green dw-btn--sm" href={waShare(shareText(partner.code))} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Share code</a>
            <button type="button" className="dw-burger dw-mobile-only" onClick={onLogout} aria-label="Log out"><LogOut size={17} /></button>
          </div>
        </div>

        {error && <div className="dw-callout dw-callout--amber"><AlertCircle size={18} /><span>{error} <button type="button" className="dw-textlink" onClick={load}>Retry</button></span></div>}
        {!d && !error && <DashboardSkeleton />}
        {d && (
          <div key={tab} className="dw-view">
            {tab === "overview" && <Overview d={d} e={e} go={go} />}
            {tab === "activity" && <ActivityView usage={d.usage} />}
            {tab === "checkouts" && <CheckoutsView partnerCode={d.partner.code} abandonedCount={d.counts.abandoned} />}
            {tab === "payouts" && (
              <PayoutsView
                e={e}
                payoutMethod={d.payoutMethod}
                canRequestPayout={d.canRequestPayout}
                payoutBlockedReason={d.payoutBlockedReason}
                openRequest={opts.openRequest}
                onRequested={load}
                go={go}
              />
            )}
            {tab === "share" && <ShareView d={d} />}
            {tab === "settings" && <SettingsView partner={d.partner} payoutMethod={d.payoutMethod} notifications={d.notifications} onSaved={load} />}
          </div>
        )}
      </main>

      <nav className="dw-tabbar" aria-label="Dashboard">
        {TABS.map((t) => { const I = t.icon; return <button key={t.id} type="button" className={tab === t.id ? "is-on" : ""} onClick={() => go(t.id)}><I size={19} />{t.short}</button>; })}
      </nav>
    </div>
  );
}

/* ============================================================
   APP — react-router + session restore
   ============================================================ */

function useSessionPartner() {
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try { setPartner(await api.me()); }
    catch { setPartner(null); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { partner, setPartner, loading };
}

function RequirePartner({ partner, loading, children }) {
  if (loading) {
    return (
      <div className="dw" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <span className="dw-spin" style={{ width: 28, height: 28 }} />
      </div>
    );
  }
  if (!partner) return <Navigate to="/partners/login" replace />;
  return children;
}

export default function DorwayPartners() {
  const { partner, setPartner, loading } = useSessionPartner();
  const navigate = useNavigate();

  const handleAuthed = (p) => { setPartner(p); navigate("/partners/dashboard"); };
  const handleLogout = async () => {
    await api.logout();
    setPartner(null);
    navigate("/partners");
  };

  return (
    <div className="dw">
      <style>{STYLES + STYLES_EXTRA}</style>
      <ToastProvider>
        <Routes>
          <Route index element={<PartnerLanding />} />
          <Route path="join" element={<Auth mode="join" onAuthed={handleAuthed} />} />
          <Route path="login" element={<Auth mode="login" onAuthed={handleAuthed} />} />
          <Route
            path="dashboard"
            element={
              <RequirePartner partner={partner} loading={loading}>
                <Dashboard partner={partner} onLogout={handleLogout} />
              </RequirePartner>
            }
          />
          <Route path="*" element={<Navigate to="/partners" replace />} />
        </Routes>
      </ToastProvider>
    </div>
  );
}
