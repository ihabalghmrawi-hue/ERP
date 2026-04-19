import { NextRequest, NextResponse } from "next/server";
import { loadSaaSData } from "@/lib/server/storage";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "البريد وكلمة المرور مطلوبان" }, { status: 400 });
  }

  const db = await loadSaaSData();
  const admin = db.superAdmins.find(a => a.email === email && a.password === password);
  if (!admin) {
    return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
  }

  return NextResponse.json({
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    createdAt: admin.createdAt,
    lastLogin: admin.lastLogin,
  });
}
