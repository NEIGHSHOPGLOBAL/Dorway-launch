import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Filter, Users, ShoppingBag, ShoppingCart, Wallet, RefreshCw,
  Handshake, UserCheck, Share2, Percent, Send, Flag, History, Settings, LogOut,
  Pin, PinOff, Search,
} from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { adminLoginPath, adminHref } from "../../lib/adminHost";
import { useAdminRange } from "../../lib/adminApi";

const NAV = [
  { group: null, items: [{ to: "/", label: "Home", icon: LayoutDashboard }] },
  {
    group: "Onboarding",
    items: [
      { to: "/onboarding/funnel", label: "Funnel", icon: Filter },
      { to: "/onboarding/approvals", label: "Approvals", icon: UserCheck, badgeKey: "approvals" as const },
      { to: "/onboarding/users", label: "Users", icon: Users },
    ],
  },
  {
    group: "Purchases",
    items: [
      { to: "/purchases", label: "Overview", icon: ShoppingBag },
      { to: "/purchases/checkouts", label: "Checkouts", icon: ShoppingCart },
      { to: "/purchases/payments", label: "Payments", icon: Wallet },
      { to: "/purchases/reconciliation", label: "Reconciliation", icon: RefreshCw },
    ],
  },
  {
    group: "Affiliates",
    items: [
      { to: "/affiliates", label: "Overview", icon: Handshake },
      { to: "/affiliates/partners", label: "Partners", icon: UserCheck },
      { to: "/affiliates/referrals", label: "Referrals", icon: Share2 },
      { to: "/affiliates/commissions", label: "Commissions", icon: Percent },
      { to: "/affiliates/payouts", label: "Payouts", icon: Send, badgeKey: "payouts" as const },
      { to: "/affiliates/flags", label: "Flags", icon: Flag, badgeKey: "flags" as const },
    ],
  },
  { group: null, items: [{ to: "/audit-log", label: "Audit log", icon: History }, { to: "/settings", label: "Settings", icon: Settings }] },
];

function searchResultHref(group: string, id: string): string | null {
  if (group === "partners") return adminHref(`/affiliates/partners/${id}`);
  if (group === "users") return adminHref(`/onboarding/users/${id}`);
  return null;
}

function Mark() {
  return (
    <svg width="28" height="28" viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="#12211C" />
      <path d="M12 31V19a8 8 0 0 1 16 0v12" fill="none" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}

export function AdminShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [pinned, setPinned] = useState(() => localStorage.getItem("dw_admin_nav_pinned") === "1");
  const [badges, setBadges] = useState<{ payouts: number; flags: number; approvals: number }>({ payouts: 0, flags: 0, approvals: 0 });
  const range = useAdminRange();
  const [searchOpen, setSearchOpen] = useState(false);
  const searchBlurTimer = useRef<number | null>(null);
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
    api.get<{ items: unknown[] }>("/admin/approvals").then((r) => setBadges((b) => ({ ...b, approvals: r.items.length }))).catch(() => {});
  }, [checking, location.pathname]);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    const t = setTimeout(() => {
      api.get<Record<string, { id: string; label: string; sub: string }[]>>(`/admin/search?q=${encodeURIComponent(searchQuery)}`).then(setSearchResults).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  function togglePin() {
    setPinned((p) => {
      localStorage.setItem("dw_admin_nav_pinned", p ? "0" : "1");
      return !p;
    });
  }

  async function logout() {
    await api.post("/admin/logout");
    navigate(adminLoginPath(), { replace: true });
  }

  if (checking) return null;

  return (
    <div className="admin">
      <div className="admin-shell">
        <aside className={`admin-sidebar${pinned ? " pinned" : ""}`}>
          <div className="admin-sidebar-brand">
            <Mark />
            <span>dorway admin</span>
          </div>

          {NAV.map((section, i) => (
            <div className="admin-nav-group" key={i}>
              {section.group && <h4>{section.group}</h4>}
              {section.items.map((item) => {
                const Icon = item.icon;
                const badgeCount = "badgeKey" in item && item.badgeKey ? badges[item.badgeKey] : 0;
                return (
                  <NavLink key={item.to} to={adminHref(item.to)} end={item.to === "/"} className={({ isActive }) => `admin-nav-link${isActive ? " active" : ""}`}>
                    <Icon size={19} />
                    <span className="admin-nav-link-label">{item.label}</span>
                    {badgeCount > 0 && <span className="admin-nav-badge">{badgeCount}</span>}
                    {badgeCount > 0 && <span className="admin-nav-dot" />}
                  </NavLink>
                );
              })}
            </div>
          ))}

          <div className="admin-sidebar-foot">
            <button className="admin-pin-btn" onClick={togglePin} title={pinned ? "Unpin sidebar" : "Keep sidebar open"}>
              {pinned ? <PinOff size={17} /> : <Pin size={17} />}
              <span className="admin-nav-link-label">{pinned ? "Unpin" : "Keep open"}</span>
            </button>
            <button className="admin-pin-btn" onClick={logout}>
              <LogOut size={17} />
              <span className="admin-nav-link-label">Log out</span>
            </button>
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
              <Search size={15} style={{ position: "absolute", left: 11, top: "50%", translate: "0 -50%", color: "var(--ink-soft)", pointerEvents: "none" }} />
              <input
                type="text"
                placeholder="Search phone, email, business, code, order id, UTR…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchBlurTimer.current) window.clearTimeout(searchBlurTimer.current);
                  setSearchOpen(true);
                }}
                onBlur={() => {
                  searchBlurTimer.current = window.setTimeout(() => setSearchOpen(false), 150);
                }}
                style={{ paddingLeft: 32 }}
              />
              {searchOpen && searchResults && (
                <div
                  onMouseDown={(e) => e.preventDefault()}
                  style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, marginTop: 6, zIndex: 50, maxHeight: 320, overflowY: "auto", boxShadow: "0 20px 44px -16px rgba(18,33,28,.25)" }}
                >
                  {Object.entries(searchResults).map(([group, items]) =>
                    items.length > 0 ? (
                      <div key={group} style={{ padding: 8 }}>
                        <div style={{ fontSize: 11, color: "var(--ink-soft)", textTransform: "uppercase", padding: "2px 6px" }}>{group}</div>
                        {items.map((it) => {
                          const href = searchResultHref(group, it.id);
                          const body = (
                            <>
                              <div>{it.label}</div>
                              <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{it.sub}</div>
                            </>
                          );
                          return href ? (
                            <Link key={it.id} to={href} onClick={() => setSearchOpen(false)} style={{ display: "block", padding: "6px 6px", fontSize: 13, textDecoration: "none", color: "inherit", borderRadius: 8 }}>
                              {body}
                            </Link>
                          ) : (
                            <div key={it.id} style={{ padding: "6px 6px", fontSize: 13 }}>{body}</div>
                          );
                        })}
                      </div>
                    ) : null,
                  )}
                  {Object.values(searchResults).every((v) => v.length === 0) && (
                    <div style={{ padding: 14, fontSize: 13, color: "var(--ink-soft)" }}>No matches.</div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div key={location.pathname} className="admin-page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
