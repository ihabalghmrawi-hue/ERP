"use client";

import { useState } from "react";
import { SuperAdmin } from "../types";
import { C, S } from "@/lib/engine/design";

interface Props {
  onLogin: (admin: SuperAdmin, token?: string) => void;
  onGoToCompanyLogin: () => void;
}

export function SuperAdminLogin({ onLogin, onGoToCompanyLogin }: Props) {
  const [form, setForm]           = useState({ email: "", password: "" });
  const [totpToken, setTotpToken] = useState("");
  const [needs2fa, setNeeds2fa]   = useState(false);
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);

  const handle = async () => {
    if (needs2fa && !totpToken) { setError("أدخل رمز التحقق"); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password, totpToken: totpToken || undefined }),
      });
      const data = await res.json();

      if (data.error === "2fa_required") {
        setNeeds2fa(true);
        setError("");
        setLoading(false);
        return;
      }

      if (!res.ok) { setError(data.error || "بيانات الدخول غير صحيحة"); return; }
      const { token, ...admin } = data;
      onLogin(admin, token);
    } catch {
      setError("حدث خطأ، حاول مجدداً");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, #0A1628 0%, #1A2744 100%)`, display: "flex", alignItems: "center", justifyContent: "center", direction: "rtl" }}>
      <div style={{ background: C.surface, borderRadius: 16, padding: 44, width: 400, boxShadow: "0 32px 80px rgba(0,0,0,0.4)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🛡️</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>لوحة المدير العام</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Super Admin Panel</div>
        </div>

        {!needs2fa ? (
          <>
            {[{ k: "email", l: "البريد الإلكتروني", t: "email" }, { k: "password", l: "كلمة المرور", t: "password" }].map(({ k, l, t }) => (
              <div key={k} style={S.formGroup}>
                <label style={S.label}>{l}</label>
                <input style={S.input} type={t} value={(form as any)[k]} onChange={e => setForm({ ...form, [k]: e.target.value })}
                  onKeyDown={e => { if (e.key === "Enter") handle(); }} placeholder={l} />
              </div>
            ))}
          </>
        ) : (
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🔐</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>التحقق الثنائي</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14 }}>
              أدخل الرمز من تطبيق المصادقة
            </div>
            <input
              style={{ ...S.input, textAlign: "center", fontSize: 22, letterSpacing: 8, direction: "ltr", width: "100%" }}
              type="text" inputMode="numeric" maxLength={6}
              value={totpToken}
              onChange={e => setTotpToken(e.target.value.replace(/\D/g, ""))}
              onKeyDown={e => { if (e.key === "Enter") handle(); }}
              autoFocus placeholder="000000"
            />
            <button
              style={{ background: "none", border: "none", color: C.accent, fontSize: 11, cursor: "pointer", marginTop: 6, textDecoration: "underline" }}
              onClick={() => { setNeeds2fa(false); setTotpToken(""); setError(""); }}
            >رجوع</button>
          </div>
        )}

        {error && <div style={{ color: C.danger, fontSize: 12, marginBottom: 12, textAlign: "center" }}>{error}</div>}

        <button style={{ ...S.btn("primary"), width: "100%", padding: 12, fontSize: 14, border: "none", opacity: loading ? 0.7 : 1 }} onClick={handle} disabled={loading}>
          {loading ? "جارٍ التحقق..." : needs2fa ? "تحقق" : "دخول"}
        </button>
        <button style={{ ...S.btn("ghost"), width: "100%", marginTop: 10, fontSize: 12, border: "none" }} onClick={onGoToCompanyLogin}>
          ← العودة لدخول الشركات
        </button>
      </div>
    </div>
  );
}
