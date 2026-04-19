"use client";

import { useState } from "react";
import { SaaSDB } from "../saasDB";
import { TenantDB } from "../tenantDB";
import { PLANS, PlanId, Company } from "../types";
import { User, DatabaseState } from "@/lib/db/database";
import { C, S } from "@/lib/engine/design";

interface Props {
  onRegistered: (company: Company, user: User) => void;
  onBack: () => void;
}

export function CompanyRegister({ onRegistered, onBack }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("trial");
  const [form, setForm] = useState({ companyName: "", country: "SA", phone: "", ownerName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!form.companyName || !form.email || !form.password || !form.ownerName) {
      setError("جميع الحقول المطلوبة يجب تعبئتها"); return;
    }
    if (form.password.length < 6) { setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName,
          email: form.email,
          password: form.password,
          ownerName: form.ownerName,
          phone: form.phone,
          country: form.country,
          planId: selectedPlan,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "حدث خطأ أثناء التسجيل"); return; }

      const { company, user, tenantData } = data;

      // Sync to localStorage for current session
      SaaSDB.get().companies.push(company);
      SaaSDB.get().globalCounters.company++;
      SaaSDB.save();

      if (tenantData) {
        TenantDB.load(company.id);
        Object.assign(TenantDB.get(), tenantData);
        TenantDB.save();
      }

      onRegistered(company, user);
    } catch {
      setError("حدث خطأ في الاتصال بالخادم، حاول مجدداً");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, #F7F6F3 0%, #E8E4DC 100%)`, overflowY: "auto", direction: "rtl", padding: "40px 16px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.accent }}>BOB ERP</div>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 28 }}>
          {[1, 2].map(s => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: step >= s ? C.accent : C.border, color: step >= s ? "#fff" : C.textMuted, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{s}</div>
              <span style={{ fontSize: 12, color: step >= s ? C.accent : C.textMuted }}>{s === 1 ? "اختر الخطة" : "بيانات الشركة"}</span>
              {s < 2 && <span style={{ color: C.border, fontSize: 18 }}>‹</span>}
            </div>
          ))}
        </div>

        {/* Step 1: Plan Selection */}
        {step === 1 && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 24 }}>
              {(Object.values(PLANS)).map(plan => (
                <div key={plan.id} onClick={() => setSelectedPlan(plan.id)} style={{
                  background: C.surface, borderRadius: 12, padding: 24, cursor: "pointer",
                  border: `2px solid ${selectedPlan === plan.id ? C.accent : C.border}`,
                  boxShadow: selectedPlan === plan.id ? `0 0 0 3px ${C.accentLight}` : "none",
                  transition: "all 0.15s",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: C.text }}>{plan.nameAr}</div>
                    {plan.id === "trial" && <span style={{ background: C.warningLight, color: C.warning, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>مجاني</span>}
                    {plan.id === "pro" && <span style={{ background: C.purpleLight, color: C.purple, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>الأكثر شيوعاً</span>}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: C.accent, marginBottom: 4 }}>
                    {plan.priceMonthly === 0 ? "مجاني" : `${plan.priceMonthly} ريال`}
                    {plan.priceMonthly > 0 && <span style={{ fontSize: 12, fontWeight: 400, color: C.textMuted }}>/شهر</span>}
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 14 }}>
                    {plan.limits.users === -1 ? "مستخدمون غير محدودون" : `حتى ${plan.limits.users} مستخدمين`} ·{" "}
                    {plan.limits.invoicesPerMonth === -1 ? "فواتير غير محدودة" : `${plan.limits.invoicesPerMonth} فاتورة/شهر`}
                  </div>
                  {plan.features.slice(0, 3).map(f => (
                    <div key={f} style={{ fontSize: 12, color: C.textSec, marginBottom: 4 }}>✓ {f}</div>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button style={{ ...S.btn("outline") }} onClick={onBack}>← رجوع</button>
              <button style={{ ...S.btn("primary"), border: "none", padding: "10px 32px" }} onClick={() => setStep(2)}>متابعة ←</button>
            </div>
          </div>
        )}

        {/* Step 2: Company Info */}
        {step === 2 && (
          <div style={{ background: C.surface, borderRadius: 16, padding: 36, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 24, color: C.text }}>بيانات الشركة والمدير</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { k: "companyName", l: "اسم الشركة *", t: "text" },
                { k: "country",     l: "الدولة *",      t: "text" },
                { k: "ownerName",   l: "اسم المسؤول *", t: "text" },
                { k: "phone",       l: "رقم الهاتف",    t: "tel" },
                { k: "email",       l: "البريد الإلكتروني *", t: "email" },
                { k: "password",    l: "كلمة المرور *", t: "password" },
              ].map(({ k, l, t }) => (
                <div key={k} style={S.formGroup}>
                  <label style={S.label}>{l}</label>
                  <input style={S.input} type={t} value={(form as any)[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} placeholder={l.replace(" *", "")} />
                </div>
              ))}
            </div>
            {error && <div style={{ color: C.danger, fontSize: 12, marginBottom: 12, textAlign: "center" }}>{error}</div>}
            <div style={{ background: C.successLight, borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 12, color: C.success }}>
              ✅ ستبدأ بفترة تجريبية مجانية 14 يوم — لا يُطلب بطاقة ائتمانية
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button style={{ ...S.btn("outline") }} onClick={() => setStep(1)}>← رجوع</button>
              <button style={{ ...S.btn("primary"), border: "none", padding: "10px 32px", opacity: loading ? 0.7 : 1 }} onClick={handleRegister} disabled={loading}>
                {loading ? "جارٍ الإنشاء..." : "إنشاء الحساب والبدء →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
