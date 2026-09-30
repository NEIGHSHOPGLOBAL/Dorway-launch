import { SignJWT, jwtVerify } from "jose";
import type { Request, Response, NextFunction } from "express";
import { config } from "./config.js";

const secret = new TextEncoder().encode(config.jwtSecret);
const COOKIE_NAME = "dw_session";

export interface SessionPayload {
  sub: string;
  email: string | null;
}

export async function issueSession(res: Response, payload: SessionPayload) {
  const jwt = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);

  res.cookie(COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // 'lax' not 'strict' — Cashfree's return redirect is cross-site
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearSession(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export async function readSession(req: Request): Promise<SessionPayload | null> {
  const jwt = req.cookies?.[COOKIE_NAME];
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, secret);
    if (typeof payload.sub !== "string") return null;
    if (payload.email !== null && typeof payload.email !== "string") return null;
    return { sub: payload.sub, email: (payload.email as string | null) ?? null };
  } catch {
    return null;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = await readSession(req);
  if (!session) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }
  (req as Request & { session: SessionPayload }).session = session;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const session = await readSession(req);
  if (!session || !session.email || !config.adminEmails.includes(session.email.toLowerCase())) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  (req as Request & { session: SessionPayload }).session = session;
  next();
}
