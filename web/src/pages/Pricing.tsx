import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { PricingCards } from "../components/PricingCards";

interface LaunchState {
  serverTime: string;
  launchAt: string;
  phase: "PRE_LAUNCH" | "LAUNCH_DAY" | "LIVE";
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

export function Pricing() {
  const [launchState, setLaunchState] = useState<LaunchState | null>(null);

  useEffect(() => {
    api.get<LaunchState>("/launch-state").then(setLaunchState).catch(() => {});
  }, []);

  const remaining = useCountdown(launchState);

  const days = remaining !== null ? Math.floor(remaining / 86400000) : null;
  const hours = remaining !== null ? Math.floor((remaining % 86400000) / 3600000) : null;
  const mins = remaining !== null ? Math.floor((remaining % 3600000) / 60000) : null;
  const secs = remaining !== null ? Math.floor((remaining % 60000) / 1000) : null;

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <h1>Simple pricing, per business</h1>
          <p className="lead" style={{ maxWidth: 560, margin: "0 auto" }}>
            Simple per-business pricing. Add people as your team grows. Meta's per-conversation charges sit outside
            the subscription — you pay Meta directly, at their rates.
          </p>

          {launchState?.phase === "PRE_LAUNCH" && remaining !== null && (
            <div className="countdown" role="timer" aria-label="Time until launch">
              <div className="countdown-cell"><div className="num">{days}</div><div className="unit">days</div></div>
              <div className="countdown-cell"><div className="num">{String(hours).padStart(2, "0")}</div><div className="unit">hrs</div></div>
              <div className="countdown-cell"><div className="num">{String(mins).padStart(2, "0")}</div><div className="unit">min</div></div>
              <div className="countdown-cell"><div className="num">{String(secs).padStart(2, "0")}</div><div className="unit">sec</div></div>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="container">
          <PricingCards />
        </div>
      </section>
    </>
  );
}
