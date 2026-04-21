"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { SaaSDB } from "./saasDB";
import { TenantDB } from "./tenantDB";
import { canAccess, shouldShowRenewalWarning, getDaysLeft } from "./accessGuard";
import { Company, SuperAdmin } from "./types";
import { LangContext, createTranslator } from "@/hooks/useLang";
import { AuthContext } from "@/hooks/useAuth";
import { hasPermission } from "@/lib/engine/permissions";
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
import { CompanyRegister }   from "./screens/CompanyRegister";
import { SubscriptionWall }  from "./screens/SubscriptionWall";
import { ERPApp }            from "./ERPApp";

// Refresh access token 3 minutes before its 15-minute expiry
const REFRESH_INTERVAL_MS = 12 * 60 * 1000;

type RootScreen =
  | "loading"
  | "saas_setup"
  | "super_login"
  | "super_panel"
  | "company_login"
  | "company_register"
  | "subscription_wall"
  | "erp"

export function SaaSShell() {
  const [screen, setScreen]         = useState<RootScreen>("loading");
  const [lang, setLang]             = useState<Lang>("ar");
  const [superAdmin, setSuperAdmin] = useState<SuperAdmin | null>(null);
  const [company, setCompany]       = useState<Company | null>(null);
  const [tenantUser, setTenantUser] = useState<User | null>(null);
  // Access token lives in memory — never in localStorage
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toasts, addToast } = useToast();

  const t   = useCallback(createTranslator(lang), [lang]);
  const dir = lang === "ar" ? "rtl" : "ltr";

  // ── Token refresh logic ────────────────────────────────────────────────
  async function tryRefreshToken(): Promise<string | null> {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST" });
      if (!res.ok) return null;
      const data = await res.json();
      const newToken: string = data.token;
      setAccessToken(newToken);
      // Keep session token in SaaSDB in sync (used by saasDB background sync)
      const session = SaaSDB.getSession();
      if (session) {
        SaaSDB.setSession({ ...session, token: newToken });
        if (session.type === "superadmin") SaaSDB.setAdminToken(newToken);
        if (session.type === "company")    TenantDB.setToken(newToken);
      }
      return newToken;
    } catch {
      return null;
    }
  }

  function startRefreshTimer() {
    stopRefreshTimer();
    refreshTimerRef.current = setInterval(tryRefreshToken, REFRESH_INTERVAL_MS);
  }

  function stopRefreshTimer() {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }

  async function callLogoutApi(token: string | null) {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch { /* best-effort */ }
  }

  // ── Boot ───────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/setup")
      .then(r => r.json())
      .then(async ({ bootstrapped }) => {
        if (!bootstrapped) {
          SaaSDB.resetSuperAdmin();
          SaaSDB.clearSession();
          setScreen("saas_setup");
          return;
        }
        // Try to get a fresh access token via refresh cookie (works across page reloads)
        const freshToken = await tryRefreshToken();

        // Sync saas-data if we have a superadmin token
        const session = SaaSDB.getSession();
        const token = freshToken ?? session?.token;
        if (token && session?.type === "superadmin") {
          try {
            const res = await fetch("/api/saas-data", { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) {
              const { companies, globalCounters } = await res.json();
              const db = SaaSDB.get();
              db.companies = companies;
              db.globalCounters = globalCounters;
              SaaSDB.save();
            }
          } catch {}
        }

        if (freshToken) setAccessToken(freshToken);
        boot(freshToken ?? undefined);
      })
      .catch(() => boot());

    return () => stopRefreshTimer();
  }, []);

  function boot(token?: string) {
    const session = SaaSDB.getSession();
    if (session?.type === "superadmin") {
      const admin = SaaSDB.get().superAdmins.find(a => a.id === session.id);
      if (admin) {
        if (token) { SaaSDB.setAdminToken(token); }
        setSuperAdmin(admin);
        startRefreshTimer();
        setScreen("super_panel");
        return;
      }
    }
    if (session?.type === "company") {
      const co = SaaSDB.getCompany(session.id);
      if (co) {
        const access = canAccess(co.id);
        if (!access.allowed) { setCompany(co); setScreen("subscription_wall"); return; }

        const activeToken = token ?? session.token;
        if (activeToken) TenantDB.setToken(activeToken);
        TenantDB.load(co.id);
        const tenantState = TenantDB.get();
        (DB as any)._syncFromTenant(tenantState, co.id);
        setLang((tenantState.settings.lang as Lang) || "ar");
        const restoredUser = session.userId
          ? tenantState.users.find(u => u.id === session.userId) ?? null
          : null;
        if (activeToken) setAccessToken(activeToken);
        setCompany(co);
        setTenantUser(restoredUser);
        startRefreshTimer();
        setScreen("erp");
        return;
      }
    }
    setScreen("company_login");
  }

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleSuperAdminCreated = (admin: SuperAdmin) => {
    SaaSDB.setSession({ type: "superadmin", id: admin.id, name: admin.name, email: admin.email });
    setSuperAdmin(admin);
    setScreen("super_panel");
  };

  const handleSuperLogin = (admin: SuperAdmin, token?: string) => {
    SaaSDB.setSession({ type: "superadmin", id: admin.id, name: admin.name, email: admin.email, token });
    if (token) { SaaSDB.setAdminToken(token); setAccessToken(token); }
    setSuperAdmin(admin);
    startRefreshTimer();
    setScreen("super_panel");
  };

  const handleSuperLogout = async () => {
    stopRefreshTimer();
    await callLogoutApi(accessToken);
    SaaSDB.clearSession();
    setAccessToken(null);
    setSuperAdmin(null);
    setScreen("super_login");
  };

  const handleCompanyLogin = async (co: Company, user: User, token?: string) => {
    const access = canAccess(co.id);
    if (!access.allowed) {
      setCompany(co);
      setScreen("subscription_wall");
      return;
    }

    if (token) TenantDB.setToken(token);

    let tenantState = TenantDB.load(co.id);
    const isEmpty = tenantState.users.length === 0 && tenantState.invoices.length === 0;
    if (isEmpty && token) {
      const serverState = await TenantDB.loadFromServer(co.id);
      if (serverState) tenantState = serverState;
    }

    (DB as any)._syncFromTenant(tenantState, co.id);
    setLang((tenantState.settings.lang as Lang) || "ar");
    SaaSDB.setSession({ type: "company", id: co.id, name: co.name, email: co.email, userId: user.id, token });
    SaaSDB.updateUsageStats(co.id, {
      totalUsers:      tenantState.users.length,
      totalProducts:   tenantState.products.length,
      totalWarehouses: tenantState.warehouses.length,
      totalInvoices:   tenantState.invoices.length,
    });
    if (token) setAccessToken(token);
    const resolvedUser = tenantState.users.find(u => u.id === user.id) ?? user;
    setCompany(co);
    setTenantUser(resolvedUser);
    if (shouldShowRenewalWarning(co.id)) {
      addToast(`⚠️ اشتراكك ينتهي خلال ${getDaysLeft(co.id)} أيام`, "info");
    }
    startRefreshTimer();
    setScreen("erp");
  };

  const handleCompanyLogout = async () => {
    stopRefreshTimer();
    await callLogoutApi(accessToken);
    TenantDB.unload();
    SaaSDB.clearSession();
    setAccessToken(null);
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

  // ── Render ─────────────────────────────────────────────────────────────
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
          onRegister={() => setScreen("company_register")}
        />
      )}

      {screen === "company_register" && (
        <CompanyRegister
          onRegistered={handleCompanyLogin}
          onBack={() => setScreen("company_login")}
        />
      )}

      {screen === "subscription_wall" && company && (
        <SubscriptionWall
          company={company}
          onLogout={handleCompanyLogout}
        />
      )}

      {screen === "erp" && company && (
        <AuthContext.Provider value={{ user: tenantUser, logout: handleCompanyLogout, can: (p) => hasPermission(tenantUser, p) }}>
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
