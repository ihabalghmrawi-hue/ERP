"use client";

import { useState } from "react";
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
  const is  = AccountingEngine.getIncomeStatement();
  const bs  = AccountingEngine.getBalanceSheet();
  const inv = AccountingEngine.getInventoryValuation();
  const [activeReport, setActiveReport] = useState<"sales" | "inventory" | "pl" | "ar" | "ap">("sales");

  const totalInvValue     = inv.reduce((s, p) => s + p.value, 0);
  const totalSalesRevenue = db.invoices.reduce((s, i) => s + i.total, 0);
  const totalPurchases    = db.purchaseOrders.reduce((s, p) => s + p.total, 0);

  const REPORT_TABS = [
    { id: "sales"     as const, label: t("salesPerformance") },
    { id: "inventory" as const, label: t("inventoryValuation") },
    { id: "pl"        as const, label: t("plSummary") },
    { id: "ar"        as const, label: t("accountsReceivable") },
    { id: "ap"        as const, label: t("accountsPayable") },
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
            <div style={{ display: "flex", gap: 16 }}>
              <span style={{ fontSize: 13, color: C.success, fontWeight: 700 }}>
                {t("amountPaid")}: {fmt(db.invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0))}
              </span>
              <span style={{ fontSize: 13, color: C.warning, fontWeight: 700 }}>
                {t("outstanding")}: {fmt(db.invoices.filter((i) => i.status === "outstanding").reduce((s, i) => s + i.total, 0))}
              </span>
            </div>
            <div style={S.sectionTitle}>{t("salesPerformance")}</div>
          </div>
          {db.invoices.length === 0 ? (
            <EmptyState icon="📊" title={t("noInvoicesYet")} />
          ) : (
            <DataTable
              headers={[
                { label: t("status") }, { label: t("total") }, { label: t("type") },
                { label: t("customer") }, { label: t("dueDate") }, { label: t("date") }, { label: t("invoiceNo") },
              ]}
              rows={db.invoices.map((inv) => [
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
                  { label: t("category") }, { label: t("productName") }, { label: t("sku") },
                ]}
                rows={inv.map((p) => [
                  <span key="mg" style={{ color: C.success, fontWeight: 700 }}>{p.margin}%</span>,
                  <span key="val" style={{ fontWeight: 800, color: C.accentMid }}>{fmt(p.value)}</span>,
                  `${p.qty || 0} ${p.unit || ""}`,
                  fmt(p.sellPrice),
                  fmt(p.unitCost),
                  p.category || "—",
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
      {activeReport === "ar" && (
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.warning }}>
              {t("totalAR")}: {fmt(db.customers.reduce((s, c) => s + (c.balance || 0), 0))}
            </span>
            <div style={S.sectionTitle}>{t("accountsReceivable")}</div>
          </div>
          {db.customers.length === 0 ? (
            <EmptyState icon="👥" title={t("noCustomersYet")} />
          ) : (
            <DataTable
              headers={[
                { label: t("status") }, { label: t("balance") }, { label: t("creditLimit") },
                { label: t("phone") }, { label: t("email") }, { label: t("customer") },
              ]}
              rows={db.customers.map((c) => [
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
            <span style={{ fontSize: 13, fontWeight: 700, color: C.danger }}>
              {t("totalAP")}: {fmt(db.suppliers.reduce((s, su) => s + (su.balance || 0), 0))}
            </span>
            <div style={S.sectionTitle}>{t("accountsPayable")}</div>
          </div>
          {db.suppliers.length === 0 ? (
            <EmptyState icon="🏢" title={t("noSuppliersYet")} />
          ) : (
            <DataTable
              headers={[
                { label: t("status") }, { label: t("outstanding") }, { label: t("terms") },
                { label: t("phone") }, { label: t("email") }, { label: t("supplier") },
              ]}
              rows={db.suppliers.map((s) => [
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
    </div>
  );
}
