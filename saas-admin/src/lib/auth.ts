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

// Next.js 15: cookies() is async — use only in Server Components/Actions
export async function getAdminFromCookie(): Promise<AdminToken | null> {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE)?.value;
    if (!token) return null;
    return verifyAdminToken(token);
  } catch { return null; }
}

// For API routes and middleware: read cookie from request header directly
export function getTokenFromRequest(req: Request): string | null {
  const cookieHeader = (req as any).headers?.get?.("cookie") ?? null;
  if (!cookieHeader) return null;
  const match = (cookieHeader as string).match(new RegExp(`${COOKIE}=([^;]+)`));
  return match?.[1] ?? null;
}

export function getAdminFromRequest(req: Request): AdminToken | null {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  try { return verifyAdminToken(token); } catch { return null; }
}

export const COOKIE_NAME = COOKIE;
