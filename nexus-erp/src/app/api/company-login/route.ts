import { NextRequest, NextResponse } from "next/server";
import { loadSaaSData, loadTenantData, saveTenantData } from "@/lib/server/storage";
import { signToken, signRefreshToken } from "@/lib/server/jwt";
import { verifyPassword } from "@/lib/server/password";
import { sanitizeTenantForClient, sanitizeUser } from "@/lib/server/sanitize";
import { checkRateLimit } from "@/lib/server/rateLimit";
import * as OTPAuth from "otpauth";

function verifyTOTP(secret: string, token: string): boolean {
  try {
    const totp = new OTPAuth.TOTP({
      issuer: "BOB ERP", label: "", algorithm: "SHA1", digits: 6, period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    return totp.validate({ token, window: 1 }) !== null;
  } catch { return false; }
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    const ipResult = checkRateLimit(`ip:${ip}`, 20, 15 * 60 * 1000);
    if (!ipResult.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { email, password, totpToken } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "البريد وكلمة المرور مطلوبان" }, { status: 400 });
    }

    const emailResult = checkRateLimit(`email:${email}`, 5, 15 * 60 * 1000);
    if (!emailResult.allowed) {
      return NextResponse.json({ error: "محاولات كثيرة، انتظر 15 دقيقة" }, { status: 429 });
    }

    const saas = await loadSaaSData();

    let company = saas.companies.find(c => c.email === email.toLowerCase().trim());
    let tenantData = null;
    let user = null;

    if (company) {
      tenantData = await loadTenantData(company.id);
      const candidate = tenantData.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
      if (candidate && verifyPassword(password, candidate.password).valid) user = candidate;
    }

    // If not found by company email, search all tenants by user email
    if (!user) {
      for (const c of saas.companies) {
        const tenant = await loadTenantData(c.id);
        const candidate = tenant.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
        if (candidate && verifyPassword(password, candidate.password).valid) {
          company = c; tenantData = tenant; user = candidate; break;
        }
      }
    }

    if (!company || !user || !tenantData) {
      return NextResponse.json({ error: "البريد أو كلمة المرور غير صحيحة" }, { status: 401 });
    }

    if (user.status === "inactive") {
      return NextResponse.json({ error: "هذا الحساب موقوف" }, { status: 403 });
    }

    // 2FA check
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!totpToken) return NextResponse.json({ error: "2fa_required" }, { status: 200 });
      if (!verifyTOTP(user.twoFactorSecret, String(totpToken))) {
        return NextResponse.json({ error: "رمز التحقق غير صحيح" }, { status: 401 });
      }
    }

    user.lastLogin = new Date().toISOString();
    saveTenantData(company.id, tenantData).catch(() => {});

    const payload = {
      sub: user.id, email: user.email, type: "company" as const,
      role: user.role as any, companyId: company.id, permissions: user.permissions,
    };
    const token = signToken(payload);
    const refreshToken = signRefreshToken(payload);

    const res = NextResponse.json({
      company,
      user: sanitizeUser(user),
      tenantData: sanitizeTenantForClient(tenantData),
      token,
    });
    res.cookies.set("refresh_token", refreshToken, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "strict", path: "/api/auth/refresh",
      maxAge: 7 * 24 * 60 * 60,
    });
    return res;

  } catch (e: any) {
    console.error("[company-login] error:", e);
    return NextResponse.json(
      { error: "حدث خطأ في الخادم: " + (e?.message ?? "unknown") },
      { status: 500 }
    );
  }
}
