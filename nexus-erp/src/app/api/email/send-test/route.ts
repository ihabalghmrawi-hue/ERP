import { NextRequest, NextResponse } from "next/server";
import { loadTenantData, saveTenantData } from "@/lib/server/storage";
import { sendEmail, createEmailLog } from "@/lib/server/sendEmail";

/**
 * POST /api/email/send-test
 * Test email sending with current SMTP configuration
 */
export async function POST(req: NextRequest) {
  try {
    const { to, subject, message } = await req.json().catch(() => ({}));

    if (!to || !subject || !message) {
      return NextResponse.json(
        { success: false, message: "Missing required fields: to, subject, message" },
        { status: 400 }
      );
    }

    // Get company ID from query params or session
    const companyId = req.nextUrl.searchParams.get("companyId") || "default";

    // Load tenant data to get SMTP settings
    let tenant;
    try {
      tenant = await loadTenantData(companyId);
    } catch {
      return NextResponse.json(
        { success: false, message: "Failed to load company settings" },
        { status: 500 }
      );
    }

    // Send test email
    const result = await sendEmail(
      tenant.settings,
      to,
      subject,
      message,
      `<h3>${subject}</h3><p>${message}</p><hr><small>اختبار إرسال البريد الإلكتروني</small>`
    );

    if (result.success) {
      // Log the email
      if (!tenant.emailLog) tenant.emailLog = [];
      tenant.emailLog.push(
        createEmailLog(to, subject, message, "other", "test")
      );

      // Persist tenant data (best-effort)
      try {
        await saveTenantData(companyId, tenant);
      } catch (e) {
        // Ignore save errors
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, message: msg },
      { status: 500 }
    );
  }
}
