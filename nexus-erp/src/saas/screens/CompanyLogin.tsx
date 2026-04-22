"use client";

import { useState } from "react";
import { SaaSDB } from "../saasDB";
import { TenantDB } from "../tenantDB";
import { Company } from "../types";
import { User } from "@/lib/db/database";
import { C, S } from "@/lib/engine/design";

interface Props {
  onLogin: (company: Company, user: User, token?: string) => void;
  onRegister: () => void;
}

type Screen = "login" | "2fa" | "forgot" | "reset";

export function CompanyLogin({ onLogin, onRegister }: Props) {
  const [screen, setScreen]         = useState<Screen>("login");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [totpToken, setTotpToken]   = useState("");
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);

  // Forgot password state
  const [forgotEmail, setForgotEmail]   = useState("");
  const [resetResult, setResetResult]   = useState<{ token?: string; resetLink?: string; message?: string } | null>(null);

  // Reset password state
  const [resetToken, setResetToken]     = useState("");
  const [newPassword, setNewPassword]   = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetDone, setResetDone]       = useState(false);

  const goLogin = () => { setScreen("login"); setError(""); setResetResult(null); setResetDone(false); };

  // ── Login ──────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!email || !password) { setError("البريد وكلمة المرور مطلوبان"); return; }
    if (screen === "2fa" && !totpToken) { setError("أدخل رمز التحقق من تطبيق المصادقة"); return; }
    setError(""); setLoading(true);
    try {
      const res  = await fetch("/api/company-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, totpToken: totpToken || undefined }),
      });

      let data: any = {};
      try { data = await res.json(); } catch {
        setError("خطأ في الخادم — تأكد من إعداد متغيرات البيئة (Redis/Database) وأعد المحاولة.");
        return;
      }

      if (data.error === "2fa_required") { setScreen("2fa"); setLoading(false); return; }
      if (!res.ok) {
        if (res.status === 429) setError(data.error || "محاولات كثيرة — انتظر قليلاً وأعد المحاولة");
        else if (res.status >= 500) setError("خطأ في الخادم (" + res.status + ") — تواصل مع المدير العام");
        else setError(data.error || "البريد أو كلمة المرور غير صحيحة");
        return;
      }

      const { company, user, tenantData, token } = data;
      const db = SaaSDB.get();
      if (!db.companies.find(c => c.id === company.id)) { db.companies.push(company); SaaSDB.save(); }
      TenantDB.load(company.id);
      Object.assign(TenantDB.get(), tenantData);
      TenantDB.save();
      onLogin(company, user, token);
    } catch {
      setError("تعذّر الاتصال بالخادم — تحقق من اتصالك بالإنترنت وأعد المحاولة.");
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot password ────────────────────────────────────────
  const handleForgot = async () => {
    if (!forgotEmail) { setError("أدخل بريدك الإلكتروني"); return; }
    setError(""); setLoading(true);
    try {
      const res  = await fetch("/api/auth/reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      setResetResult(data);
    } catch {
      setError("حدث خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  // ── Reset password ─────────────────────────────────────────
  const handleReset = async () => {
    if (!resetToken) { setError("أدخل رمز إعادة التعيين"); return; }
    if (!newPassword || newPassword.length < 8) { setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل"); return; }
    if (newPassword !== confirmPassword) { setError("كلمتا المرور غير متطابقتان"); return; }
    setError(""); setLoading(true);
    try {
      const res  = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "الرمز غير صالح"); return; }
      setResetDone(true);
    } catch {
      setError("حدث خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  const cardStyle = { background: C.surface, borderRadius: 16, padding: 40, boxShadow: "0 8px 40px rgba(0,0,0,0.12)" };
  const linkBtn   = { background: "none", border: "none", color: C.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", textDecoration: "underline" } as const;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #F7F6F3 0%, #E8E4DC 100%)", display: "flex", alignItems: "center", justifyContent: "center", direction: "rtl" }}>
      <div style={{ width: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>📊</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.accent }}>BOB ERP</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>نظام المحاسبة وإدارة الأعمال</div>
        </div>

        {/* ── Login screen ── */}
        {screen === "login" && (
          <div style={cardStyle}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 24, textAlign: "center" }}>تسجيل الدخول</div>

            <div style={S.formGroup}>
              <label style={S.label}>البريد الإلكتروني</label>
              <input style={S.input} type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleLogin(); }}
                placeholder="your@company.com" autoFocus />
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>كلمة المرور</label>
              <input style={S.input} type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleLogin(); }}
                placeholder="••••••••" />
            </div>

            {/* Forgot password link */}
            <div style={{ textAlign: "left", marginBottom: 16, marginTop: -8 }}>
              <button style={{ ...linkBtn, fontSize: 11, color: C.textMuted, fontWeight: 400 }}
                onClick={() => { setForgotEmail(email); setScreen("forgot"); setError(""); }}>
                نسيت كلمة المرور؟
              </button>
            </div>

            {error && (
              <div style={{
                background: "#FEF2F2", border: "1px solid #FECACA",
                borderRadius: 8, padding: "9px 12px",
                color: C.danger, fontSize: 12.5,
                marginBottom: 14, textAlign: "center", lineHeight: 1.5,
              }}>{error}</div>
            )}

            <button style={{ ...S.btn("primary"), width: "100%", padding: 12, fontSize: 14, border: "none", opacity: loading ? 0.7 : 1 }}
              onClick={handleLogin} disabled={loading}>
              {loading ? "جارٍ التحقق..." : "دخول"}
            </button>

            <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 20, paddingTop: 20, textAlign: "center" }}>
              <span style={{ fontSize: 12, color: C.textMuted }}>ليس لديك حساب؟ </span>
              <button style={linkBtn} onClick={onRegister}>سجّل شركتك الآن</button>
            </div>
          </div>
        )}

        {/* ── 2FA screen ── */}
        {screen === "2fa" && (
          <div style={cardStyle}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>التحقق الثنائي</div>
              <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
                افتح تطبيق المصادقة وأدخل الرمز المكون من 6 أرقام
              </div>
              <input
                style={{ ...S.input, textAlign: "center", fontSize: 24, letterSpacing: 8, direction: "ltr", width: "100%" }}
                type="text" inputMode="numeric" maxLength={6}
                value={totpToken}
                onChange={e => setTotpToken(e.target.value.replace(/\D/g, ""))}
                onKeyDown={e => { if (e.key === "Enter") handleLogin(); }}
                autoFocus placeholder="000000" />
              <button style={{ ...linkBtn, marginTop: 8 }}
                onClick={() => { setScreen("login"); setTotpToken(""); setError(""); }}>
                رجوع إلى تسجيل الدخول
              </button>
            </div>
            {error && (
              <div style={{
                background: "#FEF2F2", border: "1px solid #FECACA",
                borderRadius: 8, padding: "9px 12px",
                color: C.danger, fontSize: 12.5,
                marginBottom: 14, textAlign: "center", lineHeight: 1.5,
              }}>{error}</div>
            )}
            <button style={{ ...S.btn("primary"), width: "100%", padding: 12, fontSize: 14, border: "none", opacity: loading ? 0.7 : 1 }}
              onClick={handleLogin} disabled={loading}>
              {loading ? "جارٍ التحقق..." : "تحقق"}
            </button>
          </div>
        )}

        {/* ── Forgot password screen ── */}
        {screen === "forgot" && (
          <div style={cardStyle}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🔑</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>استعادة كلمة المرور</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>
                أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين
              </div>
            </div>

            {!resetResult ? (
              <>
                <div style={S.formGroup}>
                  <label style={S.label}>البريد الإلكتروني</label>
                  <input style={S.input} type="email" value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleForgot(); }}
                    placeholder="your@company.com" autoFocus />
                </div>
                {error && (
              <div style={{
                background: "#FEF2F2", border: "1px solid #FECACA",
                borderRadius: 8, padding: "9px 12px",
                color: C.danger, fontSize: 12.5,
                marginBottom: 14, textAlign: "center", lineHeight: 1.5,
              }}>{error}</div>
            )}
                <button style={{ ...S.btn("primary"), width: "100%", padding: 12, fontSize: 14, border: "none", opacity: loading ? 0.7 : 1 }}
                  onClick={handleForgot} disabled={loading}>
                  {loading ? "جارٍ الإرسال..." : "إرسال رابط الاستعادة"}
                </button>
              </>
            ) : (
              <div>
                <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: "#166534", fontWeight: 700, marginBottom: 8 }}>✓ {resetResult.message}</div>
                  {resetResult.token && (
                    <>
                      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>رمز إعادة التعيين (صالح لمدة ساعة):</div>
                      <div style={{ fontFamily: "monospace", fontSize: 11, background: C.surfaceAlt, padding: "6px 10px", borderRadius: 6, wordBreak: "break-all", color: C.text, marginBottom: 10 }}>
                        {resetResult.token}
                      </div>
                      <button
                        style={{ ...S.btn("outline"), fontSize: 11, padding: "6px 12px", width: "100%", marginBottom: 8 }}
                        onClick={() => { setResetToken(resetResult.token!); setScreen("reset"); setError(""); }}>
                        إعادة تعيين كلمة المرور الآن ←
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            <div style={{ textAlign: "center", marginTop: 12 }}>
              <button style={linkBtn} onClick={goLogin}>رجوع إلى تسجيل الدخول</button>
            </div>
          </div>
        )}

        {/* ── Reset password screen ── */}
        {screen === "reset" && (
          <div style={cardStyle}>
            {resetDone ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 8 }}>تم تغيير كلمة المرور</div>
                <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 24 }}>يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة</div>
                <button style={{ ...S.btn("primary"), border: "none", padding: "10px 28px" }} onClick={goLogin}>
                  تسجيل الدخول
                </button>
              </div>
            ) : (
              <>
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🔒</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>كلمة مرور جديدة</div>
                </div>

                <div style={S.formGroup}>
                  <label style={S.label}>رمز إعادة التعيين</label>
                  <input style={{ ...S.input, direction: "ltr", fontFamily: "monospace", fontSize: 12 }}
                    type="text" value={resetToken}
                    onChange={e => setResetToken(e.target.value.trim())}
                    placeholder="الصق الرمز هنا" />
                </div>
                <div style={S.formGroup}>
                  <label style={S.label}>كلمة المرور الجديدة</label>
                  <input style={S.input} type="password" value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="8 أحرف على الأقل" autoFocus />
                </div>
                <div style={S.formGroup}>
                  <label style={S.label}>تأكيد كلمة المرور</label>
                  <input style={S.input} type="password" value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleReset(); }}
                    placeholder="أعد كتابة كلمة المرور" />
                </div>

                {error && (
              <div style={{
                background: "#FEF2F2", border: "1px solid #FECACA",
                borderRadius: 8, padding: "9px 12px",
                color: C.danger, fontSize: 12.5,
                marginBottom: 14, textAlign: "center", lineHeight: 1.5,
              }}>{error}</div>
            )}

                <button style={{ ...S.btn("primary"), width: "100%", padding: 12, fontSize: 14, border: "none", opacity: loading ? 0.7 : 1 }}
                  onClick={handleReset} disabled={loading}>
                  {loading ? "جارٍ التحديث..." : "حفظ كلمة المرور الجديدة"}
                </button>
                <div style={{ textAlign: "center", marginTop: 12 }}>
                  <button style={linkBtn} onClick={goLogin}>رجوع</button>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
