"use client";

import { useState, useMemo } from "react";
import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { DB } from "@/lib/db/database";
import { AccountingEngine } from "@/lib/engine/accounting";
import { fmt, fmtDate } from "@/lib/engine/helpers";
import { KPI } from "@/components/ui/KPI";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { BarChart, DonutChart, Sparkline } from "@/components/ui/MiniChart";

interface Props { addToast: (msg: string, type?: "success" | "error" | "info") => void; }

// Generate last N months as "YYYY-MM" strings
function lastNMonths(n: number): string[] {
  const months: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    months.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

function shortMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const date = new Date(+y, +m - 1, 1);
  return date.toLocaleString("ar-SA", { month: "short" });
}

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

  // ── Monthly revenue / expenses for charts ─────────────────────────────
  const months = useMemo(() => lastNMonths(6), []);

  const monthlyRevenue = useMemo(() => {
    return months.map(m => ({
      label: shortMonth(m),
      value: db.invoices
        .filter(i => i.date.startsWith(m))
        .reduce((s, i) => s + (i.total || 0), 0),
    }));
  }, [months, db.invoices]);

  const monthlyExpenses = useMemo(() => {
    return months.map(m => ({
      label: shortMonth(m),
      value: db.purchaseOrders
        .filter(p => p.date.startsWith(m))
        .reduce((s, p) => s + (p.total || 0), 0),
      color: C.danger,
    }));
  }, [months, db.purchaseOrders]);

  // ── Revenue sparkline (trailing 6 months) ─────────────────────────────
  const revSparkline = monthlyRevenue.map(m => m.value);

  // ── Expense breakdown donut ────────────────────────────────────────────
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    db.journalEntries.forEach(je => {
      if (je.status !== "posted") return;
      je.lines.forEach(line => {
        const acct = db.accounts.find(a => a.id === line.accountId);
        if (acct?.type === "expense" && line.debit > 0) {
          map[acct.name] = (map[acct.name] || 0) + line.debit;
        }
      });
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, value], i) => ({
        label,
        value,
        color: [C.danger, C.warning, C.gold, C.purple][i] || C.textMuted,
      }));
  }, [db.journalEntries, db.accounts]);

  // ── Top customers by revenue ──────────────────────────────────────────
  const topCustomers = useMemo(() => {
    const map: Record<string, { name: string; total: number; count: number }> = {};
    db.invoices.forEach(inv => {
      if (!map[inv.customerId]) map[inv.customerId] = { name: inv.customerName, total: 0, count: 0 };
      map[inv.customerId].total += inv.total || 0;
      map[inv.customerId].count++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [db.invoices]);

  // ── Pending approvals ─────────────────────────────────────────────────
  const pendingApprovals = db.invoices.filter(i => i.approvalStatus === "pending").length;

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

  const currency = db.settings.baseCurrency || "SAR";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div style={S.pageTitle}>{t("dashboard")}</div>
        <div style={{ fontSize: 12, color: C.textMuted }}>{fmtDate(new Date().toISOString())}</div>
      </div>

      {/* Alerts row */}
      {(pendingApprovals > 0 || lowStock.length > 0) && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          {pendingApprovals > 0 && (
            <div style={{ background: "#FFF8E1", border: `1px solid ${C.warning}40`, borderRadius: 8, padding: "7px 14px", fontSize: 12, color: C.warning, fontWeight: 700 }}>
              ⏳ {pendingApprovals} فاتورة بانتظار الموافقة
            </div>
          )}
          {lowStock.length > 0 && (
            <div style={{ background: C.dangerLight, border: `1px solid ${C.danger}40`, borderRadius: 8, padding: "7px 14px", fontSize: 12, color: C.danger, fontWeight: 700 }}>
              📦 {lowStock.length} منتج يحتاج إعادة تخزين
            </div>
          )}
        </div>
      )}

      {/* KPIs row 1 */}
      <div style={S.grid(4)}>
        <KPIWithSparkline label={t("totalRevenue")}  value={fmt(is.netRevenue)}  color={C.success}   icon="📈" sparkline={revSparkline} />
        <KPI             label={t("netIncome")}     value={fmt(is.netIncome)}   color={is.netIncome >= 0 ? C.accentMid : C.danger} icon="💰" />
        <KPI             label={t("totalAssets")}   value={fmt(bs.totalAssets)} color={C.purple}    icon="🏦" />
        <KPI             label={t("cashBalance")}   value={fmt(totalCash)}      color={C.gold}      icon="💵" />
      </div>

      {/* KPIs row 2 */}
      <div style={S.grid(4)}>
        <KPI label={t("accountsReceivable")} value={fmt(outAR)}         color={C.accentMid} icon="→" />
        <KPI label={t("accountsPayable")}    value={fmt(outAP)}         color={C.danger}    icon="←" />
        <KPI label={t("inventoryValue")}     value={fmt(totalInvValue)} color={C.warning}   icon="📦" />
        <KPI label={t("cogs")}               value={fmt(is.cogs)}       color={C.textMuted} icon="⚙️" />
      </div>

      {/* Charts row */}
      <div style={S.grid(2)}>
        {/* Monthly Revenue Bar Chart */}
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={S.sectionTitle}>📊 الإيرادات الشهرية</div>
            <span style={{ fontSize: 11, color: C.textMuted }}>آخر 6 أشهر</span>
          </div>
          {monthlyRevenue.every(m => m.value === 0) ? (
            <EmptyState icon="📊" title="لا توجد بيانات بعد" />
          ) : (
            <BarChart
              data={monthlyRevenue}
              height={110}
              color={C.accent}
              formatValue={v => v > 0 ? `${(v / 1000).toFixed(0)}K` : ""}
            />
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 11, color: C.textMuted }}>
            <span>الإجمالي: <strong style={{ color: C.text }}>{fmt(monthlyRevenue.reduce((s, m) => s + m.value, 0))}</strong></span>
            <span>المتوسط: <strong style={{ color: C.text }}>{fmt(monthlyRevenue.reduce((s, m) => s + m.value, 0) / 6)}</strong></span>
          </div>
        </div>

        {/* Revenue vs Expenses comparison */}
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={S.sectionTitle}>📉 الإيرادات مقابل المشتريات</div>
            <span style={{ fontSize: 11, color: C.textMuted }}>آخر 6 أشهر</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: C.accent, display: "inline-block" }} />
              إيرادات
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: C.danger, display: "inline-block" }} />
              مشتريات
            </span>
          </div>
          <ComparisonBars rev={monthlyRevenue} exp={monthlyExpenses} />
        </div>
      </div>

      {/* Bottom row */}
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
                <span style={{ color: color as string, fontWeight: label === t("netIncome") ? 800 : 400 }}>{fmt(val as number)}</span>
                <span style={{ color: C.textSec }}>{label as string}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Customers */}
        <div style={S.card}>
          <div style={S.sectionTitle}>🏆 أفضل العملاء</div>
          <div style={{ marginTop: 16 }}>
            {topCustomers.length === 0 ? (
              <EmptyState icon="👥" title="لا توجد بيانات" />
            ) : (
              topCustomers.map((c, i) => {
                const pct = is.netRevenue > 0 ? Math.round((c.total / is.netRevenue) * 100) : 0;
                return (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: C.textSec, fontSize: 11 }}>{c.count} فاتورة</span>
                      <span style={{ fontWeight: 700, color: C.text }}>{c.name}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 5, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: C.accent, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 11, color: C.textSec, minWidth: 60, textAlign: "left" }}>{fmt(c.total)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Invoices + Low Stock */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={S.card}>
            <div style={S.sectionTitle}>{t("recentInvoices")}</div>
            <div style={{ marginTop: 12 }}>
              {db.invoices.length === 0 ? (
                <EmptyState icon="🧾" title={t("noInvoicesYet")} />
              ) : (
                db.invoices.slice(0, 4).map((inv) => (
                  <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
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

          {lowStock.length > 0 && (
            <div style={{ ...S.card, border: `1px solid ${C.danger}30` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ ...S.badge("danger") as any }}>{lowStock.length}</span>
                <div style={{ ...S.sectionTitle, color: C.danger }}>{t("lowStockAlerts")}</div>
              </div>
              {lowStock.slice(0, 3).map((p) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                  <span style={{ color: C.danger, fontWeight: 700 }}>{p.qty || 0} {p.unit || t("pcs")}</span>
                  <span style={{ color: C.text }}>{p.name}</span>
                </div>
              ))}
              {lowStock.length > 3 && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6, textAlign: "center" }}>+{lowStock.length - 3} منتجات أخرى</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── KPI card with sparkline ───────────────────────────────────────────────
function KPIWithSparkline({ label, value, color, icon, sparkline }: {
  label: string; value: string; color: string; icon: string; sparkline: number[];
}) {
  return (
    <div style={{ ...S.kpiCard(color), position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", bottom: 4, left: 0, right: 0, opacity: 0.5 }}>
        <Sparkline data={sparkline} width={200} height={28} color={color} />
      </div>
      <div style={{ position: "relative" }}>
        <div style={S.kpiIcon}>{icon}</div>
        <div style={S.kpiValue}>{value}</div>
        <div style={S.kpiLabel}>{label}</div>
      </div>
    </div>
  );
}

// ── Side-by-side revenue vs expenses mini bars ────────────────────────────
function ComparisonBars({ rev, exp }: { rev: { label: string; value: number }[]; exp: { label: string; value: number }[] }) {
  const allValues = [...rev.map(d => d.value), ...exp.map(d => d.value)];
  const max = Math.max(...allValues, 1);
  const h = 90;

  return (
    <svg viewBox={`0 0 ${rev.length * 50} ${h + 24}`} style={{ width: "100%", height: h + 24 }}>
      {rev.map((r, i) => {
        const e       = exp[i] ?? { value: 0 };
        const rH      = Math.max(2, (r.value / max) * h);
        const eH      = Math.max(2, (e.value / max) * h);
        const baseX   = i * 50 + 2;
        return (
          <g key={i}>
            <rect x={baseX}      y={h - rH} width={20} height={rH} rx={2} fill={C.accent}  opacity={0.8} />
            <rect x={baseX + 22} y={h - eH} width={20} height={eH} rx={2} fill={C.danger}  opacity={0.7} />
            <text x={baseX + 22} y={h + 14} textAnchor="middle" fontSize={9} fill={C.textMuted}>{r.label}</text>
          </g>
        );
      })}
      <line x1={0} y1={h} x2={rev.length * 50} y2={h} stroke={C.border} strokeWidth={1} />
    </svg>
  );
}
