import { Router } from "express";
import { config } from "../lib/config.js";
import { verifyWhatsAppSignature } from "../lib/whatsapp.js";

export const whatsappWebhookRouter = Router();

// Meta's verification handshake when you register the webhook URL.
whatsappWebhookRouter.get("/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === config.whatsapp.webhookVerifyToken) {
    res.status(200).send(challenge);
    return;
  }
  res.sendStatus(403);
});

// Delivery/read status callbacks for sent OTP messages. Not required for the
// OTP flow itself (the API call succeeding is enough to hand the user a
// "code sent" response) — this is diagnostic visibility only.
whatsappWebhookRouter.post("/whatsapp", (req, res) => {
  const rawBody: Buffer = req.body;
  const signature = req.headers["x-hub-signature-256"] as string | undefined;

  if (!verifyWhatsAppSignature(rawBody, signature)) {
    res.sendStatus(401);
    return;
  }

  try {
    const evt = JSON.parse(rawBody.toString("utf8"));
    const statuses = evt.entry?.[0]?.changes?.[0]?.value?.statuses;
    if (Array.isArray(statuses)) {
      for (const s of statuses) {
        console.log(`[whatsapp] message ${s.id} -> ${s.status}`);
      }
    }
  } catch (err) {
    console.error("WhatsApp webhook parse error:", err);
  }

  res.sendStatus(200);
});
