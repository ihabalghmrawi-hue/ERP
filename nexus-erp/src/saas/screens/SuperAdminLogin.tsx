"use client";

import { useState } from "react";
import { SaaSDB } from "../saasDB";
import { SuperAdmin } from "../types";
import { C, S } from "@/lib/engine/design";

interface Props {
  onLogin: (admin: SuperAdmin) => void;
  onGoToCompanyLogin: () => void;
}

export function SuperAdminLogin({ onLogin, onGoToCompanyLogin }: Props) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  const handle = () => {
    const admin = SaaSDB.loginSuperAdmin(form.email, form.password);
    if (!admin) { setError("بيانات الدخول غير صحيحة"); return; }
    onLogin(admin);
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, #0A1628 0%, #1A2744 100%)`, display: "flex", alignItems: "center", justifyContent: "center", direction: "rtl" }}>
      <div style={{ background: C.surface, borderRadius: 16, padding: 44, width: 400, boxShadow: "0 32px 80px rgba(0,0,0,0.4)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🛡️</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>لوحة المدير العام</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Super Admin Panel</div>
        </div>

        {[{ k: "email", l: "البريد الإلكتروني", t: "email" }, { k: "password", l: "كلمة المرور", t: "password" }].map(({ k, l, t }) => (
          <div key={k} style={S.formGroup}>
            <label style={S.label}>{l}</label>
            <input style={S.input} type={t} value={(form as any)[k]} onChange={e => setForm({ ...form, [k]: e.target.value })}
              onKeyDown={e => e.key === "Enter" && handle()} placeholder={l} />
          </div>
        ))}

        {error && <div style={{ color: C.danger, fontSize: 12, marginBottom: 12, textAlign: "center" }}>{error}</div>}

        <button style={{ ...S.btn("primary"), width: "100%", padding: 12, fontSize: 14, border: "none" }} onClick={handle}>
          دخول
        </button>
        <button style={{ ...S.btn("ghost"), width: "100%", marginTop: 10, fontSize: 12, border: "none" }} onClick={onGoToCompanyLogin}>
          ← العودة لدخول الشركات
        </button>
      </div>
    </div>
  );
}
