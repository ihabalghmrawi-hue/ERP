import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/server/auth";
import { loadSaaSData, loadTenantData } from "@/lib/server/storage";

type Period = "day" | "week" | "month";

function cutoffDate(period: Period): string {
  const d = new Date();
  if (period === "day")   d.setDate(d.getDate() - 1);
  if (period === "week")  d.setDate(d.getDate() - 7);
  if (period === "month") d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const auth = requireSuperAdmin(req);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") ?? "month") as Period;
  const cutoff  = cutoffDate(period);

  const saas = await loadSaaSData();

  let totalInvoices = 0;
  let totalRevenue  = 0;
  let totalEmails   = 0;
  let totalPOs      = 0;

  const perCompany = await Promise.all(
    saas.companies.map(async (co) => {
      const db = await loadTenantData(co.id);

      const invoices = db.invoices.filter(i => i.date >= cutoff);
      const emails   = (db.emailLog ?? []).filter(e => e.date.slice(0, 10) >= cutoff);
      const pos      = db.purchaseOrders.filter(p => p.date >= cutoff);
      const revenue  = invoices.reduce((s, i) => s + (i.total || 0), 0);

      totalInvoices += invoices.length;
      totalRevenue  += revenue;
      totalEmails   += emails.length;
      totalPOs      += pos.length;

      return {
        companyId:       co.id,
        companyName:     co.name,
        status:          co.status,
        subscriptionPlan: co.subscription.planId,
        invoices:        invoices.length,
        revenue,
        emails:          emails.length,
        pos:             pos.length,
        lastActivity:    co.usageStats?.lastActivity ?? co.updatedAt,
      };
    })
  );

  // Sort by revenue desc
  perCompany.sort((a, b) => b.revenue - a.revenue);

  return NextResponse.json({
    period,
    cutoff,
    totals: { invoices: totalInvoices, revenue: totalRevenue, emails: totalEmails, pos: totalPOs },
    companies: perCompany,
  });
}
