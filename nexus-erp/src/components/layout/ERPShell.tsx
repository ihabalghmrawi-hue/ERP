"use client";

import { useState, useCallback, useEffect } from "react";
import { LangContext, createTranslator } from "@/hooks/useLang";
import { AuthContext } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { DB, User } from "@/lib/db/database";
import { Lang } from "@/lib/i18n/translations";
import { S, C, GLOBAL_CSS } from "@/lib/engine/design";
import { hasPermission } from "@/lib/engine/permissions";
import { PendingActionProvider, usePendingAction, QuickActionType } from "@/lib/engine/pending-action";

import { AuthScreen }    from "./AuthScreen";
import { Sidebar, NAV_ICONS } from "./Sidebar";
import { Topbar }        from "./Topbar";
import { Toast }         from "@/components/ui/Toast";
import { CommandPalette, PaletteCommand, CommandKind } from "@/components/ui/CommandPalette";

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
import { AuditLog }        from "@/components/modules/AuditLog";
import { Reconciliation }  from "@/components/modules/Reconciliation";
import { CashierReports }      from "@/components/modules/CashierReports";
import { FinancialStatements } from "@/components/modules/FinancialStatements";
import { SalesReps }          from "@/components/modules/SalesReps";

type PageId =
  | "dashboard" | "sales" | "purchases" | "inventory" | "treasury"
  | "customers" | "suppliers" | "accounting" | "reports" | "users"
  | "settings" | "pos" | "audit_log" | "reconciliation" | "cashier_reports" | "financial_statements" | "sales_reps";

// ── SVG icons for action commands ─────────────────────────────────────────────
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

// Page → quick-action type mapping
const ACTION_PAGE_MAP: Record<QuickActionType, PageId> = {
  new_sale_invoice:    "sales",
  new_purchase_invoice:"purchases",
  new_customer:        "customers",
  new_supplier:        "suppliers",
  new_product:         "inventory",
  new_payment:         "treasury",
  new_journal_entry:   "accounting",
};

