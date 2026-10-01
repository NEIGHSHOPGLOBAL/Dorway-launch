function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const cashfreeEnv = (process.env.CASHFREE_ENV ?? process.env.CASHFREE_ENVIRONMENT ?? "sandbox").toLowerCase();

function expandCorsOrigins(raw: string): string[] {
  const listed = raw.split(",").map((e) => e.trim()).filter(Boolean);
  const out = new Set(listed);
  for (const value of listed) {
    try {
      const u = new URL(value);
      out.add(`https://${u.host}`);
      out.add(`http://${u.host}`);
    } catch {
      /* ignore malformed entries */
    }
  }
  return [...out];
}

export const config = {
  appUrl: required("APP_URL", "http://localhost:5173"),
  // Public API origin for Cashfree/WhatsApp webhooks. Falls back to APP_URL
  // when the API is reverse-proxied on the same host as the frontend.
  apiPublicUrl: process.env.API_PUBLIC_URL ?? process.env.APP_URL ?? "http://localhost:8787",
  port: Number(process.env.PORT ?? 8787),
  jwtSecret: required("JWT_SECRET"),
  adminEmails: (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  corsOrigins: expandCorsOrigins(
    process.env.CORS_ORIGINS ?? process.env.APP_URL ?? "http://localhost:5173",
  ),

  cashfree: {
    env: cashfreeEnv === "production" ? "production" : "sandbox",
    appId: process.env.CASHFREE_APP_ID ?? "",
    secretKey: process.env.CASHFREE_SECRET_KEY ?? "",
    webhookSecret: process.env.CASHFREE_WEBHOOK_SECRET ?? "",
    apiVersion: process.env.CASHFREE_API_VERSION ?? "2026-01-01",
    get baseUrl() {
      return this.env === "production"
        ? "https://api.cashfree.com/pg"
        : "https://sandbox.cashfree.com/pg";
    },
    get isConfigured() {
      return Boolean(this.appId && this.secretKey);
    },
    get hmacSecret() {
      // PG webhooks are signed with the client secret. A placeholder
      // CASHFREE_WEBHOOK_SECRET (copied from Payment Links apps) must not
      // replace it or every inbound webhook is rejected.
      const hook = this.webhookSecret;
      if (hook && hook !== "placeholder_webhook_secret") return hook;
      return this.secretKey;
    },
  },

  email: {
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    from: process.env.EMAIL_FROM ?? "Dorway <hello@dorwayai.com>",
    get isConfigured() {
      return Boolean(this.resendApiKey);
    },
  },

  whatsapp: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? "",
    appSecret: process.env.WHATSAPP_APP_SECRET ?? "",
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "",
    otpTemplateName: process.env.OTP_TEMPLATE_NAME ?? "dorway_login_otp",
    // otp.md §8: keep this false until the flow has been verified end to end
    // on a real device — the doc is explicit that email stays primary.
    otpEnabled: process.env.WHATSAPP_OTP_ENABLED === "true",
    apiVersion: "v23.0",
    get isConfigured() {
      return Boolean(this.accessToken && this.phoneNumberId);
    },
  },

  // otp.md §8: must match the dorway_login_otp template's code-expiration
  // setting (5 minutes) exactly, for both channels.
  otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES ?? 5),

  // onboarding.md O1 — [CONFIRM] your actual GST-registered state before
  // launch. Defaults to Delhi (07), matching the doc's own worked example,
  // purely so the intra/inter-state split has something to compute against.
  supplierStateCode: process.env.SUPPLIER_STATE_CODE ?? "07",

  uploadsDir: process.env.UPLOADS_DIR ?? "./uploads",

  supportWhatsAppNumber: process.env.SUPPORT_WHATSAPP_NUMBER ?? "91830702643",

  // Superadmin console — separate username/password auth, entirely distinct
  // from customer OTP login. Change these before this ever leaves your machine.
  superadmin: {
    username: process.env.ADMIN_USERNAME ?? "admin",
    password: process.env.ADMIN_PASSWORD ?? "admin123",
  },
};
