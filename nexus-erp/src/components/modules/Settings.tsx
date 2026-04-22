"use client";

import { useState, useEffect } from "react";
import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { DB } from "@/lib/db/database";
import { Lang } from "@/lib/i18n/translations";
import { logActivity } from "@/lib/engine/helpers";
import { useAuth } from "@/hooks/useAuth";
import { SaaSDB } from "@/saas/saasDB";

const ARAB_COUNTRIES = [
  { code: "SA", name: "المملكة العربية السعودية", nameEn: "Saudi Arabia" },
  { code: "AE", name: "الإمارات العربية المتحدة", nameEn: "UAE" },
  { code: "KW", name: "الكويت", nameEn: "Kuwait" },
  { code: "BH", name: "البحرين", nameEn: "Bahrain" },
  { code: "OM", name: "عُمان", nameEn: "Oman" },
  { code: "QA", name: "قطر", nameEn: "Qatar" },
  { code: "JO", name: "الأردن", nameEn: "Jordan" },
  { code: "EG", name: "مصر", nameEn: "Egypt" },
  { code: "IQ", name: "العراق", nameEn: "Iraq" },
  { code: "SY", name: "سوريا", nameEn: "Syria" },
  { code: "LB", name: "لبنان", nameEn: "Lebanon" },
  { code: "PS", name: "فلسطين", nameEn: "Palestine" },
  { code: "LY", name: "ليبيا", nameEn: "Libya" },
  { code: "TN", name: "تونس", nameEn: "Tunisia" },
  { code: "DZ", name: "الجزائر", nameEn: "Algeria" },
  { code: "MA", name: "المغرب", nameEn: "Morocco" },
  { code: "MR", name: "موريتانيا", nameEn: "Mauritania" },
  { code: "SD", name: "السودان", nameEn: "Sudan" },
  { code: "SO", name: "الصومال", nameEn: "Somalia" },
  { code: "DJ", name: "جيبوتي", nameEn: "Djibouti" },
  { code: "KM", name: "جزر القمر", nameEn: "Comoros" },
  { code: "YE", name: "اليمن", nameEn: "Yemen" },
];

const CURRENCIES = [
  { code: "SAR", name: "ريال سعودي", nameEn: "Saudi Riyal" },
  { code: "AED", name: "درهم إماراتي", nameEn: "UAE Dirham" },
  { code: "KWD", name: "دينار كويتي", nameEn: "Kuwaiti Dinar" },
  { code: "BHD", name: "دينار بحريني", nameEn: "Bahraini Dinar" },
  { code: "OMR", name: "ريال عُماني", nameEn: "Omani Rial" },
  { code: "QAR", name: "ريال قطري", nameEn: "Qatari Riyal" },
  { code: "JOD", name: "دينار أردني", nameEn: "Jordanian Dinar" },
  { code: "EGP", name: "جنيه مصري", nameEn: "Egyptian Pound" },
  { code: "IQD", name: "دينار عراقي", nameEn: "Iraqi Dinar" },
  { code: "SYP", name: "ليرة سورية", nameEn: "Syrian Pound" },
  { code: "LBP", name: "ليرة لبنانية", nameEn: "Lebanese Pound" },
  { code: "LYD", name: "دينار ليبي", nameEn: "Libyan Dinar" },
  { code: "TND", name: "دينار تونسي", nameEn: "Tunisian Dinar" },
  { code: "DZD", name: "دينار جزائري", nameEn: "Algerian Dinar" },
  { code: "MAD", name: "درهم مغربي", nameEn: "Moroccan Dirham" },
  { code: "MRU", name: "أوقية موريتانية", nameEn: "Mauritanian Ouguiya" },
  { code: "SDG", name: "جنيه سوداني", nameEn: "Sudanese Pound" },
  { code: "SOS", name: "شلن صومالي", nameEn: "Somali Shilling" },
  { code: "DJF", name: "فرنك جيبوتي", nameEn: "Djiboutian Franc" },
  { code: "KMF", name: "فرنك جزر القمر", nameEn: "Comorian Franc" },
  { code: "YER", name: "ريال يمني", nameEn: "Yemeni Rial" },
  { code: "USD", name: "دولار أمريكي", nameEn: "US Dollar" },
];

