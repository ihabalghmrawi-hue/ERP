"use client";

import { useState, useCallback, useEffect } from "react";
import { Company } from "./types";
import { TenantDB } from "./tenantDB";
import { SaaSDB } from "./saasDB";
import { getDaysLeft, shouldShowRenewalWarning } from "./accessGuard";
import { Lang } from "@/lib/i18n/translations";
import { createTranslator, LangContext } from "@/hooks/useLang";
import { useAuth } from "@/hooks/useAuth";
import { S, C } from "@/lib/engine/design";
import { PAGE_PERMISSION } from "@/lib/engine/permissions";

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
import { POS }        from "@/components/modules/POS";
import { AuditLog }  from "@/components/modules/AuditLog";

type PageId =
  | "dashboard" | "sales" | "purchases" | "inventory" | "treasury"
  | "customers" | "suppliers" | "accounting" | "reports" | "users" | "settings"
  | "pos";

interface Props {
  company: Company;
  lang: Lang;
  setLang: (l: Lang) => void;
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
}

function AccessDenied() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 400, gap: 12 }}>
      <div style={{ fontSize: 56 }}>🔒</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: C.danger }}>غير مصرح بالوصول</div>
      <div style={{ fontSize: 13, color: C.textMuted }}>ليس لديك صلاحية للوصول إلى هذه الصفحة</div>
    </div>
  );
}

export function ERPApp({ company, lang, setLang, addToast }: Props) {
  const { user, can } = useAuth();

  // Determine the default landing page based on role
  const getDefaultPage = (): PageId => {
    if (user?.role === "cashier") return "pos";
    return "dashboard";
  };

  const [page, setPage] = useState<PageId>(getDefaultPage);
  const t   = useCallback(createTranslator(lang), [lang]);
  const dir = lang === "ar" ? "rtl" : "ltr";

  const daysLeft   = getDaysLeft(company.id);
  const showWarning = shouldShowRenewalWarning(company.id);

  // If current page becomes inaccessible (e.g., permissions changed), redirect
  useEffect(() => {
    const required = PAGE_PERMISSION[page];
    if (required && !can(required)) {
      setPage(getDefaultPage());
    }
  }, [page, can]);

  const handleNavigate = (p: PageId) => {
    const required = PAGE_PERMISSION[p];
    if (required && !can(required)) {
      addToast("ليس لديك صلاحية للوصول إلى هذه الصفحة", "error");
      return;
    }
    setPage(p);
  };

  const NAV_LABELS: Record<PageId, string> = {
    dashboard: t("dashboard"), sales: t("sales"), purchases: t("purchases"),
    inventory: t("inventory"), treasury: t("treasury"), customers: t("customers"),
    suppliers: t("suppliers"), accounting: t("accounting"), reports: t("reports"),
    users: t("users"), settings: t("settings"), pos: "نقطة البيع",
  };

  const renderPage = () => {
    const required = PAGE_PERMISSION[page];
    if (required && !can(required)) return <AccessDenied />;

    switch (page) {
      case "dashboard":  return <Dashboard  addToast={addToast} />;
      case "sales":      return <Sales      addToast={addToast} />;
      case "purchases":  return <Purchases  addToast={addToast} />;
      case "inventory":  return <Inventory  addToast={addToast} />;
      case "treasury":   return <Treasury   addToast={addToast} />;
      case "customers":  return <Customers  addToast={addToast} />;
      case "suppliers":  return <Suppliers  addToast={addToast} />;
      case "accounting": return <Accounting addToast={addToast} />;
      case "reports":    return <Reports />;
      case "users":      return <Users      addToast={addToast} />;
      case "settings":   return <Settings   lang={lang} setLang={setLang} />;
      case "pos":        return <POS        addToast={addToast} />;
    }
  };

  return (
    <LangContext.Provider value={{ lang, t, dir }}>
      <div style={{ ...S.app, direction: dir, flexDirection: "column" }}>
        {/* ── Subscription Warning Banner ── */}
        {showWarning && (
          <div style={{
            background: daysLeft <= 3 ? C.dangerLight : C.warningLight,
            borderBottom: `1px solid ${daysLeft <= 3 ? C.danger : C.warning}`,
            padding: "8px 24px", display: "flex", alignItems: "center",
            justifyContent: "space-between", fontSize: 13,
            color: daysLeft <= 3 ? C.danger : C.warning, fontWeight: 600,
          }}>
            <span>
              {daysLeft <= 0
                ? "⛔ انتهى اشتراكك — يرجى التجديد فوراً"
                : `⚠️ اشتراكك ينتهي خلال ${daysLeft} ${daysLeft === 1 ? "يوم" : "أيام"} — جدّد الآن لتجنب انقطاع الخدمة`}
            </span>
            <a href="mailto:support@nexuserp.com" style={{ color: "inherit", textDecoration: "underline", fontSize: 12 }}>
              تواصل معنا للتجديد
            </a>
          </div>
        )}

        {/* ── Main Layout ── */}
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar page={page} onNavigate={handleNavigate} />
          <div style={S.main}>
            <Topbar pageLabel={NAV_LABELS[page]} companyName={company.name} />
            <div style={S.content}>
              {renderPage()}
            </div>
          </div>
        </div>
      </div>
    </LangContext.Provider>
  );
}
