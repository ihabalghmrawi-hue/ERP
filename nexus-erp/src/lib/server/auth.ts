import { NextRequest, NextResponse } from "next/server";
import { verifyToken, JWTPayload, Role } from "./jwt";
import { getDefaultPermissions, UserRole, Permission } from "@/lib/engine/permissions";

export function getAuthPayload(req: NextRequest): JWTPayload | null {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.replace("Bearer ", "");
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

export function requireAuth(req: NextRequest, allowedRoles: Role[]) {
  const payload = getAuthPayload(req);
  if (!payload) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!allowedRoles.includes(payload.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { payload };
}

export function requireSuperAdmin(req: NextRequest) {
  return requireAuth(req, ["superadmin"]);
}
