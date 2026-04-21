import { NextRequest, NextResponse } from "next/server";
import { verifyToken, isTokenRevoked, JWTPayload, Role } from "./jwt";
import { getDefaultPermissions, UserRole, Permission } from "@/lib/engine/permissions";

export async function getAuthPayload(req: NextRequest): Promise<JWTPayload | null> {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.replace("Bearer ", "");
  try {
    const payload = verifyToken(token);
    // Reject revoked tokens (e.g. from explicit logout)
    if (payload.jti && await isTokenRevoked(payload.jti)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function requireAuth(req: NextRequest, allowedRoles: Role[]) {
  const payload = await getAuthPayload(req);
  if (!payload) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!allowedRoles.includes(payload.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { payload };
}

export async function requireSuperAdmin(req: NextRequest) {
  return requireAuth(req, ["superadmin"]);
}

export async function requirePermission(req: NextRequest, permission: Permission) {
  const payload = await getAuthPayload(req);
  if (!payload) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (payload.type === "superadmin") {
    return { payload };
  }
  const perms: string[] = payload.permissions ?? getDefaultPermissions(payload.role as UserRole);
  if (!perms.includes(permission)) {
    return { error: NextResponse.json({ error: "Forbidden", required: permission }, { status: 403 }) };
  }
  return { payload };
}

export async function requireCompanyAccess(req: NextRequest, companyId: string) {
  const payload = await getAuthPayload(req);
  if (!payload) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (payload.type === "superadmin") {
    return { payload };
  }
  if (payload.companyId !== companyId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { payload };
}
