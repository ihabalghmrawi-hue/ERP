import { NextRequest, NextResponse } from "next/server";
import { loadSaaSData, saveSaaSData, saveTenantData, loadTenantData } from "@/lib/server/storage";
import { createInitialDatabaseState } from "@/lib/db/database";
import { hashPassword, validatePasswordStrength } from "@/lib/server/password";
import { sanitizeUser } from "@/lib/server/sanitize";
import { PlanId, Subscription, SubscriptionStatus } from "@/saas/types";
import { ALL_PERMISSIONS } from "@/lib/engine/permissions";

function uid() { return Math.random().toString(36).slice(2, 12); }
function today() { return new Date().toISOString().slice(0, 10); }
function addDays(n: number) {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const { companyName, email, password, ownerName, phone, country, planId = "trial" } = await req.json();

  if (!companyName || !email || !password || !ownerName || !country) {
    return NextResponse.json({ error: "جميع الحقول المطلوبة يجب تعبئتها" }, { status: 400 });
  }
  const pwError = validatePasswordStrength(password);
  if (pwError) {
    return NextResponse.json({ error: pwError }, { status: 400 });
  }

  const saas = await loadSaaSData();
  if (saas.companies.find(c => c.email === email)) {
    return NextResponse.json({ error: "يوجد شركة مسجلة بهذا البريد مسبقاً" }, { status: 409 });
  }

  const companyNum = saas.globalCounters.company++;
  const id = `company_${String(companyNum).padStart(5, "0")}`;
  const trialDays = 14;

  const subscription: Subscription = {
    id: `SUB-${String(saas.globalCounters.subscription++).padStart(6, "0")}`,
    companyId: id,
    planId: planId as PlanId,
    status: "trial" as SubscriptionStatus,
    billingCycle: "monthly",
    startDate: today(),
    endDate: addDays(trialDays),
    trialEndDate: addDays(trialDays),
    autoRenew: false,
    amountPaid: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const company = {
    id, name: companyName, email, phone: phone || "",
    country, status: "active" as const,
    subscription,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageStats: {
      totalInvoices: 0, invoicesThisMonth: 0,
      totalProducts: 0, totalUsers: 1,
      totalWarehouses: 0, lastActivity: new Date().toISOString(),
    },
  };

  saas.companies.push(company);
  await saveSaaSData(saas);

  // Create initial tenant DB with admin user
  const tenant = createInitialDatabaseState();
  tenant.settings.companyName = companyName;
  const user = {
    id: uid(), name: ownerName, email,
    password: hashPassword(password), role: "admin" as const,
    permissions: [...ALL_PERMISSIONS],
    status: "active" as const,
    companyId: id,
    lastLogin: new Date().toISOString(),
    createdAt: today(),
  };
  tenant.users.push(user);
  await saveTenantData(id, tenant);

  const safeUser = sanitizeUser(user);
  return NextResponse.json({ company, user: safeUser });
}
