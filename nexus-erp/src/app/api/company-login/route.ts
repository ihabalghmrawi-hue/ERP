import { NextRequest, NextResponse } from "next/server";
import { loadSaaSData, loadTenantData, saveTenantData } from "@/lib/server/storage";
import { signToken } from "@/lib/server/jwt";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "البريد وكلمة المرور مطلوبان" }, { status: 400 });
  }

  const saas = await loadSaaSData();

  // Find company by email or by user email in tenant DBs
  let company = saas.companies.find(c => c.email === email);
  let tenantData = null;
  let user = null;

  if (company) {
    tenantData = await loadTenantData(company.id);
    user = tenantData.users.find(u => u.email === email && u.password === password);
  } else {
    // Search by user email across all companies
    for (const c of saas.companies) {
      const tenant = await loadTenantData(c.id);
      const u = tenant.users.find(u => u.email === email && u.password === password);
      if (u) { company = c; tenantData = tenant; user = u; break; }
    }
  }

  if (!company || !user || !tenantData) {
    return NextResponse.json({ error: "البريد أو كلمة المرور غير صحيحة" }, { status: 401 });
  }
  if (user.status === "inactive") {
    return NextResponse.json({ error: "هذا الحساب موقوف" }, { status: 403 });
  }

  user.lastLogin = new Date().toISOString();
  saveTenantData(company.id, tenantData).catch(() => {});

  const token = signToken({
    sub: user.id,
    email: user.email,
    type: "company",
    role: user.role as any,
    companyId: company.id,
    permissions: user.permissions,
  });

  return NextResponse.json({ company, user, tenantData, token });
}
