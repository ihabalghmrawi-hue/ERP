import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "saas_admin_token";

export interface AdminToken {
  sub: string;
  email: string;
  name: string;
  iat?: number;
  exp?: number;
}

function getSecret(): Uint8Array {
  const secret = process.env.ADMIN_JWT_SECRET || "fallback-dev-secret-change-in-prod";
  return new TextEncoder().encode(secret);
}

export async function signAdminToken(payload: Omit<AdminToken, "iat" | "exp">): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSecret());
}

export async function verifyAdminToken(token: string): Promise<AdminToken> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as unknown as AdminToken;
}

export async function getAdminFromCookie(): Promise<AdminToken | null> {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE)?.value;
    if (!token) return null;
    return await verifyAdminToken(token);
  } catch { return null; }
}

export function getTokenFromRequest(req: Request): string | null {
  const cookieHeader = (req as any).headers?.get?.("cookie") ?? null;
  if (!cookieHeader) return null;
  const match = (cookieHeader as string).match(new RegExp(`${COOKIE}=([^;]+)`));
  return match?.[1] ?? null;
}

export async function getAdminFromRequest(req: Request): Promise<AdminToken | null> {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  try { return await verifyAdminToken(token); } catch { return null; }
}

export const COOKIE_NAME = COOKIE;
