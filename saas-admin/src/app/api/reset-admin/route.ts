import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { loadSaaS, saveSaaS } from "@/lib/storage";
import { hashPassword } from "@/lib/password";
import { verifyPassword } from "@/lib/password";

// POST /api/reset-admin
// Replaces the super admin with a new account.
// Requires SETUP_SECRET (same value set in the main ERP project).
export async function POST(req: NextRequest) {
  if (!getAdminFromRequest(req))
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { setupKey, name, email, password } = body;

  const secret = process.env.SETUP_SECRET;
  if (!secret)
    return NextResponse.json({ error: "SETUP_SECRET غير مضبوط في متغيرات البيئة" }, { status: 500 });
  if (!setupKey || setupKey !== secret)
    return NextResponse.json({ error: "مفتاح SETUP_SECRET غير صحيح" }, { status: 403 });
  if (!name || !email || !password)
    return NextResponse.json({ error: "name و email و password مطلوبة" }, { status: 400 });
  if (password.length < 8)
    return NextResponse.json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }, { status: 400 });

  const db = await loadSaaS();

  const newAdmin = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password: hashPassword(password),
    createdAt: new Date().toISOString(),
  };

  db.superAdmins = [newAdmin];
  await saveSaaS(db);

  return NextResponse.json({ ok: true, email: newAdmin.email });
}