interface Props {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export function Settings({ lang, setLang }: Props) {
  const { t } = useLang();
  const { user } = useAuth();
  const db = DB.get();
  const [form, setForm] = useState({ ...db.settings });
  const [saved, setSaved] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSave = () => {
    Object.assign(db.settings, form);
    if (form.lang !== lang) setLang(form.lang as Lang);
    DB.save();
    logActivity(user?.id || "", user?.name || "", "UPDATE", "Settings", "تعديل إعدادات النظام");
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleSendTestEmail = async () => {
    if (!testEmail) {
      alert("أدخل بريدًا إلكترونيًا لاختباره");
      return;
    }
    setTestLoading(true);
    try {
      const res = await fetch("/api/email/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: testEmail,
          subject: "اختبار إرسال البريد - Nexus ERP",
          message: "هذا بريد اختبار من نظام Nexus ERP. إذا استقبلت هذه الرسالة، فإن إعدادات البريد الإلكتروني تعمل بشكل صحيح.",
        }),
      });
      const data = await res.json();
      setTestResult(data);
      setTimeout(() => setTestResult(null), 4000);
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "خطأ في الاتصال",
      });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div>
      <div style={S.pageTitle}>{t("settingsTitle")}</div>
      <div style={S.pageSub}>{t("settingsSubtitle")}</div>

      <div style={S.grid(2)}>
        {/* Language switcher */}
        <div style={S.card}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 20 }}>
            {t("language")}
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            {([
              { v: "ar", l: t("arabic"),  flag: "🇸🇦" },
              { v: "en", l: t("english"), flag: "🇺🇸" },
            ] as { v: Lang; l: string; flag: string }[]).map((opt) => (
              <div
                key={opt.v}
                onClick={() => setForm({ ...form, lang: opt.v })}
                style={{
                  flex: 1, padding: 20, borderRadius: 10,
                  border: `2px solid ${form.lang === opt.v ? C.accent : C.border}`,
                  cursor: "pointer",
                  background: form.lang === opt.v ? C.accentLight : C.surfaceAlt,
                  textAlign: "center", transition: "all 0.15s",
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>{opt.flag}</div>
                <div style={{ fontWeight: 700, color: form.lang === opt.v ? C.accent : C.text, fontSize: 15 }}>
                  {opt.l}
                </div>
                {form.lang === opt.v && (
                  <div style={{ fontSize: 11, color: C.accent, marginTop: 4 }}>✓ محدد</div>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, padding: 12, background: C.surfaceAlt, borderRadius: 8, fontSize: 12, color: C.textMuted }}>
            💡 تغيير اللغة يؤثر فوراً على واجهة النظام بالكامل (RTL/LTR)
          </div>
        </div>

        {/* Company settings */}
        <div style={S.card}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 20 }}>
            {t("companySettings")}
          </div>

          {(["companyName", "taxNumber", "address", "fiscalYearStart"] as const).map((k) => (
            <div key={k} style={S.formGroup}>
              <label style={S.label}>{t(k as any)}</label>
              <input
                style={S.input}
                type="text"
                value={(form as any)[k] || ""}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                placeholder={t(k as any)}
              />
            </div>
          ))}

          <div style={S.formGroup}>
            <label style={S.label}>{t("country" as any)}</label>
            <select
              style={S.input}
              value={form.country || "SA"}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            >
              {ARAB_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.nameEn})
                </option>
              ))}
            </select>
          </div>

          <div style={S.formGroup}>
            <label style={S.label}>{t("baseCurrency")}</label>
            <select
              style={S.input}
              value={form.baseCurrency || "SAR"}
              onChange={(e) => setForm({ ...form, baseCurrency: e.target.value })}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name} ({c.nameEn})
                </option>
              ))}
            </select>
          </div>

          <button
            style={{ ...S.btn("primary"), padding: "10px 28px", border: "none", marginTop: 4 }}
            onClick={handleSave}
          >
            {saved ? t("saved") : t("save")}
          </button>
        </div>
      </div>

      {/* VAT Settings */}
      <div style={S.card}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 4 }}>
          ⚖️ إعدادات ضريبة القيمة المضافة (VAT)
        </div>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 20 }}>
          تُطبَّق هذه الإعدادات على جميع الفواتير الجديدة — يمكن التحكم بها لكل فاتورة على حدة
        </div>

        {/* Enable / Disable toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, padding: "14px 16px", background: (form as any).vatEnabled ? C.successLight : C.surfaceAlt, borderRadius: 10, border: `1.5px solid ${(form as any).vatEnabled ? C.success : C.border}` }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none", flex: 1 }}>
            <input
              type="checkbox"
              checked={(form as any).vatEnabled || false}
              onChange={(e) => setForm({ ...form, vatEnabled: e.target.checked } as any)}
              style={{ width: 18, height: 18, cursor: "pointer" }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: (form as any).vatEnabled ? C.success : C.text }}>
                {(form as any).vatEnabled ? "✅ ضريبة القيمة المضافة مفعّلة" : "ضريبة القيمة المضافة معطّلة"}
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                عند التفعيل، تُحسب الضريبة تلقائياً وتُرحَّل إلى حسابات الضريبة في دفتر الأستاذ
              </div>
            </div>
          </label>
        </div>

        {/* Inclusive / Exclusive default */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>نوع الأسعار الافتراضي</div>
            <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}`, width: "fit-content" }}>
              {[
                { val: false, label: "غير شامل الضريبة (Exclusive)" },
                { val: true,  label: "شامل الضريبة (Inclusive)" },
              ].map((opt) => (
                <button
                  key={String(opt.val)}
                  onClick={() => setForm({ ...form, vatInclusive: opt.val } as any)}
                  style={{
                    padding: "9px 18px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
                    background: (form as any).vatInclusive === opt.val ? C.accent : C.surface,
                    color: (form as any).vatInclusive === opt.val ? "#fff" : C.textMuted,
                    transition: "all 0.15s",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>
              {(form as any).vatInclusive
                ? "💡 الضريبة مضمّنة في السعر — يتم استخراجها تلقائياً"
                : "💡 الضريبة تُضاف فوق السعر عند إنشاء الفاتورة"}
            </div>
          </div>
        </div>

        <div style={S.grid(3)}>
          <div style={S.formGroup}>
            <label style={S.label}>اسم الضريبة</label>
            <input
              style={S.input}
              type="text"
              value={(form as any).vatName || ""}
              onChange={(e) => setForm({ ...form, vatName: e.target.value } as any)}
              placeholder="مثال: ضريبة القيمة المضافة"
            />
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>نسبة الضريبة (%)</label>
            <input
              style={S.input}
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={Math.round(((form as any).vatRate || 0) * 100)}
              onChange={(e) => setForm({ ...form, vatRate: +e.target.value / 100 } as any)}
              placeholder="مثال: 15"
            />
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>معاينة على فاتورة 1,000</label>
            <div style={{ padding: "10px 14px", background: C.surfaceAlt, borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }}>
              {(form as any).vatInclusive ? (
                <>
                  <div style={{ color: C.textMuted, marginBottom: 4, fontSize: 11 }}>السعر شامل الضريبة</div>
                  <div style={{ color: C.text }}>
                    الوعاء: {(1000 / (1 + ((form as any).vatRate || 0))).toFixed(2)}
                  </div>
                  <div style={{ fontWeight: 700, color: C.warning }}>
                    مستخرج: {(1000 - 1000 / (1 + ((form as any).vatRate || 0))).toFixed(2)}
                  </div>
                  <div style={{ fontWeight: 800, color: C.accent }}>الإجمالي: 1,000.00</div>
                </>
              ) : (
                <>
                  <div style={{ color: C.textMuted, marginBottom: 4, fontSize: 11 }}>السعر غير شامل الضريبة</div>
                  <div style={{ color: C.text }}>الوعاء: 1,000.00</div>
                  <div style={{ fontWeight: 700, color: C.warning }}>
                    مضاف: {(1000 * ((form as any).vatRate || 0)).toFixed(2)}
                  </div>
                  <div style={{ fontWeight: 800, color: C.accent }}>
                    الإجمالي: {(1000 * (1 + ((form as any).vatRate || 0))).toFixed(2)}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* VAT Accounts info */}
        <div style={{ background: C.accentLight, borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 12 }}>
          <div style={{ fontWeight: 700, color: C.accent, marginBottom: 8 }}>📊 الحسابات المحاسبية المرتبطة تلقائياً</div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div style={{ color: C.textSec }}>
              <span style={{ color: C.success, fontWeight: 700 }}>2100</span> — ضريبة المدخلات (VAT مستردة) · تُستخدم في فواتير الشراء كمدين
            </div>
            <div style={{ color: C.textSec }}>
              <span style={{ color: C.danger, fontWeight: 700 }}>2200</span> — ضريبة المخرجات (VAT مستحقة) · تُستخدم في فواتير البيع كدائن
            </div>
          </div>
        </div>

        <button
          style={{ ...S.btn("primary"), padding: "10px 28px", border: "none" }}
          onClick={handleSave}
        >
          {saved ? "تم الحفظ ✓" : "حفظ إعدادات الضريبة"}
        </button>
      </div>

      {/* Email Settings */}
      <div style={S.card}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 4 }}>
          ✉️ إعدادات البريد الإلكتروني
        </div>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 20 }}>
          أدخل بيانات خادم SMTP لتفعيل إرسال البريد الإلكتروني التلقائي للموافقات والرفوضات والتنبيهات
        </div>

        <div style={S.grid(2)}>
          <div style={S.formGroup}>
            <label style={S.label}>{t("smtpHost")}</label>
            <input
              style={S.input}
              type="text"
              value={(form as any).smtpHost || ""}
              onChange={(e) => setForm({ ...form, smtpHost: e.target.value } as any)}
              placeholder="مثال: smtp.gmail.com"
            />
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>{t("smtpPort")}</label>
            <input
              style={S.input}
              type="number"
              value={(form as any).smtpPort || 587}
              onChange={(e) => setForm({ ...form, smtpPort: +e.target.value } as any)}
              placeholder="مثال: 587"
            />
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>{t("smtpUser")}</label>
            <input
              style={S.input}
              type="text"
              value={(form as any).smtpUser || ""}
              onChange={(e) => setForm({ ...form, smtpUser: e.target.value } as any)}
              placeholder="بريدك الإلكتروني"
            />
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>{t("smtpPassword")}</label>
            <input
              style={S.input}
              type="password"
              value={(form as any).smtpPassword || ""}
              onChange={(e) => setForm({ ...form, smtpPassword: e.target.value } as any)}
              placeholder="كلمة المرور أو App Password"
            />
          </div>
        </div>

        <div style={S.formGroup}>
          <label style={S.label}>{t("smtpFrom")}</label>
          <input
            style={S.input}
            type="email"
            value={(form as any).smtpFrom || ""}
            onChange={(e) => setForm({ ...form, smtpFrom: e.target.value } as any)}
            placeholder="البريد الذي ستُرسل به الرسائل"
          />
        </div>

        <div style={{ background: C.accentLight, borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 12 }}>
          <div style={{ fontWeight: 700, color: C.accent, marginBottom: 6 }}>💡 تلميح</div>
          <div style={{ color: C.text, lineHeight: 1.5 }}>
            في Gmail: استخدم بريدك الكامل كمستخدم وكلمة مرور التطبيق (App Password) بدلاً من كلمة المرور العادية.
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label style={S.label}>اختبر الإرسال (بريد اختياري)</label>
            <input
              style={S.input}
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="بريد اختياري لاختبار الإرسال"
            />
          </div>
          <button
            style={{ ...S.btn("outline"), padding: "7px 16px", fontSize: 12, border: "none" }}
            onClick={handleSendTestEmail}
            disabled={testLoading || !testEmail}
          >
            {testLoading ? "⏳ جاري الإرسال..." : "✉️ اختبر"}
          </button>
        </div>

        {testResult && (
          <div
            style={{
              background: testResult.success ? C.successLight : `${C.danger}15`,
              borderRadius: 8,
              padding: "10px 12px",
              marginTop: 12,
              fontSize: 12,
              color: testResult.success ? C.success : C.danger,
              fontWeight: 600,
            }}
          >
            {testResult.success ? "✓" : "✗"} {testResult.message}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button
            style={{ ...S.btn("primary"), padding: "10px 28px", border: "none" }}
            onClick={handleSave}
          >
            {saved ? t("saved") : t("save")}
          </button>
        </div>
      </div>

      {/* System info card */}
      <div style={S.card}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 16 }}>
          معلومات النظام
        </div>
        <div style={S.grid(4)}>
          {[
            ["📋 الفواتير",       DB.get().invoices.length],
            ["🛒 أوامر الشراء",  DB.get().purchaseOrders.length],
            ["👥 العملاء",        DB.get().customers.length],
            ["🏢 الموردين",       DB.get().suppliers.length],
            ["📦 المنتجات",       DB.get().products.length],
            ["🏭 المستودعات",     DB.get().warehouses.length],
            ["📊 القيود",         DB.get().journalEntries.length],
            ["👤 المستخدمون",     DB.get().users.length],
          ].map(([label, val]) => (
            <div
              key={label as string}
              style={{ background: C.surfaceAlt, borderRadius: 8, padding: 16, textAlign: "center", border: `1px solid ${C.border}` }}
            >
              <div style={{ fontSize: 22, fontWeight: 800, color: C.accent }}>{val as number}</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{label as string}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Accounting Controls ────────────────────────── */}
      <div style={S.card}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 20 }}>
          ضوابط المحاسبة
        </div>

        {/* Invoice Approval Toggle */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: `1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>اعتماد الفواتير الآجلة</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
              عند التفعيل، تحتاج الفواتير الآجلة (credit) لموافقة مدير قبل تسجيلها محاسبياً
            </div>
          </div>
          <div
            onClick={() => setForm({ ...form, requireInvoiceApproval: !(form as any).requireInvoiceApproval })}
            style={{
              width: 48, height: 26, borderRadius: 13, cursor: "pointer",
              background: (form as any).requireInvoiceApproval ? C.success : C.border,
              position: "relative", transition: "background 0.2s", flexShrink: 0,
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: "50%", background: "#fff",
              position: "absolute", top: 3,
              right: (form as any).requireInvoiceApproval ? 3 : 25,
              transition: "right 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }} />
          </div>
        </div>

        {/* Locked Periods */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>
            قفل الفترات المحاسبية
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12 }}>
            الفترات المقفلة لا يمكن إضافة أو تعديل قيود أو فواتير فيها. الصيغة: YYYY-MM
          </div>
          <PeriodLockManager
            lockedPeriods={(form as any).lockedPeriods ?? []}
            onChange={(periods) => setForm({ ...form, lockedPeriods: periods } as any)}
          />
        </div>

        <button style={{ ...S.btn("primary"), padding: "10px 28px", border: "none", marginTop: 20 }} onClick={handleSave}>
          {saved ? "تم الحفظ ✓" : "حفظ ضوابط المحاسبة"}
        </button>
      </div>

      {/* Two-Factor Authentication */}
      <TwoFactorPanel token={SaaSDB.getSession()?.token} user={user} />

      {/* Active Sessions */}
      <ActiveSessionsPanel token={SaaSDB.getSession()?.token} currentRole={user?.role} />

      {/* Danger zone */}
      <div style={{ ...S.card, border: `1px solid ${C.danger}30` }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.danger, marginBottom: 12 }}>
          ⚠️ منطقة الخطر
        </div>
        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
          إعادة تعيين النظام ستحذف جميع البيانات بشكل نهائي ولا يمكن التراجع عنه.
        </div>
        <button
          style={{ ...S.btn("danger"), border: "none" }}
          onClick={() => {
            if (window.confirm("هل أنت متأكد؟ سيتم حذف جميع البيانات نهائياً.")) {
              DB.reset();
              window.location.reload();
            }
          }}
        >
          🗑 إعادة تعيين النظام
        </button>
      </div>
    </div>
  );
}

