import { api } from "./api";

const SESSION_KEY = "dw_funnel_session_id";

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/** userchanges.md §9 — fire-and-forget funnel event logging. Never blocks the UI. */
export function trackFunnel(event: string, meta?: Record<string, unknown>) {
  api.post("/funnel/track", { event, sessionId: getSessionId(), meta }).catch(() => {});
}
