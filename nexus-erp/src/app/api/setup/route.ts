import { NextRequest, NextResponse } from "next/server";
import { loadSaaSData, saveSaaSData } from "@/lib/server/storage";

function uid() {
  return Math.random().toString(36).slice(2, 12);
}

export async function POST(req: NextRequest) {
  const { setupKey, name, email, password } = await req.json();

  const secret = process.env.SETUP_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "لم يتم تعيين مفتاح الإعداد في إعدادات الخادم" }, { status: 500 });
  }
  if (!setupKey || setupKey !== secret) {
    return NextResponse.json({ error: "مفتاح الإعداد غير صحيح" }, { status: 403 });
  }

  const db = await loadSaaSData();
  if (db.superAdmins.length > 0) {
    return NextResponse.json({ error: "تم إنشاء حساب المدير مسبقاً" }, { status: 409 });
  }

  const admin = {
    id: uid(),
    name,
    email,
    password,
    role: "superadmin" as const,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  };

  db.superAdmins.push(admin);
  await saveSaaSData(db);

  return NextResponse.json({ valid: true, admin });
}

export async function GET() {
  const db = await loadSaaSData();
  return NextResponse.json({ bootstrapped: db.superAdmins.length > 0 });
}
