import { NextRequest, NextResponse } from "next/server";
import { loadSaaSData, saveSaaSData } from "@/lib/server/storage";
import { hashPassword } from "@/lib/server/password";

function uid() {
  return Math.random().toString(36).slice(2, 12);
}

// POST /api/setup
// Creates or replaces the super admin account using SETUP_SECRET.
// Used by the standalone saas-admin panel — not exposed in the main ERP UI.
export async function POST(req: NextRequest) {
  const { setupKey, name, email, password } = await req.json().catch(() => ({}));

  const secret = process.env.SETUP_SECRET;
  if (!secret)
    return NextResponse.json({ error: "SETUP_SECRET غير مضبوط في متغيرات البيئة" }, { status: 500 });
  if (!setupKey || setupKey !== secret)
    return NextResponse.json({ error: "مفتاح الإعداد غير صحيح" }, { status: 403 });
  if (!name || !email || !password)
    return NextResponse.json({ error: "name و email و password مطلوبة" }, { status: 400 });
  if (password.length < 8)
    return NextResponse.json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }, { status: 400 });

  const db = await loadSaaSData();

  // Remove existing super admins and create fresh one
  const admin = {
    id: uid(),
    name,
    email: email.trim().toLowerCase(),
    password: hashPassword(password),
    role: "superadmin" as const,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  };

  db.superAdmins = [admin];
  await saveSaaSData(db);

  return NextResponse.json({ ok: true, email: admin.email });
}

// GET /api/setup — used by saas-admin to check if bootstrapped
export async function GET() {
  const db = await loadSaaSData();
  return NextResponse.json({ bootstrapped: db.superAdmins.length > 0 });
}
