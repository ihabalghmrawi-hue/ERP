"use client";

import { useState } from "react";
import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { useAuth } from "@/hooks/useAuth";
import { DB, Account, JournalLine, FinancialPeriod } from "@/lib/db/database";
import { AccountingEngine, GeneralLedgerEntry } from "@/lib/engine/accounting";
import { fmt, fmtDate, uid, logActivity } from "@/lib/engine/helpers";
import { hasPermission, isPeriodLocked } from "@/lib/engine/permissions";
import { DataTable }   from "@/components/ui/DataTable";
import { Modal }       from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface Props { addToast: (msg: string, type?: "success" | "error" | "info") => void; }

type Tab = "journal" | "ledger" | "periods" | "trial" | "coa" | "pl" | "bs";

const TYPE_OPTS = [
  ["asset","asset"],["liability","liability"],["equity","equity"],
  ["revenue","revenue2"],["expense","expense"],["cogs","cogsType"],
  ["contra_revenue","contraRevenue"],["contra_asset","contraAsset"],
] as const;

const CAT_OPTS = [
  ["current_asset","currentAssetCat"],["non_current_asset","nonCurrentAssetCat"],
  ["current_liability","currentLiabilityCat"],["long_term_liability","longTermLiabilityCat"],
  ["equity","equityCat"],["revenue","revenueCat"],["cogs","cogsCat"],["expense","expenseCat"],
] as const;

