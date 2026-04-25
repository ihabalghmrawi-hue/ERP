import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { loadSaaS } from "@/lib/storage";

export async function GET(req: NextRequest) {
  if (!await getAdminFromRequest(req))
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const db = await loadSaaS();
  const { companies } = db;

  const total      = companies.length;
  const active     = companies.filter(c => c.status === "active" && c.subscription.status === "active").length;
  const trial      = companies.filter(c => c.subscription.status === "trial").length;
  const expired    = companies.filter(c => c.subscription.status === "expired").length;
  const suspended  = companies.filter(c => c.status === "suspended").length;

  const mrr = companies
    .filter(c => c.subscription.status === "active" && c.subscription.billingCycle === "monthly")
    .reduce((s, c) => s + c.subscription.amount, 0);
  const arr = companies
    .filter(c => c.subscription.status === "active" && c.subscription.billingCycle === "yearly")
    .reduce((s, c) => s + c.subscription.amount / 12, 0) + mrr;

  const planDist = ["trial", "starter", "pro", "enterprise"].map(p => ({
    plan: p,
    count: companies.filter(c => c.subscription.planId === p).length,
  }));

  const recent = companies.slice(-5).reverse().map(c => ({
    id: c.id, name: c.name, email: c.email,
    plan: c.subscription.planId, status: c.subscription.status,
    createdAt: c.createdAt,
  }));

  const expiringSoon = companies
    .filter(c => {
      if (c.status === "suspended") return false;
      const days = Math.ceil((new Date(c.subscription.endDate).getTime() - Date.now()) / 86400000);
      return days >= 0 && days <= 7;
    })
    .map(c => ({
      id: c.id, name: c.name, email: c.email,
      daysLeft: Math.ceil((new Date(c.subscription.endDate).getTime() - Date.now()) / 86400000),
    }));

  return NextResponse.json({ total, active, trial, expired, suspended, mrr, arr, planDist, recent, expiringSoon });
}
