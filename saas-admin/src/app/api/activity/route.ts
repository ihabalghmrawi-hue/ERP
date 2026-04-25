import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { loadSaaS } from "@/lib/storage";

export async function GET(req: NextRequest) {
  if (!await getAdminFromRequest(req))
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const db = await loadSaaS();
  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") || "50");

  return NextResponse.json((db.activityLogs || []).slice(0, limit));
}
