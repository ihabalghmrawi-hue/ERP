import { NextRequest, NextResponse } from "next/server";
import { loadSaaS, saveSaaS } from "@/lib/storage";
import { hashPassword } from "@/lib/password";

// POST /api/setup
// Creates or replaces the super admin. No login required — uses SETUP_SECRET only.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { setupKey, name, email, password } = body;

    const secret = process.env.SETUP_SECRET;
    if (!secret)
      return NextResponse.json({ error: "SETUP_SECRET غير مضبوط في متغيرات البيئة" }, { status: 503 });
    if (!setupKey || setupKey !== secret)
      return NextResponse.json({ error: "مفتاح SETUP_SECRET غير صحيح" }, { status: 403 });
    if (!name || !email || !password)
      return NextResponse.json({ error: "name و email و password مطلوبة" }, { status: 400 });
    if (password.length < 8)
      return NextResponse.json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }, { status: 400 });

    const db = await loadSaaS();

    db.superAdmins = [{
      id: crypto.randomUUID(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashPassword(password),
      createdAt: new Date().toISOString(),
    }];

    await saveSaaS(db);

    return NextResponse.json({ ok: true, email: email.trim().toLowerCase() });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unknown" }, { status: 500 });
  }
}
