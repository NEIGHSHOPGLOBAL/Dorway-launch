/**
 * partners.md §9: every trigger below needs a Meta-approved WhatsApp utility
 * template before it can really send, and none are approved yet. Same
 * "log instead of send" pattern as lib/email.ts's OTP fallback — swap the
 * body for a real sendOtpWhatsApp()-style call once templates are approved.
 */
export function notifyPartner(partnerPhone: string, event: string, detail: string) {
  console.log(`\n[partner notify] ${event} -> ${partnerPhone}: ${detail}\n`);
}