export function Accounting({ addToast }: Props) {
  const { t } = useLang();
  const { user } = useAuth();
  const db = DB.get();
  const [view, setView]     = useState<Tab>("journal");
  const [showJE, setShowJE] = useState(false);
  const [showAcct, setShowAcct] = useState(false);
  const [, tick] = useState(0);
  const rerender = () => tick((x) => x + 1);

  // General Ledger state
  const [glAccountId, setGlAccountId] = useState("");
  const [glStart, setGlStart]         = useState("");
  const [glEnd, setGlEnd]             = useState("");

  // Financial periods state
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [periodForm, setPeriodForm] = useState({ name: "", startDate: "", endDate: "" });

  const [acctForm, setAcctForm] = useState({ code: "", name: "", type: "asset", category: "current_asset", parentId: "" });
  const [jeForm, setJeForm]     = useState({
    description: "", reference: "", jeDate: "", sourceType: "manual" as string,
    currency: "", exchangeRate: "1",
    lines: [{ accountId: "", debit: 0, credit: 0, description: "" }, { accountId: "", debit: 0, credit: 0, description: "" }] as { accountId: string; debit: number; credit: number; description: string }[],
  });

  const totalD    = jeForm.lines.reduce((s, l) => s + (+l.debit  || 0), 0);
  const totalC    = jeForm.lines.reduce((s, l) => s + (+l.credit || 0), 0);
  const balanced  = Math.abs(totalD - totalC) < 0.01;
  const is        = AccountingEngine.getIncomeStatement();
  const bs        = AccountingEngine.getBalanceSheet();

  const handleAddAccount = () => {
    if (!acctForm.code || !acctForm.name) { addToast(t("fillRequired"), "error"); return; }
    const acct: Account = { id: uid(), code: acctForm.code, name: acctForm.name, type: acctForm.type as any, category: acctForm.category, parentId: acctForm.parentId || undefined, balance: 0 };
    db.accounts.push(acct);
    DB.save(); rerender();
    addToast(t("accountCreated"), "success");
    setShowAcct(false);
    setAcctForm({ code: "", name: "", type: "asset", category: "current_asset", parentId: "" });
  };

  const canCreateJE = hasPermission(user, "create_accounting");

  const handlePostJE = () => {
    if (!canCreateJE) { addToast("ليس لديك صلاحية إنشاء قيود يومية.", "error"); return; }
    if (!jeForm.description) { addToast(t("fillRequired"), "error"); return; }
    if (!balanced) { addToast(t("unbalancedEntry"), "error"); return; }

    const lines: JournalLine[] = jeForm.lines
      .filter((l) => l.accountId && (+l.debit > 0 || +l.credit > 0))
      .map((l) => ({
        accountId:   l.accountId,
        accountName: db.accounts.find((a) => a.id === l.accountId)?.name || "",
        debit:   +l.debit,
        credit:  +l.credit,
        description: l.description || undefined,
      }));
    if (lines.length < 2) { addToast(t("fillRequired"), "error"); return; }

    try {
      const srcType = (jeForm.sourceType || "manual") as any;
      const je = AccountingEngine.postJE(
        jeForm.description,
        jeForm.reference,
        lines,
        srcType,
        jeForm.reference || "",
        {
          createdBy:    user?.name || "admin",
          date:         jeForm.jeDate || undefined,
          currency:     jeForm.currency || undefined,
          exchangeRate: jeForm.currency ? +jeForm.exchangeRate : undefined,
        }
      );
      rerender();
      logActivity(user?.id || "", user?.name || "", "CREATE", "Accounting", `رحّل القيد ${je.id} (${srcType})`);
      addToast(`${t("jePosted")} — ${je.id}`, "success");
      setShowJE(false);
      setJeForm({ description: "", reference: "", jeDate: "", sourceType: "manual", currency: "", exchangeRate: "1", lines: [{ accountId: "", debit: 0, credit: 0, description: "" }, { accountId: "", debit: 0, credit: 0, description: "" }] });
    } catch (e: any) { addToast(e.message, "error"); }
  };

  const handleCreatePeriod = () => {
    if (!periodForm.name || !periodForm.startDate || !periodForm.endDate) {
      addToast(t("fillRequired"), "error"); return;
    }
    if (periodForm.endDate < periodForm.startDate) {
      addToast("تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية", "error"); return;
    }
    try {
      AccountingEngine.createPeriod(periodForm.name, periodForm.startDate, periodForm.endDate, user?.name || "admin");
      rerender();
      addToast(`تم إنشاء الفترة "${periodForm.name}"`, "success");
      setShowPeriodModal(false);
      setPeriodForm({ name: "", startDate: "", endDate: "" });
    } catch (e: any) { addToast(e.message, "error"); }
  };

  const handleTogglePeriod = (p: FinancialPeriod) => {
    try {
      if (p.status === "open") {
        AccountingEngine.closePeriod(p.id, user?.name || "admin");
        addToast(`تم إغلاق الفترة "${p.name}"`, "info");
      } else {
        AccountingEngine.openPeriod(p.id, user?.name || "admin");
        addToast(`تم فتح الفترة "${p.name}"`, "success");
      }
      rerender();
    } catch (e: any) { addToast(e.message, "error"); }
  };

  const updateJELine = (i: number, patch: Partial<typeof jeForm.lines[0]>) => {
    const lines = [...jeForm.lines]; lines[i] = { ...lines[i], ...patch };
    setJeForm({ ...jeForm, lines });
  };

  const periods = db.financialPeriods || [];
  const closedCount = periods.filter((p) => p.status === "closed").length;

  const TABS: { id: Tab; label: string; badge?: string }[] = [
    { id: "journal", label: t("journal") },
    { id: "ledger",  label: "دفتر الأستاذ" },
    { id: "periods", label: "الفترات المالية", badge: closedCount > 0 ? `${closedCount} مغلق` : undefined },
    { id: "trial",   label: t("trialBalance") },
    { id: "coa",     label: t("chartOfAccounts") },
    { id: "pl",      label: t("incomeStatement") },
    { id: "bs",      label: t("balanceSheet") },
  ];

  return (
    <div>
      <div style={S.pageTitle}>{t("accountingEngine")}</div>
      <div style={S.pageSub}>{t("accountingSubtitle")}</div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: C.surfaceAlt, padding: 4, borderRadius: 8, border: `1px solid ${C.border}`, flexWrap: "wrap" }}>
        {TABS.map((tab) => (
          <button key={tab.id} style={{ ...S.btn(view === tab.id ? "primary" : "ghost"), padding: "7px 14px", fontSize: 12, border: "none", display: "flex", alignItems: "center", gap: 6 }} onClick={() => setView(tab.id)}>
            {tab.label}
            {tab.badge && (
              <span style={{ background: C.danger, color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Journal ── */}
      {view === "journal" && (
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <button style={{ ...S.btn("primary"), border: "none" }} onClick={() => setShowJE(true)}>{t("manualEntry")}</button>
            <div style={S.sectionTitle}>{t("generalJournal")} ({db.journalEntries.length})</div>
          </div>
          <DataTable
            headers={[
              { label: t("status") }, { label: "المصدر" },
              { label: t("credits") }, { label: t("debits") },
              { label: t("description") }, { label: t("reference") },
              { label: t("date") }, { label: t("jeRef") },
            ]}
            rows={db.journalEntries.map((je) => {
              const d = je.lines.reduce((s, l) => s + (l.debit || 0), 0);
              const c = je.lines.reduce((s, l) => s + (l.credit || 0), 0);
              const srcLabel: Record<string, string> = {
                invoice: "فاتورة بيع", payment: "سند قبض", refund: "مرتجع",
                purchase: "فاتورة شراء", purchase_payment: "سند دفع",
                reversal: "قيد عكسي", manual: "يدوي",
              };
              return [
                <span key="st" style={{ ...S.badge(je.status === "reversed" ? "danger" : "success"), fontSize: 11 }}>
                  {je.status === "reversed" ? "✗ معكوس" : "✓ مرحّل"}
                </span>,
                <span key="src" style={{ ...S.badge("info"), fontSize: 11 }}>
                  {srcLabel[(je as any).sourceType] || "—"}
                </span>,
                <span key="c" style={{ color: C.danger,  fontWeight: 700 }}>{fmt(c)}</span>,
                <span key="d" style={{ color: C.success, fontWeight: 700 }}>{fmt(d)}</span>,
                <span key="desc" style={{ fontSize: 12 }}>
                  {je.description}
                  {(je as any).reversalOf && <span style={{ fontSize: 10, color: C.warning, marginRight: 6 }}>↩ يعكس {(je as any).reversalOf}</span>}
                </span>,
                <span key="ref" style={{ color: C.accentMid }}>{je.reference || "—"}</span>,
                fmtDate(je.date),
                <span key="id" style={{ color: C.purple, fontWeight: 700 }}>{je.id}</span>,
              ];
            })}
            emptyMsg={t("noJEsYet")}
          />
        </div>
      )}

      {/* ── Financial Periods ── */}
      {view === "periods" && (
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <button style={{ ...S.btn("primary"), border: "none" }} onClick={() => setShowPeriodModal(true)}>+ إنشاء فترة مالية</button>
            <div style={S.sectionTitle}>الفترات المالية ({periods.length})</div>
          </div>

          {periods.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: C.textMuted, fontSize: 14 }}>
              لا توجد فترات مالية بعد — أنشئ فترتك الأولى لتفعيل قفل الفترات
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[...periods].reverse().map((p) => {
              const isClosed = p.status === "closed";
              const jeCount  = db.journalEntries.filter(
                (je) => je.date >= p.startDate && je.date <= p.endDate
              ).length;
              return (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
                  padding: "14px 18px", borderRadius: 10,
                  border: `1.5px solid ${isClosed ? C.danger : C.success}`,
                  background: isClosed ? "#FFF5F5" : "#F0FFF4",
                }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: isClosed ? C.danger : C.success, marginBottom: 4 }}>
                      {isClosed ? "🔒" : "🔓"} {p.name}
                    </div>
                    <div style={{ fontSize: 12, color: C.textSec }}>
                      {p.startDate} → {p.endDate}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, textAlign: "center" }}>
                    <div style={{ fontWeight: 700, color: C.text }}>{jeCount}</div>
                    <div>قيد</div>
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, minWidth: 160 }}>
                    {isClosed ? (
                      <>
                        <div>أُغلق بواسطة: <strong>{p.closedBy}</strong></div>
                        <div>{p.closedAt ? new Date(p.closedAt).toLocaleDateString("ar-SA") : ""}</div>
                      </>
                    ) : (
                      <>
                        <div>أُنشئ بواسطة: <strong>{p.openedBy}</strong></div>
                        <div>{p.openedAt ? new Date(p.openedAt).toLocaleDateString("ar-SA") : ""}</div>
                      </>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ ...S.badge(isClosed ? "danger" : "success") }}>
                      {isClosed ? "مغلقة" : "مفتوحة"}
                    </span>
                    <button
                      onClick={() => handleTogglePeriod(p)}
                      style={{
                        ...S.btn(isClosed ? "outline" : "danger"),
                        border: isClosed ? `1px solid ${C.success}` : "none",
                        color: isClosed ? C.success : "#fff",
                        fontSize: 12, padding: "5px 14px",
                      }}
                    >
                      {isClosed ? "🔓 فتح الفترة" : "🔒 إغلاق الفترة"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Alert: no periods but lockedPeriods string list exists */}
          {periods.length === 0 && (db.settings.lockedPeriods || []).length > 0 && (
            <div style={{ marginTop: 16, background: "#FFF3CD", border: `1px solid ${C.warning}`, borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#856404" }}>
              ⚠️ يوجد {db.settings.lockedPeriods.length} فترة مقفلة بالإعدادات القديمة: {db.settings.lockedPeriods.join("، ")}
            </div>
          )}
        </div>
      )}

      {/* ── General Ledger ── */}
      {view === "ledger" && (() => {
        const gl = glAccountId
          ? AccountingEngine.getGeneralLedger(glAccountId, glStart || undefined, glEnd || undefined)
          : null;
        const srcLabel: Record<string, string> = {
          invoice: "فاتورة بيع", payment: "سند قبض", refund: "مرتجع",
          purchase: "فاتورة شراء", purchase_payment: "سند دفع", reversal: "قيد عكسي", manual: "يدوي",
        };
        return (
          <div style={S.card}>
            <div style={S.sectionHeader}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <select style={{ ...S.select, minWidth: 200 }} value={glAccountId} onChange={(e) => setGlAccountId(e.target.value)}>
                  <option value="">اختر الحساب...</option>
                  {db.accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
                <input type="date" style={{ ...S.input, width: 140 }} value={glStart} onChange={(e) => setGlStart(e.target.value)} placeholder="من تاريخ" />
                <input type="date" style={{ ...S.input, width: 140 }} value={glEnd}   onChange={(e) => setGlEnd(e.target.value)}   placeholder="إلى تاريخ" />
              </div>
              <div style={S.sectionTitle}>دفتر الأستاذ العام</div>
            </div>

            {gl && (
              <>
                <div style={{ display: "flex", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13, color: C.textSec }}>
                    الحساب: <strong style={{ color: C.accent }}>{gl.account?.code} — {gl.account?.name}</strong>
                  </div>
                  <div style={{ fontSize: 13, color: C.textSec }}>
                    الرصيد الافتتاحي: <strong>{fmt(gl.openingBalance)}</strong>
                  </div>
                  <div style={{ fontSize: 13, color: gl.closingBalance >= 0 ? C.success : C.danger }}>
                    الرصيد الختامي: <strong>{fmt(gl.closingBalance)}</strong>
                  </div>
                  <div style={{ fontSize: 13, color: C.textSec }}>
                    عدد الحركات: <strong>{gl.entries.length}</strong>
                  </div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: C.accent, color: "#fff" }}>
                      {["رقم القيد", "التاريخ", "البيان", "المصدر", "مدين", "دائن", "الرصيد المتراكم"].map((h) => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gl.entries.length === 0 && (
                      <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: C.textMuted }}>لا توجد حركات في هذه الفترة</td></tr>
                    )}
                    {gl.entries.map((entry, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? C.surfaceAlt : C.surface, borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: "7px 10px", color: C.purple, fontWeight: 700 }}>{entry.jeId}</td>
                        <td style={{ padding: "7px 10px" }}>{entry.date}</td>
                        <td style={{ padding: "7px 10px", fontSize: 12, color: C.textSec }}>{entry.description}</td>
                        <td style={{ padding: "7px 10px" }}>
                          <span style={{ ...S.badge("info"), fontSize: 10 }}>{srcLabel[entry.sourceType] || entry.sourceType}</span>
                        </td>
                        <td style={{ padding: "7px 10px", color: entry.debit > 0 ? C.success : C.textMuted, fontWeight: entry.debit > 0 ? 700 : 400, direction: "ltr" }}>
                          {entry.debit > 0 ? fmt(entry.debit) : "—"}
                        </td>
                        <td style={{ padding: "7px 10px", color: entry.credit > 0 ? C.danger : C.textMuted, fontWeight: entry.credit > 0 ? 700 : 400, direction: "ltr" }}>
                          {entry.credit > 0 ? fmt(entry.credit) : "—"}
                        </td>
                        <td style={{ padding: "7px 10px", fontWeight: 800, color: entry.runningBalance >= 0 ? C.success : C.danger, direction: "ltr" }}>
                          {fmt(entry.runningBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {!glAccountId && (
              <div style={{ padding: 40, textAlign: "center", color: C.textMuted, fontSize: 14 }}>
                اختر حساباً من القائمة أعلاه لعرض حركاته
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Trial Balance ── */}
      {view === "trial" && (
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <div style={{ display: "flex", gap: 20 }}>
              <span style={{ fontSize: 13, color: C.success, fontWeight: 700 }}>{t("totalDebits")}: {fmt(db.accounts.reduce((s, a) => s + Math.max(0, a.balance || 0), 0))}</span>
              <span style={{ fontSize: 13, color: C.danger,  fontWeight: 700 }}>{t("totalCredits")}: {fmt(db.accounts.reduce((s, a) => s + Math.max(0, -(a.balance || 0)), 0))}</span>
            </div>
            <div style={S.sectionTitle}>{t("trialBalance")}</div>
          </div>
          <DataTable
            headers={[{ label: t("credits") }, { label: t("debits") }, { label: t("accountName") }, { label: t("code") }]}
            rows={db.accounts.filter((a) => a.balance !== 0).map((a) => [
              <span key="c" style={{ color: (a.balance || 0) < 0 ? C.danger  : C.textMuted }}>{(a.balance || 0) < 0 ? fmt(Math.abs(a.balance)) : "—"}</span>,
              <span key="d" style={{ color: (a.balance || 0) > 0 ? C.success : C.textMuted }}>{(a.balance || 0) > 0 ? fmt(a.balance) : "—"}</span>,
              a.name,
              <span key="code" style={{ color: C.accent, fontFamily: "monospace" }}>{a.code}</span>,
            ])}
            emptyMsg={t("noJEsYet")}
          />
        </div>
      )}

      {/* ── Chart of Accounts ── */}
      {view === "coa" && (
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <button style={{ ...S.btn("primary"), border: "none" }} onClick={() => setShowAcct(true)}>{t("addAccount")}</button>
            <div style={S.sectionTitle}>{t("chartOfAccounts")} ({db.accounts.length})</div>
          </div>
          <DataTable
            headers={[{ label: t("balance") }, { label: t("accountType") }, { label: t("accountName") }, { label: t("code") }]}
            rows={db.accounts.map((a) => [
              <span key="bal" style={{ fontWeight: 700, color: (a.balance || 0) < 0 ? C.danger : C.text }}>{fmt(a.balance || 0)}</span>,
              <span key="tp" style={S.badge("info")}>{TYPE_OPTS.find(([v]) => v === a.type)?.[1] ? t(TYPE_OPTS.find(([v]) => v === a.type)![1]) : a.type}</span>,
              <span key="nm" style={{ paddingRight: a.parentId ? 20 : 0, fontWeight: a.parentId ? 400 : 700 }}>{a.name}</span>,
              <span key="code" style={{ color: C.accent, fontFamily: "monospace", fontSize: 13 }}>{a.code}</span>,
            ])}
            emptyMsg="لا توجد حسابات — ابدأ بإضافة دليل الحسابات"
          />
        </div>
      )}

      {/* ── Income Statement ── */}
      {view === "pl" && (
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <span style={S.badge("info")}>{t("ytd")}</span>
            <div style={S.sectionTitle}>{t("incomeStatement")}</div>
          </div>
          <div style={{ maxWidth: 480, marginRight: "auto" }}>
            {([
              [t("revenue"),           is.revenue,          C.success,   false, false, false],
              [t("salesReturns"),      -is.contraRevenue,   C.danger,    false, false, false],
              [t("netRevenue"),        is.netRevenue,       C.text,      true,  true,  false],
              [t("cogs"),              -is.cogs,            C.danger,    false, false, false],
              [t("grossProfit"),       is.grossProfit,      C.accentMid, true,  false, false],
              [t("operatingExpenses"), -is.expenses,        C.warning,   false, false, false],
              [t("netIncome"),         is.netIncome,        is.netIncome >= 0 ? C.success : C.danger, true, true, true],
            ] as [string,number,string,boolean,boolean,boolean][]).map(([label, val, color, bold, border, big]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${C.border}`, ...(border ? { borderTop: `2px solid ${C.borderDark}`, marginTop: 4 } : {}) }}>
                <span style={{ color, fontWeight: bold ? 800 : 400, fontSize: big ? 16 : 13 }}>{fmt(val)}</span>
                <span style={{ color: bold ? C.text : C.textSec, fontWeight: bold ? 700 : 400, fontSize: big ? 14 : 13 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Balance Sheet ── */}
      {view === "bs" && (
        <div style={S.grid(2)}>
          <div style={S.card}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>{t("assets")}</div>
            {bs.assets.map((a) => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                <span style={{ color: C.text, fontWeight: 600 }}>{fmt(a.balance || 0)}</span>
                <span style={{ color: C.textSec, paddingRight: a.parentId ? 12 : 0 }}>{a.name}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: `2px solid ${C.borderDark}`, fontWeight: 800, fontSize: 14, color: C.success }}>
              <span>{fmt(bs.totalAssets)}</span>
              <span>{t("totalAssetsFull")}</span>
            </div>
          </div>
          <div>
            <div style={{ ...S.card, marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>{t("liabilities")}</div>
              {bs.liabilities.map((a) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                  <span style={{ color: C.danger, fontWeight: 600 }}>{fmt(a.balance || 0)}</span>
                  <span style={{ color: C.textSec }}>{a.name}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: `2px solid ${C.borderDark}`, fontWeight: 800, color: C.danger, fontSize: 14 }}>
                <span>{fmt(bs.totalLiabilities)}</span>
                <span>{t("totalLiabilities")}</span>
              </div>
            </div>
            <div style={S.card}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>{t("equity")}</div>
              {bs.equity.map((a) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                  <span style={{ color: C.purple, fontWeight: 600 }}>{fmt(a.balance || 0)}</span>
                  <span style={{ color: C.textSec }}>{a.name}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: `2px solid ${C.borderDark}`, fontWeight: 800, color: C.text, fontSize: 14 }}>
                <span style={{ color: Math.abs(bs.totalAssets - (bs.totalLiabilities + bs.totalEquity)) < 1 ? C.success : C.danger }}>{fmt(bs.totalLiabilities + bs.totalEquity)}</span>
                <span>{t("totalLE")}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Add Account ── */}
      {showAcct && (
        <Modal title={t("addAccountTitle")} onClose={() => setShowAcct(false)}>
          {([["code", t("accountCode")], ["name", t("accountName")]] as [string, string][]).map(([k, lbl]) => (
            <div key={k} style={S.formGroup}>
              <label style={S.label}>{lbl}</label>
              <input style={S.input} value={(acctForm as any)[k]} onChange={(e) => setAcctForm({ ...acctForm, [k]: e.target.value })} placeholder={lbl} />
            </div>
          ))}
          <div style={S.formGroup}>
            <label style={S.label}>{t("accountType")}</label>
            <select style={S.select} value={acctForm.type} onChange={(e) => setAcctForm({ ...acctForm, type: e.target.value })}>
              {TYPE_OPTS.map(([v, tk]) => <option key={v} value={v}>{t(tk)}</option>)}
            </select>
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>{t("category")}</label>
            <select style={S.select} value={acctForm.category} onChange={(e) => setAcctForm({ ...acctForm, category: e.target.value })}>
              {CAT_OPTS.map(([v, tk]) => <option key={v} value={v}>{t(tk)}</option>)}
            </select>
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>{t("parentAccount")}</label>
            <select style={S.select} value={acctForm.parentId} onChange={(e) => setAcctForm({ ...acctForm, parentId: e.target.value })}>
              <option value="">{t("noParent")}</option>
              {db.accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-start" }}>
            <button style={{ ...S.btn("outline") }} onClick={() => setShowAcct(false)}>{t("cancel")}</button>
            <button style={{ ...S.btn("primary"), border: "none" }} onClick={handleAddAccount}>{t("save")}</button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Manual Journal Entry ── */}
      {showJE && (
        <Modal title={t("manualJournalEntry")} onClose={() => setShowJE(false)} wide>
          {/* Row 1: Description + Reference + Date */}
          <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 3, minWidth: 200 }}>
              <label style={S.label}>{t("entryDescription")} *</label>
              <input style={S.input} value={jeForm.description} onChange={(e) => setJeForm({ ...jeForm, description: e.target.value })} placeholder={t("entryDescription")} />
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={S.label}>{t("reference")}</label>
              <input style={S.input} value={jeForm.reference} onChange={(e) => setJeForm({ ...jeForm, reference: e.target.value })} placeholder="#REF" />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={S.label}>تاريخ القيد</label>
              <input type="date" style={S.input} value={jeForm.jeDate} onChange={(e) => setJeForm({ ...jeForm, jeDate: e.target.value })} />
            </div>
          </div>

          {/* Row 2: Source type + Currency */}
          <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={S.label}>نوع القيد</label>
              <select style={S.select} value={jeForm.sourceType} onChange={(e) => setJeForm({ ...jeForm, sourceType: e.target.value })}>
                <option value="manual">يدوي — Manual</option>
                <option value="adjustment">تسوية — Adjustment</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={S.label}>العملة (اختياري)</label>
              <input style={S.input} value={jeForm.currency} onChange={(e) => setJeForm({ ...jeForm, currency: e.target.value })} placeholder="USD / EUR ..." />
            </div>
            {jeForm.currency && (
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={S.label}>سعر الصرف (1 {jeForm.currency} = ؟ {db.settings.baseCurrency})</label>
                <input type="number" style={S.input} min="0.0001" step="0.0001" value={jeForm.exchangeRate} onChange={(e) => setJeForm({ ...jeForm, exchangeRate: e.target.value })} />
              </div>
            )}
          </div>

          {/* Period warning */}
          {jeForm.jeDate && (() => {
            const locked = (db.financialPeriods || []).some(
              (p) => p.status === "closed" && jeForm.jeDate >= p.startDate && jeForm.jeDate <= p.endDate
            );
            return locked ? (
              <div style={{ background: "#FFF3CD", border: `1px solid ${C.warning}`, borderRadius: 7, padding: "8px 14px", marginBottom: 12, fontSize: 12, color: "#856404", fontWeight: 700 }}>
                ⚠️ التاريخ المحدد يقع في فترة مالية مغلقة — سيُرفض الترحيل
              </div>
            ) : null;
          })()}

          {/* Lines */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <button style={{ ...S.btn("outline") }} onClick={() => setJeForm({ ...jeForm, lines: [...jeForm.lines, { accountId: "", debit: 0, credit: 0, description: "" }] })}>{t("addLine")}</button>
            <label style={S.label}>{t("lineItems")}</label>
          </div>

          <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 110px 110px 36px" }}>
              {[t("account"), "بيان السطر", t("debits"), t("credits"), ""].map((h, i) => (
                <div key={i} style={S.th}>{h}</div>
              ))}
            </div>
            {jeForm.lines.map((line, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 110px 110px 36px", borderBottom: `1px solid ${C.border}` }}>
                <select style={{ ...S.select, border: "none", borderRadius: 0, borderLeft: `1px solid ${C.border}` }} value={line.accountId} onChange={(e) => updateJELine(i, { accountId: e.target.value })}>
                  <option value="">{t("selectAccount")}</option>
                  {db.accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                </select>
                <input style={{ ...S.input, border: "none", borderRadius: 0, borderLeft: `1px solid ${C.border}`, fontSize: 12 }} value={line.description || ""} placeholder="وصف اختياري..." onChange={(e) => updateJELine(i, { description: e.target.value })} />
                <input style={{ ...S.input, border: "none", borderRadius: 0, borderLeft: `1px solid ${C.border}`, color: C.success }} type="number" min="0" value={line.debit || ""} placeholder="0" onChange={(e) => updateJELine(i, { debit: +e.target.value, credit: 0 })} />
                <input style={{ ...S.input, border: "none", borderRadius: 0, borderLeft: `1px solid ${C.border}`, color: C.danger }} type="number" min="0" value={line.credit || ""} placeholder="0" onChange={(e) => updateJELine(i, { credit: +e.target.value, debit: 0 })} />
                <button style={{ background: "transparent", border: "none", cursor: "pointer", color: C.danger, fontSize: 16 }} onClick={() => { if (jeForm.lines.length > 2) setJeForm({ ...jeForm, lines: jeForm.lines.filter((_, j) => j !== i) }); }}>×</button>
              </div>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 110px 110px 36px", background: C.surfaceAlt }}>
              <div style={{ ...S.th, fontSize: 12 }}>{t("totals")}</div>
              <div style={S.th} />
              <div style={{ ...S.th, color: C.success, fontWeight: 800 }}>{fmt(totalD)}</div>
              <div style={{ ...S.th, color: C.danger,  fontWeight: 800 }}>{fmt(totalC)}</div>
              <div />
            </div>
          </div>

          <div style={{ margin: "12px 0", padding: 10, borderRadius: 7, background: balanced ? C.successLight : C.dangerLight, fontSize: 12, fontWeight: 700, color: balanced ? C.success : C.danger }}>
            {balanced ? `✓ ${t("entryBalanced")}` : `✗ ${t("entryUnbalanced")} — الفرق: ${fmt(Math.abs(totalD - totalC))}`}
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-start" }}>
            <button style={{ ...S.btn("outline") }} onClick={() => setShowJE(false)}>{t("cancel")}</button>
            <button style={{ ...S.btn("primary"), border: "none", opacity: balanced ? 1 : 0.5 }} onClick={handlePostJE} disabled={!balanced}>{t("postJournalEntry")}</button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Create Financial Period ── */}
      {showPeriodModal && (
        <Modal title="إنشاء فترة مالية جديدة" onClose={() => setShowPeriodModal(false)}>
          <div style={S.formGroup}>
            <label style={S.label}>اسم الفترة *</label>
            <input style={S.input} value={periodForm.name} onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })} placeholder="مثال: يناير 2025، الربع الأول 2025" />
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>تاريخ البداية *</label>
              <input type="date" style={S.input} value={periodForm.startDate} onChange={(e) => setPeriodForm({ ...periodForm, startDate: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.label}>تاريخ الانتهاء *</label>
              <input type="date" style={S.input} value={periodForm.endDate} onChange={(e) => setPeriodForm({ ...periodForm, endDate: e.target.value })} />
            </div>
          </div>
          <div style={{ background: C.accentLight, borderRadius: 7, padding: 10, marginBottom: 16, fontSize: 12, color: C.accentMid }}>
            بعد إغلاق الفترة لا يمكن ترحيل أي قيد فيها — يمكن إعادة الفتح عند الحاجة للتصحيح
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-start" }}>
            <button style={{ ...S.btn("outline") }} onClick={() => setShowPeriodModal(false)}>إلغاء</button>
            <button style={{ ...S.btn("primary"), border: "none" }} onClick={handleCreatePeriod}>✓ إنشاء الفترة</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
