"use client";

import { useEffect, useState } from "react";
import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { DB } from "@/lib/db/database";
import { AccountingEngine } from "@/lib/engine/accounting";
import { TaxService } from "@/lib/engine/tax";
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
  const [activeReport, setActiveReport] = useState<"sales" | "inventory" | "pl" | "bs" | "trial" | "ar" | "ap" | "vat" | "cashflow" | "aged">("sales");
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
      setActiveReport(saved.activeReport || "sales" as any);
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
    { id: "bs"        as const, label: "🏛 الميزانية العمومية" },
    { id: "trial"     as const, label: "ميزان المراجعة" },
    { id: "ar"        as const, label: t("accountsReceivable") },
    { id: "ap"        as const, label: t("accountsPayable") },
    { id: "vat"       as const, label: "⚖️ تقرير الضريبة (VAT)" },
    { id: "cashflow"  as const, label: "💵 التدفق النقدي" },
    { id: "aged"      as const, label: "📅 تقادم الذمم" },
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
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: C.success, fontWeight: 700 }}>
                {t("amountPaid")}: {fmt(filteredInvoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0))}
              </span>
              <span style={{ fontSize: 13, color: C.warning, fontWeight: 700 }}>
                {t("outstanding")}: {fmt(filteredInvoices.filter((i) => i.status === "outstanding").reduce((s, i) => s + i.total, 0))}
              </span>
              <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 700 }}>
                {filteredInvoices.length} {t("invoices") || "Invoices"}
              </span>
              <button
                style={{ ...S.btn("outline"), fontSize: 11, padding: "5px 10px" }}
                onClick={() => {
                  const rows = [
                    ["رقم الفاتورة","التاريخ","تاريخ الاستحقاق","العميل","النوع","الحالة","المجموع","الضريبة","الصافي"],
                    ...filteredInvoices.map(i => [i.id, i.date, i.dueDate, i.customerName, i.paymentType, i.status, i.total, i.taxAmount, i.subtotal]),
                  ];
                  const csv  = rows.map(r => r.join(",")).join("\n");
                  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
                  const url  = URL.createObjectURL(blob);
                  const a    = document.createElement("a"); a.href = url;
                  a.download = `sales-${startDate || "all"}.csv`; a.click(); URL.revokeObjectURL(url);
                }}
              >⬇️ CSV</button>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{t("incomeStatement")}</div>
              <button
                style={{ ...S.btn("outline"), fontSize: 11, padding: "5px 10px" }}
                onClick={() => {
                  const rows = [
                    ["البند", "المبلغ"],
                    ["الإيرادات", is.revenue],
                    ["المردودات والمسموحات", -is.contraRevenue],
                    ["صافي الإيرادات", is.netRevenue],
                    ["تكلفة البضاعة المباعة", -is.cogs],
                    ["إجمالي الربح", is.grossProfit],
                    ["المصروفات التشغيلية", -is.expenses],
                    ["صافي الدخل", is.netIncome],
                  ];
                  const csv  = rows.map(r => r.join(",")).join("\n");
                  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
                  const url  = URL.createObjectURL(blob);
                  const a    = document.createElement("a"); a.href = url;
                  a.download = `pl-${startDate || "all"}.csv`; a.click(); URL.revokeObjectURL(url);
                }}
              >⬇️ CSV</button>
            </div>
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

      {/* ── Trial Balance ── */}
      {activeReport === "trial" && (
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{"ميزان المراجعة"}</div>
              <div style={{ fontSize: 13, color: C.textMuted }}>عرض الحسابات حسب الرصيد والتصنيف</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                style={{ ...S.btn("outline"), fontSize: 11, padding: "5px 10px" }}
                onClick={() => {
                  const rows = [["الكود","الحساب","النوع","مدين","دائن"], ...tb.accounts.map(a => [a.code, a.name, a.type, a.debit, a.credit])];
                  const csv  = rows.map(r => r.join(",")).join("\n");
                  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
                  const url  = URL.createObjectURL(blob);
                  const a    = document.createElement("a"); a.href = url;
                  a.download = `trial-balance-${asOfDate || "all"}.csv`; a.click(); URL.revokeObjectURL(url);
                }}
              >⬇️ CSV</button>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, color: C.textMuted }}><strong>حتى:</strong> {asOfDate || "—"}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{tb.accounts.length} حسابات</div>
              </div>
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
      {activeReport === "vat" && (() => {
        const settings   = db.settings;
        const vatName    = settings.vatName    || "VAT";
        const currency   = settings.baseCurrency || "SAR";

        // CSV export helper
        const handleExportCSV = () => {
          const rows = [
            ...vatReport.taxableInvoices.map((inv) => ({
              id: inv.id, date: inv.date, party: inv.customerName,
              subtotal: inv.subtotal, tax: inv.taxAmount, total: inv.total, type: "sale" as const,
            })),
            ...vatReport.taxablePOs.map((po) => ({
              id: po.id, date: po.date, party: po.supplierName,
              subtotal: po.subtotal, tax: po.taxAmount, total: po.total, type: "purchase" as const,
            })),
          ].sort((a, b) => a.date.localeCompare(b.date));
          const csv  = TaxService.exportCSV(rows, vatName, currency);
          const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
          const url  = URL.createObjectURL(blob);
          const a    = document.createElement("a");
          a.href     = url; a.download = `vat-report-${startDate || "all"}.csv`; a.click();
          URL.revokeObjectURL(url);
        };

        // Per-month breakdown (all transactions combined)
        const allTx = [
          ...vatReport.taxableInvoices.map((i) => ({ month: i.date.slice(0, 7), tax: i.taxAmount, type: "output" })),
          ...vatReport.taxablePOs.map((p)       => ({ month: p.date.slice(0, 7), tax: p.taxAmount, type: "input"  })),
        ];
        const months = Array.from(new Set(allTx.map((t) => t.month))).sort();
        const monthlyData = months.map((m) => ({
          month: m,
          output: TaxService.round(allTx.filter((t) => t.month === m && t.type === "output").reduce((s, t) => s + t.tax, 0)),
          input:  TaxService.round(allTx.filter((t) => t.month === m && t.type === "input").reduce((s, t) => s + t.tax, 0)),
        }));

        return (
          <div>
            {/* KPIs */}
            <div style={S.grid(4)}>
              <div style={{ ...S.kpiCard(C.danger), padding: 20 }}>
                <div style={S.kpiLabel}>ضريبة المخرجات (مبيعات)</div>
                <div style={{ ...S.kpiValue, color: C.danger }}>{fmt(vatReport.outputVAT)}</div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                  وعاء: {fmt(vatReport.totalSalesSubtotal)} · {vatReport.taxableInvoices.length} فاتورة
                </div>
              </div>
              <div style={{ ...S.kpiCard(C.success), padding: 20 }}>
                <div style={S.kpiLabel}>ضريبة المدخلات (مشتريات)</div>
                <div style={{ ...S.kpiValue, color: C.success }}>{fmt(vatReport.inputVAT)}</div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                  وعاء: {fmt(vatReport.totalPurchSubtotal)} · {vatReport.taxablePOs.length} أمر
                </div>
              </div>
              <div style={{ ...S.kpiCard(vatReport.netVAT >= 0 ? C.warning : C.accentMid), padding: 20 }}>
                <div style={S.kpiLabel}>صافي الضريبة المستحقة</div>
                <div style={{ ...S.kpiValue, color: vatReport.netVAT >= 0 ? C.warning : C.accentMid }}>{fmt(vatReport.netVAT)}</div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                  {vatReport.netVAT >= 0 ? "مستحق للجهات الضريبية" : "رصيد مستحق الاسترداد"}
                </div>
              </div>
              <div style={{ ...S.kpiCard(C.purple), padding: 20 }}>
                <div style={S.kpiLabel}>نسبة الضريبة الفعّالة</div>
                <div style={{ ...S.kpiValue, color: C.purple }}>
                  {vatReport.totalSalesSubtotal > 0
                    ? `${((vatReport.outputVAT / vatReport.totalSalesSubtotal) * 100).toFixed(1)}%`
                    : "—"}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>مخرجات ÷ وعاء المبيعات</div>
              </div>
            </div>

            {/* Summary + Export */}
            <div style={{ ...S.card, background: vatReport.netVAT >= 0 ? "#FEF9E7" : "#EBF5FB", border: `1px solid ${vatReport.netVAT >= 0 ? C.warning : C.accent}30`, marginTop: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>📋 ملخص الضريبة</div>
                <button
                  onClick={handleExportCSV}
                  style={{ ...S.btn("outline"), fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
                >
                  ⬇️ تصدير CSV
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>
                {[
                  ["الوعاء الضريبي — مبيعات",     fmt(vatReport.totalSalesSubtotal),  C.textSec],
                  ["ضريبة المخرجات",               fmt(vatReport.outputVAT),           C.danger],
                  ["الوعاء الضريبي — مشتريات",    fmt(vatReport.totalPurchSubtotal),   C.textSec],
                  ["ضريبة المدخلات",               fmt(vatReport.inputVAT),             C.success],
                  ["صافي الضريبة المستحقة",        fmt(vatReport.netVAT),               vatReport.netVAT >= 0 ? C.warning : C.accentMid],
                  [vatReport.netVAT >= 0 ? "الحالة: مستحق الدفع" : "الحالة: مستحق الاسترداد", "", vatReport.netVAT >= 0 ? C.warning : C.success],
                ].map(([label, val, color]) => (
                  <div key={label as string} style={{ padding: "10px 8px", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>{label as string}</div>
                    <div style={{ fontWeight: 800, color: color as string, fontSize: 15 }}>{val as string}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly breakdown */}
            {monthlyData.length > 1 && (
              <div style={{ ...S.card, marginTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 14 }}>📅 التفصيل الشهري</div>
                <DataTable
                  headers={[
                    { label: "صافي" }, { label: "مدخلات" }, { label: "مخرجات" }, { label: "الشهر" },
                  ]}
                  rows={monthlyData.map((m) => [
                    <span key="net" style={{ fontWeight: 800, color: m.output - m.input >= 0 ? C.warning : C.success }}>
                      {fmt(TaxService.round(m.output - m.input))}
                    </span>,
                    <span key="in"  style={{ color: C.success }}>{fmt(m.input)}</span>,
                    <span key="out" style={{ color: C.danger  }}>{fmt(m.output)}</span>,
                    <span key="mo"  style={{ fontWeight: 700   }}>{m.month}</span>,
                  ])}
                />
              </div>
            )}

            {/* Sales detail */}
            {vatReport.taxableInvoices.length > 0 && (
              <div style={{ ...S.card, marginTop: 4 }}>
                <div style={S.sectionHeader}>
                  <span style={{ fontSize: 12, color: C.danger, fontWeight: 700 }}>
                    إجمالي ضريبة المخرجات: {fmt(vatReport.outputVAT)}
                  </span>
                  <div style={S.sectionTitle}>فواتير البيع الخاضعة للضريبة ({vatReport.taxableInvoices.length})</div>
                </div>
                <DataTable
                  headers={[
                    { label: "نوع السعر" }, { label: "ضريبة" }, { label: "الإجمالي" },
                    { label: "الوعاء" }, { label: "العميل" }, { label: "التاريخ" }, { label: "رقم" },
                  ]}
                  rows={vatReport.taxableInvoices.map((inv) => [
                    <span key="mode" style={S.badge(inv.vatInclusive ? "gold" : "info")}>
                      {inv.vatInclusive ? "شامل" : "غير شامل"}
                    </span>,
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

            {/* Purchases detail */}
            {vatReport.taxablePOs.length > 0 && (
              <div style={{ ...S.card, marginTop: 4 }}>
                <div style={S.sectionHeader}>
                  <span style={{ fontSize: 12, color: C.success, fontWeight: 700 }}>
                    إجمالي ضريبة المدخلات: {fmt(vatReport.inputVAT)}
                  </span>
                  <div style={S.sectionTitle}>فواتير الشراء الخاضعة للضريبة ({vatReport.taxablePOs.length})</div>
                </div>
                <DataTable
                  headers={[
                    { label: "نوع السعر" }, { label: "ضريبة مدخلات" }, { label: "الإجمالي" },
                    { label: "الوعاء" }, { label: "المورد" }, { label: "التاريخ" }, { label: "رقم" },
                  ]}
                  rows={vatReport.taxablePOs.map((po) => [
                    <span key="mode" style={S.badge(po.vatInclusive ? "gold" : "info")}>
                      {po.vatInclusive ? "شامل" : "غير شامل"}
                    </span>,
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
        );
      })()}

      {/* ── Cash Flow Statement ── */}
      {activeReport === "cashflow" && (() => {
        const today = new Date().toISOString().slice(0, 10);
        const from  = startDate || db.invoices.concat(db.purchaseOrders as any[]).map((d: any) => d.date).sort()[0] || today;
        const to    = endDate   || today;

        // Operating: receipts from customers (paid invoices), payments to suppliers (received POs)
        const paidInvoices = db.invoices.filter(i =>
          i.status === "paid" && i.date >= from && i.date <= to
        );
        const receivedPOs  = db.purchaseOrders.filter(p =>
          p.status === "received" && p.date >= from && p.date <= to
        );
        const cashReceipts  = paidInvoices.reduce((s, i) => s + i.total, 0);
        const cashPayments  = receivedPOs.reduce((s, p) => s + p.amountPaid, 0);
        const netOperating  = cashReceipts - cashPayments;

        // Financing / other: treasury transactions in period
        const txInPeriod    = db.treasury.filter(tx => tx.date >= from && tx.date <= to);
        const receiptsOther = txInPeriod.filter(tx => tx.type === "receipt").reduce((s, tx) => s + tx.amount, 0);
        const paymentsOther = txInPeriod.filter(tx => tx.type === "payment").reduce((s, tx) => s + tx.amount, 0);
        const netFinancing  = receiptsOther - paymentsOther;

        const netCashFlow   = netOperating + netFinancing;

        const exportCSV = () => {
          const rows = [
            ["البند","المبلغ"],
            ["أنشطة التشغيل",""],
            ["تحصيلات من العملاء", cashReceipts],
            ["مدفوعات للموردين", -cashPayments],
            ["صافي التدفق التشغيلي", netOperating],
            ["أنشطة التمويل",""],
            ["إيصالات خزينة أخرى", receiptsOther],
            ["مدفوعات خزينة أخرى", -paymentsOther],
            ["صافي التدفق التمويلي", netFinancing],
            ["صافي التدفق النقدي", netCashFlow],
          ];
          const csv  = rows.map(r => r.join(",")).join("\n");
          const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
          const url  = URL.createObjectURL(blob);
          const a    = document.createElement("a"); a.href = url;
          a.download = `cashflow-${from}-${to}.csv`; a.click(); URL.revokeObjectURL(url);
        };

        const row = (label: string, value: number, bold = false, color?: string) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${C.border}`, fontSize: bold ? 13 : 12 }}>
            <span style={{ color: color || (value >= 0 ? C.success : C.danger), fontWeight: bold ? 800 : 400 }}>{fmt(value)}</span>
            <span style={{ color: bold ? C.text : C.textSec, fontWeight: bold ? 700 : 400 }}>{label}</span>
          </div>
        );

        const sectionHead = (label: string) => (
          <div key={label} style={{ fontSize: 12, fontWeight: 800, color: C.textMuted, padding: "10px 0 4px", borderBottom: `2px solid ${C.border}`, marginTop: 8 }}>{label}</div>
        );

        return (
          <div style={S.grid(2)}>
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>💵 قائمة التدفق النقدي</div>
                <button style={{ ...S.btn("outline"), fontSize: 11, padding: "5px 10px" }} onClick={exportCSV}>⬇️ CSV</button>
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12 }}>الفترة: {from} — {to}</div>

              {sectionHead("أنشطة التشغيل (Operating)")}
              {row("تحصيلات من العملاء (فواتير مدفوعة)", cashReceipts)}
              {row("مدفوعات للموردين (أوامر مستلمة)", -cashPayments)}
              {row("صافي التدفق التشغيلي", netOperating, true)}

              {sectionHead("أنشطة التمويل (Financing)")}
              {row("إيصالات خزينة أخرى", receiptsOther)}
              {row("مدفوعات خزينة أخرى", -paymentsOther)}
              {row("صافي التدفق التمويلي", netFinancing, true)}

              <div style={{ marginTop: 16, padding: "14px 0", borderTop: `2px solid ${C.borderDark}`, display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
                <span style={{ fontSize: 16, color: netCashFlow >= 0 ? C.success : C.danger }}>{fmt(netCashFlow)}</span>
                <span style={{ color: C.text }}>صافي التدفق النقدي</span>
              </div>
            </div>

            <div style={S.card}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>📋 تفاصيل حركات الخزينة</div>
              {txInPeriod.length === 0 ? (
                <div style={{ textAlign: "center", color: C.textMuted, padding: 32 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                  <div>لا توجد حركات خزينة في هذه الفترة</div>
                </div>
              ) : (
                <DataTable
                  headers={[{ label: "المبلغ" }, { label: "النوع" }, { label: "الوصف" }, { label: "التاريخ" }]}
                  rows={txInPeriod.slice().sort((a, b) => b.date.localeCompare(a.date)).map(tx => [
                    <span key="amt" style={{ fontWeight: 700, color: tx.type === "receipt" ? C.success : C.danger }}>{fmt(tx.amount)}</span>,
                    <span key="type" style={S.badge(tx.type === "receipt" ? "success" : tx.type === "payment" ? "danger" : "info")}>
                      {tx.type === "receipt" ? "إيصال" : tx.type === "payment" ? "دفع" : "تحويل"}
                    </span>,
                    <span key="desc" style={{ fontSize: 12, color: C.textSec }}>{tx.description}</span>,
                    fmtDate(tx.date),
                  ])}
                />
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Aged AR/AP ── */}
      {activeReport === "aged" && (() => {
        const today    = new Date();
        const daysDiff = (dateStr: string) => {
          const d = new Date(dateStr);
          return Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
        };
        const bucket = (days: number): "current" | "30" | "60" | "90" | "120+" => {
          if (days <= 0)   return "current";
          if (days <= 30)  return "30";
          if (days <= 60)  return "60";
          if (days <= 90)  return "90";
          return "120+";
        };
        const BUCKETS = ["current","30","60","90","120+"] as const;
        const BUCKET_LABELS: Record<string, string> = {
          current: "جارٍ (غير مستحق)", "30": "1-30 يوم", "60": "31-60 يوم", "90": "61-90 يوم", "120+": "91+ يوم",
        };
        const BUCKET_COLORS: Record<string, string> = {
          current: C.success, "30": C.accentMid, "60": C.warning, "90": C.danger, "120+": "#7B2D00",
        };

        // Outstanding invoices
        const outstanding = db.invoices.filter(i => i.status !== "paid" && (i.amountDue ?? i.total) > 0);
        type AgedRow = { id: string; name: string; amount: number; dueDate: string; days: number; bucket: string };
        const arRows: AgedRow[] = outstanding.map(i => ({
          id: i.id, name: i.customerName, amount: i.amountDue ?? i.total,
          dueDate: i.dueDate, days: daysDiff(i.dueDate), bucket: bucket(daysDiff(i.dueDate)),
        }));

        // Outstanding POs (unpaid)
        const outstandingPOs = db.purchaseOrders.filter(p => p.amountDue > 0);
        const apRows: AgedRow[] = outstandingPOs.map(p => ({
          id: p.id, name: p.supplierName, amount: p.amountDue,
          dueDate: p.date, days: daysDiff(p.date), bucket: bucket(daysDiff(p.date)),
        }));

        const bucketTotals = (rows: AgedRow[]) =>
          BUCKETS.reduce((acc, b) => {
            acc[b] = rows.filter(r => r.bucket === b).reduce((s, r) => s + r.amount, 0);
            return acc;
          }, {} as Record<string, number>);

        const arTotals  = bucketTotals(arRows);
        const apTotals  = bucketTotals(apRows);
        const arGrand   = arRows.reduce((s, r) => s + r.amount, 0);
        const apGrand   = apRows.reduce((s, r) => s + r.amount, 0);

        const exportCSV = (rows: AgedRow[], type: string) => {
          const csv = [
            ["المعرف","الاسم","تاريخ الاستحقاق","الأيام","المتأخر","المبلغ"],
            ...rows.map(r => [r.id, r.name, r.dueDate, r.days, BUCKET_LABELS[r.bucket], r.amount]),
          ].map(r => r.join(",")).join("\n");
          const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
          const url  = URL.createObjectURL(blob);
          const a    = document.createElement("a"); a.href = url;
          a.download = `aged-${type}.csv`; a.click(); URL.revokeObjectURL(url);
        };

        const SummaryBar = ({ totals, grand }: { totals: Record<string, number>; grand: number }) => (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {BUCKETS.map(b => (
              <div key={b} style={{ flex: 1, minWidth: 100, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", borderTop: `3px solid ${BUCKET_COLORS[b]}` }}>
                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>{BUCKET_LABELS[b]}</div>
                <div style={{ fontWeight: 800, color: BUCKET_COLORS[b], fontSize: 14 }}>{fmt(totals[b] ?? 0)}</div>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>
                  {grand > 0 ? `${((totals[b] ?? 0) / grand * 100).toFixed(1)}%` : "—"}
                </div>
              </div>
            ))}
          </div>
        );

        return (
          <div>
            {/* AR Section */}
            <div style={{ ...S.card, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>📅 تقادم الذمم المدينة (AR)</div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>إجمالي المستحق: <strong style={{ color: C.warning }}>{fmt(arGrand)}</strong></div>
                </div>
                <button style={{ ...S.btn("outline"), fontSize: 11, padding: "5px 10px" }} onClick={() => exportCSV(arRows, "ar")}>⬇️ CSV</button>
              </div>
              <SummaryBar totals={arTotals} grand={arGrand} />
              {arRows.length === 0 ? (
                <div style={{ textAlign: "center", color: C.textMuted, padding: 24 }}>لا توجد فواتير مستحقة</div>
              ) : (
                <DataTable
                  headers={[{ label: "الشريحة" }, { label: "الأيام" }, { label: "المبلغ المستحق" }, { label: "تاريخ الاستحقاق" }, { label: "العميل" }, { label: "رقم الفاتورة" }]}
                  rows={arRows.sort((a, b) => b.days - a.days).map(r => [
                    <span key="b" style={{ ...S.badge("info"), background: BUCKET_COLORS[r.bucket] + "22", color: BUCKET_COLORS[r.bucket], border: `1px solid ${BUCKET_COLORS[r.bucket]}40` }}>
                      {BUCKET_LABELS[r.bucket]}
                    </span>,
                    <span key="d" style={{ color: r.days > 60 ? C.danger : r.days > 30 ? C.warning : C.textSec }}>{r.days}d</span>,
                    <span key="amt" style={{ fontWeight: 800, color: r.days > 60 ? C.danger : C.text }}>{fmt(r.amount)}</span>,
                    fmtDate(r.dueDate),
                    <span key="name" style={{ fontWeight: 700 }}>{r.name}</span>,
                    <span key="id" style={{ color: C.accent }}>{r.id}</span>,
                  ])}
                />
              )}
            </div>

            {/* AP Section */}
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>📅 تقادم الذمم الدائنة (AP)</div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>إجمالي المستحق: <strong style={{ color: C.danger }}>{fmt(apGrand)}</strong></div>
                </div>
                <button style={{ ...S.btn("outline"), fontSize: 11, padding: "5px 10px" }} onClick={() => exportCSV(apRows, "ap")}>⬇️ CSV</button>
              </div>
              <SummaryBar totals={apTotals} grand={apGrand} />
              {apRows.length === 0 ? (
                <div style={{ textAlign: "center", color: C.textMuted, padding: 24 }}>لا توجد أوامر شراء مستحقة</div>
              ) : (
                <DataTable
                  headers={[{ label: "الشريحة" }, { label: "الأيام" }, { label: "المبلغ المستحق" }, { label: "تاريخ الأمر" }, { label: "المورد" }, { label: "رقم الأمر" }]}
                  rows={apRows.sort((a, b) => b.days - a.days).map(r => [
                    <span key="b" style={{ ...S.badge("info"), background: BUCKET_COLORS[r.bucket] + "22", color: BUCKET_COLORS[r.bucket], border: `1px solid ${BUCKET_COLORS[r.bucket]}40` }}>
                      {BUCKET_LABELS[r.bucket]}
                    </span>,
                    <span key="d" style={{ color: r.days > 60 ? C.danger : r.days > 30 ? C.warning : C.textSec }}>{r.days}d</span>,
                    <span key="amt" style={{ fontWeight: 800, color: r.days > 60 ? C.danger : C.text }}>{fmt(r.amount)}</span>,
                    fmtDate(r.dueDate),
                    <span key="name" style={{ fontWeight: 700 }}>{r.name}</span>,
                    <span key="id" style={{ color: C.accent }}>{r.id}</span>,
                  ])}
                />
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Balance Sheet ── */}
      {activeReport === "bs" && (() => {
        const exportCSV = () => {
          const rows = [
            ["القسم", "الكود", "الحساب", "الرصيد"],
            ...bs.assets.map(a => ["أصول", a.code, a.name, a.balance]),
            ["", "", "إجمالي الأصول", bs.totalAssets],
            ...bs.liabilities.map(a => ["خصوم", a.code, a.name, a.balance]),
            ["", "", "إجمالي الخصوم", bs.totalLiabilities],
            ...bs.equity.map(a => ["حقوق ملكية", a.code, a.name, a.balance]),
            ["", "", "إجمالي حقوق الملكية", bs.totalEquity],
            ["", "", "الخصوم + حقوق الملكية", bs.totalLiabilities + bs.totalEquity],
          ];
          const csv  = rows.map(r => r.join(",")).join("\n");
          const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
          const url  = URL.createObjectURL(blob);
          const a    = document.createElement("a"); a.href = url;
          a.download = `balance-sheet-${asOfDate || "all"}.csv`; a.click(); URL.revokeObjectURL(url);
        };

        const AccountSection = ({ title, accounts, total, color }: { title: string; accounts: typeof bs.assets; total: number; color: string }) => (
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color }}>{title}</div>
            </div>
            {accounts.length === 0 ? (
              <div style={{ color: C.textMuted, fontSize: 12, textAlign: "center", padding: 16 }}>لا توجد حسابات</div>
            ) : (
              <>
                {["current_asset","fixed_asset","current_liability","long_term_liability","equity","asset","liability","asset_group","liability_group"].map(cat => {
                  const items = accounts.filter(a => a.category === cat);
                  if (!items.length) return null;
                  const catLabel: Record<string, string> = {
                    current_asset: "أصول متداولة", fixed_asset: "أصول ثابتة",
                    current_liability: "خصوم متداولة", long_term_liability: "خصوم طويلة الأجل",
                    equity: "حقوق الملكية", asset: "أصول", liability: "خصوم",
                    asset_group: "مجموعة الأصول", liability_group: "مجموعة الخصوم",
                  };
                  return (
                    <div key={cat} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, padding: "4px 0", borderBottom: `1px solid ${C.border}`, marginBottom: 4 }}>
                        {catLabel[cat] || cat}
                      </div>
                      {items.map(a => (
                        <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 8px", fontSize: 12, borderRadius: 4 }}>
                          <span style={{ color, fontWeight: (a.balance || 0) !== 0 ? 700 : 400 }}>{fmt(a.balance || 0)}</span>
                          <span style={{ color: C.textSec }}><span style={{ color: C.textMuted, fontSize: 10, marginLeft: 6 }}>{a.code}</span> {a.name}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 8px", borderTop: `2px solid ${C.borderDark}`, fontWeight: 800, marginTop: 4 }}>
                  <span style={{ color, fontSize: 14 }}>{fmt(total)}</span>
                  <span style={{ color: C.text }}>الإجمالي</span>
                </div>
              </>
            )}
          </div>
        );

        return (
          <div>
            {/* Header */}
            <div style={{ ...S.card, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ ...S.kpiCard(bs.isBalanced ? C.success : C.danger), padding: "10px 16px", minWidth: 160 }}>
                    <div style={{ fontSize: 10, color: C.textMuted }}>الأصول</div>
                    <div style={{ fontWeight: 800, color: C.success, fontSize: 16 }}>{fmt(bs.totalAssets)}</div>
                  </div>
                  <div style={{ ...S.kpiCard(C.danger), padding: "10px 16px", minWidth: 160 }}>
                    <div style={{ fontSize: 10, color: C.textMuted }}>الخصوم + حقوق الملكية</div>
                    <div style={{ fontWeight: 800, color: C.danger, fontSize: 16 }}>{fmt(bs.totalLiabilities + bs.totalEquity)}</div>
                  </div>
                  <div style={{ ...S.kpiCard(bs.isBalanced ? C.success : C.danger), padding: "10px 16px", minWidth: 140 }}>
                    <div style={{ fontSize: 10, color: C.textMuted }}>الميزانية</div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: bs.isBalanced ? C.success : C.danger }}>
                      {bs.isBalanced ? "✓ متوازنة" : "✗ غير متوازنة"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <button style={{ ...S.btn("outline"), fontSize: 11, padding: "5px 10px" }} onClick={exportCSV}>⬇️ CSV</button>
                  <div style={{ fontSize: 11, color: C.textMuted }}>حتى: {asOfDate || "اليوم"}</div>
                </div>
              </div>
            </div>

            <div style={S.grid(3)}>
              <AccountSection title="الأصول" accounts={bs.assets} total={bs.totalAssets} color={C.success} />
              <AccountSection title="الخصوم" accounts={bs.liabilities} total={bs.totalLiabilities} color={C.danger} />
              <AccountSection title="حقوق الملكية" accounts={bs.equity} total={bs.totalEquity} color={C.purple} />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
