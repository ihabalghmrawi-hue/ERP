"use client";

import { useState, useCallback, useEffect } from "react";
import { SaaSDB } from "./saasDB";
import { TenantDB } from "./tenantDB";
import { canAccess, shouldShowRenewalWarning, getDaysLeft } from "./accessGuard";
import { Company, SuperAdmin } from "./types";
import { LangContext, createTranslator } from "@/hooks/useLang";
import { AuthContext } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { DB } from "@/lib/db/database";
import { Lang } from "@/lib/i18n/translations";
import { User } from "@/lib/db/database";
import { C } from "@/lib/engine/design";
import { Toast } from "@/components/ui/Toast";

import { SuperAdminLogin }   from "./screens/SuperAdminLogin";
import { SuperAdminSetup }   from "./screens/SuperAdminSetup";
import { SuperAdminPanel }   from "./screens/SuperAdminPanel";
import { CompanyLogin }      from "./screens/CompanyLogin";
import { SubscriptionWall }  from "./screens/SubscriptionWall";
import { ERPApp }            from "./ERPApp";

type RootScreen =
  | "loading"
  | "saas_setup"          // first time: create super admin
  | "super_login"         // super admin login
  | "super_panel"         // super admin dashboard
  | "company_login"       // tenant login
  | "subscription_wall"   // expired / suspended
  | "erp"                 // main ERP app

export function SaaSShell() {
  const [screen, setScreen]         = useState<RootScreen>("loading");
  const [lang, setLang]             = useState<Lang>("ar");
  const [superAdmin, setSuperAdmin] = useState<SuperAdmin | null>(null);
  const [company, setCompany]       = useState<Company | null>(null);
  const [tenantUser, setTenantUser] = useState<User | null>(null);
  const { toasts, addToast }        = useToast();

  const t   = useCallback(createTranslator(lang), [lang]);
  const dir = lang === "ar" ? "rtl" : "ltr";

  // ── Boot: decide which screen to show ──────────────────
  useEffect(() => {
    fetch("/api/setup")
      .then(r => r.json())
      .then(({ bootstrapped }) => {
        if (!bootstrapped) {
          SaaSDB.resetSuperAdmin();
          SaaSDB.clearSession();
          setScreen("saas_setup");
          return;
        }
        boot();
      })
      .catch(() => boot());
  }, []);

  function boot() {
    const session = SaaSDB.getSession();
    if (session?.type === "superadmin") {
      const admin = SaaSDB.get().superAdmins.find(a => a.id === session.id);
      if (admin) { setSuperAdmin(admin); setScreen("super_panel"); return; }
    }
    if (session?.type === "company") {
      const co = SaaSDB.getCompany(session.id);
      if (co) {
        const access = canAccess(co.id);
        if (!access.allowed) { setCompany(co); setScreen("subscription_wall"); return; }
        // Load tenant DB into memory
        TenantDB.load(co.id);
        // Sync the legacy DB singleton so existing modules work unchanged
        const tenantState = TenantDB.get();
        (DB as any)._syncFromTenant(tenantState, co.id);
        setLang((tenantState.settings.lang as Lang) || "ar");
        setCompany(co);
        setScreen("erp");
        return;
      }
    }

    setScreen("company_login");
  }

  // ── Handlers ───────────────────────────────────────────
  const handleSuperAdminCreated = (admin: SuperAdmin) => {
    SaaSDB.setSession({ type: "superadmin", id: admin.id, name: admin.name, email: admin.email });
    setSuperAdmin(admin);
    setScreen("super_panel");
  };

  const handleSuperLogin = (admin: SuperAdmin) => {
    SaaSDB.setSession({ type: "superadmin", id: admin.id, name: admin.name, email: admin.email });
    setSuperAdmin(admin);
    setScreen("super_panel");
  };

  const handleSuperLogout = () => {
    SaaSDB.clearSession();
    setSuperAdmin(null);
    setScreen("super_login");
  };

  const handleCompanyLogin = (co: Company, user: User) => {
    const access = canAccess(co.id);
    if (!access.allowed) {
      setCompany(co);
      setScreen("subscription_wall");
      return;
    }
    TenantDB.load(co.id);
    const tenantState = TenantDB.get();
    (DB as any)._syncFromTenant(tenantState, co.id);
    setLang((tenantState.settings.lang as Lang) || "ar");
    SaaSDB.setSession({ type: "company", id: co.id, name: co.name, email: co.email });
    SaaSDB.updateUsageStats(co.id, {
      totalUsers: tenantState.users.length,
      totalProducts: tenantState.products.length,
      totalWarehouses: tenantState.warehouses.length,
      totalInvoices: tenantState.invoices.length,
    });
    setCompany(co);
    setTenantUser(user);
    if (shouldShowRenewalWarning(co.id)) {
      addToast(`⚠️ اشتراكك ينتهي خلال ${getDaysLeft(co.id)} أيام`, "info");
    }
    setScreen("erp");
  };

  const handleCompanyLogout = () => {
    TenantDB.unload();
    SaaSDB.clearSession();
    setCompany(null);
    setTenantUser(null);
    setScreen("company_login");
  };

  const handleSetLang = (newLang: Lang) => {
    setLang(newLang);
    if (company) {
      const db = TenantDB.get();
      db.settings.lang = newLang;
      TenantDB.save();
    }
  };

  // ── Render ──────────────────────────────────────────────
  return (
    <LangContext.Provider value={{ lang, t, dir }}>
      <style>{`html, body { direction: ${dir}; }`}</style>

      {screen === "loading" && <LoadingScreen />}

      {screen === "saas_setup" && (
        <SuperAdminSetup onCreated={handleSuperAdminCreated} />
      )}

      {screen === "super_login" && (
        <SuperAdminLogin
          onLogin={handleSuperLogin}
          onGoToCompanyLogin={() => setScreen("company_login")}
        />
      )}

      {screen === "super_panel" && superAdmin && (
        <SuperAdminPanel
          admin={superAdmin}
          onLogout={handleSuperLogout}
          addToast={addToast}
        />
      )}

      {screen === "company_login" && (
        <CompanyLogin
          onLogin={handleCompanyLogin}
          onSuperAdmin={() => setScreen("super_login")}
        />
      )}

      {screen === "subscription_wall" && company && (
        <SubscriptionWall
          company={company}
          onLogout={handleCompanyLogout}
        />
      )}

      {screen === "erp" && company && (
        <AuthContext.Provider value={{ user: tenantUser, logout: handleCompanyLogout }}>
          <ERPApp
            company={company}
            lang={lang}
            setLang={handleSetLang}
            addToast={addToast}
          />
        </AuthContext.Provider>
      )}

      <Toast toasts={toasts} />
    </LangContext.Provider>
  );
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F6F3" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <div style={{ fontSize: 16, color: C.textMuted, fontFamily: "'Tajawal', sans-serif" }}>جارٍ التحميل...</div>
      </div>
    </div>
  );
}
