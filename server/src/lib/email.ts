import { config } from "./config.js";

/**
 * No RESEND_API_KEY yet — logs the OTP to the server console instead of
 * sending it, so local dev/testing works without a real email provider.
 * Swap the body of this function for a real Resend call once the key lands.
 */
export async function sendOtpEmail(email: string, code: string) {
  if (!config.email.isConfigured) {
    console.log(`\n[dev email] OTP for ${email}: ${code}  (expires in 10 min)\n`);
    return;
  }

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.email.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.email.from,
      to: email,
      subject: `Your Dorway login code: ${code}`,
      text: `Your login code is ${code}. It expires in 10 minutes.`,
    }),
  });
}

export async function sendReceiptEmail(email: string, orderSummary: string) {
  if (!config.email.isConfigured) {
    console.log(`\n[dev email] Receipt for ${email}:\n${orderSummary}\n`);
    return;
  }

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.email.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.email.from,
      to: email,
      subject: "Your Dorway order receipt",
      text: orderSummary,
    }),
  });
}
