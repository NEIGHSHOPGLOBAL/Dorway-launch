import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { useAuth } from "../lib/auth";
import { applyTheme, currentIsDark, getStoredTheme } from "../lib/theme";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [dark, setDark] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    // Navigate first so any page-level "redirect to /login if logged out"
    // guard doesn't race this and win.
    navigate("/", { replace: true });
    logout();
  }

  useEffect(() => {
    const stored = getStoredTheme();
    const isDark = stored ? stored === "dark" : currentIsDark();
    setDark(isDark);
    applyTheme(isDark ? "dark" : "light");

    function onScroll() {
      setScrolled(window.scrollY > 40);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    applyTheme(next ? "dark" : "light");
  }

  return (
    <>
      <header className={`nav${scrolled ? " scrolled" : ""}`}>
        <div className="container nav-inner">
          <Logo />

          <nav className="nav-links" aria-label="Primary">
            <Link to="/#features">Features</Link>
            <Link to="/pricing">Pricing</Link>
            <Link to="/#faq">FAQ</Link>
          </nav>

          <div className="nav-right">
            <button className="theme-toggle" aria-label="Toggle dark mode" onClick={toggleTheme}>
              {dark ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              )}
            </button>
            {user ? (
              <>
                <Link to="/dashboard" className="login-link">
                  Account
                </Link>
                <button className="login-link" onClick={handleLogout}>
                  Log out
                </button>
              </>
            ) : (
              <Link to="/login" className="login-link">
                Log in
              </Link>
            )}
            <button
              className="btn btn-primary btn-nav"
              onClick={() => navigate(user ? "/dashboard" : "/login")}
            >
              Try now
            </button>
            <button className="hamburger" aria-label="Open menu" onClick={() => setDrawerOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className={`mobile-drawer${drawerOpen ? " open" : ""}`}>
        <div className="mobile-drawer-backdrop" onClick={() => setDrawerOpen(false)} />
        <div className="mobile-drawer-panel">
          <button className="mobile-drawer-close" aria-label="Close menu" onClick={() => setDrawerOpen(false)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <Link to="/#features" onClick={() => setDrawerOpen(false)}>Features</Link>
          <Link to="/pricing" onClick={() => setDrawerOpen(false)}>Pricing</Link>
          <Link to="/#faq" onClick={() => setDrawerOpen(false)}>FAQ</Link>
          <Link to={user ? "/dashboard" : "/login"} onClick={() => setDrawerOpen(false)}>
            {user ? "Account" : "Log in"}
          </Link>
          {user && (
            <button
              className="login-link"
              style={{ textAlign: "left", fontSize: 18, paddingBlock: 8 }}
              onClick={() => {
                setDrawerOpen(false);
                handleLogout();
              }}
            >
              Log out
            </button>
          )}
          <button
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 8 }}
            onClick={() => {
              setDrawerOpen(false);
              navigate(user ? "/dashboard" : "/login");
            }}
          >
            Try now
          </button>
        </div>
      </div>
    </>
  );
}
