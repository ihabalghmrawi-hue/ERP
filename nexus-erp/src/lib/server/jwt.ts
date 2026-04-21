import * as jwt from "jsonwebtoken";
import { query } from "./postgres";
import { randomUUID } from "crypto";

export type Role = "superadmin" | "admin" | "accountant" | "sales" | "cashier" | "viewer";

function getSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: JWT_SECRET env variable must be set in production.");
    }
    console.warn("[jwt] WARNING: JWT_SECRET not set. Using insecure dev fallback.");
    return "dev-insecure-fallback-do-not-use-in-production";
  }
  if (secret.length < 32) {
    console.warn("[jwt] WARNING: JWT_SECRET is too short. Use at least 32 random characters.");
  }
  return secret;
}

function getRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("FATAL: JWT_REFRESH_SECRET env variable must be set in production.");
  }
  return (secret ?? "dev-refresh-fallback") + "_refresh";
}

const ACCESS_EXPIRES_IN  = process.env.JWT_EXPIRES_IN         || "15m";
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

export interface JWTPayload {
  sub: string;
  email: string;
  type: "superadmin" | "company";
  role: Role;
  companyId?: string;
  permissions?: string[];
  jti?: string; // JWT ID — used for revocation
}

// ── In-memory revocation cache (TTL entries cleared lazily) ──────────────
const _revokedCache = new Map<string, number>(); // jti → expiry epoch ms

function _pruneCache() {
  const now = Date.now();
  _revokedCache.forEach((exp, jti) => {
    if (exp < now) _revokedCache.delete(jti);
  });
}

export async function revokeToken(jti: string, expiresAt: Date): Promise<void> {
  _revokedCache.set(jti, expiresAt.getTime());
  // Persist to PostgreSQL (best-effort — if DB is unavailable, cache still protects)
  try {
    await query(
      `INSERT INTO revoked_tokens (jti, expires_at) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [jti, expiresAt.toISOString()]
    );
  } catch (e) {
    console.error("[jwt] Failed to persist revoked token:", e);
  }
}

export async function isTokenRevoked(jti: string): Promise<boolean> {
  // Check in-memory cache first (fast path)
  const cached = _revokedCache.get(jti);
  if (cached !== undefined) {
    if (cached < Date.now()) {
      _revokedCache.delete(jti);
      return false; // Expired entry — token has also expired, so effectively invalid
    }
    return true;
  }
  // Fallback to PostgreSQL (handles server restarts)
  try {
    _pruneCache();
    const res = await query(
      `SELECT expires_at FROM revoked_tokens WHERE jti = $1 AND expires_at > NOW()`,
      [jti]
    );
    if (res.rows.length > 0) {
      _revokedCache.set(jti, new Date(res.rows[0].expires_at).getTime());
      return true;
    }
  } catch {
    // DB unavailable — fall back to cache (miss = allow)
  }
  return false;
}

export function signToken(payload: Omit<JWTPayload, "exp">): string {
  const withJti = { ...payload, jti: randomUUID() };
  return jwt.sign(withJti, getSecret(), { expiresIn: ACCESS_EXPIRES_IN as any });
}

export function signRefreshToken(payload: Pick<JWTPayload, "sub" | "email" | "type" | "role" | "companyId">): string {
  const withJti = { ...payload, jti: randomUUID() };
  return jwt.sign(withJti, getRefreshSecret(), { expiresIn: REFRESH_EXPIRES_IN as any });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, getSecret()) as JWTPayload;
}

export function verifyRefreshToken(token: string): JWTPayload {
  return jwt.verify(token, getRefreshSecret()) as JWTPayload;
}

// Parse expiry from a decoded payload (exp is in seconds)
export function tokenExpiryDate(decoded: { exp?: number }): Date {
  return decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 8 * 60 * 60 * 1000);
}
