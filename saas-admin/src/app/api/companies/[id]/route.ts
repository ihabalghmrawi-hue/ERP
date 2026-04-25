import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { loadSaaS, saveSaaS, loadTenantData, addDays, logActivity, generateInvoice } from "@/lib/storage";
import { PlanId, Currency } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

async function guard(req: NextRequest) {
  if (!await getAdminFromRequest(req))
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  return null;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const err = await guard(req); if (err) return err;
  const { id } = await ctx.params;
  const db = await loadSaaS();
  const company = db.companies.find(c => c.id === id);
  if (!company) return NextResponse.json({ error: "الشركة غير موجودة" }, { status: 404 });

  const tenant = await loadTenantData(id);
  const invoices = (db.invoices || []).filter(i => i.companyId === id);
  return NextResponse.json({
    company,
    stats: {
      users: tenant?.users?.length ?? 0,
      invoices: tenant?.invoices?.length ?? 0,
      products: tenant?.products?.length ?? 0,
      customers: tenant?.customers?.length ?? 0,
    },
    invoices,
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const err = await guard(req); if (err) return err;
  const admin = await getAdminFromRequest(req);
  const { id } = await ctx.params;
  const db = await loadSaaS();
  const company = db.companies.find(c => c.id === id);
  if (!company) return NextResponse.json({ error: "الشركة غير موجودة" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  switch (action) {
    case "suspend":
      company.status = "suspended";
      company.subscription.status = "expired";
      await logActivity(db, admin!.sub, admin!.name, "subscription_suspended", company.id, company.name);
      break;

    case "activate":
      company.status = "active";
      if (company.subscription.status === "expired") company.subscription.status = "active";
      company.deletedAt = undefined;
      await logActivity(db, admin!.sub, admin!.name, "subscription_activated", company.id, company.name);
      break;

    case "renew": {
      const planId: PlanId = body.planId ?? company.subscription.planId;
      const cycle: "monthly" | "yearly" = body.billingCycle ?? "monthly";
      const cur: Currency = body.currency ?? company.subscription.currency ?? "SAR";
      const days = cycle === "yearly" ? 365 : 30;
      company.status = "active";
      company.subscription = {
        ...company.subscription,
        planId, status: "active", billingCycle: cycle,
        amount: Number(body.amount) || company.subscription.amount,
        currency: cur,
        startDate: new Date().toISOString().slice(0, 10),
        endDate: addDays(new Date(), days),
      };
      generateInvoice(db, company.id);
      await logActivity(db, admin!.sub, admin!.name, "subscription_renewed", company.id, company.name, { planId, cycle, amount: company.subscription.amount });
      break;
    }

    case "extend_trial": {
      const extraDays = Number(body.days) || 7;
      const base = new Date(company.subscription.endDate) > new Date()
        ? company.subscription.endDate : new Date().toISOString().slice(0, 10);
      company.subscription.endDate = addDays(base, extraDays);
      if (company.subscription.status === "expired") company.subscription.status = "trial";
      await logActivity(db, admin!.sub, admin!.name, "trial_extended", company.id, company.name, { days: extraDays });
      break;
    }

    case "change_plan": {
      const planId: PlanId = body.planId;
      if (!planId) return NextResponse.json({ error: "planId مطلوب" }, { status: 400 });
      const oldPlan = company.subscription.planId;
      company.subscription.planId = planId;
      await logActivity(db, admin!.sub, admin!.name, "plan_changed", company.id, company.name, { from: oldPlan, to: planId });
      break;
    }

    case "update_notes":
      company.notes = body.notes || "";
      break;

    default:
      return NextResponse.json({ error: "action غير معروف" }, { status: 400 });
  }

  await saveSaaS(db);
  return NextResponse.json({ ok: true, company });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const err = await guard(req); if (err) return err;
  const admin = await getAdminFromRequest(req);
  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const hard = searchParams.get("hard") === "true";

  const db = await loadSaaS();
  const idx = db.companies.findIndex(c => c.id === id);
  if (idx === -1) return NextResponse.json({ error: "الشركة غير موجودة" }, { status: 404 });

  const company = db.companies[idx];

  if (hard) {
    // Permanent delete
    db.companies.splice(idx, 1);
    await logActivity(db, admin!.sub, admin!.name, "company_deleted", id, company.name, { permanent: true });
  } else {
    // Soft delete
    company.deletedAt = new Date().toISOString();
    company.status = "suspended";
    await logActivity(db, admin!.sub, admin!.name, "company_deleted", id, company.name, { permanent: false });
  }

  await saveSaaS(db);
  return NextResponse.json({ ok: true });
}
