"use client";

import { useState } from "react";
import { S, C, ELEVATION } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { DB, User } from "@/lib/db/database";
import { uid, today } from "@/lib/engine/helpers";
import { ALL_PERMISSIONS } from "@/lib/engine/permissions";

interface AuthScreenProps {
  onAuth: (user: User) => void;
}

type Screen = "login" | "confirm_reset";

export function AuthScreen({ onAuth }: AuthScreenProps) {
  const { t } = useLang();
  const db = DB.get();
  const isSetup = db.users.length === 0;

  const [screen, setScreen] = useState<Screen>("login");
  const [form, setForm]     = useState({ name: "", email: "", password: "" });
  const [error, setError]   = useState("");

  // ── Setup: create first admin ────────────────────────────────────────────
  const handleSetup = () => {
    if (!form.name || !form.email || !form.password) {
      setError(t("fillRequired"));
      return;
    }
    if (form.password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    const user: User = {
      id: uid(),
      name: form.name,
      email: form.email.trim().toLowerCase(),
      password: form.password,
      role: "admin",
      permissions: [...ALL_PERMISSIONS],
      status: "active",
      lastLogin: new Date().toISOString(),
      createdAt: today(),
    };
    db.users.push(user);
    db.settings.companyName = db.settings.companyName || form.name;
    db.activityLog.unshift({
      id: uid(),
      timestamp: new Date().toLocaleString("ar-SA"),
      userId: user.id,
      user: user.name,
      action: "CREATE",
      module: "Auth",
      description: "تم إنشاء حساب المدير العام",
      readonly: true,
    });
    DB.save();
    onAuth(user);
  };

  // ── Login ────────────────────────────────────────────────────────────────
  const handleLogin = () => {
    const candidate = db.users.find(
      u => u.email.toLowerCase() === form.email.trim().toLowerCase()
    );
    if (!candidate || candidate.password !== form.password) {
      setError(t("loginError"));
      return;
    }
    if (candidate.status === "inactive") {
      setError("هذا الحساب موقوف، تواصل مع المدير");
      return;
    }
    candidate.lastLogin = new Date().toISOString();
    db.activityLog.unshift({
      id: uid(),
      timestamp: new Date().toLocaleString("ar-SA"),
      userId: candidate.id,
      user: candidate.name,
      action: "LOGIN",
      module: "Auth",
      description: "تسجيل دخول",
      readonly: true,
    });
    DB.save();
    onAuth(candidate);
  };

  // ── Reset system ─────────────────────────────────────────────────────────
  const handleReset = () => {
    DB.reset();
    window.location.reload();
  };

  const submit = isSetup ? handleSetup : handleLogin;

  // ── Confirm reset screen ─────────────────────────────────────────────────
  if (screen === "confirm_reset") {
    return (
      <div style={wrapStyle}>
        <div style={cardStyle}>
          {/* Warning icon */}
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: C.dangerLight,
            border: `1px solid ${C.danger}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px", fontSize: 26,
          }}>
            ⚠️
          </div>

          <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 8, textAlign: "center" }}>
            إعادة ضبط النظام
          </div>
          <div style={{
            fontSize: 13, color: C.textMuted, lineHeight: 1.7,
            textAlign: "center", marginBottom: 24,
          }}>
            سيتم حذف <strong style={{ color: C.danger }}>جميع البيانات</strong> بشكل نهائي:
            <br />
            المستخدمين، العملاء، الفواتير، المنتجات، والإعدادات.
            <br />
            <strong>هذا الإجراء لا يمكن التراجع عنه.</strong>
          </div>

          <button
            onClick={handleReset}
            style={{
              ...S.btn("danger"),
              width: "100%",
              padding: "11px",
              fontSize: 14,
              border: "none",
              marginBottom: 10,
            }}
          >
            نعم، احذف كل البيانات وابدأ من جديد
          </button>

          <button
            onClick={() => setScreen("login")}
            style={{
              ...S.btn("ghost"),
              width: "100%",
              padding: "9px",
              fontSize: 13,
              border: "none",
              color: C.textMuted,
            }}
          >
            إلغاء، الرجوع لتسجيل الدخول
          </button>
        </div>
      </div>
    );
  }

  // ── Login / Setup screen ─────────────────────────────────────────────────
  return (
    <div style={wrapStyle}>
      <div style={cardStyle}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, margin: "0 auto 14px",
            background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
              <line x1="2" y1="20" x2="22" y2="20"/>
            </svg>
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>
            {isSetup ? "إعداد النظام" : "BOB ERP"}
          </div>
          <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 4 }}>
            {isSetup
              ? "أنشئ حساب المدير العام للبدء"
              : "سجّل دخولك للمتابعة"}
          </div>
        </div>

        {/* Form */}
        {isSetup && (
          <div style={S.formGroup}>
            <label style={S.label}>الاسم الكامل</label>
            <input
              style={S.input}
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="مثال: أحمد محمد"
              autoFocus
            />
          </div>
        )}

        <div style={S.formGroup}>
          <label style={S.label}>البريد الإلكتروني</label>
          <input
            style={S.input}
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            placeholder="admin@company.com"
            autoFocus={!isSetup}
            onKeyDown={e => e.key === "Enter" && submit()}
          />
        </div>

        <div style={S.formGroup}>
          <label style={S.label}>كلمة المرور</label>
          <input
            style={S.input}
            type="password"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
            onKeyDown={e => e.key === "Enter" && submit()}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: C.dangerLight,
            border: `1px solid ${C.danger}30`,
            borderRadius: 8, padding: "9px 12px",
            color: C.danger, fontSize: 12.5,
            marginBottom: 14, textAlign: "center",
          }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          style={{
            ...S.btn("primary"),
            width: "100%", padding: "11px",
            fontSize: 14, border: "none",
          }}
          onClick={submit}
        >
          {isSetup ? "إنشاء الحساب والبدء" : "تسجيل الدخول"}
        </button>

        {/* Reset link — only shown on login screen (not setup) */}
        {!isSetup && (
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <div style={{ height: 1, background: C.border, marginBottom: 16 }} />
            <button
              onClick={() => { setError(""); setScreen("confirm_reset"); }}
              style={{
                background: "none", border: "none",
                fontSize: 11.5, color: C.textMuted,
                cursor: "pointer", fontFamily: "inherit",
                textDecoration: "underline", textDecorationStyle: "dotted",
                opacity: 0.7,
              }}
            >
              إعادة ضبط النظام وحذف جميع البيانات
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const wrapStyle = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
} as const;

const cardStyle = {
  background: "#FFFFFF",
  borderRadius: 16,
  padding: "36px 32px",
  width: "100%",
  maxWidth: 380,
  boxShadow: ELEVATION[5],
} as const;
