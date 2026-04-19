"use client";

import { Company, PLANS } from "../types";
import { C, S } from "@/lib/engine/design";

interface Props { company: Company; onLogout: () => void; }

export function SubscriptionWall({ company, onLogout }: Props) {
  const sub = company.subscription;
  const isExpired   = sub.status === "expired";
  const isSuspended = company.status === "suspended" || sub.status === "suspended";
  const plan = PLANS[sub.planId];

  return (
    <div style={{ minHeight: "100vh", background: "#F7F6F3", display: "flex", alignItems: "center", justifyContent: "center", direction: "rtl" }}>
      <div style={{ maxWidth: 480, width: "90%", textAlign: "center" }}>
        <div style={{ background: C.surface, borderRadius: 16, padding: 48, boxShadow: "0 8px 40px rgba(0,0,0,0.1)", border: `2px solid ${isExpired ? C.warning : C.danger}` }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>{isSuspended ? "🚫" : "⏰"}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 12 }}>
            {isSuspended ? "تم تعليق الحساب" : "انتهى الاشتراك"}
          </div>
          <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 28, lineHeight: 1.7 }}>
            {isSuspended
              ? "تم تعليق حسابك من قِبل الإدارة. يرجى التواصل مع الدعم الفني لمعرفة السبب وإعادة تفعيل الحساب."
              : `انتهت صلاحية اشتراكك في خطة "${plan.nameAr}" بتاريخ ${new Date(sub.endDate).toLocaleDateString("ar-SA")}. يرجى التجديد للمتابعة في استخدام النظام.`}
          </div>

          {/* Company info */}
          <div style={{ background: C.surfaceAlt, borderRadius: 10, padding: 16, marginBottom: 28, textAlign: "right" }}>
            <div style={{ fontSize: 13, color: C.textSec }}>
              <div style={{ marginBottom: 6 }}><strong>الشركة:</strong> {company.name}</div>
              <div style={{ marginBottom: 6 }}><strong>الخطة:</strong> {plan.nameAr}</div>
              <div style={{ marginBottom: 6 }}><strong>تاريخ الانتهاء:</strong> {new Date(sub.endDate).toLocaleDateString("ar-SA")}</div>
              <div><strong>رقم الاشتراك:</strong> {sub.id}</div>
            </div>
          </div>

          {/* Contact options */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <a
              href="mailto:support@nexuserp.com?subject=تجديد الاشتراك"
              style={{ ...S.btn("primary"), border: "none", textDecoration: "none", display: "block", textAlign: "center", padding: 12, fontSize: 14 }}
            >
              📧 تواصل معنا لتجديد الاشتراك
            </a>
            <a
              href="https://wa.me/966500000000"
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...S.btn("outline"), textDecoration: "none", display: "block", textAlign: "center", padding: 12, fontSize: 14, color: C.success, borderColor: C.success }}
            >
              💬 واتساب: دعم فوري
            </a>
            <button style={{ ...S.btn("ghost"), fontSize: 13, border: "none", color: C.textMuted }} onClick={onLogout}>
              تسجيل الخروج
            </button>
          </div>
        </div>

        <div style={{ marginTop: 16, fontSize: 12, color: C.textMuted }}>
          BOB ERP · support@nexuserp.com
        </div>
      </div>
    </div>
  );
}