// ── Inner shell (has access to PendingActionContext) ──────────────────────────
function ERPShellInner() {
  const [lang, setLang]         = useState<Lang>(() => (DB.get().settings.lang as Lang) || "ar");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [page, setPage]         = useState<PageId>("dashboard");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { toasts, addToast }    = useToast();
  const { dispatch }            = usePendingAction();

  const t   = useCallback(createTranslator(lang), [lang]);
  const dir = lang === "ar" ? "rtl" : "ltr";
  const isAr = lang === "ar";

  // ── Global keyboard shortcuts ───────────────────────────────────────────────
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

  // ── Palette command selection ───────────────────────────────────────────────
  const handlePaletteSelect = (id: string, kind: CommandKind) => {
    if (kind === "action") {
      const actionType = id as QuickActionType;
      const targetPage = ACTION_PAGE_MAP[actionType];
      if (targetPage) {
        dispatch({ type: actionType });
        handleNavigate(targetPage);
      }
    } else {
      handleNavigate(id as PageId);
    }
    setPaletteOpen(false);
  };

  // ── Labels ──────────────────────────────────────────────────────────────────
  const NAV_LABELS: Record<PageId, string> = {
    dashboard: t("dashboard"), sales: t("sales"), purchases: t("purchases"),
    inventory: t("inventory"), treasury: t("treasury"), customers: t("customers"),
    suppliers: t("suppliers"), accounting: t("accounting"), reports: t("reports"),
    users: t("users"), settings: t("settings"), pos: "POS",
    audit_log: isAr ? "سجل التدقيق" : "Audit Log",
    reconciliation: isAr ? "تسوية البنك" : "Reconciliation",
    cashier_reports:      isAr ? "تقارير الكاشير" : "Cashier Reports",
    financial_statements: isAr ? "القوائم المالية" : "Financial Statements",
    sales_reps:           isAr ? "مندوبو المبيعات" : "Sales Reps",
  };

  // ── Command palette items ───────────────────────────────────────────────────
  const ACTION_COMMANDS: PaletteCommand[] = ([
    {
      id: "new_sale_invoice",
      label: isAr ? "فاتورة مبيعات جديدة" : "New Sales Invoice",
      sublabel: isAr ? "إنشاء فاتورة بيع" : "Create a sale",
      icon: <PlusIcon />, kind: "action" as const, accent: C.success,
    },
    {
      id: "new_purchase_invoice",
      label: isAr ? "فاتورة مشتريات جديدة" : "New Purchase Invoice",
      sublabel: isAr ? "تسجيل فاتورة مورد" : "Record a purchase",
      icon: <PlusIcon />, kind: "action" as const, accent: C.warning,
    },
    {
      id: "new_customer",
      label: isAr ? "عميل جديد" : "New Customer",
      sublabel: isAr ? "إضافة عميل للدفتر" : "Add to contact book",
      icon: <PlusIcon />, kind: "action" as const, accent: C.accentMid,
    },
    {
      id: "new_supplier",
      label: isAr ? "مورد جديد" : "New Supplier",
      sublabel: isAr ? "إضافة مورد للدفتر" : "Add to supplier list",
      icon: <PlusIcon />, kind: "action" as const, accent: C.purple,
    },
    {
      id: "new_product",
      label: isAr ? "منتج جديد" : "New Product",
      sublabel: isAr ? "إضافة منتج للمخزون" : "Add to inventory",
      icon: <PlusIcon />, kind: "action" as const, accent: C.gold,
    },
    {
      id: "new_payment",
      label: isAr ? "تسجيل دفعة" : "Record Payment",
      sublabel: isAr ? "إيداع أو سحب" : "Deposit or withdrawal",
      icon: <PlusIcon />, kind: "action" as const, accent: C.success,
    },
  ] as PaletteCommand[]).filter(cmd => {
    const page = ACTION_PAGE_MAP[cmd.id as QuickActionType];
    const permMap: Record<PageId, string> = {
      sales: "view_sales", purchases: "view_purchases", customers: "view_customers",
      suppliers: "view_suppliers", inventory: "view_inventory", treasury: "view_treasury",
      accounting: "view_accounting", reports: "view_reports", users: "manage_users",
      settings: "manage_settings", dashboard: "view_dashboard", pos: "access_pos",
      audit_log: "manage_users", reconciliation: "manage_treasury",
      cashier_reports: "view_reports", financial_statements: "view_accounting",
      sales_reps: "view_sales",
    };
    return hasPermission(authUser, permMap[page] as any);
  });

  const NAV_COMMANDS: PaletteCommand[] = [
    { id: "dashboard",      label: t("dashboard"),    sublabel: t("overview"),    perm: "view_dashboard",  icon: NAV_ICONS.dashboard },
    { id: "pos",            label: "نقطة البيع",      sublabel: t("overview"),    perm: "access_pos",      icon: NAV_ICONS.pos },
    { id: "sales",          label: t("sales"),         sublabel: t("operations"),  perm: "view_sales",      icon: NAV_ICONS.sales },
    { id: "purchases",      label: t("purchases"),     sublabel: t("operations"),  perm: "view_purchases",  icon: NAV_ICONS.purchases },
    { id: "inventory",      label: t("inventory"),     sublabel: t("operations"),  perm: "view_inventory",  icon: NAV_ICONS.inventory },
    { id: "treasury",       label: t("treasury"),      sublabel: t("operations"),  perm: "view_treasury",   icon: NAV_ICONS.treasury },
    { id: "customers",      label: t("customers"),     sublabel: t("masterData"),  perm: "view_customers",  icon: NAV_ICONS.customers },
    { id: "suppliers",      label: t("suppliers"),     sublabel: t("masterData"),  perm: "view_suppliers",  icon: NAV_ICONS.suppliers },
    { id: "accounting",     label: t("accounting"),    sublabel: t("finance"),     perm: "view_accounting", icon: NAV_ICONS.accounting },
    { id: "reports",        label: t("reports"),       sublabel: t("finance"),     perm: "view_reports",    icon: NAV_ICONS.reports },
    { id: "sales_reps",           label: isAr ? "مندوبو المبيعات" : "Sales Reps",           sublabel: t("operations"), perm: "view_sales",   icon: NAV_ICONS.sales },
    { id: "cashier_reports",      label: isAr ? "تقارير الكاشير" : "Cashier Reports",        sublabel: t("finance"), perm: "view_reports",    icon: NAV_ICONS.cashier_reports },
    { id: "financial_statements", label: isAr ? "القوائم المالية" : "Financial Statements",  sublabel: t("finance"), perm: "view_accounting", icon: NAV_ICONS.accounting },
    { id: "reconciliation",  label: isAr ? "تسوية البنك" : "Reconciliation",   sublabel: t("finance"), perm: "manage_treasury", icon: NAV_ICONS.reconciliation },
    { id: "users",          label: t("users"),         sublabel: t("system"),      perm: "manage_users",    icon: NAV_ICONS.users },
    { id: "audit_log",      label: isAr ? "سجل التدقيق" : "Audit Log", sublabel: t("system"), perm: "manage_users", icon: NAV_ICONS.audit_log },
    { id: "settings",       label: t("settings"),      sublabel: t("system"),      perm: "manage_settings", icon: NAV_ICONS.settings },
  ].filter((cmd: any) => hasPermission(authUser, cmd.perm));

  const paletteCommands: PaletteCommand[] = [...ACTION_COMMANDS, ...NAV_COMMANDS];

  // ── Pages ────────────────────────────────────────────────────────────────────
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
    audit_log:            <AuditLog />,
    reconciliation:       <Reconciliation />,
    cashier_reports:      <CashierReports />,
    financial_statements: <FinancialStatements />,
    sales_reps:           <SalesReps addToast={addToast} />,
  };

  return (
    <LangContext.Provider value={{ lang, t, dir }}>
      <AuthContext.Provider value={{ user: authUser, logout: handleLogout, can: (p) => hasPermission(authUser, p) }}>
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
              <div key={page} className="page-enter" style={S.content}>
                {PAGES[page]}
              </div>
            </div>
          </div>
        )}

        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onSelect={handlePaletteSelect}
          commands={paletteCommands}
          placeholder={isAr ? "بحث أو إجراء سريع..." : "Search or quick action..."}
        />

        <Toast toasts={toasts} />
      </AuthContext.Provider>
    </LangContext.Provider>
  );
}

// ── Public export (wraps inner in PendingActionProvider) ──────────────────────
export function ERPShell() {
  return (
    <PendingActionProvider>
      <ERPShellInner />
    </PendingActionProvider>
  );
}
