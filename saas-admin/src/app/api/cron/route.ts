import { NextRequest, NextResponse } from "next/server";
import { loadSaaS, saveSaaS, logActivity } from "@/lib/storage";
import { Company, NotificationRecord } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

// Vercel Cron: runs daily at 8:00 AM UTC
// Add to vercel.json: { "crons": [{ "path": "/api/cron", "schedule": "0 8 * * *" }] }

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await loadSaaS();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const results = { expired: 0, notified: 0, activated: 0 };

  for (const company of db.companies) {
    if (company.status === "suspended" && company.subscription.status === "expired") continue;
    if (company.deletedAt) continue;

    const endDate = new Date(company.subscription.endDate);
    endDate.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / 86400000);

    // Auto-expire subscriptions
    if (daysLeft < 0 && company.subscription.status !== "expired") {
      company.subscription.status = "expired";
      company.status = "suspended";
      await logActivity(db, "system", "النظام", "subscription_suspended", company.id, company.name, { reason: "auto_expire" });
      results.expired++;
    }

    // Send expiry notifications
    if (daysLeft === 7 || daysLeft === 3 || daysLeft === 0) {
      const type = daysLeft === 7 ? "expiry_7d" : daysLeft === 3 ? "expiry_3d" : "expiry_today";

      // Check if already notified today
      const alreadyNotified = (db.notifications || []).some(
        n => n.companyId === company.id && n.type === type &&
          n.sentAt.startsWith(new Date().toISOString().slice(0, 10))
      );

      if (!alreadyNotified) {
        // Send email notification
        await sendExpiryEmail(company, daysLeft);

        const notif: NotificationRecord = {
          id: uuidv4(),
          companyId: company.id,
          companyName: company.name,
          type,
          sentAt: new Date().toISOString(),
          channel: "email",
        };
        if (!db.notifications) db.notifications = [];
        db.notifications = [notif, ...db.notifications].slice(0, 1000);
        results.notified++;
      }
    }
  }

  await saveSaaS(db);
  return NextResponse.json({ ok: true, ...results, runAt: new Date().toISOString() });
}

async function sendExpiryEmail(company: Company, daysLeft: number): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const subject =
    daysLeft === 0 ? `⚠️ اشتراك ${company.name} انتهى اليوم` :
    `⚠️ اشتراك ${company.name} ينتهي خلال ${daysLeft} أيام`;

  const body = `
    <div dir="rtl" style="font-family: Arial; padding: 24px; color: #1e293b;">
      <h2 style="color: #dc2626;">تنبيه انتهاء الاشتراك</h2>
      <p>مرحباً،</p>
      <p>اشتراك شركة <strong>${company.name}</strong> ${daysLeft === 0 ? "ينتهي اليوم" : `ينتهي خلال <strong>${daysLeft}</strong> أيام`}.</p>
      <ul>
        <li>الخطة: ${company.subscription.planId}</li>
        <li>تاريخ الانتهاء: ${company.subscription.endDate}</li>
      </ul>
      <p>يرجى التواصل مع العميل لتجديد الاشتراك.</p>
    </div>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "noreply@yourdomain.com",
      to: [company.email],
      subject,
      html: body,
    }),
  }).catch(() => {});
}
