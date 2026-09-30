import { SignJWT, jwtVerify } from "jose";
import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { config } from "./config.js";

const secret = new TextEncoder().encode(config.jwtSecret);
const COOKIE_NAME = "dw_admin_session";

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    // Still run a comparison of equal length to avoid a length-based timing
    // leak, then fail — lengths differing is itself not sensitive here.
    crypto.timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function verifySuperadminCredentials(username: string, password: string): boolean {
  return (
    timingSafeStringEqual(username, config.superadmin.username) &&
    timingSafeStringEqual(password, config.superadmin.password)
  );
}

export async function issueAdminSession(res: Response) {
  const jwt = await new SignJWT({ role: "superadmin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret);

  res.cookie(COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60 * 1000,
  });
}

export function clearAdminSession(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export async function readAdminSession(req: Request): Promise<boolean> {
  const jwt = req.cookies?.[COOKIE_NAME];
  if (!jwt) return false;
  try {
    const { payload } = await jwtVerify(jwt, secret);
    return payload.role === "superadmin";
  } catch {
    return false;
  }
}

export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!(await readAdminSession(req))) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }
  next();
}
