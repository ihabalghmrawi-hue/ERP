import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { loadSaaS } from "@/lib/storage";

export async function GET(req: NextRequest) {
  if (!await getAdminFromRequest(req))
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const db = await loadSaaS();
  const today = new Date();

  // Compute upcoming expiries for dashboard alerts
  const alerts = db.companies
    .filter(c => !c.deletedAt && c.status !== "suspended")
    .map(c => {
      const daysLeft = Math.ceil((new Date(c.subscription.endDate).getTime() - today.getTime()) / 86400000);
      return { company: c, daysLeft };
    })
    .filter(({ daysLeft }) => daysLeft <= 7)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return NextResponse.json({
    alerts,
    recentNotifications: (db.notifications || []).slice(0, 20),
  });
}
