import { randomInt } from "node:crypto";
import { db } from "./db.js";

// 5-character alphanumeric codes. Ambiguous glyphs (0/O, 1/I) are left out
// so a code can be read aloud on a call.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;

function randomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

/** Uppercase and keep only letters and digits, so "k7 mq2" and "K7MQ2" match. */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function generateUniquePartnerCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    const existing = await db.partner.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique partner code");
}
