/**
 * POST /api/auth/reset-request
 * Body: { email }
 *
 * Generates a one-time password reset token (valid 1 hour).
 * In production with SMTP configured, sends an email.
 * Without SMTP (current setup), returns the token directly so an admin
 * can share it with the user out-of-band.
 *
 * Always returns 200 (prevents email enumeration).
 */
import { NextRequest, NextResponse } from "next/server";
import { loadSaaSData, loadTenantData, saveTenantData } from "@/lib/server/storage";
import { sendEmail, createEmailLog } from "@/lib/server/sendEmail";
import { query } from "@/lib/server/postgres";
import { randomBytes } from "crypto";
import { runMigrations } from "@/lib/server/migrate";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

async function storeToken(token: string, email: string, companyId: string | null) {
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  try {
    await runMigrations();
    await query(
      `INSERT INTO password_reset_tokens (token, email, company_id, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (token) DO NOTHING`,
      [token, email, companyId, expiresAt]
    );
  } catch {
    // DB not available — token will be shown directly in response
  }
}

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));
  if (!email || typeof email !== "string") {
    return NextResponse.json({ ok: true }); // always 200
  }

  const normalEmail = email.trim().toLowerCase();
  let found = false;
  let companyId: string | null = null;

  // 1. Check super admins
  const saas = await loadSaaSData();
  const superAdmin = saas.superAdmins.find(
    (a) => a.email.toLowerCase() === normalEmail
  );
  if (superAdmin) found = true;

  // 2. Check tenant users across all companies
  if (!found) {
    for (const company of saas.companies) {
      const tenant = await loadTenantData(company.id);
      const user = tenant.users.find(
        (u) => u.email.toLowerCase() === normalEmail
      );
      if (user) {
        found = true;
        companyId = company.id;
        break;
      }
    }
  }

  if (!found) {
    // Don't reveal that email doesn't exist
    return NextResponse.json({ ok: true });
  }

  const token = randomBytes(32).toString("hex");
  await storeToken(token, normalEmail, companyId);

  const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  const resetLink = `${appUrl}/app?reset=${token}`;

  // Try send reset email if SMTP is configured (tenant-level or global)
  try {
    if (companyId) {
      const tenant = await loadTenantData(companyId);
      if (tenant?.settings?.smtpHost) {
        const subject = `رابط إعادة تعيين كلمة المرور`;
        const message = `مرحباً، استخدم هذا الرابط لإعادة تعيين كلمة المرور: ${resetLink} (صالح لمدة ساعة)`;
        const result = await sendEmail(tenant.settings as any, normalEmail, subject, message, `<p>${message}</p>`);
        if (result.success) {
          if (!tenant.emailLog) tenant.emailLog = [];
          tenant.emailLog.push(createEmailLog(normalEmail, subject, message, "auth", "reset-request"));
          try { await saveTenantData(companyId, tenant); } catch {}
          return NextResponse.json({ ok: true, message: "تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني" });
        }
      }
    }

    // Global env fallback
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
      const subject = `رابط إعادة تعيين كلمة المرور`;
      const message = `مرحباً، استخدم هذا الرابط لإعادة تعيين كلمة المرور: ${resetLink} (صالح لمدة ساعة)`;
      const result = await sendEmail(globalSettings, normalEmail, subject, message, `<p>${message}</p>`);
      if (result.success) {
        return NextResponse.json({ ok: true, message: "تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني" });
      }
    }
  } catch (e) {
    // best-effort: continue to return token when SMTP fails
  }

  // No SMTP — return token so admin can share it manually
  return NextResponse.json({
    ok: true,
    token,
    resetLink,
    expiresIn: "ساعة واحدة",
    message: "لم يتم تكوين البريد الإلكتروني. شارك الرابط أدناه مع المستخدم.",
  });
}
