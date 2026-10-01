import { SignJWT, jwtVerify } from "jose";
import type { Request, Response, NextFunction } from "express";
import { config } from "./config.js";

// Separate cookie/secret namespace from the customer session (lib/session.ts)
// — a partner and a customer are different actors and must not share a login.
const secret = new TextEncoder().encode(config.jwtSecret);
const COOKIE_NAME = "dw_partner_session";

export interface PartnerSessionPayload {
  sub: string; // partner id
}

export async function issuePartnerSession(res: Response, payload: PartnerSessionPayload) {
  const jwt = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);

  res.cookie(COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearPartnerSession(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export async function readPartnerSession(req: Request): Promise<PartnerSessionPayload | null> {
  const jwt = req.cookies?.[COOKIE_NAME];
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, secret);
    if (typeof payload.sub !== "string") return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

export async function requirePartner(req: Request, res: Response, next: NextFunction) {
  const session = await readPartnerSession(req);
  if (!session) {
    res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Log in to your partner account to continue." } });
    return;
  }
  (req as Request & { partnerSession: PartnerSessionPayload }).partnerSession = session;
  next();
}
