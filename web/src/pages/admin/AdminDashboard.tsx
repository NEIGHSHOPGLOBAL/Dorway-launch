import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { formatRupees } from "../../lib/usePlans";
import { adminLoginPath } from "../../lib/adminHost";

interface Stats {
  totalUsers: number;
  paidOrders: number;
  pendingOrders: number;
  waitlistCount: number;
}
interface AdminUser {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  businessName: string | null;
  businessCity: string | null;
  onboardingStep: string;
  plan: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}
interface AdminOrder {
  id: string;
  email: string | null;
  planName: string;
  termMonths: number;
  totalPaise: number;
  status: string;
  isEarlyBird: boolean;
  hasEntitlement: boolean;
  crmTenantId: string | null;
  createdAt: string;
}
interface WaitlistRow {
  id: string;
  email: string;
  source: string | null;
  planIntent: string | null;
  createdAt: string;
}
interface Transaction {
  id: string;
  cfPaymentId: string;
  status: string;
  method: string | null;
  amountPaise: number;
  bankRef: string | null;
  createdAt: string;
  orderId: string;
  planName: string;
  termMonths: number;
  userPhone: string | null;
  userEmail: string | null;
}

type Tab = "users" | "transactions" | "orders" | "waitlist";

// Login identity is the phone number an account verified with via WhatsApp
// OTP — that's what should read first here, not email (which is often
// null for phone-only signups, or just a secondary fallback contact).
function formatPhone(phone: string | null): string {
  if (!phone) return "—";
  // Stored as bare digits with country code, e.g. "919876543210".
  if (phone.length === 12 && phone.startsWith("91")) {
    return `+91 ${phone.slice(2, 7)} ${phone.slice(7)}`;
  }
  return `+${phone}`;
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [waitlist, setWaitlist] = useState<WaitlistRow[] | null>(null);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);

  useEffect(() => {
    api
      .get("/admin/me")
      .then(() => setChecking(false))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          navigate(adminLoginPath(), { replace: true });
        }
      });
  }, [navigate]);

  useEffect(() => {
    if (checking) return;
    api.get<Stats>("/admin/stats").then(setStats).catch(() => {});
  }, [checking]);

  useEffect(() => {
    if (checking) return;
    if (tab === "users" && !users) api.get<{ users: AdminUser[] }>("/admin/users").then((r) => setUsers(r.users));
    if (tab === "orders" && !orders) api.get<{ orders: AdminOrder[] }>("/admin/orders").then((r) => setOrders(r.orders));
    if (tab === "waitlist" && !waitlist) api.get<{ waitlist: WaitlistRow[] }>("/admin/waitlist").then((r) => setWaitlist(r.waitlist));
    if (tab === "transactions" && !transactions)
      api.get<{ transactions: Transaction[] }>("/admin/transactions").then((r) => setTransactions(r.transactions));
  }, [tab, checking, users, orders, waitlist, transactions]);

  async function logout() {
    await api.post("/admin/logout");
    navigate(adminLoginPath(), { replace: true });
  }

  if (checking) return null;

  return (
    <div style={{ background: "#0C1512", minHeight: "100vh", color: "#EDF2EF", padding: "40px 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <h1 style={{ fontFamily: "Comfortaa, cursive", fontSize: 26 }}>Dorway admin</h1>
          <button className="btn btn-secondary" onClick={logout}>Log out</button>
        </div>

        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
            {[
              { label: "Total users", value: stats.totalUsers },
              { label: "Paid orders", value: stats.paidOrders },
              { label: "Pending orders", value: stats.pendingOrders },
              { label: "Waitlist", value: stats.waitlistCount },
            ].map((s) => (
              <div key={s.label} style={{ background: "#121D19", border: "1px solid #22302B", borderRadius: 12, padding: 20 }}>
                <div style={{ fontFamily: "Comfortaa, cursive", fontWeight: 700, fontSize: 28 }}>{s.value}</div>
                <div style={{ fontSize: 13, color: "#8A9A94", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "1px solid #22302B" }}>
          {(["users", "transactions", "orders", "waitlist"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: "none",
                border: "none",
                color: tab === t ? "#2BC786" : "#8A9A94",
                borderBottom: tab === t ? "2px solid #2BC786" : "2px solid transparent",
                padding: "10px 16px",
                fontWeight: 600,
                fontSize: 14,
                textTransform: "capitalize",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={{ overflowX: "auto" }}>
          {tab === "users" && (
            <table className="admin-table" style={{ color: "#EDF2EF" }}>
              <thead>
                <tr>
                  <th>Phone (OTP identity)</th><th>Email</th><th>Name</th><th>Business</th><th>Step</th><th>Plan</th><th>Joined</th><th>Last login</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((u) => (
                  <tr key={u.id} style={{ borderColor: "#22302B" }}>
                    <td className="mono">{formatPhone(u.phone)}</td>
                    <td>{u.email ?? "—"}</td>
                    <td>{u.fullName ?? "—"}</td>
                    <td>{u.businessName ?? "—"}{u.businessCity ? `, ${u.businessCity}` : ""}</td>
                    <td>{u.onboardingStep}</td>
                    <td>{u.plan ?? "—"}</td>
                    <td>{new Date(u.createdAt).toLocaleDateString("en-IN")}</td>
                    <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("en-IN") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "transactions" && (
            <table className="admin-table" style={{ color: "#EDF2EF" }}>
              <thead>
                <tr>
                  <th>Phone</th><th>Plan</th><th>Amount</th><th>Method</th><th>Status</th><th>Gateway payment ID</th><th>Bank ref</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions?.map((t) => (
                  <tr key={t.id} style={{ borderColor: "#22302B" }}>
                    <td className="mono">{formatPhone(t.userPhone)}</td>
                    <td>{t.planName} · {t.termMonths}mo</td>
                    <td className="mono">{formatRupees(t.amountPaise)}</td>
                    <td>{t.method ?? "—"}</td>
                    <td>{t.status}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{t.cfPaymentId}</td>
                    <td>{t.bankRef ?? "—"}</td>
                    <td>{new Date(t.createdAt).toLocaleDateString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "orders" && (
            <table className="admin-table" style={{ color: "#EDF2EF" }}>
              <thead>
                <tr>
                  <th>Email</th><th>Plan</th><th>Term</th><th>Total</th><th>Status</th><th>Early bird</th><th>Provisioned</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {orders?.map((o) => (
                  <tr key={o.id} style={{ borderColor: "#22302B" }}>
                    <td>{o.email ?? "—"}</td>
                    <td>{o.planName}</td>
                    <td>{o.termMonths}mo</td>
                    <td className="mono">{formatRupees(o.totalPaise)}</td>
                    <td>{o.status}</td>
                    <td>{o.isEarlyBird ? "Yes" : "No"}</td>
                    <td>{o.hasEntitlement ? (o.crmTenantId ? "Provisioned" : "Pending") : "—"}</td>
                    <td>{new Date(o.createdAt).toLocaleDateString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "waitlist" && (
            <table className="admin-table" style={{ color: "#EDF2EF" }}>
              <thead>
                <tr><th>Email</th><th>Source</th><th>Plan intent</th><th>Date</th></tr>
              </thead>
              <tbody>
                {waitlist?.map((w) => (
                  <tr key={w.id} style={{ borderColor: "#22302B" }}>
                    <td>{w.email}</td>
                    <td>{w.source ?? "—"}</td>
                    <td>{w.planIntent ?? "—"}</td>
                    <td>{new Date(w.createdAt).toLocaleDateString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {((tab === "users" && users?.length === 0) ||
            (tab === "transactions" && transactions?.length === 0) ||
            (tab === "orders" && orders?.length === 0) ||
            (tab === "waitlist" && waitlist?.length === 0)) && (
            <p className="lead" style={{ marginTop: 16, color: "#8A9A94" }}>Nothing here yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
