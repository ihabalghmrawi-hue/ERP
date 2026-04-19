"use client";

import { useState } from "react";
import { SaaSDB } from "../saasDB";
import { SuperAdmin } from "../types";
import { C, S } from "@/lib/engine/design";

interface Props { onCreated: (admin: SuperAdmin) => void; }

export function SuperAdminSetup({ onCreated }: Props) {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", setupKey: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!form.name || !form.email || !form.password || !form.setupKey) {
      setError("جميع الحقول مطلوبة"); return;
    }
    if (form.password !== form.confirm) { setError("كلمتا المرور غير متطابقتين"); return; }
    if (form.password.length < 8) { setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل"); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupKey: form.setupKey }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "مفتاح الإعداد غير صحيح"); setLoading(false); return; }

      const admin = SaaSDB.createSuperAdmin(form.name, form.email, form.password);
      onCreated(admin);
    } catch {
      setError("حدث خطأ، حاول مجدداً");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, #0A1628 0%, #1A2744 100%)`, display: "flex", alignItems: "center", justifyContent: "center", direction: "rtl" }}>
      <div style={{ background: C.surface, borderRadius: 16, padding: 44, width: 420, boxShadow: "0 32px 80px rgba(0,0,0,0.4)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>إعداد نظام BOB ERP</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 6 }}>إنشاء حساب المدير العام (Super Admin)</div>
          <div style={{ marginTop: 10, padding: "8px 16px", background: C.warningLight, borderRadius: 8, fontSize: 12, color: C.warning }}>
            هذه الشاشة تظهر مرة واحدة فقط عند أول تشغيل
          </div>
        </div>

        {[
          { k: "setupKey",  l: "🔑 مفتاح الإعداد السري", t: "password" },
          { k: "name",      l: "الاسم الكامل",           t: "text" },
          { k: "email",     l: "البريد الإلكتروني",       t: "email" },
          { k: "password",  l: "كلمة المرور",             t: "password" },
          { k: "confirm",   l: "تأكيد كلمة المرور",       t: "password" },
        ].map(({ k, l, t }) => (
          <div key={k} style={S.formGroup}>
            <label style={S.label}>{l}</label>
            <input
              style={S.input} type={t}
              value={(form as any)[k]}
              onChange={e => setForm({ ...form, [k]: e.target.value })}
              placeholder={l}
            />
          </div>
        ))}

        {error && <div style={{ color: C.danger, fontSize: 12, marginBottom: 12, textAlign: "center" }}>{error}</div>}

        <button
          style={{ ...S.btn("primary"), width: "100%", padding: 12, fontSize: 15, border: "none", marginTop: 4, opacity: loading ? 0.7 : 1 }}
          onClick={handle}
          disabled={loading}
        >
          {loading ? "جارٍ التحقق..." : "إنشاء حساب المدير العام"}
        </button>
      </div>
    </div>
  );
}
