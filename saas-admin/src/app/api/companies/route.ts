import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { loadSaaS, saveSaaS, saveTenantData, nextId, addDays } from "@/lib/storage";
import { hashPassword } from "@/lib/password";
import { v4 as uuidv4 } from "uuid";
import { Company, PlanId } from "@/lib/types";

async function guard(req: NextRequest) {
  if (!await getAdminFromRequest(req))
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  return null;
}

// GET /api/companies  — list all companies with optional search/filter
export async function GET(req: NextRequest) {
  const err = await guard(req); if (err) return err;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase() ?? "";
  const status = searchParams.get("status") ?? "all";

  const db = await loadSaaS();
  let list = db.companies;
  if (q) list = list.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  if (status !== "all") {
    if (status === "active")    list = list.filter(c => c.status === "active" && c.subscription.status === "active");
    else if (status === "trial")     list = list.filter(c => c.subscription.status === "trial");
    else if (status === "expired")   list = list.filter(c => c.subscription.status === "expired");
    else if (status === "suspended") list = list.filter(c => c.status === "suspended");
  }

  return NextResponse.json(list.slice().reverse());
}

// POST /api/companies  — create company + first admin user
export async function POST(req: NextRequest) {
  const err = await guard(req); if (err) return err;
  const body = await req.json().catch(() => ({}));
  const { name, email, phone, country, planId, trialDays, adminName, adminEmail, adminPassword } = body;

  if (!name || !email || !adminName || !adminEmail || !adminPassword)
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  if (adminPassword.length < 6)
    return NextResponse.json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }, { status: 400 });

  const db = await loadSaaS();
  if (db.companies.some(c => c.email === email.toLowerCase()))
    return NextResponse.json({ error: "هذا البريد مسجل بالفعل" }, { status: 409 });

  const plan: PlanId = planId || "trial";
  const days = plan === "trial" ? (Number(trialDays) || 14) : 30;
  const now = new Date().toISOString().slice(0, 10);

  const company: Company = {
    id: `co_${nextId(db, "company")}`,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone || "",
    country: country || "SA",
    status: "active",
    subscription: {
      planId: plan,
      status: plan === "trial" ? "trial" : "active",
      startDate: now,
      endDate: addDays(now, days),
      billingCycle: "monthly",
      amount: 0,
    },
    usageStats: { totalInvoices: 0, totalProducts: 0, totalUsers: 1, lastActivity: now },
    createdAt: now,
  };

  db.companies.push(company);
  await saveSaaS(db);

  // Create tenant data with first admin user
  const userId = uuidv4();
  const tenantData = {
    users: [{
      id: userId,
      name: adminName,
      email: adminEmail.trim().toLowerCase(),
      password: hashPassword(adminPassword),
      role: "admin",
      permissions: ["all"],
      status: "active",
      companyId: company.id,
      lastLogin: new Date().toISOString(),
      createdAt: now,
    }],
    accounts: [], journalEntries: [], customers: [], suppliers: [],
    products: [], invoices: [], purchaseOrders: [], treasury: [],
    warehouses: [], inventoryMovements: [], activityLog: [], emailLog: [],
    bankStatements: [],
    settings: {
      companyName: name, taxNumber: "", address: "", country: country || "SA",
      baseCurrency: "SAR", fiscalYearStart: "01-01", lang: "ar",
      vatEnabled: false, vatRate: 0.15, vatName: "ضريبة القيمة المضافة",
      vatInclusive: false, lockedPeriods: [], requireInvoiceApproval: false,
    },
    counters: { je: 1, inv: 1, po: 1, tx: 1, bs: 1 },
  };

  await saveTenantData(company.id, tenantData);
  return NextResponse.json({ ok: true, company }, { status: 201 });
}
