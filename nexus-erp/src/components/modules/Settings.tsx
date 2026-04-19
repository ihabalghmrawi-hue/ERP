"use client";

import { useState } from "react";
import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { DB } from "@/lib/db/database";
import { Lang } from "@/lib/i18n/translations";

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

          {([
            ["companyName",     t("companyName"),     "text"],
            ["taxNumber",       t("taxNumber"),        "text"],
            ["address",         t("address"),          "text"],
            ["baseCurrency",    t("baseCurrency"),     "text"],
            ["fiscalYearStart", t("fiscalYearStart"),  "text"],
          ] as [string, string, string][]).map(([k, lbl, type]) => (
            <div key={k} style={S.formGroup}>
              <label style={S.label}>{lbl}</label>
              <input
                style={S.input}
                type={type}
                value={(form as any)[k] || ""}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                placeholder={lbl}
              />
            </div>
          ))}

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
