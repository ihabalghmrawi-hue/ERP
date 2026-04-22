import { AppSettings, EmailLog } from "@/lib/db/database";

/**
 * Send email using SMTP configuration
 * Note: nodemailer should be installed: npm install nodemailer
 */
export async function sendEmail(
  settings: AppSettings,
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<{ success: boolean; message: string }> {
  // Validate SMTP settings
  if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPassword || !settings.smtpFrom) {
    return {
      success: false,
      message: "SMTP settings not configured",
    };
  }

  try {
    // Attempt to use nodemailer if available
    let nodemailer;
    try {
      nodemailer = require("nodemailer");
    } catch {
      return {
        success: false,
        message: "nodemailer not installed. Run: npm install nodemailer",
      };
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort || 587,
      secure: (settings.smtpPort || 587) === 465, // true for 465, false for other ports
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPassword,
      },
    });

    // Send email
    const info = await transporter.sendMail({
      from: settings.smtpFrom,
      to,
      subject,
      text,
      html: html || text,
    });

    return {
      success: true,
      message: `Email sent: ${info.messageId}`,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[sendEmail] Error:", errorMsg);
    return {
      success: false,
      message: `Failed to send email: ${errorMsg}`,
    };
  }
}

/**
 * Create EmailLog entry
 */
export function createEmailLog(
  to: string,
  subject: string,
  body: string,
  relatedType?: string,
  relatedId?: string
): EmailLog {
  return {
    id: `email_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    date: new Date().toISOString(),
    direction: "sent",
    from: "system",
    to,
    subject,
    body,
    relatedType: relatedType as any,
    relatedId,
  };
}
