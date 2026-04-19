"use client";

import { useState } from "react";
import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { DB } from "@/lib/db/database";
import { AccountingEngine } from "@/lib/engine/accounting";
import { fmt, fmtDate } from "@/lib/engine/helpers";
import { KPI } from "@/components/ui/KPI";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";

interface Props { addToast: (msg: string, type?: "success" | "error" | "info") => void; }

export function Dashboard({ addToast }: Props) {
  const { t } = useLang();
  const [, forceUpdate] = useState(0);
  const db = DB.get();
  const is  = AccountingEngine.getIncomeStatement();
  const bs  = AccountingEngine.getBalanceSheet();
  const inv = AccountingEngine.getInventoryValuation();

  const totalInvValue = inv.reduce((s, p) => s + p.value, 0);
  const outAR  = db.customers.reduce((s, c) => s + (c.balance || 0), 0);
  const outAP  = db.suppliers.reduce((s, su) => s + (su.balance || 0), 0);
  const totalCash = db.accounts
    .filter((a) => a.type === "asset" && a.category === "current_asset" && a.balance > 0)
    .reduce((s, a) => s + (a.balance || 0), 0);
  const lowStock = db.products.filter((p) => (p.qty || 0) <= (p.reorderPoint || 0));
  const isEmpty  = db.products.length === 0 && db.customers.length === 0 && db.invoices.length === 0;

  if (isEmpty) {
    return (
      <div>
        <div style={S.pageTitle}>{t("dashboard")}</div>
        <div style={S.pageSub}>{t("emptySystemMsg")}</div>
        <div style={{ ...S.card, maxWidth: 560, margin: "0 auto", padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 8 }}>{t("systemReady")}</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 28 }}>{t("emptySystemMsg")}</div>
          <div style={{ textAlign: "right", background: C.surfaceAlt, borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 12 }}>{t("quickStart")}</div>
            {[t("step1"), t("step2"), t("step3"), t("step4")].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, fontSize: 13 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: C.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                <span style={{ color: C.textSec }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={S.pageTitle}>{t("dashboard")}</div>
      <div style={S.pageSub}>{fmtDate(new Date().toISOString())}</div>

      <div style={S.grid(4)}>
        <KPI label={t("totalRevenue")}  value={fmt(is.netRevenue)}  color={C.success}   icon="📈" />
        <KPI label={t("netIncome")}     value={fmt(is.netIncome)}   color={C.accentMid} icon="💰" />
        <KPI label={t("totalAssets")}   value={fmt(bs.totalAssets)} color={C.purple}    icon="🏦" />
        <KPI label={t("cashBalance")}   value={fmt(totalCash)}      color={C.gold}      icon="💵" />
      </div>

      <div style={S.grid(4)}>
        <KPI label={t("accountsReceivable")} value={fmt(outAR)}          color={C.accentMid} icon="→" />
        <KPI label={t("accountsPayable")}    value={fmt(outAP)}          color={C.danger}    icon="←" />
        <KPI label={t("inventoryValue")}     value={fmt(totalInvValue)}  color={C.warning}   icon="📦" />
        <KPI label={t("cogs")}               value={fmt(is.cogs)}        color={C.textMuted} icon="⚙️" />
      </div>

      <div style={S.grid(3)}>
        {/* P&L Summary */}
        <div style={S.card}>
          <div style={S.sectionTitle}>{t("plSummaryTitle")}</div>
          <div style={{ marginTop: 16 }}>
            {[
              [t("revenue"),            is.revenue,          C.success],
              [t("salesReturns"),       -is.contraRevenue,   C.danger],
              [t("netRevenue"),         is.netRevenue,       C.text],
              [t("cogs"),               -is.cogs,            C.danger],
              [t("grossProfit"),        is.grossProfit,      C.accentMid],
              [t("operatingExpenses"),  -is.expenses,        C.warning],
              [t("netIncome"),          is.netIncome,        is.netIncome >= 0 ? C.success : C.danger],
            ].map(([label, val, color]) => (
              <div key={label as string} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                <span style={{ color: color as string }}>{fmt(val as number)}</span>
                <span style={{ color: C.textSec }}>{label as string}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Invoices */}
        <div style={S.card}>
          <div style={S.sectionTitle}>{t("recentInvoices")}</div>
          <div style={{ marginTop: 16 }}>
            {db.invoices.length === 0 ? (
              <EmptyState icon="🧾" title={t("noInvoicesYet")} />
            ) : (
              db.invoices.slice(0, 5).map((inv) => (
                <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{inv.id}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{inv.customerName}</div>
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{fmt(inv.total)}</div>
                    <StatusBadge status={inv.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {lowStock.length > 0 && <span style={S.badge("danger")}>{lowStock.length}</span>}
            <div style={S.sectionTitle}>{t("lowStockAlerts")}</div>
          </div>
          <div style={{ marginTop: 16 }}>
            {lowStock.length === 0 ? (
              <EmptyState icon="✅" title={t("allStocked")} />
            ) : (
              lowStock.map((p) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.danger }}>{p.qty || 0} {p.unit || t("pcs")}</div>
                    <div style={{ fontSize: 10, color: C.textMuted }}>{t("min")}: {p.reorderPoint}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{p.sku}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
