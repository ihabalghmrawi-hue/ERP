import { NextRequest, NextResponse } from "next/server";
import { loadSaaSData, findTenantUserByEmail, loadTenantData } from "@/lib/server/storage";
import { signToken } from "@/lib/server/jwt";
import { verifyPassword } from "@/lib/server/password";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const saas = await loadSaaSData();
  const superAdmin = saas.superAdmins.find((admin) => admin.email === email);
  if (superAdmin && verifyPassword(password, superAdmin.password)) {
    const token = signToken({
      sub: superAdmin.id,
      email: superAdmin.email,
      type: "superadmin",
      role: "superadmin",
    });
    return NextResponse.json({ token, role: "superadmin" });
  }

  const tenantRecord = await findTenantUserByEmail(email);
  if (!tenantRecord) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const { companyId, user } = tenantRecord;
  if (user.password !== password) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }
  if (user.status !== "active") {
    return NextResponse.json({ error: "User account is inactive." }, { status: 403 });
  }

  const company = saas.companies.find((c) => c.id === companyId);
  if (!company) {
    return NextResponse.json({ error: "Tenant company not found." }, { status: 401 });
  }

  const token = signToken({
    sub: user.id,
    email: user.email,
    type: "company",
    role: user.role,
    companyId,
  });

  return NextResponse.json({ token, role: user.role, companyId, companyName: company.name });
}
