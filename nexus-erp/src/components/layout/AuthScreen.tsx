"use client";

import { useState } from "react";
import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { DB, User } from "@/lib/db/database";
import { uid, today } from "@/lib/engine/helpers";

interface AuthScreenProps {
  onAuth: (user: User) => void;
}

export function AuthScreen({ onAuth }: AuthScreenProps) {
  const { t } = useLang();
  const db = DB.get();
  const isSetup = db.users.length === 0;
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");

  const handleSetup = () => {
    if (!form.name || !form.email || !form.password) {
      setError(t("fillRequired"));
      return;
    }
    const user: User = {
      id: uid(),
      name: form.name,
      email: form.email,
      password: form.password,
      role: "admin",
      permissions: [...(await import("@/lib/engine/permissions")).ALL_PERMISSIONS],
      status: "active",
      lastLogin: new Date().toISOString(),
      createdAt: today(),
    };
    db.users.push(user);
    db.activityLog.unshift({
      id: uid(),
      timestamp: new Date().toLocaleString("ar-SA"),
      userId: user.id,
      user: user.name,
      action: "CREATE",
      module: "Auth",
      description: "تم إنشاء حساب المدير",
    });
    DB.save();
    onAuth(user);
  };

  const handleLogin = () => {
    const user = db.users.find(
      (u) => u.email === form.email && u.password === form.password
    );
    if (!user) {
      setError(t("loginError"));
      return;
    }
    user.lastLogin = new Date().toISOString();
    db.activityLog.unshift({
      id: uid(),
      timestamp: new Date().toLocaleString("ar-SA"),
      userId: user.id,
      user: user.name,
      action: "LOGIN",
      module: "Auth",
      description: "تسجيل دخول",
    });
    DB.save();
    onAuth(user);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(135deg, #1A2744 0%, #0D1B2A 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: C.surface,
          borderRadius: 16,
          padding: 40,
          width: 380,
          boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>
            {t(isSetup ? "setupTitle" : "loginTitle")}
          </div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
            {t(isSetup ? "setupSubtitle" : "loginSubtitle")}
          </div>
        </div>

        {isSetup && (
          <div style={S.formGroup}>
            <label style={S.label}>{t("fullName")}</label>
            <input
              style={S.input}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t("fullName")}
            />
          </div>
        )}

        <div style={S.formGroup}>
          <label style={S.label}>{t("emailLabel")}</label>
          <input
            style={S.input}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="admin@company.com"
            onKeyDown={(e) => e.key === "Enter" && (isSetup ? handleSetup() : handleLogin())}
          />
        </div>

        <div style={S.formGroup}>
          <label style={S.label}>{t("passwordLabel")}</label>
          <input
            style={S.input}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
            onKeyDown={(e) => e.key === "Enter" && (isSetup ? handleSetup() : handleLogin())}
          />
        </div>

        {error && (
          <div
            style={{
              color: C.danger,
              fontSize: 12,
              marginBottom: 12,
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        <button
          style={{
            ...S.btn("primary"),
            width: "100%",
            padding: "11px",
            fontSize: 14,
            border: "none",
          }}
          onClick={isSetup ? handleSetup : handleLogin}
        >
          {t(isSetup ? "createAccount" : "loginBtn")}
        </button>
      </div>
    </div>
  );
}
