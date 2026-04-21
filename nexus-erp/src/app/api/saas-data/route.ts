import { NextRequest, NextResponse } from "next/server";
import { loadSaaSData, saveSaaSData } from "@/lib/server/storage";
import { requireSuperAdmin } from "@/lib/server/auth";

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (auth.error) return auth.error;

  const data = await loadSaaSData();
  return NextResponse.json({ companies: data.companies, globalCounters: data.globalCounters });
}

// Accepts the full SaaS state from the client and persists it to PostgreSQL.
export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Merge with existing to avoid wiping server-only fields
  const current = await loadSaaSData();
  const merged = {
    ...current,
    companies:      body.companies      ?? current.companies,
    superAdmins:    body.superAdmins    ?? current.superAdmins,
    globalCounters: body.globalCounters ?? current.globalCounters,
  };

  await saveSaaSData(merged);
  return NextResponse.json({ ok: true });
}
