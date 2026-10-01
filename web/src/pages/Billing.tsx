import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useOnboardingState } from "../lib/useOnboardingState";
import { api } from "../lib/api";
import { formatRupeesExact } from "../lib/usePlans";

interface OrderRow {
  id: string;
  planName: string;
  termMonths: number;
  status: string;
  totalPaise: number;
  createdAt: string;
  paidAt: string | null;
}

// userchanges.md X-5 — plan, term, access dates, GSTIN on file, and every
// order with a GST invoice download.
export function Billing() {
  const { user, loading: authLoading } = useAuth();
  const { data } = useOnboardingState();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login?next=/billing", { replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    api.get<{ orders: OrderRow[] }>("/orders").then((r) => setOrders(r.orders)).catch(() => {});
  }, []);

  if (!user || !data) {
    return <section className="page-hero"><div className="container"><p className="lead">Loading…</p></div></section>;
  }

  return (
    <section style={{ paddingTop: 64, paddingBottom: 96 }}>
      <div className="container" style={{ maxWidth: 680 }}>
        <h1 style={{ fontFamily: "Comfortaa, cursive", fontSize: 28, marginBottom: 24 }}>Billing</h1>

        {data.entitlement ? (
          <div className="card account-panel">
            <h2>Your plan</h2>
            <div className="account-row"><span className="label">Plan</span><span className="value">{data.entitlement.planName} · {data.entitlement.termMonths} months</span></div>
            <div className="account-row"><span className="label">Access starts</span><span className="value">{new Date(data.entitlement.accessStartsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span></div>
            <div className="account-row"><span className="label">Access ends</span><span className="value">{new Date(data.entitlement.accessEndsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span></div>
            <div className="account-row"><span className="label">Paid</span><span className="value mono">{formatRupeesExact(data.entitlement.totalPaise)}</span></div>
            {user.gstin && <div className="account-row"><span className="label">GSTIN on file</span><span className="value mono">{user.gstin}</span></div>}
          </div>
        ) : (
          <div className="card account-panel"><p className="lead" style={{ fontSize: 15 }}>No plan yet.</p></div>
        )}

        <div className="card account-panel">
          <h2>Orders</h2>
          {orders.map((o) => (
            <div key={o.id} className="account-row">
              <span className="label">{o.planName} · {o.termMonths}mo · {new Date(o.createdAt).toLocaleDateString("en-IN")}</span>
              <span className="value" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {formatRupeesExact(o.totalPaise)}
                {o.status === "PAID" && (
                  <a href={`/api/orders/${o.id}/invoice`} target="_blank" rel="noreferrer" style={{ color: "var(--green)", fontWeight: 600, fontSize: 13 }}>
                    Download invoice
                  </a>
                )}
              </span>
            </div>
          ))}
          {orders.length === 0 && <p className="field-hint">No orders yet.</p>}
        </div>
      </div>
    </section>
  );
}
