import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useOnboardingState } from "../lib/useOnboardingState";
import { LockedWorkspace } from "../components/preview/LockedWorkspace";
import { StatusHome } from "../components/preview/StatusHome";

// Unpaid accounts see a locked screen. Paid states use the post-purchase status home.
export function Dashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const { data, loading } = useOnboardingState();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login?next=/dashboard", { replace: true });
  }, [authLoading, user, navigate]);

  if (!user || loading || !data) {
    return (
      <section className="page-hero">
        <div className="container"><p className="lead">Loading…</p></div>
      </section>
    );
  }

  return (
    <section style={{ paddingTop: 32, paddingBottom: 96 }}>
      <div className="container" style={{ maxWidth: 1040 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              navigate("/", { replace: true });
              logout();
            }}
          >
            Log out
          </button>
        </div>

        {data.accountState === "PREVIEW" || data.accountState === "PAYMENT_PENDING" ? (
          <>
            {data.accountState === "PAYMENT_PENDING" && (
              <div className="payment-notice pending" style={{ marginBottom: 16 }}>
                Your payment is being confirmed. This can take up to a minute — refresh if it's been longer.
              </div>
            )}
            <LockedWorkspace />
          </>
        ) : data.accountState === "LIVE" ? (
          <div className="card account-panel">
            <h2>You're live</h2>
            <p className="lead" style={{ fontSize: 15 }}>Dorway has launched for your account. The full product experience isn't part of this build yet.</p>
          </div>
        ) : (
          <StatusHome data={data} />
        )}
      </div>
    </section>
  );
}
