import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const SECRET = process.env.ADMIN_JWT_SECRET || "fallback-dev-secret-change-in-prod";
const COOKIE = "saas_admin_token";

export interface AdminToken {
  sub: string;
  email: string;
  name: string;
  iat?: number;
  exp?: number;
}

export function signAdminToken(payload: Omit<AdminToken, "iat" | "exp">): string {
  return jwt.sign(payload, SECRET, { expiresIn: "8h" });
}

export function verifyAdminToken(token: string): AdminToken {
  return jwt.verify(token, SECRET) as AdminToken;
}

export function getTokenFromCookie(): string | null {
  try {
    const jar = cookies();
    return jar.get(COOKIE)?.value ?? null;
  } catch { return null; }
}

export function getAdminFromCookie(): AdminToken | null {
  const token = getTokenFromCookie();
  if (!token) return null;
  try { return verifyAdminToken(token); } catch { return null; }
}

export function getTokenFromRequest(req: Request): string | null {
  const auth = (req as any).headers?.get?.("cookie") ?? null;
  if (!auth) return null;
  const match = auth.match(new RegExp(`${COOKIE}=([^;]+)`));
  return match?.[1] ?? null;
}

export function getAdminFromRequest(req: Request): AdminToken | null {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  try { return verifyAdminToken(token); } catch { return null; }
}

export const COOKIE_NAME = COOKIE;
