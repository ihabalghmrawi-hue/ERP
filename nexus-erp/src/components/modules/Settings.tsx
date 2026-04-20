"use client";

import { useState } from "react";
import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { DB } from "@/lib/db/database";
import { Lang } from "@/lib/i18n/translations";

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
  const db = DB.get();
  const [form, setForm] = useState({ ...db.settings });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    Object.assign(db.settings, form);
    if (form.lang !== lang) setLang(form.lang as Lang);
    DB.save();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
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
