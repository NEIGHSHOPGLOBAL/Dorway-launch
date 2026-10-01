import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { formatRupeesExact } from "../lib/usePlans";
import { trackPurchase } from "../lib/pixel";
import { supportWaLink } from "../lib/support";

interface OrderStatus {
  id: string;
  status: "CREATED" | "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED";
  planCode: string;
  termMonths: number;
  subtotalPaise: number;
  totalPaise: number;
  invoiceEmail: string | null;
}

const PLAN_NAMES: Record<string, string> = { growth: "Dorway" };

const TIMELINE = [
  { label: "Payment confirmed", done: true },
  { label: "Our team reviews your account. We'll WhatsApp you within 1 working day to book your setup call.", done: false, active: true },
  { label: "Setup call on WhatsApp", done: false },
  { label: "Go live on launch day", done: false },
];

export function CheckoutReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const orderId = params.get("order_id");
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [error, setError] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const pollCount = useRef(0);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await api.get<OrderStatus>(`/orders/${orderId}`);
        if (cancelled) return;
        setOrder(res);
        if (res.status === "CREATED" || res.status === "PENDING") {
          if (pollCount.current < 20) {
            pollCount.current += 1;
            timer = setTimeout(poll, 3000);
          } else {
            setTimedOut(true);
          }
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderId]);

  useEffect(() => {
    if (!orderId || order?.status !== "PAID") return;
    const key = `fbq_purchase_${orderId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    trackPurchase({ orderId, valueRupees: order.totalPaise / 100, planCode: order.planCode });
  }, [order, orderId]);

  if (!orderId || error) {
    return (
      <section className="page-hero">
        <div className="container">
          <div className="payment-notice error" style={{ maxWidth: 480, margin: "0 auto" }}>
            We couldn't find that order. If money left your account, it will be refunded automatically — email{" "}
            <a href="mailto:hello@dorwayai.com" style={{ color: "inherit", textDecoration: "underline" }}>hello@dorwayai.com</a>{" "}
            if you don't see it within a few days.
          </div>
        </div>
      </section>
    );
  }

  const stillPending = (!order || order.status === "CREATED" || order.status === "PENDING") && !timedOut;

  return (
    <section className="page-hero">
      <div className="container">
        <div className="card checkout-summary" style={{ maxWidth: 520, margin: "0 auto", textAlign: "left" }}>
          {stillPending ? (
            <>
              <div className="confirm-ring" aria-hidden="true" />
              <h2>Confirming your payment…</h2>
              <p className="lead" style={{ fontSize: 15, marginTop: 8 }}>
                UPI can take up to a minute. Don't close this page.
              </p>
            </>
          ) : timedOut ? (
            <>
              <h2 style={{ color: "var(--amber)" }}>Still confirming</h2>
              <p className="lead" style={{ fontSize: 15, marginTop: 8 }}>
                We're still confirming with your bank. You don't need to pay again. We'll WhatsApp you as soon as
                it's done.
              </p>
              <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={() => navigate("/dashboard")}>
                Go to dashboard
              </button>
            </>
          ) : order!.status === "PAID" ? (
            <>
              <div className="confirm-ring success" aria-hidden="true">✓</div>
              <h2 style={{ color: "var(--green-deep)" }}>Payment received. You're in.</h2>
              <div className="summary-row total" style={{ marginTop: 8 }}>
                <span>{PLAN_NAMES[order!.planCode] ?? order!.planCode} · {order!.termMonths} months</span>
                <span>{formatRupeesExact(order!.totalPaise)}</span>
              </div>
              {order!.invoiceEmail && (
                <p className="field-hint" style={{ marginTop: 4 }}>A GST invoice is on its way to {order!.invoiceEmail}.</p>
              )}

              <div style={{ borderTop: "1px solid var(--line)", marginTop: 24, paddingTop: 24 }}>
                <h3 style={{ fontFamily: "Comfortaa, cursive", fontSize: 17, marginBottom: 16 }}>What happens next</h3>
                {TIMELINE.map((step, i) => (
                  <div key={step.label} style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                    <span className={`checklist-icon ${step.done ? "done" : step.active ? "active" : "locked"}`} style={{ flexShrink: 0 }}>
                      {step.done ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      ) : step.active ? i + 1 : <span className="hollow-dot" />}
                    </span>
                    <div className={`checklist-text ${step.done || step.active ? "" : "locked"}`} style={{ paddingTop: 2, fontSize: 14 }}>{step.label}</div>
                  </div>
                ))}
              </div>

              <Link to="/dashboard" className="btn btn-primary btn-block" style={{ marginTop: 16 }}>Go to your dashboard</Link>
              <button className="btn btn-secondary btn-block" style={{ marginTop: 10 }} onClick={() => navigate("/onboarding/setup")}>
                Start setup now
              </button>
            </>
          ) : (
            <>
              <h2 style={{ color: "var(--clay)" }}>Payment didn't go through</h2>
              <p className="lead" style={{ fontSize: 15, marginTop: 8 }}>No money was taken. You can try again.</p>
              <Link to={`/checkout/${order!.planCode}?term=${order!.termMonths}`} className="btn btn-primary btn-block" style={{ marginTop: 16 }}>
                Try again
              </Link>
              <a href={supportWaLink("Hi, my Dorway payment didn't go through.")} target="_blank" rel="noreferrer" className="field-hint" style={{ display: "block", textAlign: "center", marginTop: 12 }}>
                Chat with us on WhatsApp
              </a>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
