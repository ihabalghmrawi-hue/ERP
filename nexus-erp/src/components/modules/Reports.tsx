"use client";

import { useEffect, useState } from "react";
import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { DB } from "@/lib/db/database";
import { AccountingEngine } from "@/lib/engine/accounting";
import { fmt, fmtDate } from "@/lib/engine/helpers";
import { KPI }         from "@/components/ui/KPI";
import { DataTable }   from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState }  from "@/components/ui/EmptyState";

export function Reports() {
  const { t } = useLang();
  const db  = DB.get();
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  const [asOfDate, setAsOfDate] = useState<string | undefined>(new Date().toISOString().slice(0, 10));

  const FILTER_STORAGE_KEY = "nexus_reports_filters";
  const is  = AccountingEngine.getIncomeStatement(startDate, endDate);
  const prevIs = startDate && endDate
    ? AccountingEngine.getIncomeStatement(
        new Date(new Date(startDate).getTime() - (new Date(endDate).getTime() - new Date(startDate).getTime()) - 86400000).toISOString().slice(0, 10),
        new Date(new Date(startDate).getTime() - 86400000).toISOString().slice(0, 10)
      )
    : null;
  const bs  = AccountingEngine.getBalanceSheet(asOfDate);
  const tb  = AccountingEngine.getTrialBalance(asOfDate);
  const inv = AccountingEngine.getInventoryValuation();
  const [activeReport, setActiveReport] = useState<"sales" | "inventory" | "pl" | "trial" | "ar" | "ap" | "vat">("sales");
  const [searchQuery, setSearchQuery] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<"all" | "paid" | "outstanding" | "overdue">("all");
  const [accountTypeFilter, setAccountTypeFilter] = useState<"all" | "asset" | "liability" | "equity" | "revenue" | "expense" | "cogs">("all");
  const [inventoryWarehouseFilter, setInventoryWarehouseFilter] = useState<string>("");
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState<string>("");
  const [arStatusFilter, setArStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [apStatusFilter, setApStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const warehouses = db.warehouses;
  const categories = Array.from(new Set(db.products.map((p) => p.category).filter(Boolean)));
  const receivables = AccountingEngine.getReceivables().filter((c) => {
    if (arStatusFilter !== "all" && c.status !== arStatusFilter) return false;
    if (!searchQuery) return true;
    const text = `${c.name} ${c.email || ""} ${c.phone || ""}`.toLowerCase();
    return text.includes(searchQuery.toLowerCase());
  });
  const payables = AccountingEngine.getPayables().filter((s) => {
    if (apStatusFilter !== "all" && s.status !== apStatusFilter) return false;
    if (!searchQuery) return true;
    const text = `${s.name} ${s.email || ""} ${s.phone || ""}`.toLowerCase();
    return text.includes(searchQuery.toLowerCase());
  });
  const filteredInvoices = db.invoices.filter((inv) => {
    if (startDate && inv.date < startDate) return false;
    if (endDate && inv.date > endDate) return false;
    if (invoiceStatusFilter !== "all" && inv.status !== invoiceStatusFilter) return false;
    if (!searchQuery) return true;
    const text = `${inv.customerName || ""} ${inv.id} ${inv.paymentType} ${inv.status}`.toLowerCase();
    return text.includes(searchQuery.toLowerCase());
  });
  const filteredInventory = inv.filter((p) => {
    if (inventoryWarehouseFilter && p.warehouseId !== inventoryWarehouseFilter) return false;
    if (inventoryCategoryFilter && p.category !== inventoryCategoryFilter) return false;
    if (!searchQuery) return true;
    const text = `${p.sku} ${p.name} ${p.category || ""}`.toLowerCase();
    return text.includes(searchQuery.toLowerCase());
  });
  const totalInvValue     = inv.reduce((s, p) => s + p.value, 0);
  const totalSalesRevenue = db.invoices.reduce((s, i) => s + i.total, 0);
  const totalPurchases    = db.purchaseOrders.reduce((s, p) => s + p.total, 0);
  const totalReceivables  = receivables.reduce((s, c) => s + (c.balance || 0), 0);
  const totalPayables     = payables.reduce((s, sitem) => s + (sitem.balance || 0), 0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw || "{}");

      setStartDate(saved.startDate);
      setEndDate(saved.endDate);
      setAsOfDate(saved.asOfDate || new Date().toISOString().slice(0, 10));
      setActiveReport(saved.activeReport || "sales");
      setSearchQuery(saved.searchQuery || "");
      setInvoiceStatusFilter(saved.invoiceStatusFilter || "all");
      setAccountTypeFilter(saved.accountTypeFilter || "all");
      setInventoryWarehouseFilter(saved.inventoryWarehouseFilter || "");
      setInventoryCategoryFilter(saved.inventoryCategoryFilter || "");
      setArStatusFilter(saved.arStatusFilter || "all");
      setApStatusFilter(saved.apStatusFilter || "all");
    } catch {
      // ignore malformed stored filters
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
      startDate,
      endDate,
      asOfDate,
      activeReport,
      searchQuery,
      invoiceStatusFilter,
      accountTypeFilter,
      inventoryWarehouseFilter,
      inventoryCategoryFilter,
      arStatusFilter,
      apStatusFilter,
    }));
  }, [startDate, endDate, asOfDate, activeReport, searchQuery, invoiceStatusFilter, accountTypeFilter, inventoryWarehouseFilter, inventoryCategoryFilter, arStatusFilter, apStatusFilter]);

  const vatReport = AccountingEngine.getVATReport(startDate, endDate);

  const REPORT_TABS = [
    { id: "sales"     as const, label: t("salesPerformance") },
    { id: "inventory" as const, label: t("inventoryValuation") },
    { id: "pl"        as const, label: t("plSummary") },
    { id: "trial"     as const, label: "ميزان المراجعة" },
    { id: "ar"        as const, label: t("accountsReceivable") },
    { id: "ap"        as const, label: t("accountsPayable") },
    { id: "vat"       as const, label: "⚖️ تقرير الضريبة (VAT)" },
  ];

  return (
    <div>
      <div style={S.pageTitle}>{t("reportsTitle")}</div>
      <div style={S.pageSub}>{t("reportsSubtitle")}</div>

      {/* KPIs */}
      <div style={S.grid(4)}>
        <KPI label={t("totalRevenue")}    value={fmt(is.netRevenue)}   color={C.success}   icon="📈" />
        <KPI label={t("netIncome")}       value={fmt(is.netIncome)}    color={C.accentMid} icon="💰" />
        <KPI label={t("inventoryValue")}  value={fmt(totalInvValue)}   color={C.warning}   icon="📦" />
        <KPI label={t("totalPurchases")}  value={fmt(totalPurchases)}  color={C.purple}    icon="📥" />
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 12, color: C.textMuted }}>من:</label>
          <input type="date" value={startDate || ""} onChange={(e) => setStartDate(e.target.value || undefined)} style={{ ...S.input, padding: "6px 8px", width: 150 }} />
          <label style={{ fontSize: 12, color: C.textMuted }}>إلى:</label>
          <input type="date" value={endDate || ""} onChange={(e) => setEndDate(e.target.value || undefined)} style={{ ...S.input, padding: "6px 8px", width: 150 }} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: 16 }}>
          <label style={{ fontSize: 12, color: C.textMuted }}>حتى:</label>
          <input type="date" value={asOfDate || ""} onChange={(e) => setAsOfDate(e.target.value || undefined)} style={{ ...S.input, padding: "6px 8px", width: 150 }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="بحث متقدم..."
          style={{ ...S.input, padding: "6px 10px", width: 260, minWidth: 220 }}
        />

        {activeReport === "sales" && (
          <select value={invoiceStatusFilter} onChange={(e) => setInvoiceStatusFilter(e.target.value as any)} style={{ ...S.select, width: 180 }}>
            <option value="all">كل الحالات</option>
            <option value="paid">مدفوعة</option>
            <option value="outstanding">مستحقة</option>
            <option value="overdue">متأخرة</option>
          </select>
        )}

        {activeReport === "inventory" && (
          <>
            <select value={inventoryCategoryFilter} onChange={(e) => setInventoryCategoryFilter(e.target.value)} style={{ ...S.select, width: 180 }}>
              <option value="">{t("category")}</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <select value={inventoryWarehouseFilter} onChange={(e) => setInventoryWarehouseFilter(e.target.value)} style={{ ...S.select, width: 180 }}>
              <option value="">{t("warehouse")}</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </select>
          </>
        )}

        {activeReport === "trial" && (
          <select value={accountTypeFilter} onChange={(e) => setAccountTypeFilter(e.target.value as any)} style={{ ...S.select, width: 180 }}>
            <option value="all">كل الحسابات</option>
            <option value="asset">الأصول</option>
            <option value="liability">الخصوم</option>
            <option value="equity">حقوق الملكية</option>
            <option value="revenue">الإيرادات</option>
            <option value="expense">المصروفات</option>
            <option value="cogs">تكلفة البضاعة</option>
          </select>
        )}

        {activeReport === "ar" && (
          <select value={arStatusFilter} onChange={(e) => setArStatusFilter(e.target.value as any)} style={{ ...S.select, width: 180 }}>
            <option value="all">{t("all") || "All Customers"}</option>
            <option value="active">{t("activeStatus")}</option>
            <option value="inactive">{t("inactiveStatus")}</option>
          </select>
        )}

        {activeReport === "ap" && (
          <select value={apStatusFilter} onChange={(e) => setApStatusFilter(e.target.value as any)} style={{ ...S.select, width: 180 }}>
            <option value="all">{t("all") || "All Suppliers"}</option>
            <option value="active">{t("activeStatus")}</option>
            <option value="inactive">{t("inactiveStatus")}</option>
          </select>
        )}

        <button
          type="button"
          onClick={() => {
            setStartDate(undefined);
            setEndDate(undefined);
            setAsOfDate(new Date().toISOString().slice(0, 10));
            setSearchQuery("");
            setInvoiceStatusFilter("all");
            setAccountTypeFilter("all");
            setInventoryWarehouseFilter("");
            setInventoryCategoryFilter("");
            setArStatusFilter("all");
            setApStatusFilter("all");
            if (typeof window !== "undefined") {
              window.localStorage.removeItem(FILTER_STORAGE_KEY);
            }
          }}
          style={{ ...S.btn("ghost"), padding: "7px 14px", fontSize: 12 }}
        >
          {t("resetFilters") || "Reset Filters"}
        </button>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap", background: C.surfaceAlt, padding: 4, borderRadius: 8, border: `1px solid ${C.border}`, width: "fit-content" }}>
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.id}
            style={{ ...S.btn(activeReport === tab.id ? "primary" : "ghost"), padding: "7px 14px", fontSize: 12, border: "none" }}
            onClick={() => setActiveReport(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Sales Performance ── */}
      {activeReport === "sales" && (
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: C.success, fontWeight: 700 }}>
                {t("amountPaid")}: {fmt(filteredInvoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0))}
              </span>
              <span style={{ fontSize: 13, color: C.warning, fontWeight: 700 }}>
                {t("outstanding")}: {fmt(filteredInvoices.filter((i) => i.status === "outstanding").reduce((s, i) => s + i.total, 0))}
              </span>
              <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 700 }}>
                {filteredInvoices.length} {t("invoices") || "Invoices"}
              </span>
            </div>
            <div style={S.sectionTitle}>{t("salesPerformance")}</div>
          </div>
          {filteredInvoices.length === 0 ? (
            <EmptyState icon="📊" title={t("noInvoicesYet")} />
          ) : (
            <DataTable
              headers={[
                { label: t("status") }, { label: t("total") }, { label: t("type") },
                { label: t("customer") }, { label: t("dueDate") }, { label: t("date") }, { label: t("invoiceNo") },
              ]}
              rows={filteredInvoices.map((inv) => [
                <StatusBadge key="st" status={inv.status} />,
                <span key="tot" style={{ fontWeight: 800, color: C.text }}>{fmt(inv.total)}</span>,
                <span key="tp" style={S.badge("info")}>{inv.paymentType === "cash" ? t("cash") : t("credit")}</span>,
                inv.customerName,
                fmtDate(inv.dueDate),
                fmtDate(inv.date),
                <span key="id" style={{ color: C.accent, fontWeight: 700 }}>{inv.id}</span>,
              ])}
            />
          )}
        </div>
      )}

      {/* ── Inventory Valuation ── */}
      {activeReport === "inventory" && (
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <span style={S.badge("info")}>FIFO</span>
            <div style={S.sectionTitle}>{t("inventoryValuation")}</div>
          </div>
          {inv.length === 0 ? (
            <EmptyState icon="📦" title={t("noProductsYet")} />
          ) : (
            <>
              <DataTable
                headers={[
                  { label: t("margin") }, { label: t("stockValue") }, { label: t("qty") },
                  { label: t("sellPrice") }, { label: t("unitCost") },
                  { label: t("category") }, { label: t("warehouse") }, { label: t("productName") }, { label: t("sku") },
                ]}
                rows={filteredInventory.map((p) => [
                    <span key="mg" style={{ color: C.success, fontWeight: 700 }}>{p.margin}%</span>,
                    <span key="val" style={{ fontWeight: 800, color: C.accentMid }}>{fmt(p.value)}</span>,
                    `${p.qty || 0} ${p.unit || ""}`,
                    fmt(p.sellPrice),
                    fmt(p.unitCost),
                    p.category || "—",
                    p.warehouseId ? (db.warehouses.find((w) => w.id === p.warehouseId)?.name || p.warehouseId) : "—",
                    <span key="name" style={{ fontWeight: 700 }}>{p.name}</span>,
                    <span key="sku" style={{ color: C.textMuted, fontSize: 12 }}>{p.sku}</span>,
                ])}
              />
              {/* Total row */}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", borderTop: `2px solid ${C.borderDark}`, fontWeight: 800, color: C.text, marginTop: 4 }}>
                <span style={{ color: C.accentMid, fontSize: 15 }}>{fmt(totalInvValue)}</span>
                <span style={{ fontSize: 13 }}>{t("totalStockValue")}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── P&L Statement ── */}
      {activeReport === "pl" && (
        <div style={{ ...S.grid(2) }}>
          <div style={S.card}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>{t("incomeStatement")}</div>
          {prevIs && (
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, minWidth: 180 }}>
                <div style={{ fontSize: 12, color: C.textMuted }}>الفترة السابقة</div>
                <div style={{ fontWeight: 800, color: C.text, marginTop: 6 }}>{fmt(prevIs.netIncome)}</div>
                <div style={{ fontSize: 11, color: C.success }}>{prevIs.netIncome >= 0 ? "+" : ""}{fmt(prevIs.netIncome)}</div>
              </div>
              <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, minWidth: 180 }}>
                <div style={{ fontSize: 12, color: C.textMuted }}>التغير في صافي الدخل</div>
                <div style={{ fontWeight: 800, color: is.netIncome >= prevIs.netIncome ? C.success : C.danger, marginTop: 6 }}>
                  {fmt(is.netIncome - prevIs.netIncome)}
                </div>
              </div>
            </div>
          )}
            {([
              [t("revenue"),           is.revenue,         C.success,   false],
              [t("salesReturns"),      -is.contraRevenue,  C.danger,    false],
              [t("netRevenue"),        is.netRevenue,      C.text,      true],
              [t("cogs"),              -is.cogs,           C.danger,    false],
              [t("grossProfit"),       is.grossProfit,     C.accentMid, true],
              [t("operatingExpenses"), -is.expenses,       C.warning,   false],
              [t("netIncome"),         is.netIncome,       is.netIncome >= 0 ? C.success : C.danger, true],
            ] as [string, number, string, boolean][]).map(([label, val, color, bold]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: bold ? 13 : 12 }}>
                <span style={{ color, fontWeight: bold ? 800 : 400 }}>{fmt(val)}</span>
                <span style={{ color: bold ? C.text : C.textSec, fontWeight: bold ? 700 : 400 }}>{label}</span>
              </div>
            ))}
          </div>

          <div style={S.card}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>مؤشرات مالية</div>
            {[
              ["إجمالي الفواتير",    db.invoices.length,       "",       false],
              ["إجمالي المبيعات",    fmt(totalSalesRevenue),   "",       false],
              ["إجمالي المشتريات",  fmt(totalPurchases),      "",       false],
              ["عدد العملاء",        db.customers.length,      "",       false],
              ["عدد الموردين",       db.suppliers.length,      "",       false],
              ["عدد أوامر الشراء",  db.purchaseOrders.length, "",       false],
              ["قيمة المخزون",       fmt(totalInvValue),       "",       false],
              ["إجمالي الأصول",      fmt(bs.totalAssets),      C.success, true],
              ["إجمالي الخصوم",      fmt(bs.totalLiabilities), C.danger,  true],
              ["حقوق الملكية",       fmt(bs.totalEquity),      C.purple,  true],
            ].map(([label, val, color, bold]) => (
              <div key={label as string} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                <span style={{ color: (color as string) || C.text, fontWeight: bold ? 700 : 400 }}>{val as string | number}</span>
                <span style={{ color: C.textSec }}>{label as string}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AR Report ── */}
      {activeReport === "trial" && (
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{"ميزان المراجعة"}</div>
              <div style={{ fontSize: 13, color: C.textMuted }}>عرض الحسابات حسب الرصيد والتصنيف</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, color: C.textMuted }}><strong>حتى:</strong> {asOfDate || "—"}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{tb.accounts.length} حسابات</div>
            </div>
          </div>
          {tb.accounts.length === 0 ? (
            <EmptyState icon="📘" title="لا توجد حسابات" />
          ) : (
            <>
              <DataTable
                headers={[
                  { label: "الرمز" }, { label: "الحساب" }, { label: "النوع" },
                  { label: "مدين" }, { label: "دائن" },
                ]}
                rows={tb.accounts
                  .filter((acc) => {
                    if (accountTypeFilter !== "all" && acc.type !== accountTypeFilter) return false;
                    if (!searchQuery) return true;
                    const text = `${acc.code} ${acc.name} ${acc.type}`.toLowerCase();
                    return text.includes(searchQuery.toLowerCase());
                  })
                  .map((acc) => [
                    acc.code,
                    <span key="name" style={{ fontWeight: 700 }}>{acc.name}</span>,
                    <span key="type" style={S.badge(acc.type === "asset" ? "success" : acc.type === "liability" ? "danger" : acc.type === "revenue" ? "info" : acc.type === "expense" ? "warning" : "purple")}>{acc.type}</span>,
                    fmt(acc.debit),
                    fmt(acc.credit),
                  ])}
              />
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", borderTop: `2px solid ${C.borderDark}`, fontWeight: 800, color: C.text, marginTop: 4 }}>
                <span>{t("totalDebits")}: {fmt(tb.totalDebits)}</span>
                <span>{t("totalCredits")}: {fmt(tb.totalCredits)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {activeReport === "ar" && (
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.warning }}>
                {t("totalAR")}: {fmt(totalReceivables)}
              </span>
              <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 700 }}>
                {receivables.length} {t("customers")}
              </span>
            </div>
            <div style={S.sectionTitle}>{t("accountsReceivable")}</div>
          </div>
          {receivables.length === 0 ? (
            <EmptyState icon="👥" title={t("noCustomersYet")} />
          ) : (
            <DataTable
              headers={[
                { label: t("status") }, { label: t("balance") }, { label: t("creditLimit") },
                { label: t("phone") }, { label: t("email") }, { label: t("customer") },
              ]}
              rows={receivables.map((c) => [
                <StatusBadge key="st" status={c.status} />,
                <span key="bal" style={{ fontWeight: 800, color: (c.balance || 0) > 0 ? C.warning : C.success }}>{fmt(c.balance || 0)}</span>,
                fmt(c.creditLimit || 0),
                c.phone || "—", c.email || "—",
                <span key="name" style={{ fontWeight: 700 }}>{c.name}</span>,
              ])}
            />
          )}
        </div>
      )}

      {/* ── AP Report ── */}
      {activeReport === "ap" && (
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.danger }}>
                {t("totalAP")}: {fmt(totalPayables)}
              </span>
              <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 700 }}>
                {payables.length} {t("suppliers")}
              </span>
            </div>
            <div style={S.sectionTitle}>{t("accountsPayable")}</div>
          </div>
          {payables.length === 0 ? (
            <EmptyState icon="🏢" title={t("noSuppliersYet")} />
          ) : (
            <DataTable
              headers={[
                { label: t("status") }, { label: t("outstanding") }, { label: t("terms") },
                { label: t("phone") }, { label: t("email") }, { label: t("supplier") },
              ]}
              rows={payables.map((s) => [
                <StatusBadge key="st" status={s.status} />,
                <span key="bal" style={{ fontWeight: 800, color: (s.balance || 0) > 0 ? C.danger : C.success }}>{fmt(s.balance || 0)}</span>,
                <span key="terms" style={S.badge("info")}>{s.creditTerms}</span>,
                s.phone || "—", s.email || "—",
                <span key="name" style={{ fontWeight: 700 }}>{s.name}</span>,
              ])}
            />
          )}
        </div>
      )}

      {/* ── VAT Report ── */}
      {activeReport === "vat" && (
        <div>
          {/* KPI cards */}
          <div style={S.grid(3)}>
            <div style={{ ...S.kpiCard(C.danger), padding: 20 }}>
              <div style={S.kpiLabel}>ضريبة المخرجات (على المبيعات)</div>
              <div style={{ ...S.kpiValue, color: C.danger }}>{fmt(vatReport.outputVAT)}</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                وعاء ضريبي: {fmt(vatReport.totalSalesSubtotal)} · {vatReport.taxableInvoices.length} فاتورة
              </div>
            </div>
            <div style={{ ...S.kpiCard(C.success), padding: 20 }}>
              <div style={S.kpiLabel}>ضريبة المدخلات (على المشتريات)</div>
              <div style={{ ...S.kpiValue, color: C.success }}>{fmt(vatReport.inputVAT)}</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                وعاء ضريبي: {fmt(vatReport.totalPurchSubtotal)} · {vatReport.taxablePOs.length} أمر شراء
              </div>
            </div>
            <div style={{ ...S.kpiCard(vatReport.netVAT >= 0 ? C.warning : C.accentMid), padding: 20 }}>
              <div style={S.kpiLabel}>صافي الضريبة المستحقة</div>
              <div style={{ ...S.kpiValue, color: vatReport.netVAT >= 0 ? C.warning : C.accentMid }}>{fmt(vatReport.netVAT)}</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                {vatReport.netVAT >= 0 ? "مستحق الدفع للجهات الضريبية" : "رصيد مستحق الاسترداد"}
              </div>
            </div>
          </div>

          {/* Summary box */}
          <div style={{ ...S.card, background: vatReport.netVAT >= 0 ? "#FEF9E7" : "#EBF5FB", border: `1px solid ${vatReport.netVAT >= 0 ? C.warning : C.accent}30`, marginTop: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 16 }}>
              📋 ملخص الضريبة
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
              {[
                ["ضريبة المخرجات (مبيعات)", fmt(vatReport.outputVAT), C.danger],
                ["ضريبة المدخلات (مشتريات)", fmt(vatReport.inputVAT), C.success],
                ["صافي الضريبة المستحقة", fmt(vatReport.netVAT), vatReport.netVAT >= 0 ? C.warning : C.accentMid],
              ].map(([label, val, color]) => (
                <div key={label as string} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.textSec, fontSize: 13 }}>{label as string}</span>
                  <span style={{ fontWeight: 800, color: color as string, fontSize: 14 }}>{val as string}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Taxable Sales */}
          {vatReport.taxableInvoices.length > 0 && (
            <div style={{ ...S.card, marginTop: 4 }}>
              <div style={S.sectionHeader}>
                <span style={{ fontSize: 12, color: C.danger, fontWeight: 700 }}>
                  إجمالي الضريبة: {fmt(vatReport.outputVAT)}
                </span>
                <div style={S.sectionTitle}>فواتير البيع الخاضعة للضريبة ({vatReport.taxableInvoices.length})</div>
              </div>
              <DataTable
                headers={[
                  { label: "ضريبة" }, { label: "الإجمالي" }, { label: "الوعاء الضريبي" },
                  { label: "العميل" }, { label: "التاريخ" }, { label: "رقم الفاتورة" },
                ]}
                rows={vatReport.taxableInvoices.map((inv) => [
                  <span key="tax" style={{ fontWeight: 700, color: C.danger }}>{fmt(inv.taxAmount)}</span>,
                  <span key="tot" style={{ fontWeight: 700 }}>{fmt(inv.total)}</span>,
                  fmt(inv.subtotal),
                  inv.customerName,
                  fmtDate(inv.date),
                  <span key="id" style={{ color: C.accent, fontWeight: 700 }}>{inv.id}</span>,
                ])}
              />
            </div>
          )}

          {/* Taxable Purchases */}
          {vatReport.taxablePOs.length > 0 && (
            <div style={{ ...S.card, marginTop: 4 }}>
              <div style={S.sectionHeader}>
                <span style={{ fontSize: 12, color: C.success, fontWeight: 700 }}>
                  إجمالي الضريبة: {fmt(vatReport.inputVAT)}
                </span>
                <div style={S.sectionTitle}>فواتير الشراء الخاضعة للضريبة ({vatReport.taxablePOs.length})</div>
              </div>
              <DataTable
                headers={[
                  { label: "ضريبة مدخلات" }, { label: "الإجمالي" }, { label: "الوعاء الضريبي" },
                  { label: "المورد" }, { label: "التاريخ" }, { label: "رقم الأمر" },
                ]}
                rows={vatReport.taxablePOs.map((po) => [
                  <span key="tax" style={{ fontWeight: 700, color: C.success }}>{fmt(po.taxAmount)}</span>,
                  <span key="tot" style={{ fontWeight: 700 }}>{fmt(po.total)}</span>,
                  fmt(po.subtotal),
                  po.supplierName,
                  fmtDate(po.date),
                  <span key="id" style={{ color: C.accent, fontWeight: 700 }}>{po.id}</span>,
                ])}
              />
            </div>
          )}

          {vatReport.taxableInvoices.length === 0 && vatReport.taxablePOs.length === 0 && (
            <div style={{ ...S.card, textAlign: "center", color: C.textMuted, padding: 40 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
              <div style={{ fontWeight: 700 }}>لا توجد معاملات خاضعة للضريبة في هذه الفترة</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>فعّل ضريبة القيمة المضافة من الإعدادات ثم أنشئ فواتير جديدة</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
