import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { loadSaaS, saveSaaS, loadTenantData, addDays } from "@/lib/storage";
import { PlanId } from "@/lib/types";

async function guard(req: NextRequest) {
  if (!await getAdminFromRequest(req))
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  return null;
}

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/companies/[id]
export async function GET(req: NextRequest, ctx: RouteContext) {
  const err = await guard(req); if (err) return err;
  const { id } = await ctx.params;
  const db = await loadSaaS();
  const company = db.companies.find(c => c.id === id);
  if (!company) return NextResponse.json({ error: "الشركة غير موجودة" }, { status: 404 });

  const tenant = await loadTenantData(id);
  return NextResponse.json({
    company,
    stats: {
      users: tenant?.users?.length ?? 0,
      invoices: tenant?.invoices?.length ?? 0,
      products: tenant?.products?.length ?? 0,
      customers: tenant?.customers?.length ?? 0,
    },
  });
}

// PATCH /api/companies/[id]
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const err = await guard(req); if (err) return err;
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
      break;

    case "activate":
      company.status = "active";
      if (company.subscription.status === "expired")
        company.subscription.status = "active";
      break;

    case "renew": {
      const planId: PlanId = body.planId ?? company.subscription.planId;
      const cycle: "monthly" | "yearly" = body.billingCycle ?? "monthly";
      const days = cycle === "yearly" ? 365 : 30;
      company.status = "active";
      company.subscription = {
        ...company.subscription,
        planId,
        status: "active",
        billingCycle: cycle,
        amount: body.amount ?? 0,
        startDate: new Date().toISOString().slice(0, 10),
        endDate: addDays(new Date(), days),
      };
      break;
    }

    case "extend_trial": {
      const extraDays = Number(body.days) || 7;
      const base = new Date(company.subscription.endDate) > new Date()
        ? company.subscription.endDate
        : new Date().toISOString().slice(0, 10);
      company.subscription.endDate = addDays(base, extraDays);
      if (company.subscription.status === "expired")
        company.subscription.status = "trial";
      break;
    }

    case "change_plan": {
      const planId: PlanId = body.planId;
      if (!planId) return NextResponse.json({ error: "planId مطلوب" }, { status: 400 });
      company.subscription.planId = planId;
      break;
    }

    default:
      return NextResponse.json({ error: "action غير معروف" }, { status: 400 });
  }

  await saveSaaS(db);
  return NextResponse.json({ ok: true, company });
}

// DELETE /api/companies/[id]
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const err = await guard(req); if (err) return err;
  const { id } = await ctx.params;
  const db = await loadSaaS();
  const idx = db.companies.findIndex(c => c.id === id);
  if (idx === -1) return NextResponse.json({ error: "الشركة غير موجودة" }, { status: 404 });
  db.companies.splice(idx, 1);
  await saveSaaS(db);
  return NextResponse.json({ ok: true });
}
