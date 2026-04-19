"use client";

import { useState, useCallback } from "react";
import { Company } from "./types";
import { TenantDB } from "./tenantDB";
import { SaaSDB } from "./saasDB";
import { getDaysLeft, shouldShowRenewalWarning } from "./accessGuard";
import { Lang } from "@/lib/i18n/translations";
import { createTranslator, LangContext } from "@/hooks/useLang";
import { S, C } from "@/lib/engine/design";

import { Sidebar }    from "@/components/layout/Sidebar";
import { Topbar }     from "@/components/layout/Topbar";
import { Dashboard }  from "@/components/modules/Dashboard";
import { Sales }      from "@/components/modules/Sales";
import { Purchases }  from "@/components/modules/Purchases";
import { Inventory }  from "@/components/modules/Inventory";
import { Treasury }   from "@/components/modules/Treasury";
import { Customers }  from "@/components/modules/Customers";
import { Suppliers }  from "@/components/modules/Suppliers";
import { Accounting } from "@/components/modules/Accounting";
import { Reports }    from "@/components/modules/Reports";
import { Users }      from "@/components/modules/Users";
import { Settings }   from "@/components/modules/Settings";

type PageId =
  | "dashboard" | "sales" | "purchases" | "inventory" | "treasury"
  | "customers" | "suppliers" | "accounting" | "reports" | "users" | "settings";

interface Props {
  company: Company;
  lang: Lang;
  setLang: (l: Lang) => void;
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export function ERPApp({ company, lang, setLang, addToast }: Props) {
  const [page, setPage] = useState<PageId>("dashboard");
  const t   = useCallback(createTranslator(lang), [lang]);
  const dir = lang === "ar" ? "rtl" : "ltr";

  const daysLeft = getDaysLeft(company.id);
  const showWarning = shouldShowRenewalWarning(company.id);

  const NAV_LABELS: Record<PageId, string> = {
    dashboard: t("dashboard"), sales: t("sales"), purchases: t("purchases"),
    inventory: t("inventory"), treasury: t("treasury"), customers: t("customers"),
    suppliers: t("suppliers"), accounting: t("accounting"), reports: t("reports"),
    users: t("users"), settings: t("settings"),
  };

  const PAGES: Record<PageId, React.ReactNode> = {
    dashboard:  <Dashboard  addToast={addToast} />,
    sales:      <Sales      addToast={addToast} />,
    purchases:  <Purchases  addToast={addToast} />,
    inventory:  <Inventory  addToast={addToast} />,
    treasury:   <Treasury   addToast={addToast} />,
    customers:  <Customers  addToast={addToast} />,
    suppliers:  <Suppliers  addToast={addToast} />,
    accounting: <Accounting addToast={addToast} />,
    reports:    <Reports />,
    users:      <Users      addToast={addToast} />,
    settings:   <Settings   lang={lang} setLang={setLang} />,
  };

  return (
    <LangContext.Provider value={{ lang, t, dir }}>
      <div style={{ ...S.app, direction: dir, flexDirection: "column" }}>
        {/* ── Subscription Warning Banner ── */}
        {showWarning && (
          <div style={{
            background: daysLeft <= 3 ? C.dangerLight : C.warningLight,
            borderBottom: `1px solid ${daysLeft <= 3 ? C.danger : C.warning}`,
            padding: "8px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 13,
            color: daysLeft <= 3 ? C.danger : C.warning,
            fontWeight: 600,
          }}>
            <span>
              {daysLeft <= 0
                ? "⛔ انتهى اشتراكك — يرجى التجديد فوراً"
                : `⚠️ اشتراكك ينتهي خلال ${daysLeft} ${daysLeft === 1 ? "يوم" : "أيام"} — جدّد الآن لتجنب انقطاع الخدمة`}
            </span>
            <a
              href="mailto:support@nexuserp.com"
              style={{ color: "inherit", textDecoration: "underline", fontSize: 12 }}
            >
              تواصل معنا للتجديد
            </a>
          </div>
        )}

        {/* ── Main Layout ── */}
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar page={page} onNavigate={setPage} />
          <div style={S.main}>
            <Topbar pageLabel={NAV_LABELS[page]} companyName={company.name} />
            <div style={S.content}>
              {PAGES[page]}
            </div>
          </div>
        </div>
      </div>
    </LangContext.Provider>
  );
}
