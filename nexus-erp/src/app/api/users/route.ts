import { NextRequest, NextResponse } from "next/server";
import { loadSaaSData, loadTenantData, saveTenantData } from "@/lib/server/storage";
import { requireAuth } from "@/lib/server/auth";
import { uid } from "@/lib/server/uid";
import { User } from "@/lib/db/database";
import { getDefaultPermissions, UserRole } from "@/lib/engine/permissions";

export async function POST(req: NextRequest) {
  const auth = requireAuth(req, ["superadmin", "admin"]);
  if (auth.error) return auth.error;

  const payload = auth.payload;
  const body = await req.json();
  const { name, email, password, role, companyId } = body;

  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  if (role === "superadmin") {
    return NextResponse.json({ error: "Cannot create Super Admin via this endpoint." }, { status: 403 });
  }

  if (payload.role === "admin" && role === "admin") {
    return NextResponse.json({ error: "Tenant admins cannot create other admin users." }, { status: 403 });
  }

  const targetCompanyId = payload.role === "admin" ? payload.companyId : companyId;
  if (!targetCompanyId) {
    return NextResponse.json({ error: "companyId is required for user creation." }, { status: 400 });
  }

  const tenant = await loadTenantData(targetCompanyId);
  if (tenant.users.find((u) => u.email === email)) {
    return NextResponse.json({ error: "User email already exists for this company." }, { status: 409 });
  }

  const customPermissions: string[] | undefined = body.permissions;
  const user: User = {
    id: uid(),
    name,
    email,
    password,
    role,
    permissions: customPermissions ?? getDefaultPermissions(role as UserRole),
    status: "active",
    companyId: targetCompanyId,
    lastLogin: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  tenant.users.push(user);
  await saveTenantData(targetCompanyId, tenant);

  return NextResponse.json({ user });
}
