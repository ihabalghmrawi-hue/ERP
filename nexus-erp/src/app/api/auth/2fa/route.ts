/**
 * 2FA API — TOTP-based two-factor authentication
 *
 * GET  /api/auth/2fa          — Generate a new TOTP secret + QR code URL for setup
 * POST /api/auth/2fa          — Verify code + enable 2FA (requires valid TOTP token)
 * DELETE /api/auth/2fa        — Disable 2FA (requires valid TOTP token + password)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthPayload } from "@/lib/server/auth";
import { loadTenantData, saveTenantData, loadSaaSData, saveSaaSData } from "@/lib/server/storage";
import { verifyPassword } from "@/lib/server/password";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

function generateSecret(): OTPAuth.Secret {
  return new OTPAuth.Secret({ size: 20 });
}

function createTOTP(secret: OTPAuth.Secret | string, email: string, issuer: string) {
  return new OTPAuth.TOTP({
    issuer,
    label:     email,
    algorithm: "SHA1",
    digits:    6,
    period:    30,
    secret:    typeof secret === "string" ? OTPAuth.Secret.fromBase32(secret) : secret,
  });
}

function verifyTOTP(secret: string, token: string): boolean {
  try {
    const totp = createTOTP(secret, "", "");
    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
  } catch {
    return false;
  }
}

// GET — generate new secret + QR code data URL for setup wizard
export async function GET(req: NextRequest) {
  const auth = await getAuthPayload(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const issuer = "BOB ERP";
  const secret = generateSecret();
  const totp   = createTOTP(secret, auth.email, issuer);
  const uri    = totp.toString();

  let qrDataUrl: string;
  try {
    qrDataUrl = await QRCode.toDataURL(uri, { width: 200, margin: 1 });
  } catch {
    qrDataUrl = "";
  }

  return NextResponse.json({
    secret:    secret.base32,
    uri,
    qrDataUrl,
  });
}

// POST — verify token + activate 2FA
export async function POST(req: NextRequest) {
  const auth = await getAuthPayload(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { secret, token } = await req.json().catch(() => ({}));
  if (!secret || !token) {
    return NextResponse.json({ error: "secret and token are required" }, { status: 400 });
  }

  if (!verifyTOTP(secret, String(token))) {
    return NextResponse.json({ error: "رمز التحقق غير صحيح. تأكد من توقيت الجهاز وأعد المحاولة." }, { status: 400 });
  }

  // Save secret to user record
  if (auth.type === "superadmin") {
    const saas = await loadSaaSData();
    const admin = saas.superAdmins.find((a) => a.id === auth.sub);
    if (!admin) return NextResponse.json({ error: "User not found" }, { status: 404 });
    (admin as any).twoFactorEnabled = true;
    (admin as any).twoFactorSecret  = secret;
    await saveSaaSData(saas);
  } else if (auth.companyId) {
    const tenant = await loadTenantData(auth.companyId);
    const user   = tenant.users.find((u) => u.id === auth.sub);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    user.twoFactorEnabled = true;
    user.twoFactorSecret  = secret;
    await saveTenantData(auth.companyId, tenant);
  }

  return NextResponse.json({ ok: true, message: "تم تفعيل المصادقة الثنائية بنجاح" });
}

// DELETE — disable 2FA (requires valid TOTP token + current password for safety)
export async function DELETE(req: NextRequest) {
  const auth = await getAuthPayload(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token, password } = await req.json().catch(() => ({}));
  if (!token || !password) {
    return NextResponse.json({ error: "token and password are required" }, { status: 400 });
  }

  if (auth.type === "superadmin") {
    const saas  = await loadSaaSData();
    const admin = saas.superAdmins.find((a) => a.id === auth.sub);
    if (!admin) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const { valid } = verifyPassword(password, (admin as any).password);
    if (!valid) return NextResponse.json({ error: "كلمة المرور غير صحيحة" }, { status: 401 });
    if (!(admin as any).twoFactorSecret || !verifyTOTP((admin as any).twoFactorSecret, String(token))) {
      return NextResponse.json({ error: "رمز التحقق غير صحيح" }, { status: 400 });
    }
    (admin as any).twoFactorEnabled = false;
    (admin as any).twoFactorSecret  = undefined;
    await saveSaaSData(saas);
  } else if (auth.companyId) {
    const tenant = await loadTenantData(auth.companyId);
    const user   = tenant.users.find((u) => u.id === auth.sub);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const { valid } = verifyPassword(password, user.password);
    if (!valid) return NextResponse.json({ error: "كلمة المرور غير صحيحة" }, { status: 401 });
    if (!user.twoFactorSecret || !verifyTOTP(user.twoFactorSecret, String(token))) {
      return NextResponse.json({ error: "رمز التحقق غير صحيح" }, { status: 400 });
    }
    user.twoFactorEnabled = false;
    user.twoFactorSecret  = undefined;
    await saveTenantData(auth.companyId, tenant);
  }

  return NextResponse.json({ ok: true, message: "تم إلغاء تفعيل المصادقة الثنائية" });
}
