"use client";

import { useState, useCallback } from "react";
import { LangContext, createTranslator } from "@/hooks/useLang";
import { AuthContext } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { DB, User } from "@/lib/db/database";
import { Lang } from "@/lib/i18n/translations";
import { S } from "@/lib/engine/design";
import { hasPermission } from "@/lib/engine/permissions";

import { AuthScreen } from "./AuthScreen";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { Toast } from "@/components/ui/Toast";

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
  | "customers" | "suppliers" | "accounting" | "reports" | "users" | "settings" | "pos" | "audit_log";

export function ERPShell() {
  const [lang, setLang]       = useState<Lang>(() => (DB.get().settings.lang as Lang) || "ar");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [page, setPage]        = useState<PageId>("dashboard");
  const { toasts, addToast }   = useToast();

  const t   = useCallback(createTranslator(lang), [lang]);
  const dir = lang === "ar" ? "rtl" : "ltr";

  const handleLogin  = (user: User) => { setAuthUser(user); setPage("dashboard"); };
  const handleLogout = () => setAuthUser(null);
  const handleNavigate = (p: PageId) => setPage(p);

  const handleSetLang = (newLang: Lang) => {
    setLang(newLang);
    const db = DB.get();
    db.settings.lang = newLang;
    DB.save();
  };

  /* ── Label for topbar breadcrumb ─ */
  const NAV_LABELS: Record<PageId, string> = {
    dashboard: t("dashboard"), sales: t("sales"), purchases: t("purchases"),
    inventory: t("inventory"), treasury: t("treasury"), customers: t("customers"),
    suppliers: t("suppliers"), accounting: t("accounting"), reports: t("reports"),
    users: t("users"), settings: t("settings"), pos: "POS",
  };

  /* ── Page content map ─────────────── */
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
    settings:   <Settings   lang={lang} setLang={handleSetLang} />,
    pos:        <POS        addToast={addToast} />,
  };

  return (
    <LangContext.Provider value={{ lang, t, dir }}>
      <AuthContext.Provider value={{ user: authUser, logout: handleLogout, can: (p) => hasPermission(authUser, p) }}>
        {/* ── Global styles ─────────────────────── */}
        <style>{`
          html, body { direction: ${dir}; }
        `}</style>

        {!authUser ? (
          <AuthScreen onAuth={handleLogin} />
        ) : (
          <div style={{ ...S.app, direction: dir }}>
            <Sidebar page={page} onNavigate={handleNavigate} />
            <div style={S.main}>
              <Topbar pageLabel={NAV_LABELS[page]} />
              <div style={S.content}>
                {PAGES[page]}
              </div>
            </div>
          </div>
        )}

        <Toast toasts={toasts} />
      </AuthContext.Provider>
    </LangContext.Provider>
  );
}