function PeriodLockManager({
  lockedPeriods,
  onChange,
}: {
  lockedPeriods: string[];
  onChange: (periods: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const addPeriod = () => {
    const p = input.trim();
    if (!/^\d{4}-\d{2}$/.test(p)) return;
    if (lockedPeriods.includes(p)) { setInput(""); return; }
    onChange([...lockedPeriods, p].sort());
    setInput("");
  };

  const removePeriod = (p: string) => onChange(lockedPeriods.filter((x) => x !== p));

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          style={{ ...S.input, width: 140, direction: "ltr", textAlign: "center" }}
          placeholder="2024-01"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addPeriod()}
        />
        <button
          style={{ ...S.btn("outline"), padding: "6px 16px", fontSize: 13 }}
          onClick={addPeriod}
        >
          + قفل
        </button>
      </div>
      {lockedPeriods.length === 0 ? (
        <div style={{ fontSize: 12, color: C.textMuted }}>لا توجد فترات مقفلة حالياً</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {lockedPeriods.map((p) => (
            <div key={p} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#FEF2F2", border: `1px solid ${C.danger}40`,
              borderRadius: 6, padding: "4px 10px", fontSize: 13,
            }}>
              <span style={{ color: C.danger, fontWeight: 700, direction: "ltr" }}>🔒 {p}</span>
              <button
                onClick={() => removePeriod(p)}
                style={{ background: "none", border: "none", cursor: "pointer", color: C.danger, fontSize: 14, lineHeight: 1, padding: 0 }}
              >×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface SessionRow {
  jti: string;
  user_id: string;
  email: string;
  company_id: string | null;
  issued_at: string;
  expires_at: string;
  user_agent: string | null;
  ip_address: string | null;
}

function ActiveSessionsPanel({ token, currentRole }: { token?: string; currentRole?: string }) {
  const [sessions, setSessions]   = useState<SessionRow[]>([]);
  const [loading, setLoading]     = useState(false);
  const [revoking, setRevoking]   = useState<string | null>(null);
  const [expanded, setExpanded]   = useState(false);

  const canManage = currentRole === "admin" || currentRole === "superadmin";

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/sessions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { sessions: data } = await res.json();
        setSessions(data ?? []);
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => { if (expanded) load(); }, [expanded]);

  async function revoke(jti: string) {
    if (!token || !window.confirm("هل تريد إنهاء هذه الجلسة؟")) return;
    setRevoking(jti);
    try {
      await fetch("/api/auth/sessions", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ jti }),
      });
      setSessions((s) => s.filter((x) => x.jti !== jti));
    } catch {}
    setRevoking(null);
  }

  function shortUA(ua: string | null) {
    if (!ua) return "غير معروف";
    if (ua.includes("Mobile")) return "📱 موبايل";
    if (ua.includes("Chrome"))  return "🌐 Chrome";
    if (ua.includes("Firefox")) return "🦊 Firefox";
    if (ua.includes("Safari"))  return "🧭 Safari";
    return "💻 متصفح";
  }

  return (
    <div style={{ ...S.card }}>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>
          🔐 الجلسات النشطة {sessions.length > 0 && `(${sessions.length})`}
        </div>
        <span style={{ color: C.textMuted, fontSize: 13 }}>{expanded ? "▲ إخفاء" : "▼ عرض"}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: 16 }}>
          {loading ? (
            <div style={{ color: C.textMuted, fontSize: 13 }}>جارٍ التحميل...</div>
          ) : sessions.length === 0 ? (
            <div style={{ color: C.textMuted, fontSize: 13 }}>لا توجد جلسات نشطة مسجلة</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sessions.map((s) => (
                <div key={s.jti} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 14px", borderRadius: 8,
                  background: "#F8F8F6", border: `1px solid ${C.border}`,
                  fontSize: 13,
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <div style={{ fontWeight: 600 }}>{s.email}</div>
                    <div style={{ color: C.textMuted, fontSize: 12, display: "flex", gap: 12 }}>
                      <span>{shortUA(s.user_agent)}</span>
                      {s.ip_address && <span>IP: {s.ip_address}</span>}
                      <span>منذ: {new Date(s.issued_at).toLocaleString("ar-SA")}</span>
                    </div>
                  </div>
                  {canManage && (
                    <button
                      style={{ ...S.btn("danger"), padding: "4px 12px", fontSize: 12, border: "none", opacity: revoking === s.jti ? 0.5 : 1 }}
                      disabled={revoking === s.jti}
                      onClick={() => revoke(s.jti)}
                    >
                      إنهاء
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <button
            style={{ ...S.btn("outline"), marginTop: 12, fontSize: 12, padding: "5px 14px" }}
            onClick={load}
          >
            ↻ تحديث
          </button>
        </div>
      )}
    </div>
  );
}

// ── Two-Factor Authentication Setup ───────────────────────────────────────
type TwoFactorStep = "idle" | "setup" | "disable";

function TwoFactorPanel({ token, user }: { token?: string; user: any }) {
  const [step, setStep]         = useState<TwoFactorStep>("idle");
  const [secret, setSecret]     = useState("");
  const [qrUrl, setQrUrl]       = useState("");
  const [code, setCode]         = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [enabled, setEnabled]   = useState(!!(user as any)?.twoFactorEnabled);

  async function startSetup() {
    if (!token) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/2fa", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { setError("فشل التحميل"); setLoading(false); return; }
      const data = await res.json();
      setSecret(data.secret); setQrUrl(data.qrDataUrl); setStep("setup");
    } catch { setError("خطأ في الاتصال"); }
    setLoading(false);
  }

  async function confirmEnable() {
    if (!token || code.length < 6) { setError("أدخل الرمز المكون من 6 أرقام"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/2fa", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ secret, token: code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "رمز غير صحيح"); setLoading(false); return; }
      setSuccess("✓ تم تفعيل المصادقة الثنائية بنجاح");
      setEnabled(true); setStep("idle"); setCode(""); setSecret(""); setQrUrl("");
    } catch { setError("خطأ في الاتصال"); }
    setLoading(false);
  }

  async function confirmDisable() {
    if (!token || !code || !password) { setError("أدخل الرمز وكلمة المرور"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/2fa", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ token: code, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "فشل الإلغاء"); setLoading(false); return; }
      setSuccess("تم إلغاء تفعيل المصادقة الثنائية");
      setEnabled(false); setStep("idle"); setCode(""); setPassword("");
    } catch { setError("خطأ في الاتصال"); }
    setLoading(false);
  }

  return (
    <div style={{ ...S.card }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: step !== "idle" ? 16 : 0 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>
            🔐 المصادقة الثنائية (2FA)
            {enabled && <span style={{ marginRight: 8, fontSize: 11, color: C.success, fontWeight: 700 }}>● مفعّلة</span>}
          </div>
          {step === "idle" && (
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
              {enabled ? "حسابك محمي بطبقة أمان إضافية" : "أضف طبقة حماية إضافية بتطبيق المصادقة (Google Authenticator, Authy)"}
            </div>
          )}
        </div>
        {step === "idle" && (
          <button
            style={{ ...S.btn(enabled ? "danger" : "primary"), border: "none", padding: "7px 18px", fontSize: 13 }}
            onClick={() => { setError(""); setSuccess(""); if (enabled) setStep("disable"); else startSetup(); }}
            disabled={loading}
          >
            {loading ? "..." : enabled ? "إلغاء التفعيل" : "تفعيل 2FA"}
          </button>
        )}
      </div>

      {success && <div style={{ color: C.success, fontSize: 13, marginBottom: 10, fontWeight: 700 }}>{success}</div>}
      {error   && <div style={{ color: C.danger,  fontSize: 13, marginBottom: 10 }}>{error}</div>}

      {step === "setup" && qrUrl && (
        <div>
          <div style={{ fontSize: 13, color: C.textSec, marginBottom: 12 }}>
            افتح تطبيق المصادقة وامسح رمز QR، ثم أدخل الرمز الناتج للتأكيد:
          </div>
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start", marginBottom: 16 }}>
            <img src={qrUrl} alt="2FA QR" style={{ width: 160, height: 160, border: `1px solid ${C.border}`, borderRadius: 8 }} />
            <div>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>أو أدخل المفتاح يدوياً:</div>
              <div style={{ fontFamily: "monospace", fontSize: 12, background: C.surfaceAlt, padding: "6px 12px", borderRadius: 6, letterSpacing: 2, direction: "ltr", wordBreak: "break-all" }}>
                {secret}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              style={{ ...S.input, width: 150, textAlign: "center", fontSize: 20, letterSpacing: 6, direction: "ltr" }}
              type="text" inputMode="numeric" maxLength={6}
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000" autoFocus
            />
            <button style={{ ...S.btn("primary"), border: "none", padding: "8px 20px" }} onClick={confirmEnable} disabled={loading || code.length < 6}>
              {loading ? "..." : "تأكيد التفعيل"}
            </button>
            <button style={{ ...S.btn("outline") }} onClick={() => { setStep("idle"); setCode(""); setSecret(""); setQrUrl(""); }}>إلغاء</button>
          </div>
        </div>
      )}

      {step === "disable" && (
        <div>
          <div style={{ fontSize: 13, color: C.textSec, marginBottom: 12 }}>
            أدخل رمز التحقق الحالي من التطبيق وكلمة مرورك لإلغاء التفعيل:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 320 }}>
            <input
              style={{ ...S.input, textAlign: "center", fontSize: 20, letterSpacing: 6, direction: "ltr" }}
              type="text" inputMode="numeric" maxLength={6}
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="رمز التحقق" autoFocus
            />
            <input style={S.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="كلمة المرور الحالية" />
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ ...S.btn("danger"), border: "none", padding: "8px 20px" }} onClick={confirmDisable} disabled={loading || !code || !password}>
                {loading ? "..." : "إلغاء التفعيل"}
              </button>
              <button style={{ ...S.btn("outline") }} onClick={() => { setStep("idle"); setCode(""); setPassword(""); }}>رجوع</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
