"use client";

import { useState, useCallback, useEffect } from "react";
import { LangContext, createTranslator } from "@/hooks/useLang";
import { AuthContext } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { DB, User } from "@/lib/db/database";
import { Lang } from "@/lib/i18n/translations";
import { S, GLOBAL_CSS } from "@/lib/engine/design";
import { hasPermission } from "@/lib/engine/permissions";

import { AuthScreen }   from "./AuthScreen";
import { Sidebar, NAV_ICONS } from "./Sidebar";
import { Topbar }             from "./Topbar";
import { Toast }              from "@/components/ui/Toast";
import { CommandPalette, PaletteCommand } from "@/components/ui/CommandPalette";

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
import { AuditLog }       from "@/components/modules/AuditLog";
import { Reconciliation } from "@/components/modules/Reconciliation";

type PageId =
  | "dashboard" | "sales" | "purchases" | "inventory" | "treasury"
  | "customers" | "suppliers" | "accounting" | "reports" | "users" | "settings" | "pos" | "audit_log"
  | "reconciliation";

export function ERPShell() {
  const [lang, setLang]         = useState<Lang>(() => (DB.get().settings.lang as Lang) || "ar");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [page, setPage]         = useState<PageId>("dashboard");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { toasts, addToast }    = useToast();

  const t   = useCallback(createTranslator(lang), [lang]);
  const dir = lang === "ar" ? "rtl" : "ltr";

  // ⌘K / Ctrl+K global handler
  useEffect(() => {
    if (!authUser) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(p => !p);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [authUser]);

  const handleLogin    = (user: User) => { setAuthUser(user); setPage("dashboard"); };
  const handleLogout   = () => setAuthUser(null);
  const handleNavigate = (p: PageId) => { setPage(p); setPaletteOpen(false); };

  const handleSetLang = (newLang: Lang) => {
    setLang(newLang);
    const db = DB.get();
    db.settings.lang = newLang;
    DB.save();
  };

  const NAV_LABELS: Record<PageId, string> = {
    dashboard: t("dashboard"), sales: t("sales"), purchases: t("purchases"),
    inventory: t("inventory"), treasury: t("treasury"), customers: t("customers"),
    suppliers: t("suppliers"), accounting: t("accounting"), reports: t("reports"),
    users: t("users"), settings: t("settings"), pos: "POS",
    audit_log: "سجل التدقيق", reconciliation: "تسوية البنك",
  };

  /* ── Command palette items ─────────────────── */
  const ALL_COMMANDS: (PaletteCommand & { perm: string; section: string })[] = [
    { id: "dashboard",     label: t("dashboard"),    sublabel: t("overview"),    perm: "view_dashboard",  section: t("overview"),    icon: NAV_ICONS.dashboard },
    { id: "pos",           label: "نقطة البيع",      sublabel: t("overview"),    perm: "access_pos",      section: t("overview"),    icon: NAV_ICONS.pos },
    { id: "sales",         label: t("sales"),         sublabel: t("operations"),  perm: "view_sales",      section: t("operations"),  icon: NAV_ICONS.sales },
    { id: "purchases",     label: t("purchases"),     sublabel: t("operations"),  perm: "view_purchases",  section: t("operations"),  icon: NAV_ICONS.purchases },
    { id: "inventory",     label: t("inventory"),     sublabel: t("operations"),  perm: "view_inventory",  section: t("operations"),  icon: NAV_ICONS.inventory },
    { id: "treasury",      label: t("treasury"),      sublabel: t("operations"),  perm: "view_treasury",   section: t("operations"),  icon: NAV_ICONS.treasury },
    { id: "customers",     label: t("customers"),     sublabel: t("masterData"),  perm: "view_customers",  section: t("masterData"),  icon: NAV_ICONS.customers },
    { id: "suppliers",     label: t("suppliers"),     sublabel: t("masterData"),  perm: "view_suppliers",  section: t("masterData"),  icon: NAV_ICONS.suppliers },
    { id: "accounting",    label: t("accounting"),    sublabel: t("finance"),     perm: "view_accounting", section: t("finance"),     icon: NAV_ICONS.accounting },
    { id: "reports",       label: t("reports"),       sublabel: t("finance"),     perm: "view_reports",    section: t("finance"),     icon: NAV_ICONS.reports },
    { id: "reconciliation",label: "تسوية البنك",     sublabel: t("finance"),     perm: "manage_treasury", section: t("finance"),     icon: NAV_ICONS.reconciliation },
    { id: "users",         label: t("users"),          sublabel: t("system"),      perm: "manage_users",    section: t("system"),      icon: NAV_ICONS.users },
    { id: "audit_log",     label: "سجل التدقيق",    sublabel: t("system"),      perm: "manage_users",    section: t("system"),      icon: NAV_ICONS.audit_log },
    { id: "settings",      label: t("settings"),      sublabel: t("system"),      perm: "manage_settings", section: t("system"),      icon: NAV_ICONS.settings },
  ];

  const paletteCommands: PaletteCommand[] = ALL_COMMANDS
    .filter(cmd => hasPermission(authUser, cmd.perm as any))
    .map(({ id, label, sublabel, icon }) => ({ id, label, sublabel, icon }));

  /* ── Page content ─────────────────────────── */
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
    audit_log:      <AuditLog />,
    reconciliation: <Reconciliation />,
  };

  return (
    <LangContext.Provider value={{ lang, t, dir }}>
      <AuthContext.Provider value={{ user: authUser, logout: handleLogout, can: (p) => hasPermission(authUser, p) }}>
        {/* ── Global styles ──────────────────────── */}
        <style>{GLOBAL_CSS + `\nhtml, body { direction: ${dir}; }`}</style>

        {!authUser ? (
          <AuthScreen onAuth={handleLogin} />
        ) : (
          <div style={{ ...S.app, direction: dir }}>
            <Sidebar page={page} onNavigate={handleNavigate} />
            <div style={S.main}>
              <Topbar
                pageLabel={NAV_LABELS[page]}
                onOpenPalette={() => setPaletteOpen(true)}
              />
              {/* key= triggers .page-enter re-animation on every navigation */}
              <div key={page} className="page-enter" style={S.content}>
                {PAGES[page]}
              </div>
            </div>
          </div>
        )}

        {/* ── Command Palette ─────────────────────── */}
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onSelect={id => handleNavigate(id as PageId)}
          commands={paletteCommands}
          placeholder={dir === "rtl" ? "بحث في الوحدات..." : "Search modules..."}
        />

        <Toast toasts={toasts} />
      </AuthContext.Provider>
    </LangContext.Provider>
  );
}
