import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { loadSaaS, saveSaaS } from "@/lib/storage";
import { verifyPassword, hashPassword } from "@/lib/password";

export async function PATCH(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { email, currentPassword, newPassword } = body;

  if (!currentPassword)
    return NextResponse.json({ error: "كلمة المرور الحالية مطلوبة" }, { status: 400 });

  const db = await loadSaaS();
  const record = db.superAdmins.find(a => a.id === admin.sub);
  if (!record) return NextResponse.json({ error: "المدير غير موجود" }, { status: 404 });

  if (!verifyPassword(currentPassword, record.password))
    return NextResponse.json({ error: "كلمة المرور الحالية غير صحيحة" }, { status: 400 });

  if (email && email.toLowerCase() !== record.email) {
    if (db.superAdmins.some(a => a.email === email.toLowerCase() && a.id !== record.id))
      return NextResponse.json({ error: "هذا البريد مستخدم بالفعل" }, { status: 409 });
    record.email = email.trim().toLowerCase();
  }

  if (newPassword) {
    if (newPassword.length < 8)
      return NextResponse.json({ error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل" }, { status: 400 });
    record.password = hashPassword(newPassword);
  }

  await saveSaaS(db);
  return NextResponse.json({ ok: true, email: record.email, name: record.name });
}
