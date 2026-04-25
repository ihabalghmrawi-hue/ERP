import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  return NextResponse.json({ id: admin.sub, email: admin.email, name: admin.name });
}
