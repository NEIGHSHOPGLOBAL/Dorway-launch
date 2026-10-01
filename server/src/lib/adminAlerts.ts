/**
 * superadmin.md §12 "Alerts". No Slack webhook or alerting email configured
 * yet — same "log instead of send" pattern as lib/email.ts and
 * lib/partnerNotify.ts. Wire a real SLACK_WEBHOOK_URL here when one exists.
 */
export function notifyAdmins(event: string, detail: string) {
  console.log(`\n[admin alert] ${event}: ${detail}\n`);
}
