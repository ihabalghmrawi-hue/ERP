import * as jwt from "jsonwebtoken";

export type Role = "superadmin" | "admin" | "accountant" | "sales" | "cashier" | "viewer";

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || "";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";

export interface JWTPayload {
  sub: string;
  email: string;
  type: "superadmin" | "company";
  role: Role;
  companyId?: string;
  permissions?: string[];
}

export function signToken(payload: Omit<JWTPayload, "exp">) {
  if (!JWT_SECRET) throw new Error("JWT secret not set. Set JWT_SECRET or NEXTAUTH_SECRET in environment.");
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });
}

export function verifyToken(token: string): JWTPayload {
  if (!JWT_SECRET) throw new Error("JWT secret not set. Set JWT_SECRET or NEXTAUTH_SECRET in environment.");
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}
