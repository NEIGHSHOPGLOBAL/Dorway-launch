import { config } from "./config.js";

async function sendEmail(to: string, subject: string, text: string, devLabel: string) {
  if (!config.email.isConfigured) {
    console.log(`\n[dev email] ${devLabel} for ${to}:\n${text}\n`);
    return;
  }

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.email.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: config.email.from, to, subject, text }),
  });
}

/**
 * No RESEND_API_KEY yet — logs the OTP to the server console instead of
 * sending it, so local dev/testing works without a real email provider.
 */
export async function sendOtpEmail(email: string, code: string) {
  await sendEmail(email, `Your Dorway login code: ${code}`, `Your login code is ${code}. It expires in 10 minutes.`, "OTP");
}

export async function sendReceiptEmail(email: string, orderSummary: string) {
  await sendEmail(email, "Your Dorway order receipt", orderSummary, "Receipt");
}

// userchanges.md §8.5 — post-purchase approval-journey emails. Same
// console-log-when-unconfigured fallback as the functions above.
export async function sendApprovalEmail(email: string, setupOwnerName: string) {
  await sendEmail(
    email,
    "You're approved — Dorway",
    `You're approved. ${setupOwnerName} from Dorway will help you set up. Reply on WhatsApp with a good time for a 20-minute call.`,
    "Approval",
  );
}

export async function sendSetupScheduledEmail(email: string, whenLabel: string) {
  await sendEmail(
    email,
    "Your Dorway setup call is booked",
    `Your Dorway setup call is on ${whenLabel}. Keep your business documents handy.`,
    "Setup scheduled",
  );
}

export async function sendRejectionEmail(email: string, reason: string, amountRupees: number) {
  await sendEmail(
    email,
    "About your Dorway account",
    `We couldn't approve your Dorway account: ${reason}. A full refund of ₹${amountRupees.toFixed(2)} has been started and should reach you in 5–7 working days.`,
    "Rejection",
  );
}
