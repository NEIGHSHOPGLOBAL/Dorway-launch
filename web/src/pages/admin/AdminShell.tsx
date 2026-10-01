import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { adminLoginPath } from "../../lib/adminHost";
import { useAdminRange } from "../../lib/adminApi";

const NAV = [
  { group: null, items: [{ to: "/", label: "Home" }] },
  {
    group: "Onboarding",
    items: [
      { to: "/onboarding/funnel", label: "Funnel" },
      { to: "/onboarding/users", label: "Users" },
    ],
  },
  {
    group: "Purchases",
    items: [
      { to: "/purchases", label: "Overview" },
      { to: "/purchases/checkouts", label: "Checkouts" },
      { to: "/purchases/payments", label: "Payments" },
      { to: "/purchases/reconciliation", label: "Reconciliation" },
    ],
  },
  {
    group: "Affiliates",
    items: [
      { to: "/affiliates", label: "Overview" },
      { to: "/affiliates/partners", label: "Partners" },
      { to: "/affiliates/referrals", label: "Referrals" },
      { to: "/affiliates/commissions", label: "Commissions" },
      { to: "/affiliates/payouts", label: "Payouts", badgeKey: "payouts" as const },
      { to: "/affiliates/flags", label: "Flags", badgeKey: "flags" as const },
    ],
  },
  { group: null, items: [{ to: "/audit-log", label: "Audit log" }, { to: "/settings", label: "Settings" }] },
];

export function AdminShell() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [badges, setBadges] = useState<{ payouts: number; flags: number }>({ payouts: 0, flags: 0 });
  const [searchParams] = useSearchParams();
  const range = useAdminRange();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Record<string, { id: string; label: string; sub: string }[]> | null>(null);

  useEffect(() => {
    api
      .get("/admin/me")
      .then(() => setChecking(false))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) navigate(adminLoginPath(), { replace: true });
      });
  }, [navigate]);

  useEffect(() => {
    if (checking) return;
    api.get<{ items: unknown[] }>("/admin/payouts?status=requested").then((r) => setBadges((b) => ({ ...b, payouts: r.items.length }))).catch(() => {});
    api.get<{ items: unknown[] }>("/admin/flags?status=open").then((r) => setBadges((b) => ({ ...b, flags: r.items.length }))).catch(() => {});
  }, [checking]);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    const t = setTimeout(() => {
      api.get(`/admin/search?q=${encodeURIComponent(searchQuery)}`).then(setSearchResults).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  async function logout() {
    await api.post("/admin/logout");
    navigate(adminLoginPath(), { replace: true });
  }

  if (checking) return null;

  return (
    <div className="admin">
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <h1>dorway admin</h1>
          {NAV.map((section, i) => (
            <div className="admin-nav-group" key={i}>
              {section.group && <h4>{section.group}</h4>}
              {section.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === "/"} className={({ isActive }) => `admin-nav-link${isActive ? " active" : ""}`}>
                  <span>{item.label}</span>
                  {"badgeKey" in item && item.badgeKey && badges[item.badgeKey] > 0 && <span className="admin-nav-badge">{badges[item.badgeKey]}</span>}
                </NavLink>
              ))}
            </div>
          ))}
          <div className="admin-nav-group">
            <button className="admin-link-btn" onClick={logout}>Log out</button>
          </div>
        </aside>

        <main className="admin-main">
          <div className="admin-topbar">
            <div>
              <select value="" onChange={(e) => e.target.value && range.setPreset(e.target.value === "today" ? 0 : e.target.value === "7" ? 7 : e.target.value === "30" ? 30 : e.target.value === "month" ? "month" : "lastMonth")}>
                <option value="">Date range ▾</option>
                <option value="today">Today</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="month">This month</option>
                <option value="lastMonth">Last month</option>
              </select>
            </div>
            <select value={range.compare} onChange={(e) => range.setCompare(e.target.value)}>
              <option value="previous">Compare: previous period</option>
              <option value="none">Compare: none</option>
            </select>
            <label>
              <input type="checkbox" checked={range.includeTest} onChange={(e) => range.setIncludeTest(e.target.checked)} />
              Include test accounts
            </label>
            <div className="admin-search" style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Search phone, email, business, code, order id, UTR…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              />
              {searchOpen && searchResults && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--a-card)", border: "1px solid var(--a-line)", borderRadius: 8, marginTop: 4, zIndex: 50, maxHeight: 320, overflowY: "auto" }}>
                  {Object.entries(searchResults).map(([group, items]) =>
                    items.length > 0 ? (
                      <div key={group} style={{ padding: 8 }}>
                        <div style={{ fontSize: 11, color: "var(--a-ink-soft)", textTransform: "uppercase", padding: "2px 6px" }}>{group}</div>
                        {items.map((it) => (
                          <div key={it.id} style={{ padding: "6px 6px", fontSize: 13 }}>
                            <div>{it.label}</div>
                            <div style={{ fontSize: 11.5, color: "var(--a-ink-soft)" }}>{it.sub}</div>
                          </div>
                        ))}
                      </div>
                    ) : null,
                  )}
                </div>
              )}
            </div>
          </div>
          <Outlet key={searchParams.toString()} />
        </main>
      </div>
    </div>
  );
}
