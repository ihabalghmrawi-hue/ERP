import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { loadSaaS, saveSaaS, saveTenantData, nextId, addDays, logActivity, generateInvoice } from "@/lib/storage";
import { hashPassword } from "@/lib/password";
import { v4 as uuidv4 } from "uuid";
import { Company, PlanId, Currency } from "@/lib/types";

async function guard(req: NextRequest) {
  if (!await getAdminFromRequest(req))
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  return null;
}

export async function GET(req: NextRequest) {
  const err = await guard(req); if (err) return err;
  const { searchParams } = new URL(req.url);
  const q      = searchParams.get("q")?.toLowerCase() ?? "";
  const status = searchParams.get("status") ?? "all";
  const plan   = searchParams.get("plan") ?? "all";
  const sort   = searchParams.get("sort") ?? "createdAt_desc";
  const page   = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit  = Math.min(50, Number(searchParams.get("limit") || "20"));
  const deleted = searchParams.get("deleted") === "true";

  const db = await loadSaaS();
  let list = db.companies.filter(c => deleted ? !!c.deletedAt : !c.deletedAt);

  if (q) list = list.filter(c =>
    c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone?.includes(q)
  );
  if (status !== "all") {
    if (status === "active")     list = list.filter(c => c.status === "active" && c.subscription.status === "active");
    else if (status === "trial")     list = list.filter(c => c.subscription.status === "trial");
    else if (status === "expired")   list = list.filter(c => c.subscription.status === "expired");
    else if (status === "suspended") list = list.filter(c => c.status === "suspended");
  }
  if (plan !== "all") list = list.filter(c => c.subscription.planId === plan);

  const [sf, sd] = sort.split("_");
  list.sort((a, b) => {
    let va: any, vb: any;
    if (sf === "name")    { va = a.name; vb = b.name; }
    else if (sf === "endDate") { va = a.subscription.endDate; vb = b.subscription.endDate; }
    else if (sf === "amount")  { va = a.subscription.amount; vb = b.subscription.amount; }
    else { va = a.createdAt; vb = b.createdAt; }
    return sd === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  const total = list.length;
  const data  = list.slice((page - 1) * limit, page * limit);
  return NextResponse.json({ data, total, page, pages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const err = await guard(req); if (err) return err;
  const admin = await getAdminFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const { name, email, phone, country, planId, trialDays, billingCycle, amount, currency,
          adminName, adminEmail, adminPassword, notes } = body;

  if (!name || !email || !adminName || !adminEmail || !adminPassword)
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  if (adminPassword.length < 6)
    return NextResponse.json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }, { status: 400 });

  const db = await loadSaaS();
  if (db.companies.some(c => c.email === email.toLowerCase() && !c.deletedAt))
    return NextResponse.json({ error: "هذا البريد مسجل بالفعل" }, { status: 409 });

  const plan: PlanId = planId || "trial";
  const cycle: "monthly" | "yearly" = billingCycle || "monthly";
  const days = plan === "trial" ? (Number(trialDays) || 14) : cycle === "yearly" ? 365 : 30;
  const now = new Date().toISOString().slice(0, 10);

  const company: Company = {
    id: `co_${nextId(db, "company")}`,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone || "",
    country: country || "SA",
    status: "active",
    notes: notes || "",
    subscription: {
      planId: plan,
      status: plan === "trial" ? "trial" : "active",
      startDate: now,
      endDate: addDays(now, days),
      billingCycle: cycle,
      amount: Number(amount) || 0,
      currency: (currency as Currency) || "SAR",
    },
    usageStats: { totalInvoices: 0, totalProducts: 0, totalUsers: 1, totalWarehouses: 0, invoicesThisMonth: 0, lastActivity: now },
    createdAt: now,
  };

  db.companies.push(company);
  if (plan !== "trial" && company.subscription.amount > 0) generateInvoice(db, company.id);
  await logActivity(db, admin!.sub, admin!.name, "company_created", company.id, company.name);
  await saveSaaS(db);

  const userId = uuidv4();
  await saveTenantData(company.id, {
    users: [{
      id: userId, name: adminName, email: adminEmail.trim().toLowerCase(),
      password: hashPassword(adminPassword), role: "admin", permissions: ["all"],
      status: "active", companyId: company.id, lastLogin: new Date().toISOString(), createdAt: now,
    }],
    accounts: [], journalEntries: [], customers: [], suppliers: [], products: [],
    invoices: [], purchaseOrders: [], treasury: [], warehouses: [],
    inventoryMovements: [], activityLog: [], emailLog: [], bankStatements: [],
    settings: {
      companyName: name, taxNumber: "", address: "", country: country || "SA",
      baseCurrency: currency || "SAR", fiscalYearStart: "01-01", lang: "ar",
      vatEnabled: false, vatRate: 0.15, vatName: "ضريبة القيمة المضافة",
      vatInclusive: false, lockedPeriods: [], requireInvoiceApproval: false,
    },
    counters: { je: 1, inv: 1, po: 1, tx: 1, bs: 1 },
  });

  return NextResponse.json({ ok: true, company }, { status: 201 });
}
