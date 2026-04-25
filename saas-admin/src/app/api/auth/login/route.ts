import { NextRequest, NextResponse } from "next/server";
import { loadSaaS, saveSaaS } from "@/lib/storage";
import { verifyPassword, hashPassword } from "@/lib/password";
import { signAdminToken, COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password)
    return NextResponse.json({ error: "البريد وكلمة المرور مطلوبان" }, { status: 400 });

  const db = await loadSaaS();
  const admin = db.superAdmins.find(a => a.email === email.toLowerCase().trim());

  if (!admin || !verifyPassword(password, admin.password))
    return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });

  // Rehash if stored as plain text (not scrypt and not bcrypt)
  if (!admin.password.startsWith("scrypt$") && !admin.password.startsWith("$2")) {
    admin.password = hashPassword(password);
    await saveSaaS(db);
  }

  const token = await signAdminToken({ sub: admin.id, email: admin.email, name: admin.name });
  const res = NextResponse.json({ ok: true, name: admin.name, email: admin.email });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return res;
}
