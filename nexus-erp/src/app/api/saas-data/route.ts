import { NextRequest, NextResponse } from "next/server";
import { loadSaaSData } from "@/lib/server/storage";
import { requireSuperAdmin } from "@/lib/server/auth";

export async function GET(req: NextRequest) {
  const auth = requireSuperAdmin(req);
  if (auth.error) return auth.error;

  const data = await loadSaaSData();
  return NextResponse.json({ companies: data.companies, globalCounters: data.globalCounters });
}
