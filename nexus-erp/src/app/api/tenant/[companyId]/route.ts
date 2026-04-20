import { NextRequest, NextResponse } from "next/server";
import { loadTenantData, saveTenantData } from "@/lib/server/storage";
import { requireCompanyAccess } from "@/lib/server/auth";

export async function GET(req: NextRequest, { params }: { params: { companyId: string } }) {
  const auth = requireCompanyAccess(req, params.companyId);
  if (auth.error) return auth.error;

  const data = await loadTenantData(params.companyId);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: { companyId: string } }) {
  const auth = requireCompanyAccess(req, params.companyId);
  if (auth.error) return auth.error;

  const data = await req.json();
  await saveTenantData(params.companyId, data);
  return NextResponse.json({ ok: true });
}
