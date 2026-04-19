"use client";

import { useState } from "react";
import { SaaSDB } from "../saasDB";
import { TenantDB } from "../tenantDB";
import { Company } from "../types";
import { User } from "@/lib/db/database";
import { C, S } from "@/lib/engine/design";
import { uid, today } from "@/lib/engine/helpers";

interface Props {
  onLogin: (company: Company, user: User) => void;
  onSuperAdmin: () => void;
  onRegister: () => void;
}

export function CompanyLogin({ onLogin, onSuperAdmin, onRegister }: Props) {
  const [step, setStep] = useState<"email" | "password">("email");
  const [email, setEmail] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState("");

  // Step 1: find company by email
  const handleFindCompany = () => {
    setError("");
    const co = SaaSDB.getCompanyByEmail(email) ||
      // also search by user email in tenant db
      SaaSDB.get().companies.find(c => {
        try {
          const db = TenantDB.load(c.id);
          return db.users.some(u => u.email === email);
        } catch { return false; }
      });

    if (!co) { setError("لم يتم العثور على شركة بهذا البريد"); return; }
    setCompany(co);
    setUserEmail(email);
    setStep("password");
  };

  // Step 2: verify password
  const handleLogin = () => {
    if (!company) return;
    setError("");
    const db = TenantDB.load(company.id);

    // Prevent public first-login registration for tenant companies
    if (db.users.length === 0) {
      setError("لا يوجد مستخدم مسجل لهذه الشركة. يرجى التواصل مع المدير العام لإنشاء حساب.");
      return;
    }

    const user = db.users.find(u => u.email === userEmail && u.password === password);
    if (!user) { setError("كلمة المرور غير صحيحة"); return; }
    if (user.status === "inactive") { setError("هذا الحساب موقوف"); return; }
    user.lastLogin = new Date().toISOString();
    TenantDB.save();
    onLogin(company, user);
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, #F7F6F3 0%, #E8E4DC 100%)`, display: "flex", alignItems: "center", justifyContent: "center", direction: "rtl" }}>
      <div style={{ width: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>📊</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.accent }}>BOB ERP</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>نظام المحاسبة وإدارة الأعمال</div>
        </div>

        <div style={{ background: C.surface, borderRadius: 16, padding: 40, boxShadow: "0 8px 40px rgba(0,0,0,0.12)" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 24, textAlign: "center" }}>
            {step === "email" ? "تسجيل الدخول" : `مرحباً بك في ${company?.name}`}
          </div>

          {step === "email" ? (
            <>
              <div style={S.formGroup}>
                <label style={S.label}>البريد الإلكتروني</label>
                <input style={S.input} type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleFindCompany()}
                  placeholder="your@company.com" autoFocus />
              </div>
              {error && <div style={{ color: C.danger, fontSize: 12, marginBottom: 12, textAlign: "center" }}>{error}</div>}
              <button style={{ ...S.btn("primary"), width: "100%", padding: 12, fontSize: 14, border: "none" }} onClick={handleFindCompany}>
                متابعة →
              </button>
            </>
          ) : (
            <>
              <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "10px 14px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: C.accent, fontSize: 15 }}>
                  {company?.name?.slice(0, 1)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{company?.name}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{userEmail}</div>
                </div>
              </div>
              <div style={S.formGroup}>
                <label style={S.label}>كلمة المرور</label>
                <input style={S.input} type="password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  placeholder="••••••••" autoFocus />
              </div>
              {error && <div style={{ color: C.danger, fontSize: 12, marginBottom: 12, textAlign: "center" }}>{error}</div>}
              <button style={{ ...S.btn("primary"), width: "100%", padding: 12, fontSize: 14, border: "none" }} onClick={handleLogin}>
                دخول
              </button>
              <button style={{ ...S.btn("ghost"), width: "100%", marginTop: 8, fontSize: 12, border: "none" }} onClick={() => { setStep("email"); setError(""); }}>
                ← تغيير البريد الإلكتروني
              </button>
            </>
          )}

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
