import { NextRequest, NextResponse } from "next/server";
import { loadSaaSData, findTenantUserByEmail, loadTenantData, saveTenantData, saveSaaSData } from "@/lib/server/storage";
import { signToken, signRefreshToken, verifyRefreshToken, tokenExpiryDate } from "@/lib/server/jwt";
import { verifyPassword, hashPassword } from "@/lib/server/password";
import { checkRateLimit, resetRateLimit } from "@/lib/server/rateLimit";
import { query } from "@/lib/server/postgres";
import * as OTPAuth from "otpauth";
import { sendEmail, createEmailLog } from "@/lib/server/sendEmail";

function verifyTOTP(secret: string, token: string): boolean {
  try {
    const totp = new OTPAuth.TOTP({
      secret:    OTPAuth.Secret.fromBase32(secret),
      algorithm: "SHA1", digits: 6, period: 30,
    });
    return totp.validate({ token, window: 1 }) !== null;
  } catch { return false; }
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function setRefreshCookie(res: NextResponse, token: string) {
  res.cookies.set("refresh_token", token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict",
    path:     "/api/auth/refresh",
    maxAge:   7 * 24 * 60 * 60, // 7 days
  });
}

async function persistRefreshToken(
  jti: string, userId: string, email: string, companyId: string | null,
  expiresAt: Date, userAgent: string, ip: string
) {
  try {
    await query(
      `INSERT INTO refresh_tokens (jti, user_id, email, company_id, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [jti, userId, email, companyId, expiresAt.toISOString(), userAgent, ip]
    );
  } catch { /* best-effort — DB may not be set up yet */ }
}

export async function POST(req: NextRequest) {
  const ip    = getClientIp(req);
  const ua    = req.headers.get("user-agent") ?? "";
  const body  = await req.json().catch(() => ({}));
  const { email, password, totpToken } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "البريد الإلكتروني وكلمة المرور مطلوبان." },
      { status: 400 }
    );
  }

  // ── Rate limit by IP ──────────────────────────────────────────────────
  const ipLimit = checkRateLimit(`login:ip:${ip}`, 20, 15 * 60 * 1000);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "محاولات تسجيل دخول كثيرة. حاول مرة أخرى لاحقاً." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } }
    );
  }

  // ── Rate limit by email ───────────────────────────────────────────────
  const emailLimit = checkRateLimit(`login:email:${email}`, 5, 15 * 60 * 1000);
  if (!emailLimit.allowed) {
    return NextResponse.json(
      { error: "تم تجاوز عدد المحاولات لهذا الحساب. حاول بعد 15 دقيقة." },
      { status: 429, headers: { "Retry-After": String(emailLimit.retryAfterSeconds) } }
    );
  }

  // ── Super Admin check ─────────────────────────────────────────────────
  const saas = await loadSaaSData();
  const superAdmin = saas.superAdmins.find((a) => a.email === email);

  if (superAdmin) {
    const { valid, needsRehash } = verifyPassword(password, superAdmin.password);
    if (!valid) {
      return NextResponse.json({ error: "بيانات الدخول غير صحيحة." }, { status: 401 });
    }
    if (needsRehash) {
      superAdmin.password = hashPassword(password);
      await saveSaaSData(saas);
    }

    // 2FA check
    if ((superAdmin as any).twoFactorEnabled && (superAdmin as any).twoFactorSecret) {
      if (!totpToken) {
        return NextResponse.json({ error: "2fa_required", message: "أدخل رمز التحقق من تطبيق المصادقة." }, { status: 200 });
      }
      if (!verifyTOTP((superAdmin as any).twoFactorSecret, String(totpToken))) {
        return NextResponse.json({ error: "رمز التحقق الثنائي غير صحيح." }, { status: 401 });
      }
    }

    resetRateLimit(`login:ip:${ip}`);
    resetRateLimit(`login:email:${email}`);

    const token = signToken({ sub: superAdmin.id, email: superAdmin.email, type: "superadmin", role: "superadmin" });
    const refreshToken = signRefreshToken({ sub: superAdmin.id, email: superAdmin.email, type: "superadmin", role: "superadmin" });
    const rp = verifyRefreshToken(refreshToken);
    await persistRefreshToken(rp.jti!, superAdmin.id, superAdmin.email, null, tokenExpiryDate(rp as any), ua, ip);

    const res = NextResponse.json({ token, role: "superadmin" });
    setRefreshCookie(res, refreshToken);
    // Fire-and-forget: notify superadmin by email if SMTP configured in env
    (async () => {
      try {
        if (process.env.SMTP_HOST) {
          const globalSettings = {
            companyName: "SaaS",
            taxNumber: "",
            address: "",
            country: "",
            baseCurrency: "SAR",
            fiscalYearStart: new Date().toISOString().slice(0, 10),
            lang: "en",
            vatEnabled: false,
            vatRate: 0,
            vatName: "",
            vatInclusive: false,
            lockedPeriods: [],
            requireInvoiceApproval: false,
            smtpHost: process.env.SMTP_HOST,
            smtpPort: process.env.SMTP_PORT ? +process.env.SMTP_PORT : 587,
            smtpUser: process.env.SMTP_USER,
            smtpPassword: process.env.SMTP_PASSWORD || process.env.SMTP_PASS,
            smtpFrom: process.env.SMTP_FROM || process.env.SMTP_USER,
          } as any;

          const subject = `تم تسجيل دخول جديد إلى حساب المدير (${superAdmin.email})`;
          const body = `تم تسجيل دخول إلى الحساب من العنوان ${ip}، وكيل المستخدم: ${ua}، في ${new Date().toISOString()}`;
          try {
            await sendEmail(globalSettings, superAdmin.email, subject, body);
          } catch (e) {
            console.error("[login] failed to send superadmin login email:", e);
          }
        }
      } catch (e) { /* swallow errors */ }
    })();

    return res;
  }

  // ── Tenant User check ─────────────────────────────────────────────────
  const tenantRecord = await findTenantUserByEmail(email);
  if (!tenantRecord) {
    return NextResponse.json({ error: "بيانات الدخول غير صحيحة." }, { status: 401 });
  }

  const { companyId, user } = tenantRecord;
  const { valid, needsRehash } = verifyPassword(password, user.password);

  if (!valid) {
    return NextResponse.json({ error: "بيانات الدخول غير صحيحة." }, { status: 401 });
  }
  if (user.status !== "active") {
    return NextResponse.json({ error: "الحساب غير نشط. تواصل مع مدير النظام." }, { status: 403 });
  }
  if (needsRehash) {
    const tenant = await loadTenantData(companyId);
    const u = tenant.users.find((u) => u.id === user.id);
    if (u) {
      u.password = hashPassword(password);
      await saveTenantData(companyId, tenant);
    }
  }

  const company = saas.companies.find((c) => c.id === companyId);
  if (!company) {
    return NextResponse.json({ error: "الشركة غير موجودة." }, { status: 401 });
  }

  // 2FA check
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    if (!totpToken) {
      return NextResponse.json({ error: "2fa_required", message: "أدخل رمز التحقق من تطبيق المصادقة." }, { status: 200 });
    }
    if (!verifyTOTP(user.twoFactorSecret, String(totpToken))) {
      return NextResponse.json({ error: "رمز التحقق الثنائي غير صحيح." }, { status: 401 });
    }
  }

  resetRateLimit(`login:ip:${ip}`);
  resetRateLimit(`login:email:${email}`);

  const token = signToken({ sub: user.id, email: user.email, type: "company", role: user.role, companyId, permissions: user.permissions });
  const refreshToken = signRefreshToken({ sub: user.id, email: user.email, type: "company", role: user.role, companyId });
  const rp = verifyRefreshToken(refreshToken);
  await persistRefreshToken(rp.jti!, user.id, user.email, companyId, tokenExpiryDate(rp as any), ua, ip);

  const res = NextResponse.json({ token, role: user.role, companyId, companyName: company.name });
  setRefreshCookie(res, refreshToken);
  // Fire-and-forget: send login notification to tenant user using tenant SMTP settings
  (async () => {
    try {
      const tenant = await loadTenantData(companyId);
      const settings = tenant.settings as any;
      const subject = `تم تسجيل دخول جديد لحسابك (${user.email})`;
      const body = `تم تسجيل الدخول من ${ip} — وكيل المستخدم: ${ua} — في ${new Date().toISOString()}`;

      const result = await sendEmail(settings, user.email, subject, body);

      // record in tenant email log (best-effort)
      try {
        if (!tenant.emailLog) tenant.emailLog = [];
        tenant.emailLog.push(createEmailLog(user.email, subject, body, "other", "login"));
        await saveTenantData(companyId, tenant);
      } catch (e) {
        console.error("[login] failed to save tenant email log:", e);
      }
    } catch (e) {
      /* ignore notification errors */
    }
  })();

  return res;
}
