"use client";

import { useState, useMemo, useCallback } from "react";
import { S, C } from "@/lib/engine/design";
import { DB, Account } from "@/lib/db/database";
import { AccountingEngine } from "@/lib/engine/accounting";
import { fmt } from "@/lib/engine/helpers";

// ─── Types ────────────────────────────────────────────────────────────────────
type StatementTab = "trial_balance" | "income_statement" | "balance_sheet";

interface AccountRow {
  account: Account;
  debit: number;
  credit: number;
  balance: number; // debit-positive for assets/expenses, credit-positive for liab/equity/rev
}

interface Section {
  title: string;
  accounts: AccountRow[];
  total: number;
  color: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function money(n: number, abs = false) {
  const v = abs ? Math.abs(n) : n;
  return v === 0 ? "—" : fmt(v);
}

function today() { return new Date().toISOString().slice(0, 10); }
function monthStart(dateStr: string) { return dateStr.slice(0, 7) + "-01"; }
function prevMonth(dateStr: string) {
  const d = new Date(dateStr.slice(0, 7) + "-01");
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
}

// ─── Print helper ─────────────────────────────────────────────────────────────
const PRINT_CSS = `
@media print {
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .no-print { display: none !important; }
  body { font-size: 11px; }
  @page { margin: 14mm; }
}
`;

// ─── Section block (collapsible) ──────────────────────────────────────────────
function SectionBlock({
  title, accounts, total, color, currency, collapsed, onToggle,
}: {
  title: string; accounts: AccountRow[]; total: number; color: string;
  currency: string; collapsed: boolean; onToggle: () => void;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      {/* Section header */}
      <div
        onClick={onToggle}
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: color + "18", borderRadius: 8, padding: "10px 14px",
          cursor: "pointer", userSelect: "none", marginBottom: 4,
          border: `1px solid ${color}40`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color, fontWeight: 700, transform: collapsed ? "rotate(-90deg)" : "none", display: "inline-block", transition: "transform 0.2s" }}>▼</span>
          <span style={{ fontWeight: 800, fontSize: 14, color }}>{title}</span>
          <span style={{ fontSize: 11, color: C.textMuted }}>({accounts.length} حساب)</span>
        </div>
        <span style={{ fontWeight: 900, fontSize: 15, color }}>
          {money(Math.abs(total))} {currency}
        </span>
      </div>

