import { NextRequest, NextResponse } from "next/server";
import { loadTenantData, saveTenantData } from "@/lib/server/storage";
import { sanitizeTenantForClient } from "@/lib/server/sanitize";
import { requireCompanyAccess } from "@/lib/server/auth";

export async function GET(req: NextRequest, { params }: { params: { companyId: string } }) {
  const auth = await requireCompanyAccess(req, params.companyId);
  if (auth.error) return auth.error;

  const data = await loadTenantData(params.companyId);
  const safe = sanitizeTenantForClient(data);
  return NextResponse.json(safe);
}

export async function POST(req: NextRequest, { params }: { params: { companyId: string } }) {
  const auth = await requireCompanyAccess(req, params.companyId);
  if (auth.error) return auth.error;

  const data = await req.json();
  await saveTenantData(params.companyId, data);
  return NextResponse.json({ ok: true });
}
