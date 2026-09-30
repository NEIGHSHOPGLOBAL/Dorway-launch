import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { formatRupees } from "../lib/usePlans";
import { trackPurchase } from "../lib/pixel";

interface OrderStatus {
  id: string;
  status: "CREATED" | "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED";
  planCode: string;
  termMonths: number;
  subtotalPaise: number;
  totalPaise: number;
}

interface LaunchState {
  serverTime: string;
  launchAt: string;
}

function useCountdown(launchState: LaunchState | null) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!launchState) return;
    const offset = Date.parse(launchState.serverTime) - Date.now();
    const target = Date.parse(launchState.launchAt);
    let raf: number;
    function tick() {
      setRemaining(Math.max(0, target - (Date.now() + offset)));
      raf = requestAnimationFrame(tick);
    }
    tick();
    return () => cancelAnimationFrame(raf);
  }, [launchState]);
  return remaining;
}

const PLAN_NAMES: Record<string, string> = { starter: "Starter", growth: "Growth", scale: "Scale" };

export function CheckoutReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const orderId = params.get("order_id");
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [error, setError] = useState(false);
  const [launchState, setLaunchState] = useState<LaunchState | null>(null);
  const pollCount = useRef(0);
  const remaining = useCountdown(launchState);

  useEffect(() => {
    api.get<LaunchState>("/launch-state").then(setLaunchState).catch(() => {});
  }, []);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await api.get<OrderStatus>(`/orders/${orderId}`);
        if (cancelled) return;
        setOrder(res);
        if ((res.status === "CREATED" || res.status === "PENDING") && pollCount.current < 20) {
          pollCount.current += 1;
          timer = setTimeout(poll, 3000);
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
            We couldn't find that order. If money left your account, it will be refunded automatically — contact
            us if you don't see it within a few days.
          </div>
        </div>
      </section>
    );
  }

  const days = remaining !== null ? Math.floor(remaining / 86400000) : null;
  const hours = remaining !== null ? Math.floor((remaining % 86400000) / 3600000) : null;

  return (
    <section className="page-hero">
      <div className="container">
        <div className="card checkout-summary" style={{ maxWidth: 520, margin: "0 auto", textAlign: "left" }}>
          {!order || order.status === "CREATED" || order.status === "PENDING" ? (
            <>
              <h2>Confirming your payment…</h2>
              <p className="lead" style={{ fontSize: 15, marginTop: 8 }}>
                UPI can take up to a minute to settle. This page updates automatically — don't close it.
              </p>
            </>
          ) : order.status === "PAID" ? (
            <>
              <h2 style={{ color: "var(--green-deep)" }}>✓ You're in.</h2>
              <p className="lead" style={{ fontSize: 15, marginTop: 8, color: "var(--ink)" }}>
                {PLAN_NAMES[order.planCode] ?? order.planCode} plan · {order.termMonths} months
              </p>
              <div className="summary-row total" style={{ marginTop: 8 }}>
                <span>Paid</span><span>{formatRupees(order.totalPaise)}</span>
              </div>
              <p className="field-hint" style={{ marginTop: 4 }}>Invoice on its way to your email.</p>

              <div style={{ borderTop: "1px solid var(--line)", marginTop: 24, paddingTop: 24 }}>
                <h3 style={{ fontFamily: "Comfortaa, cursive", fontSize: 17, marginBottom: 16 }}>What happens next</h3>

                <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                  <span className="checklist-icon active" style={{ flexShrink: 0 }}>1</span>
                  <div>
                    <div className="checklist-title">Tell us about your WhatsApp number</div>
                    <p className="field-hint" style={{ margin: "2px 0 10px" }}>
                      Takes about 5 minutes. Do it now and you'll be live on day one.
                    </p>
                    <button className="btn btn-primary btn-nav" onClick={() => navigate("/onboarding/setup")}>
                      Start setup
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                  <span className="checklist-icon locked" style={{ flexShrink: 0 }}><span className="hollow-dot" /></span>
                  <div>
                    <div className="checklist-title locked">We get you verified with Meta</div>
                    <p className="field-hint" style={{ margin: "2px 0" }}>
                      We handle the submission. It's the slowest part, which is why we start now.
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <span className="checklist-icon locked" style={{ flexShrink: 0 }}><span className="hollow-dot" /></span>
                  <div>
                    <div className="checklist-title locked">
                      Dorway opens{days !== null ? ` — ${days} days, ${hours} hours` : ""}
                    </div>
                  </div>
                </div>
              </div>

              <Link to="/dashboard" className="btn btn-secondary btn-block" style={{ marginTop: 24 }}>Go to your dashboard</Link>
            </>
          ) : (
            <>
              <h2 style={{ color: "var(--clay)" }}>Payment didn't go through</h2>
              <p className="lead" style={{ fontSize: 15, marginTop: 8 }}>No money was taken. You can try again.</p>
              <Link to="/pricing" className="btn btn-primary btn-block" style={{ marginTop: 16 }}>Try again</Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
