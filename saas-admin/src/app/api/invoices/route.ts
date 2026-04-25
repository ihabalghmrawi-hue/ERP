import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { loadSaaS, saveSaaS } from "@/lib/storage";

export async function GET(req: NextRequest) {
  if (!await getAdminFromRequest(req))
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const db = await loadSaaS();
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");
  const status = searchParams.get("status");

  let invoices = db.invoices || [];
  if (companyId) invoices = invoices.filter(i => i.companyId === companyId);
  if (status && status !== "all") invoices = invoices.filter(i => i.status === status);

  return NextResponse.json(invoices);
}

export async function PATCH(req: NextRequest) {
  if (!await getAdminFromRequest(req))
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id, status } = await req.json().catch(() => ({}));
  if (!id || !status) return NextResponse.json({ error: "id و status مطلوبان" }, { status: 400 });

  const db = await loadSaaS();
  const inv = db.invoices?.find(i => i.id === id);
  if (!inv) return NextResponse.json({ error: "الفاتورة غير موجودة" }, { status: 404 });

  inv.status = status;
  if (status === "paid") inv.paidAt = new Date().toISOString();
  await saveSaaS(db);
  return NextResponse.json({ ok: true, invoice: inv });
}
