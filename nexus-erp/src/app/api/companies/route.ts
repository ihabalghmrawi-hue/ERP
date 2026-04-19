import { NextRequest, NextResponse } from "next/server";
import { loadSaaSData, saveSaaSData, saveTenantData, loadTenantData } from "@/lib/server/storage";
import { requireSuperAdmin } from "@/lib/server/auth";
import { Company, PlanId, Subscription, SubscriptionStatus } from "@/saas/types";

function getDaysFromPlan(planId: PlanId, billingCycle: "monthly" | "yearly", trialDays?: number) {
  if (trialDays && trialDays > 0) return trialDays;
  if (planId === "trial") return 14;
  return billingCycle === "yearly" ? 365 : 30;
}

export async function POST(req: NextRequest) {
  const auth = requireSuperAdmin(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const { name, email, phone, country, city, planId = "trial", billingCycle = "monthly", trialDays } = body;

  if (!name || !email || !country) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const saas = await loadSaaSData();
  if (saas.companies.find((c) => c.email === email)) {
    return NextResponse.json({ error: "Company email already exists." }, { status: 409 });
  }

  const companyNum = saas.globalCounters.company++;
  const id = `company_${String(companyNum).padStart(5, "0")}`;
  const isTrial = planId === "trial";
  const status: SubscriptionStatus = isTrial ? "trial" : "active";
  const days = getDaysFromPlan(planId, billingCycle, trialDays);
  const subscription: Subscription = {
    id: `SUB-${String(saas.globalCounters.subscription++).padStart(6, "0")}`,
    companyId: id,
    planId,
    status,
    billingCycle,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    trialEndDate: isTrial ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : undefined,
    autoRenew: !isTrial,
    amountPaid: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const company: Company = {
    id,
    name,
    email,
    phone,
    country,
    city,
    status: "active",
    subscription,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageStats: {
      totalInvoices: 0,
      invoicesThisMonth: 0,
      totalProducts: 0,
      totalUsers: 0,
      totalWarehouses: 0,
      lastActivity: new Date().toISOString(),
    },
  };

  saas.companies.push(company);
  await saveSaaSData(saas);

  await saveTenantData(id, await loadTenantData(id));
  return NextResponse.json({ company });
}
