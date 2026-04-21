import * as jwt from "jsonwebtoken";

export type Role = "superadmin" | "admin" | "accountant" | "sales" | "cashier" | "viewer";

function getSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: JWT_SECRET env variable must be set in production.");
    }
    // Dev fallback — insecure but functional locally
    console.warn("[jwt] WARNING: JWT_SECRET not set. Using insecure dev fallback.");
    return "dev-insecure-fallback-do-not-use-in-production";
  }
  if (secret.length < 32) {
    console.warn("[jwt] WARNING: JWT_SECRET is too short. Use at least 32 random characters.");
  }
  return secret;
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h"; // increased from 1h for UX

export interface JWTPayload {
  sub: string;
  email: string;
  type: "superadmin" | "company";
  role: Role;
  companyId?: string;
  permissions?: string[];
}

export function signToken(payload: Omit<JWTPayload, "exp">): string {
  return jwt.sign(payload, getSecret(), { expiresIn: JWT_EXPIRES_IN as any });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, getSecret()) as JWTPayload;
}
