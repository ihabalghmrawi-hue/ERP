import { NextRequest, NextResponse } from "next/server";
import { loadSaaSData, saveSaaSData } from "@/lib/server/storage";
import { verifyToken } from "@/lib/server/jwt";
import { verifyPassword, hashPassword } from "@/lib/server/password";

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

// PATCH /api/admin/profile
// Body: { email?, currentPassword, newPassword? }
export async function PATCH(req: NextRequest) {
  const token = getToken(req);
  if (!token) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  let payload: any;
  try { payload = verifyToken(token); } catch {
    return NextResponse.json({ error: "الجلسة منتهية" }, { status: 401 });
  }
  if (payload.type !== "superadmin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { email, currentPassword, newPassword } = body;

  if (!currentPassword) {
    return NextResponse.json({ error: "كلمة المرور الحالية مطلوبة للتحقق" }, { status: 400 });
  }

  const saas = await loadSaaSData();
  const admin = saas.superAdmins.find(a => a.id === payload.sub);
  if (!admin) return NextResponse.json({ error: "المدير غير موجود" }, { status: 404 });

  const { valid } = verifyPassword(currentPassword, admin.password);
  if (!valid) return NextResponse.json({ error: "كلمة المرور الحالية غير صحيحة" }, { status: 400 });

  if (email && email !== admin.email) {
    const taken = saas.superAdmins.some(a => a.email === email && a.id !== admin.id);
    if (taken) return NextResponse.json({ error: "هذا البريد الإلكتروني مستخدم بالفعل" }, { status: 400 });
    admin.email = email.trim().toLowerCase();
  }

  if (newPassword) {
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل" }, { status: 400 });
    }
    admin.password = hashPassword(newPassword);
  }

  await saveSaaSData(saas);
  return NextResponse.json({ ok: true, email: admin.email });
}
