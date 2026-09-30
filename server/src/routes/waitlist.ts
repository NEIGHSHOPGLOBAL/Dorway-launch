import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db.js";
import { rateLimit } from "../lib/rateLimit.js";

export const waitlistRouter = Router();

const schema = z.object({
  email: z.string().email(),
  source: z.string().optional(),
  planIntent: z.string().optional(),
});

waitlistRouter.post("/", async (req, res) => {
  const ip = req.ip ?? "unknown";
  if (!rateLimit(`waitlist:${ip}`, 5, 60 * 60_000)) {
    res.status(200).json({ ok: true });
    return;
  }
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_email" });
    return;
  }
  await db.waitlist.upsert({
    where: { email: parsed.data.email.toLowerCase() },
    update: { source: parsed.data.source, planIntent: parsed.data.planIntent },
    create: {
      email: parsed.data.email.toLowerCase(),
      source: parsed.data.source,
      planIntent: parsed.data.planIntent,
    },
  });
  res.status(200).json({ ok: true });
});
