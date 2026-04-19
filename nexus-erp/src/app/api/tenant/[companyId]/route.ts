import { NextRequest, NextResponse } from "next/server";
import { loadTenantData, saveTenantData } from "@/lib/server/storage";

export async function GET(_: NextRequest, { params }: { params: { companyId: string } }) {
  const data = await loadTenantData(params.companyId);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: { companyId: string } }) {
  const data = await req.json();
  await saveTenantData(params.companyId, data);
  return NextResponse.json({ ok: true });
}
