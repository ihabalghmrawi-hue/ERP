import { NextRequest, NextResponse } from "next/server";
import { loadSaaSData } from "@/lib/server/storage";
import { signToken, signRefreshToken, verifyRefreshToken, tokenExpiryDate } from "@/lib/server/jwt";
import { verifyPassword } from "@/lib/server/password";
import { query } from "@/lib/server/postgres";
import * as OTPAuth from "otpauth";

function verifyTOTP(secret: string, token: string): boolean {
  try {
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret),
      algorithm: "SHA1", digits: 6, period: 30,
    });
    return totp.validate({ token, window: 1 }) !== null;
  } catch { return false; }
}

function setRefreshCookie(res: NextResponse, token: string) {
  res.cookies.set("refresh_token", token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict",
    path:     "/api/auth/refresh",
    maxAge:   7 * 24 * 60 * 60,
  });
}

export async function POST(req: NextRequest) {
  const { email, password, totpToken } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "البريد وكلمة المرور مطلوبان" }, { status: 400 });
  }

  const db    = await loadSaaSData();
  const admin = db.superAdmins.find((a) => a.email === email);
  if (!admin) {
    return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
  }
  const { valid } = verifyPassword(password, admin.password);
  if (!valid) {
    return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
  }

  // 2FA check
  if ((admin as any).twoFactorEnabled && (admin as any).twoFactorSecret) {
    if (!totpToken) {
      return NextResponse.json({ error: "2fa_required", message: "أدخل رمز التحقق من تطبيق المصادقة." }, { status: 200 });
    }
    if (!verifyTOTP((admin as any).twoFactorSecret, String(totpToken))) {
      return NextResponse.json({ error: "رمز التحقق الثنائي غير صحيح." }, { status: 401 });
    }
  }

  const token        = signToken({ sub: admin.id, email: admin.email, type: "superadmin", role: "superadmin" });
  const refreshToken = signRefreshToken({ sub: admin.id, email: admin.email, type: "superadmin", role: "superadmin" });
  const rp           = verifyRefreshToken(refreshToken);
  const ip           = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const ua           = req.headers.get("user-agent") ?? "";

  try {
    await query(
      `INSERT INTO refresh_tokens (jti, user_id, email, company_id, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [rp.jti, admin.id, admin.email, null, tokenExpiryDate(rp as any).toISOString(), ua, ip]
    );
  } catch { /* best-effort */ }

  const res = NextResponse.json({
    id: admin.id, name: admin.name, email: admin.email,
    role: admin.role, createdAt: admin.createdAt, lastLogin: admin.lastLogin,
    token,
  });
  setRefreshCookie(res, refreshToken);
  return res;
}
