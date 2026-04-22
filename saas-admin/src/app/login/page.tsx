"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handle = async () => {
    if (!email || !password) { setError("أدخل البريد وكلمة المرور"); return; }
    setError(""); setLoading(true);
    try {
      const res  = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "بيانات الدخول غير صحيحة"); return; }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #0F172A 100%)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div className="fade-in" style={{
        background: "#fff", borderRadius: 18, padding: "44px 40px",
        width: "100%", maxWidth: 400,
        boxShadow: "0 24px 64px rgba(0,0,0,0.28), 0 4px 16px rgba(0,0,0,0.12)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, margin: "0 auto 16px",
            background: "linear-gradient(135deg, #1D4ED8 0%, #7C3AED 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <path d="M8 12h8M12 8v8"/>
            </svg>
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.02em" }}>BOB SaaS Admin</div>
          <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 5 }}>لوحة إدارة الشركات والاشتراكات</div>
        </div>

        {/* Form */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#475569", marginBottom: 6 }}>البريد الإلكتروني</label>
          <input
            style={inputStyle}
            type="email" value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handle()}
            placeholder="admin@domain.com" autoFocus
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#475569", marginBottom: 6 }}>كلمة المرور</label>
          <input
            style={inputStyle}
            type="password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handle()}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div style={{
            background: "#FEF2F2", border: "1px solid #FECACA",
            borderRadius: 8, padding: "9px 14px", color: "#DC2626",
            fontSize: 12.5, marginBottom: 16, textAlign: "center",
          }}>{error}</div>
        )}

        <button
          onClick={handle} disabled={loading}
          style={{
            width: "100%", padding: "12px", borderRadius: 10, border: "none",
            background: loading ? "#93C5FD" : "linear-gradient(135deg, #1D4ED8 0%, #7C3AED 100%)",
            color: "#fff", fontSize: 14.5, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}
        >
          {loading ? <><span className="spinner" /> جارٍ التحقق...</> : "دخول"}
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 8,
  border: "1.5px solid #E2E8F0", fontSize: 14, color: "#1E293B",
  outline: "none", transition: "border-color 0.15s",
  background: "#F8FAFC",
};
