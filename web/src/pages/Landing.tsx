import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PricingCards } from "../components/PricingCards";
import { TeamInboxShowcase } from "../components/TeamInboxShowcase";

const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const ARROW = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="7" y1="17" x2="17" y2="7" />
    <polyline points="7 7 17 7 17 17" />
  </svg>
);

const HERO_VIDEO_SRC = "https://res.cloudinary.com/jetitb2w/video/upload/v1789590019/dorway2.mp4";

function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const video = videoRef.current;
    if (!video || reduceMotion) return;
    video.play().catch(() => {
      // Autoplay can be blocked before user interaction — the poster frame
      // still shows, and play() is retried once the tab gains focus.
    });
  }, []);

  return (
    <div className="card hero-panel hero-panel-img">
      <video
        ref={videoRef}
        className="hero-screenshot"
        src={HERO_VIDEO_SRC}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-label="Dorway product walkthrough: a live WhatsApp conversation moving through the shared inbox"
      />
    </div>
  );
}

const FAQ_ITEMS = [
  {
    q: "Do I need my own WhatsApp number?",
    a: "Yes, and that's deliberate. You connect your own WhatsApp Business Account, so the number and the customer relationships stay yours. A fresh number works, or you can move an existing one — though a number currently on the consumer WhatsApp app has to be migrated, which we walk you through.",
  },
  {
    q: "How long does setup take?",
    a: "Connecting the account takes a few minutes. The wait is on Meta's side: your business needs to be verified, and your message templates need to be approved. Both are Meta's processes with Meta's timelines, and we can't promise a date — but we show you exactly which step you're on and what's blocking it.",
  },
  {
    q: "What is the 24-hour window?",
    a: "When a customer messages you, you can reply with anything you like for 24 hours. After that, you need a message template that Meta has approved in advance. Dorway shows the countdown on every chat and switches the composer to your templates automatically when the window closes.",
  },
  {
    q: "What do WhatsApp messages cost?",
    a: "Meta charges per conversation at rates that vary by country and message category. You pay Meta directly from your own account, at their rates, with no markup from us. Your subscription covers the software.",
  },
  {
    q: "Can other businesses on Dorway see my leads?",
    a: "No. Every business on the platform is isolated at the database level — separate data, separate connected accounts, separate real-time channels. Your leads and conversations are visible only to the users you invite.",
  },
  {
    q: "What happens when a salesperson leaves?",
    a: "Their access is revoked and every conversation stays in the shared inbox where their replacement picks it up. Because chats run through your business account rather than their personal phone, nothing walks out the door.",
  },
  {
    q: "Can I import my existing leads?",
    a: "Yes — upload a CSV with names, numbers and any fields you're tracking, and map them to your pipeline stages during import.",
  },
  {
    q: "Is there a contract?",
    a: "No. Monthly plans cancel any time. Annual plans are billed upfront for the year. You can export your leads and chat history whenever you like.",
  },
];

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <div className="faq-list">
      {FAQ_ITEMS.map((item, i) => (
        <div className={`faq-item${open === i ? " open" : ""}`} key={item.q}>
          <button className="faq-question" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
            {item.q}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <div className="faq-answer" style={{ maxHeight: open === i ? "400px" : "0px" }}>
            <div className="faq-answer-inner">{item.a}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

const TESTIMONIALS_A = [
  { q: "Four salespeople were running four WhatsApp accounts. When one left, we lost six months of conversations. That can't happen now.", n: "Rohit Agarwal", r: "Director, Sunstone Interiors", i: "RA", c: undefined },
  { q: "The rotation alone paid for it. Nobody argues about who got which lead anymore.", n: "Meera Shah", r: "Sales Head, Vedant Diagnostics", i: "MS", c: "var(--green-deep)" },
  { q: "We were forgetting follow-ups on maybe a third of enquiries. Now it just happens on day two and day five.", n: "Karan Malhotra", r: "Founder, Loop Fitness", i: "KM", c: "var(--amber)" },
];
const TESTIMONIALS_B = [
  { q: "Our old tool put everything on a shared number we didn't control. Owning the account was non-negotiable for us.", n: "Priya Nair", r: "Operations, Anand Realty", i: "PN", c: "var(--clay)" },
  { q: "Setup took a day, including the Meta verification wait. I'd budgeted a week.", n: "Sanjay Gupta", r: "Partner, Gupta & Sons Traders", i: "SG", c: "#5A6B65" },
  { q: "I can see the whole month's pipeline on one screen at 8am. That's the entire product for me.", n: "Anjali Desai", r: "Business Head, Coastline Travel", i: "AD", c: undefined },
];

function TestimonialCard({ q, n, r, i, c, hidden }: { q: string; n: string; r: string; i: string; c?: string; hidden?: boolean }) {
  return (
    <div className="card testimonial-card" aria-hidden={hidden}>
      <p className="testimonial-quote">&ldquo;{q}&rdquo;</p>
      <div className="testimonial-person">
        <span className="avatar avatar-md" style={c ? { background: c } : undefined}>{i}</span>
        <div>
          <div className="testimonial-name">{n}</div>
          <div className="testimonial-role">{r}</div>
        </div>
      </div>
    </div>
  );
}

export function Landing() {
  return (
    <>
      <section className="hero">
        <div className="hero-wash" aria-hidden="true" />
        <div className="decor-blob b-lime" style={{ width: 340, height: 340, top: -40, left: -80 }} aria-hidden="true" />
        <div className="decor-blob b-sun" style={{ width: 280, height: 280, top: 60, right: -60 }} aria-hidden="true" />
        <div className="container hero-content">
          <h1 className="hero-headline">
            Your team already sells on WhatsApp.
            <br />
            Now you can actually run it.
          </h1>
          <p className="lead hero-lead">
            Every enquiry lands in one shared inbox on your own WhatsApp Business number. Leads get assigned the
            moment they arrive, follow-ups run on their own, and nothing lives on anyone's personal phone.
          </p>
          <div className="hero-buttons">
            <Link to="/login" className="btn btn-primary">Try now</Link>
            <a href="#features" className="btn btn-secondary">See how it works</a>
          </div>
          <p className="hero-reassurance">Bring your own WhatsApp number · Set up in a day</p>
        </div>
        <div className="container">
          <div className="hero-visual-wrap">
            <HeroVideo />
          </div>
        </div>
      </section>

      <section className="proof-strip">
        <div className="container" style={{ display: "flex", justifyContent: "center", flexWrap: "wrap" }}>
          <div className="proof-item">
            <div className="proof-number">Under 60 sec</div>
            <div className="proof-label">average first response</div>
          </div>
          <div className="proof-item">
            <div className="proof-number">100%</div>
            <div className="proof-label">of chats kept on the business account</div>
          </div>
          <div className="proof-item">
            <div className="proof-number">Zero</div>
            <div className="proof-label">leads assigned by hand</div>
          </div>
          <div className="proof-item">
            <div className="proof-number">Your</div>
            <div className="proof-label">number, your data</div>
          </div>
        </div>
      </section>

      <TeamInboxShowcase />

      <section id="features">
        <div className="decor-blob b-green" style={{ width: 420, height: 420, top: -120, right: -140 }} aria-hidden="true" />
        <div className="decor-blob b-lime" style={{ width: 300, height: 300, bottom: -100, left: -100 }} aria-hidden="true" />
        <div className="container">
          <div className="section-header">
            <h2 className="section-headline">Everything your team needs to close on WhatsApp</h2>
            <p className="lead">
              Built for the way small sales teams actually work — one number, several people, and a lot of
              conversations that can't be dropped.
            </p>
          </div>

          <div className="bento-grid">
            <div className="card bento-card span-3">
              <div className="bento-mock">
                <div className="assign-lead-card">New enquiry — Malviya Nagar</div>
                <div className="assign-row">
                  <div className="assign-avatar-wrap active">
                    <span className="avatar avatar-md">PR</span>
                    <span className="caption mono" style={{ fontSize: 11 }}>Priya</span>
                  </div>
                  <div className="assign-avatar-wrap">
                    <span className="avatar avatar-md" style={{ background: "var(--green-deep)" }}>RK</span>
                    <span className="caption mono" style={{ fontSize: 11 }}>Rahul</span>
                  </div>
                  <div className="assign-avatar-wrap">
                    <span className="avatar avatar-md" style={{ background: "var(--amber)" }}>AN</span>
                    <span className="caption mono" style={{ fontSize: 11 }}>Anjali</span>
                  </div>
                  <div className="assign-avatar-wrap">
                    <span className="avatar avatar-md" style={{ background: "var(--clay)" }}>SK</span>
                    <span className="caption mono" style={{ fontSize: 11 }}>Sanjay</span>
                  </div>
                </div>
                <div className="text-center mono" style={{ color: "var(--green-deep)" }}>next: Priya</div>
              </div>
              <div>
                <h3 className="card-title">Leads assign themselves</h3>
                <p>
                  New enquiry arrives, the next salesperson in the rotation gets it. No manager forwarding numbers
                  at midnight, no two people calling the same lead, no lead sitting untouched because everyone
                  assumed someone else had it.
                </p>
              </div>
            </div>

            <div className="card bento-card span-3">
              <div className="bento-mock">
                <div className="seq-timeline">
                  <div className="seq-node">
                    <span className="seq-dot done">{CHECK}</span>
                    <div>
                      <div className="seq-node-title">Day 2 · Sent</div>
                      <div className="seq-node-detail">Just checking in on the quote</div>
                    </div>
                  </div>
                  <div className="seq-node">
                    <span className="seq-dot done">{CHECK}</span>
                    <div>
                      <div className="seq-node-title">Day 5 · Sent</div>
                      <div className="seq-node-detail">Template: pricing_followup_v2</div>
                    </div>
                  </div>
                  <div className="seq-node">
                    <span className="seq-dot pending" />
                    <div>
                      <div className="seq-node-title">Day 10 · Scheduled</div>
                      <div className="seq-node-detail">Notify assignee + status nudge</div>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="card-title">Follow-ups that happen</h3>
                <p>
                  Set the rule once — day two, day five, day ten. The system sends it whether or not anyone
                  remembered. Most deals are lost to silence, not to a competitor.
                </p>
              </div>
            </div>

            <div className="card bento-card span-3">
              <div className="bento-mock">
                <div className="campaign-template">
                  Hi <span className="mono">{"{{1}}"}</span>, your interior quote of <span className="mono">{"{{2}}"}</span> is ready to view.
                  <div style={{ marginTop: 8 }}><span className="pill pill-green">Approved</span></div>
                </div>
                <div className="campaign-stats">
                  <div><div className="campaign-stat-num">1,240</div><div className="campaign-stat-label">sent</div></div>
                  <div><div className="campaign-stat-num">1,190</div><div className="campaign-stat-label">delivered</div></div>
                  <div><div className="campaign-stat-num">312</div><div className="campaign-stat-label">replied</div></div>
                </div>
              </div>
              <div>
                <h3 className="card-title">Campaigns to your whole list</h3>
                <p>
                  Send an approved template to a filtered segment — everyone marked Interested in Jaipur, say — and
                  watch delivery, reads and replies come back into the same inbox.
                </p>
              </div>
            </div>

            <div className="card bento-card span-3">
              <div className="bento-mock">
                <div className="pipeline-cols">
                  <div className="pipeline-col"><div className="pipeline-col-head">New · 6</div><div className="pipeline-card">Kiran J.</div><div className="pipeline-card">Deepak P.</div></div>
                  <div className="pipeline-col"><div className="pipeline-col-head">Contacted · 4</div><div className="pipeline-card">Rahul V.</div></div>
                  <div className="pipeline-col"><div className="pipeline-col-head">Interested · 3</div><div className="pipeline-card">Tara S.</div></div>
                  <div className="pipeline-col"><div className="pipeline-col-head">Negotiating · 2</div><div className="pipeline-card">Anil M.</div></div>
                  <div className="pipeline-col won"><div className="pipeline-col-head">Won · 5</div><div className="pipeline-card">Neha R.</div></div>
                </div>
              </div>
              <div>
                <h3 className="card-title">Pipeline you can see</h3>
                <p>
                  New, Contacted, Interested, Negotiating, Won, Lost. Every lead sits in exactly one column, and
                  you can tell at a glance where the month is going.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="deep-dive">
            <div className="deep-dive-text">
              <span className="eyebrow">Your account, not ours</span>
              <h2 className="section-headline" style={{ fontSize: 40 }}>Your business number. Your WhatsApp account.</h2>
              <p className="lead" style={{ fontSize: 19 }}>
                You connect your own WhatsApp Business Account through Meta's official sign-up flow — a few
                screens, inside Dorway, no Business Manager spelunking. The number stays yours. The account stays
                in your name. If you ever leave, you keep both.
              </p>
              <p className="lead" style={{ fontSize: 19 }}>
                We track the two parts everyone gets stuck on: Meta's verification of your business, and approval
                of your message templates. You get a plain-English status for each and a clear list of what's
                blocking you, instead of an error code and a shrug.
              </p>
              <div className="see-also">
                <a href="#">{ARROW}What business verification involves</a>
                <a href="#">{ARROW}How message templates get approved</a>
              </div>
            </div>
            <div className="deep-dive-visual">
              <div className="card status-panel">
                <div className="status-panel-title">WhatsApp connection</div>
                <div className="status-row">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  <div className="status-row-main">
                    <span className="status-row-label">Business account connected</span>
                    <span className="pill pill-green">Connected</span>
                    <span className="status-row-detail mono">+91 98•••••210</span>
                  </div>
                </div>
                <div className="status-row">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  <div className="status-row-main">
                    <span className="status-row-label">Business verification</span>
                    <span className="pill pill-amber">In review</span>
                    <span className="status-row-detail">Submitted 2 days ago</span>
                  </div>
                </div>
                <div className="status-row">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/></svg>
                  <div className="status-row-main">
                    <span className="status-row-label">Message templates</span>
                    <span className="pill pill-green">4 of 5 approved</span>
                  </div>
                </div>
                <div className="status-row">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  <div className="status-row-main">
                    <span className="status-row-label">Payment method</span>
                    <span className="pill pill-green">Attached</span>
                  </div>
                </div>
                <a href="#" className="status-panel-link">What's blocking me →</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="deep-dive reverse">
            <div className="deep-dive-text">
              <span className="eyebrow">Built around WhatsApp's rules</span>
              <h2 className="section-headline" style={{ fontSize: 40 }}>Know exactly what you can send, and when</h2>
              <p className="lead" style={{ fontSize: 19 }}>
                WhatsApp gives you a 24-hour window to reply freely after a customer messages you. Outside it, you
                need an approved template. Most teams learn this by having a message silently fail.
              </p>
              <p className="lead" style={{ fontSize: 19 }}>
                Dorway shows the window counting down on every open chat. Inside it, type whatever you want.
                Outside it, the composer switches to your approved templates and fills in the customer's details
                for you. Your team never has to think about the rule — they just see the right composer.
              </p>
              <div className="see-also">
                <a href="#">{ARROW}How the 24-hour window works</a>
                <a href="#">{ARROW}Managing your template library</a>
              </div>
            </div>
            <div className="deep-dive-visual">
              <div className="composer-stack">
                <div className="card composer-panel">
                  <div className="composer-label">Window open</div>
                  <div className="composer-box">
                    <span>Type a message</span>
                    <span className="mono">23:41 left</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                    <div className="composer-send">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </div>
                  </div>
                </div>
                <div className="card composer-panel">
                  <div className="composer-label">Window closed</div>
                  <div className="composer-template">
                    <div className="composer-template-name">pricing_followup_v2</div>
                    <div className="composer-template-body">Hi Rahul, your interior quote is ready to view whenever you'd like.</div>
                  </div>
                  <div className="composer-note">Window closed — send an approved template</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="deep-dive">
            <div className="deep-dive-text">
              <span className="eyebrow">Follow-up automation</span>
              <h2 className="section-headline" style={{ fontSize: 40 }}>The deal you lost was probably just forgotten</h2>
              <p className="lead" style={{ fontSize: 19 }}>
                A lead goes quiet on day three. Everyone means to check back. Nobody does. Two weeks later they've
                bought from someone who did.
              </p>
              <p className="lead" style={{ fontSize: 19 }}>
                Build the sequence once and it runs on every lead that matches — a nudge on day two, a template on
                day five, a status change and a reminder to the salesperson on day ten. Anyone replies, the
                sequence stops and the chat lands back in the inbox as a live conversation.
              </p>
              <div className="see-also">
                <a href="#">{ARROW}Building a follow-up sequence</a>
                <a href="#">{ARROW}Bulk campaigns and segments</a>
              </div>
            </div>
            <div className="deep-dive-visual">
              <div className="card builder-panel">
                <div className="builder-toggle-row">
                  <span className="card-title" style={{ fontSize: 18 }}>New sequence</span>
                  <span className="toggle-pill"><span className="toggle-dot" />Sequence active</span>
                </div>
                <div className="builder-trigger">
                  <strong>When</strong> lead status is <strong>Contacted</strong> and no reply for <strong>2 days</strong>
                </div>
                <div className="builder-action">
                  <svg className="grip" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9 22 2z"/></svg>
                  <span className="builder-action-text">Send template: pricing_followup_v2</span>
                </div>
                <div className="builder-action">
                  <svg className="grip" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span className="builder-action-text">Wait 3 days</span>
                </div>
                <div className="builder-action" style={{ marginBottom: 0 }}>
                  <svg className="grip" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  <span className="builder-action-text">Notify assignee</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="card health-panel">
            <h2 className="section-headline">Your account health, in the open</h2>
            <p className="lead" style={{ maxWidth: 640, margin: "16px auto 0" }}>
              Meta rates every WhatsApp Business Account on quality and gives it a sending limit. Most tools hide
              this. If your rating drops or your limit changes, you find out here first — not when your campaign
              stops going out.
            </p>
            <div className="health-strip">
              <div className="health-strip-cell">
                <div className="health-strip-label">Quality rating</div>
                <div className="health-strip-value" style={{ color: "var(--green)" }}>High</div>
                <div className="sparkline" aria-hidden="true">
                  {[40, 55, 45, 70, 60, 80, 75, 90, 85, 95].map((h, i) => (
                    <span key={i} style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
              <div className="health-strip-cell">
                <div className="health-strip-label">Sending limit</div>
                <div className="health-strip-value">
                  1,000{" "}
                  <span style={{ fontSize: 16, color: "var(--ink-soft)", fontFamily: "Inter, sans-serif", fontWeight: 400 }}>
                    / 24h
                  </span>
                </div>
                <div className="progress-track"><div className="progress-fill" style={{ width: "40%" }} /></div>
                <div className="caption" style={{ marginTop: 8 }}>Next tier at 10,000</div>
              </div>
              <div className="health-strip-cell">
                <div className="health-strip-label">Templates</div>
                <div className="template-list">
                  <div className="template-list-row"><span>pricing_followup_v2</span><span className="pill pill-green">Approved</span></div>
                  <div className="template-list-row"><span>welcome_message</span><span className="pill pill-green">Approved</span></div>
                  <div className="template-list-row"><span>appointment_reminder</span><span className="pill pill-green">Approved</span></div>
                  <div className="template-list-row"><span>festive_offer_v1</span><span className="pill pill-amber">In review</span></div>
                </div>
              </div>
            </div>
            <div className="health-support">
              <div className="health-support-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                <h3>Quality rating</h3>
                <p>See your current rating and what moved it, per number.</p>
              </div>
              <div className="health-support-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M4.6 15a8 8 0 1 1 14.8 0"/><line x1="12" y1="12" x2="15" y2="9"/></svg>
                <h3>Sending limit</h3>
                <p>Know how many business-initiated conversations you can start in 24 hours, and when the tier steps up.</p>
              </div>
              <div className="health-support-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/></svg>
                <h3>Template status</h3>
                <p>Every template, its approval state, and the reason if it was rejected.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="section-header container">
          <h2 className="section-headline">Teams that stopped losing leads</h2>
        </div>
        <div className="marquee-row">
          <div className="marquee-track">
            {[...TESTIMONIALS_A, ...TESTIMONIALS_A].map((t, i) => (
              <TestimonialCard key={i} {...t} hidden={i >= TESTIMONIALS_A.length} />
            ))}
          </div>
        </div>
        <div className="marquee-row">
          <div className="marquee-track reverse">
            {[...TESTIMONIALS_B, ...TESTIMONIALS_B].map((t, i) => (
              <TestimonialCard key={i} {...t} hidden={i >= TESTIMONIALS_B.length} />
            ))}
          </div>
        </div>
      </section>

      <section id="pricing">
        <div className="decor-blob b-lime" style={{ width: 360, height: 360, top: -100, left: -120 }} aria-hidden="true" />
        <div className="decor-blob b-sun" style={{ width: 300, height: 300, bottom: -80, right: -100 }} aria-hidden="true" />
        <div className="container">
          <div className="section-header">
            <h2 className="section-headline">Simple pricing, per business</h2>
            <p className="lead">Simple per-business pricing. Add people as your team grows.</p>
          </div>
          <PricingCards />
        </div>
      </section>

      <section id="faq">
        <div className="container">
          <div className="section-header">
            <h2 className="section-headline">Frequently asked questions</h2>
          </div>
          <Faq />
        </div>
      </section>

      <section className="final-cta-section">
        <div className="decor-blob b-green" style={{ width: 320, height: 320, top: -60, left: "10%" }} aria-hidden="true" />
        <div className="decor-blob b-sun" style={{ width: 260, height: 260, bottom: -60, right: "10%" }} aria-hidden="true" />
        <div className="container">
          <div className="final-cta-panel">
            <h2 className="section-headline">Stop losing leads to a forgotten follow-up</h2>
            <p className="lead">Connect your WhatsApp number and run your first sequence today.</p>
            <div className="final-cta-buttons">
              <Link to="/login" className="btn btn-primary">Try now</Link>
              <Link to="/contact" className="btn btn-secondary">Talk to us</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
