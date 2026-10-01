import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { formatMoney } from "../../../lib/adminApi";

interface ProgramConfig { version: string; commissionRate: number; bonus: { amountPaise: number; every: number; withinDays: number }; minPayoutPaise: number; holdDays: number; attributionDays: number; note: string }

const ONBOARDING_STEPS = ["IDENTIFIED", "PROFILED", "PLAN_SELECTED", "PAYING", "PAID", "SETUP_STARTED", "SETUP_SUBMITTED", "PROVISIONED", "ACTIVE"];

const FRAUD_RULES = [
  { rule: "Self-referral match", trigger: "Customer phone or email matches the partner" },
  { rule: "Signup burst", trigger: "More than 5 referred signups from one IP in 24h" },
  { rule: "Fast conversion cluster", trigger: "More than 3 referred checkouts completed under 10 min after signup, in 24h" },
  { rule: "Refund cluster", trigger: "More than 30% of a partner's referred checkouts refunded in 30 days" },
  { rule: "Bonus edge", trigger: "Partner hits exactly 10 in 7 days with more than 50% of those later refunded" },
  { rule: "Shared payout method", trigger: "Same UPI ID or bank account on more than one partner" },
];

export function Settings() {
  const [config, setConfig] = useState<ProgramConfig | null>(null);

  useEffect(() => {
    api.get<ProgramConfig>("/admin/settings/program-config").then(setConfig);
  }, []);

  return (
    <div>
      <h2 className="admin-h2">Settings</h2>
      <p className="admin-sub">Read-only. Rule and program changes happen in code/config deploys, never from this screen.</p>

      <div className="admin-card">
        <h3>Program config — v{config?.version}</h3>
        {config && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <tbody>
                <tr><td>Commission rate</td><td>{(config.commissionRate * 100).toFixed(0)}%</td></tr>
                <tr><td>Bonus</td><td>{formatMoney(config.bonus.amountPaise)} per {config.bonus.every} checkouts within {config.bonus.withinDays} days</td></tr>
                <tr><td>Minimum payout</td><td>{formatMoney(config.minPayoutPaise)}</td></tr>
                <tr><td>Hold days</td><td>{config.holdDays}</td></tr>
                <tr><td>Attribution window</td><td>{config.attributionDays} days</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-card">
        <h3>Onboarding steps</h3>
        <p style={{ fontSize: 13, color: "var(--a-ink-soft)", marginTop: -8 }}>
          The real product's OnboardingStep sequence — PAYING, PROVISIONED and ACTIVE aren't assigned anywhere in the app yet.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ONBOARDING_STEPS.map((s) => <span key={s} className="admin-badge blue">{s}</span>)}
        </div>
      </div>

      <div className="admin-card">
        <h3>Fraud rule thresholds</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Rule</th><th>Trigger</th></tr></thead>
            <tbody>{FRAUD_RULES.map((r) => <tr key={r.rule}><td>{r.rule}</td><td>{r.trigger}</td></tr>)}</tbody>
          </table>
        </div>
      </div>

      <div className="admin-card">
        <h3>Admin users</h3>
        <p className="admin-sub" style={{ margin: 0 }}>
          Single shared superadmin login today — no per-admin accounts, roles or 2FA yet. Every audit row is attributed to "admin:superadmin".
        </p>
      </div>
    </div>
  );
}
