import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./lib/config.js";
import { authRouter } from "./routes/auth.js";
import { plansRouter, launchStateRouter } from "./routes/plans.js";
import { checkoutRouter, ordersRouter, webhookRouter } from "./routes/checkout.js";
import { waitlistRouter } from "./routes/waitlist.js";
import { accountRouter } from "./routes/account.js";
import { adminRouter } from "./routes/admin.js";
import { adminAuthRouter } from "./routes/adminAuth.js";
import { whatsappWebhookRouter } from "./routes/whatsappWebhook.js";
import { onboardingRouter } from "./routes/onboarding.js";
import { partnersRouter } from "./routes/partners.js";
import { startPartnerJobs } from "./lib/partnerJobs.js";
import { adminOnboardingRouter } from "./routes/adminOnboarding.js";
import { adminPurchasesRouter } from "./routes/adminPurchases.js";
import { adminAffiliatesRouter } from "./routes/adminAffiliates.js";
import { adminHomeRouter } from "./routes/adminHome.js";
import { adminMetaRouter } from "./routes/adminMeta.js";
import { startAdminJobs } from "./lib/adminJobs.js";

const app = express();

app.set("trust proxy", 1);
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(cookieParser());

// Webhooks need the RAW body for HMAC signature verification — must be
// mounted before the global express.json() body parser touches them.
app.use("/api/webhooks", express.raw({ type: "application/json" }), webhookRouter);
app.use("/api/webhooks", express.raw({ type: "application/json" }), whatsappWebhookRouter);

app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/plans", plansRouter);
app.use("/api/launch-state", launchStateRouter);
app.use("/api/checkout", checkoutRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/waitlist", waitlistRouter);
app.use("/api/account", accountRouter);
app.use("/api/admin", adminAuthRouter);
app.use("/api/admin", adminRouter);
app.use("/api/onboarding", onboardingRouter);
app.use("/api/partners", partnersRouter);
app.use("/api/admin", adminHomeRouter);
app.use("/api/admin", adminOnboardingRouter);
app.use("/api/admin", adminPurchasesRouter);
app.use("/api/admin", adminAffiliatesRouter);
app.use("/api/admin", adminMetaRouter);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    cashfreeConfigured: config.cashfree.isConfigured,
    emailConfigured: config.email.isConfigured,
    whatsappConfigured: config.whatsapp.isConfigured,
    whatsappOtpEnabled: config.whatsapp.otpEnabled,
  });
});

startPartnerJobs();
startAdminJobs();

app.listen(config.port, "127.0.0.1", () => {
  console.log(`Dorway API listening on http://127.0.0.1:${config.port}`);
  if (!config.cashfree.isConfigured) {
    console.log("  ⚠ CASHFREE_APP_ID/SECRET not set — checkout will return 503 until configured.");
  }
  if (!config.email.isConfigured) {
    console.log("  ⚠ RESEND_API_KEY not set — OTP codes will print to this console instead of emailing.");
  }
  if (config.whatsapp.otpEnabled && config.whatsapp.isConfigured) {
    console.log(`  ✓ WhatsApp OTP enabled via template "${config.whatsapp.otpTemplateName}".`);
  } else if (config.whatsapp.isConfigured) {
    console.log("  ⚠ WhatsApp credentials set but WHATSAPP_OTP_ENABLED=false — channel stays email-only.");
  }
});