      {/* Rows */}
      {!collapsed && accounts.map((row) => (
        <div key={row.account.id} style={{
          display: "flex", justifyContent: "space-between", padding: "7px 14px",
          borderBottom: `1px solid ${C.border}`, fontSize: 13,
          background: C.surface,
        }}>
          <div>
            <span style={{ color: C.textMuted, fontSize: 11, marginLeft: 8 }}>{row.account.code}</span>
            <span style={{ color: C.text }}>{row.account.name}</span>
          </div>
          <span style={{ fontWeight: 600, color: row.balance === 0 ? C.textMuted : C.text }}>
            {money(Math.abs(row.balance))} {currency}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Trial Balance ─────────────────────────────────────────────────────────────
function TrialBalance({ currency }: { currency: string }) {
  const db = DB.get();
  const [asOf, setAsOf] = useState(today());
  const [hideZero, setHideZero] = useState(true);
  const [hideReversed, setHideReversed] = useState(true);

  const rows = useMemo((): AccountRow[] => {
    const balances = AccountingEngine._computePeriodBalances(undefined, asOf);
    return db.accounts
      .filter((a) => a.category !== "asset_group" && a.category !== "liability_group")
      .map((a) => {
        const raw = balances[a.id] || 0;
        // debit-normal: asset, expense, cogs, contra_asset
        const isDebitNormal = ["asset", "expense", "cogs", "contra_asset"].includes(a.type);
        const debit  = raw > 0 ? raw : 0;
        const credit = raw < 0 ? -raw : 0;
        const balance = isDebitNormal ? raw : -raw;
        return { account: a, debit, credit, balance };
      })
      .filter((r) => !hideZero || r.debit !== 0 || r.credit !== 0);
  }, [db.accounts, asOf, hideZero]);

  // TE totals
  const totalDebit  = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div>
      <style>{PRINT_CSS}</style>

      {/* Controls */}
      <div className="no-print" style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <div>
          <label style={S.label}>بتاريخ</label>
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} style={{ ...S.input, width: 160 }} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", marginTop: 18 }}>
          <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} />
          إخفاء الأصفار
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", marginTop: 18 }}>
          <input type="checkbox" checked={hideReversed} onChange={(e) => setHideReversed(e.target.checked)} />
          إخفاء المعكوسة
        </label>
        <button
          className="no-print"
          style={{ ...S.btn("outline"), marginTop: 18 }}
          onClick={() => window.print()}
        >
          🖨️ طباعة
        </button>
        <div style={{ marginInlineStart: "auto", marginTop: 18 }}>
          {balanced
            ? <span style={S.badge("success")}>✓ متوازن</span>
            : <span style={S.badge("danger")}>غير متوازن — فرق: {money(Math.abs(totalDebit - totalCredit))}</span>}
        </div>
      </div>

      {/* Table */}
      <div style={{ ...S.card, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "40px 120px 1fr 140px 140px 140px", padding: "10px 14px", background: C.surfaceAlt, fontSize: 12, fontWeight: 700, color: C.textMuted }}>
          <span>#</span>
          <span>الكود</span>
          <span>اسم الحساب</span>
          <span style={{ textAlign: "left" }}>مدين</span>
          <span style={{ textAlign: "left" }}>دائن</span>
          <span style={{ textAlign: "left" }}>الرصيد</span>
        </div>

        {rows.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>لا توجد قيود في هذه الفترة</div>
        )}

        {rows.map((row, i) => (
          <div key={row.account.id} style={{
            display: "grid", gridTemplateColumns: "40px 120px 1fr 140px 140px 140px",
            padding: "9px 14px", borderBottom: `1px solid ${C.border}`,
            background: i % 2 === 0 ? C.surface : C.bg,
            fontSize: 13,
          }}>
            <span style={{ color: C.textMuted, fontSize: 11 }}>{i + 1}</span>
            <span style={{ color: C.textMuted, fontSize: 12 }}>{row.account.code}</span>
            <span style={{ fontWeight: 500 }}>{row.account.name}</span>
            <span style={{ textAlign: "left", color: row.debit > 0 ? C.text : C.textMuted }}>
              {row.debit > 0 ? money(row.debit) : "—"}
            </span>
            <span style={{ textAlign: "left", color: row.credit > 0 ? C.text : C.textMuted }}>
              {row.credit > 0 ? money(row.credit) : "—"}
            </span>
            <span style={{ textAlign: "left", fontWeight: 700, color: row.balance > 0 ? C.success : row.balance < 0 ? C.danger : C.textMuted }}>
              {row.balance !== 0 ? money(Math.abs(row.balance)) : "—"}
            </span>
          </div>
        ))}

        {/* Totals row */}
        <div style={{
          display: "grid", gridTemplateColumns: "40px 120px 1fr 140px 140px 140px",
          padding: "12px 14px", background: C.surfaceAlt,
          fontWeight: 900, fontSize: 14, borderTop: `2px solid ${C.border}`,
        }}>
          <span /><span /><span style={{ color: C.text }}>الإجمالي</span>
          <span style={{ textAlign: "left", color: C.accent }}>{money(totalDebit)}</span>
          <span style={{ textAlign: "left", color: C.accent }}>{money(totalCredit)}</span>
          <span style={{ textAlign: "left", color: balanced ? C.success : C.danger }}>
            {balanced ? "✓ متوازن" : money(Math.abs(totalDebit - totalCredit))}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Income Statement ──────────────────────────────────────────────────────────
function IncomeStatement({ currency }: { currency: string }) {
  const db = DB.get();
  const currentMonth = today().slice(0, 7);
  const [month, setMonth]       = useState(currentMonth);
  const [compare, setCompare]   = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = useCallback((key: string) =>
    setCollapsed((c) => ({ ...c, [key]: !c[key] })), []);

  const computeForPeriod = useCallback((m: string) => {
    const start = m + "-01";
    const endD  = new Date(parseInt(m.slice(0, 4)), parseInt(m.slice(5, 7)), 0);
    const end   = endD.toISOString().slice(0, 10);
    const balances = AccountingEngine._computePeriodBalances(start, end);

    const byType = (types: string[]) =>
      db.accounts
        .filter((a) => types.includes(a.type) && a.category !== "asset_group" && a.category !== "liability_group")
        .map((a) => ({ account: a, balance: Math.abs(balances[a.id] || 0), raw: balances[a.id] || 0 }))
        .filter((r) => r.balance > 0.005);

    const revenues  = byType(["revenue"]);
    const cogs      = byType(["cogs"]);
    const expenses  = byType(["expense"]);
    const totalRev  = revenues.reduce((s, r) => s + r.balance, 0);
    const totalCogs = cogs.reduce((s, r) => s + r.balance, 0);
    const totalExp  = expenses.reduce((s, r) => s + r.balance, 0);
    const grossProfit = totalRev - totalCogs;
    const netProfit   = grossProfit - totalExp;
    return { revenues, cogs, expenses, totalRev, totalCogs, totalExp, grossProfit, netProfit };
  }, [db.accounts]);

  const current = useMemo(() => computeForPeriod(month), [computeForPeriod, month]);
  const prev    = useMemo(() => compare ? computeForPeriod(prevMonth(month)) : null, [compare, computeForPeriod, month]);

  const monthLabel = (m: string) =>
    new Date(m + "-01").toLocaleDateString("ar-SA", { year: "numeric", month: "long" });

  const NetRow = ({ label, value, prev: prevVal, bold, color }: { label: string; value: number; prev?: number | null; bold?: boolean; color?: string }) => {
    const diff = prevVal != null ? value - prevVal : null;
    return (
      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderTop: `2px solid ${C.border}`, background: C.surfaceAlt, alignItems: "center" }}>
        <span style={{ fontWeight: bold ? 900 : 700, fontSize: bold ? 15 : 13, color: color || C.text }}>{label}</span>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          {prev && <span style={{ fontSize: 12, color: C.textMuted }}>{money(Math.abs(prevVal || 0))} {currency}</span>}
          <span style={{ fontWeight: bold ? 900 : 700, fontSize: bold ? 15 : 13, color: color || (value >= 0 ? C.success : C.danger) }}>
            {money(Math.abs(value))} {currency}
          </span>
          {diff != null && (
            <span style={{ fontSize: 11, color: diff >= 0 ? C.success : C.danger }}>
              {diff >= 0 ? "▲" : "▼"} {money(Math.abs(diff))}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <style>{PRINT_CSS}</style>

      {/* Controls */}
      <div className="no-print" style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <label style={S.label}>الشهر</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ ...S.input, width: 160 }} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", marginBottom: 4 }}>
          <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
          مقارنة مع الشهر السابق ({monthLabel(prevMonth(month))})
        </label>
        <button style={{ ...S.btn("outline"), marginBottom: 4 }} onClick={() => window.print()}>🖨️ طباعة</button>
      </div>

      {/* Revenues */}
      <SectionBlock
        title="الإيرادات"
        color={C.success}
        accounts={current.revenues.map((r) => ({ account: r.account, debit: 0, credit: r.balance, balance: r.balance }))}
        total={current.totalRev}
        currency={currency}
        collapsed={!!collapsed["rev"]}
        onToggle={() => toggle("rev")}
      />
      <NetRow label="إجمالي الإيرادات" value={current.totalRev} prev={prev?.totalRev} bold color={C.success} />

      <div style={{ marginBottom: 16 }} />

      {/* COGS */}
      <SectionBlock
        title="تكلفة البضاعة المباعة"
        color={C.warning}
        accounts={current.cogs.map((r) => ({ account: r.account, debit: r.balance, credit: 0, balance: r.balance }))}
        total={current.totalCogs}
        currency={currency}
        collapsed={!!collapsed["cogs"]}
        onToggle={() => toggle("cogs")}
      />
      <NetRow label="إجمالي التكلفة" value={current.totalCogs} prev={prev?.totalCogs} color={C.warning} />

      <div style={{ marginBottom: 8 }} />
      <NetRow label="مجمل الربح" value={current.grossProfit} prev={prev?.grossProfit} bold color={current.grossProfit >= 0 ? C.success : C.danger} />
      <div style={{ marginBottom: 16 }} />

      {/* Expenses */}
      <SectionBlock
        title="المصروفات التشغيلية"
        color={C.danger}
        accounts={current.expenses.map((r) => ({ account: r.account, debit: r.balance, credit: 0, balance: r.balance }))}
        total={current.totalExp}
        currency={currency}
        collapsed={!!collapsed["exp"]}
        onToggle={() => toggle("exp")}
      />
      <NetRow label="إجمالي المصروفات" value={current.totalExp} prev={prev?.totalExp} color={C.danger} />

      <div style={{ marginBottom: 8 }} />

      {/* Net profit */}
      <div style={{
        background: current.netProfit >= 0 ? C.successLight : C.dangerLight,
        border: `2px solid ${current.netProfit >= 0 ? C.success : C.danger}`,
        borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontWeight: 900, fontSize: 16, color: current.netProfit >= 0 ? C.success : C.danger }}>
          {current.netProfit >= 0 ? "✅ صافي الربح" : "❌ صافي الخسارة"}
        </span>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          {prev && (
            <span style={{ fontSize: 12, color: C.textMuted }}>
              السابق: {money(Math.abs(prev.netProfit))} {currency}
            </span>
          )}
          <span style={{ fontWeight: 900, fontSize: 20, color: current.netProfit >= 0 ? C.success : C.danger }}>
            {money(Math.abs(current.netProfit))} {currency}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Balance Sheet ─────────────────────────────────────────────────────────────
function BalanceSheet({ currency }: { currency: string }) {
  const db = DB.get();
  const [asOf, setAsOf]         = useState(today());
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = useCallback((key: string) =>
    setCollapsed((c) => ({ ...c, [key]: !c[key] })), []);

  const sections = useMemo(() => {
    const balances = AccountingEngine._computePeriodBalances(undefined, asOf);

    const buildSection = (types: string[], title: string, color: string): Section => {
      const accounts = db.accounts
        .filter((a) => types.includes(a.type) && a.category !== "asset_group" && a.category !== "liability_group")
        .map((a) => {
          const raw = balances[a.id] || 0;
          return { account: a, debit: raw > 0 ? raw : 0, credit: raw < 0 ? -raw : 0, balance: Math.abs(raw) };
        })
        .filter((r) => r.balance > 0.005);
      const total = accounts.reduce((s, r) => s + r.balance, 0);
      return { title, accounts, total, color };
    };

    const assets      = buildSection(["asset", "contra_asset"],   "الأصول",            C.accent);
    const liabilities = buildSection(["liability", "contra_revenue"], "الخصوم",          C.danger);
    const equity      = buildSection(["equity"],                   "حقوق الملكية",       C.purple);

    // Net income (revenues - expenses - cogs) feeds into equity
    const getTypeTotal = (types: string[]) => db.accounts
      .filter((a) => types.includes(a.type))
      .reduce((s, a) => s + Math.abs(balances[a.id] || 0), 0);
    const netIncome = getTypeTotal(["revenue"]) - getTypeTotal(["expense", "cogs"]);

    const totalAssets = assets.total;
    const totalLiabEquity = liabilities.total + equity.total + netIncome;
    const balanced = Math.abs(totalAssets - totalLiabEquity) < 1;

    return { assets, liabilities, equity, netIncome, totalAssets, totalLiabEquity, balanced };
  }, [db.accounts, asOf]);

  return (
    <div>
      <style>{PRINT_CSS}</style>

      {/* Controls */}
      <div className="no-print" style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <label style={S.label}>بتاريخ</label>
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} style={{ ...S.input, width: 160 }} />
        </div>
        <button style={{ ...S.btn("outline"), marginBottom: 4 }} onClick={() => window.print()}>🖨️ طباعة</button>
        <div style={{ marginInlineStart: "auto", marginBottom: 4 }}>
          {sections.balanced
            ? <span style={S.badge("success")}>✓ أصول = خصوم + حقوق ملكية</span>
            : <span style={S.badge("warning")}>⚠️ فرق: {money(Math.abs(sections.totalAssets - sections.totalLiabEquity))}</span>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* LEFT: Assets */}
        <div>
          <div style={{ fontWeight: 900, fontSize: 16, color: C.accent, marginBottom: 10, padding: "8px 14px", background: C.accentLight, borderRadius: 8 }}>
            الأصول
          </div>
          <SectionBlock
            title="الأصول المتداولة وغيرها"
            color={C.accent}
            accounts={sections.assets.accounts}
            total={sections.assets.total}
            currency={currency}
            collapsed={!!collapsed["assets"]}
            onToggle={() => toggle("assets")}
          />
          <div style={{ background: C.accentLight, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 14 }}>
            <span style={{ color: C.accent }}>إجمالي الأصول</span>
            <span style={{ color: C.accent }}>{money(sections.totalAssets)} {currency}</span>
          </div>
        </div>

        {/* RIGHT: Liabilities + Equity */}
        <div>
          <div style={{ fontWeight: 900, fontSize: 16, color: C.danger, marginBottom: 10, padding: "8px 14px", background: C.dangerLight, borderRadius: 8 }}>
            الخصوم وحقوق الملكية
          </div>
          <SectionBlock
            title="الخصوم"
            color={C.danger}
            accounts={sections.liabilities.accounts}
            total={sections.liabilities.total}
            currency={currency}
            collapsed={!!collapsed["liab"]}
            onToggle={() => toggle("liab")}
          />
          <SectionBlock
            title="حقوق الملكية"
            color={C.purple}
            accounts={sections.equity.accounts}
            total={sections.equity.total}
            currency={currency}
            collapsed={!!collapsed["equity"]}
            onToggle={() => toggle("equity")}
          />
          {/* Retained earnings from P&L */}
          {Math.abs(sections.netIncome) > 0.005 && (
            <div style={{ padding: "9px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 13, display: "flex", justifyContent: "space-between", background: sections.netIncome >= 0 ? C.successLight : C.dangerLight }}>
              <span>{sections.netIncome >= 0 ? "صافي الربح المرحل" : "صافي الخسارة المرحلة"}</span>
              <span style={{ fontWeight: 700, color: sections.netIncome >= 0 ? C.success : C.danger }}>
                {money(Math.abs(sections.netIncome))} {currency}
              </span>
            </div>
          )}
          <div style={{ background: C.dangerLight, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 14, marginTop: 4 }}>
            <span style={{ color: C.danger }}>إجمالي الخصوم + الملكية</span>
            <span style={{ color: sections.balanced ? C.success : C.danger }}>
              {money(sections.totalLiabEquity)} {currency}
            </span>
          </div>
        </div>
      </div>

      {/* Validation banner */}
      <div style={{
        marginTop: 20, padding: "14px 20px", borderRadius: 10, textAlign: "center",
        background: sections.balanced ? C.successLight : "#FFF3CD",
        border: `1px solid ${sections.balanced ? C.success : C.warning}`,
        fontWeight: 700, fontSize: 14,
        color: sections.balanced ? C.success : C.warning,
      }}>
        {sections.balanced
          ? `✅ الميزانية متوازنة — الأصول = الخصوم + حقوق الملكية = ${money(sections.totalAssets)} ${currency}`
          : `⚠️ الميزانية غير متوازنة — فرق: ${money(Math.abs(sections.totalAssets - sections.totalLiabEquity))} ${currency}`}
      </div>
    </div>
  );
}

// ─── Main Module ──────────────────────────────────────────────────────────────
export function FinancialStatements() {
  const db = DB.get();
  const currency = db.settings.baseCurrency || "SAR";
  const [tab, setTab] = useState<StatementTab>("trial_balance");

  const tabBtn = (id: StatementTab, label: string): React.ReactElement => (
    <button
      onClick={() => setTab(id)}
      style={{
        padding: "8px 22px", borderRadius: 8, border: "none", cursor: "pointer",
        fontWeight: tab === id ? 700 : 500,
        background: tab === id ? C.accent : "transparent",
        color: tab === id ? "#fff" : C.textMuted,
        transition: "all 0.2s",
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div style={S.pageTitle}>القوائم المالية</div>
      <div style={S.pageSub}>ميزان المراجعة — قائمة الدخل — الميزانية العمومية</div>

      {/* Tabs */}
      <div className="no-print" style={{ display: "flex", gap: 6, marginBottom: 20, background: C.surface, borderRadius: 10, padding: 6, border: `1px solid ${C.border}`, width: "fit-content" }}>
        {tabBtn("trial_balance",    "ميزان المراجعة")}
        {tabBtn("income_statement", "قائمة الدخل")}
        {tabBtn("balance_sheet",    "الميزانية العمومية")}
      </div>

      {tab === "trial_balance"    && <TrialBalance    currency={currency} />}
      {tab === "income_statement" && <IncomeStatement currency={currency} />}
      {tab === "balance_sheet"    && <BalanceSheet    currency={currency} />}
    </div>
  );
}
