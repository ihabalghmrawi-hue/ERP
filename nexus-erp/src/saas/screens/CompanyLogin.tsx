"use client";

import { useState } from "react";
import { SaaSDB } from "../saasDB";
import { TenantDB } from "../tenantDB";
import { Company } from "../types";
import { User } from "@/lib/db/database";
import { C, S } from "@/lib/engine/design";

interface Props {
  onLogin: (company: Company, user: User, token?: string) => void;
  onSuperAdmin: () => void;
  onRegister: () => void;
}

export function CompanyLogin({ onLogin, onSuperAdmin, onRegister }: Props) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handle = async () => {
    if (!email || !password) { setError("البريد وكلمة المرور مطلوبان"); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/company-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "البريد أو كلمة المرور غير صحيحة"); return; }

      const { company, user, tenantData, token } = data;

      // Sync to localStorage for current session
      const db = SaaSDB.get();
      if (!db.companies.find(c => c.id === company.id)) {
        db.companies.push(company);
        SaaSDB.save();
      }
      TenantDB.load(company.id);
      Object.assign(TenantDB.get(), tenantData);
      TenantDB.save();

      onLogin(company, user, token);
    } catch {
      setError("حدث خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, #F7F6F3 0%, #E8E4DC 100%)`, display: "flex", alignItems: "center", justifyContent: "center", direction: "rtl" }}>
      <div style={{ width: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>📊</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.accent }}>BOB ERP</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>نظام المحاسبة وإدارة الأعمال</div>
        </div>

        <div style={{ background: C.surface, borderRadius: 16, padding: 40, boxShadow: "0 8px 40px rgba(0,0,0,0.12)" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 24, textAlign: "center" }}>
            تسجيل الدخول
          </div>

          <div style={S.formGroup}>
            <label style={S.label}>البريد الإلكتروني</label>
            <input style={S.input} type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handle(); }}
              placeholder="your@company.com" autoFocus />
          </div>

          <div style={S.formGroup}>
            <label style={S.label}>كلمة المرور</label>
            <input style={S.input} type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handle(); }}
              placeholder="••••••••" />
          </div>

          {error && <div style={{ color: C.danger, fontSize: 12, marginBottom: 12, textAlign: "center" }}>{error}</div>}

          <button style={{ ...S.btn("primary"), width: "100%", padding: 12, fontSize: 14, border: "none", opacity: loading ? 0.7 : 1 }} onClick={handle} disabled={loading}>
            {loading ? "جارٍ التحقق..." : "دخول"}
          </button>

          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 20, paddingTop: 20, textAlign: "center" }}>
            <span style={{ fontSize: 12, color: C.textMuted }}>ليس لديك حساب؟ </span>
            <button style={{ background: "none", border: "none", color: C.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }} onClick={onRegister}>
              سجّل شركتك الآن
            </button>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button style={{ ...S.btn("ghost"), fontSize: 11, color: C.textMuted, border: "none", opacity: 0.5 }} onClick={onSuperAdmin}>
            دخول المدير العام
          </button>
        </div>
      </div>
    </div>
  );
}
