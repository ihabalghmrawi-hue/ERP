import { NextRequest, NextResponse } from "next/server";
import { loadSaaSData, loadTenantData, saveTenantData } from "@/lib/server/storage";

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
  // Save updated lastLogin back (fire and forget)
  saveTenantData(company.id, tenantData).catch(() => {});

  return NextResponse.json({ company, user, tenantData });
}
