import crypto from "node:crypto";
import { config } from "./config.js";

/**
 * Sends the approved `dorway_login_otp` authentication template.
 * otp.md §6: the code goes into BOTH the body param and the button param,
 * and the button's sub_type at send time is "url" even though it was
 * created as an "OTP" button — that mismatch is intentional on Meta's side.
 */
export async function sendOtpWhatsApp(toE164: string, code: string) {
  const url = `https://graph.facebook.com/${config.whatsapp.apiVersion}/${config.whatsapp.phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.whatsapp.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toE164,
      type: "template",
      template: {
        name: config.whatsapp.otpTemplateName,
        language: { code: "en" },
        components: [
          { type: "body", parameters: [{ type: "text", text: code }] },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: code }],
          },
        ],
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp send failed: ${res.status} ${body}`);
  }
  return (await res.json()) as { messages?: { id: string }[] };
}

/**
 * userchanges.md §8.5 — generic sender for the post-purchase utility
 * templates (paid/approved/setup_scheduled/rejected). These aren't
 * Meta-approved in this environment yet, so — like sendOtpEmail in
 * lib/email.ts — this falls back to a console log when WhatsApp isn't
 * configured, rather than failing the admin action that triggers it.
 */
export async function sendUtilityTemplate(toE164: string, templateName: string, bodyParams: string[]) {
  if (!config.whatsapp.isConfigured) {
    console.log(`\n[dev whatsapp] template "${templateName}" to ${toE164}: ${bodyParams.join(" | ")}\n`);
    return;
  }

  const url = `https://graph.facebook.com/${config.whatsapp.apiVersion}/${config.whatsapp.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.whatsapp.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toE164,
      type: "template",
      template: {
        name: templateName,
        language: { code: "en" },
        components: [{ type: "body", parameters: bodyParams.map((text) => ({ type: "text", text })) }],
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`WhatsApp utility template "${templateName}" send failed: ${res.status} ${body}`);
  }
}

export function verifyWhatsAppSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!signatureHeader || !config.whatsapp.appSecret) return false;
  const expected =
    "sha256=" + crypto.createHmac("sha256", config.whatsapp.appSecret).update(rawBody).digest("hex");
  const sigBuf = Buffer.from(signatureHeader);
  const expBuf = Buffer.from(expected);
  return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
}

/** Normalizes a loosely-typed Indian mobile number to E.164 without the leading '+' (what the Cloud API expects in `to`). */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 13 && digits.startsWith("091")) return `91${digits.slice(3)}`;
  return null;
}
