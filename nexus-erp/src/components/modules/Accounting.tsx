"use client";

import { useState } from "react";
import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { useAuth } from "@/hooks/useAuth";
import { DB, Account, JournalLine } from "@/lib/db/database";
import { AccountingEngine } from "@/lib/engine/accounting";
import { fmt, fmtDate, uid, logActivity } from "@/lib/engine/helpers";
import { hasPermission, isPeriodLocked } from "@/lib/engine/permissions";
import { DataTable }   from "@/components/ui/DataTable";
import { Modal }       from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface Props { addToast: (msg: string, type?: "success" | "error" | "info") => void; }

type Tab = "journal" | "trial" | "coa" | "pl" | "bs";

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

  const [acctForm, setAcctForm] = useState({ code: "", name: "", type: "asset", category: "current_asset", parentId: "" });
  const [jeForm, setJeForm]     = useState({
    description: "", reference: "",
    lines: [{ accountId: "", debit: 0, credit: 0 }, { accountId: "", debit: 0, credit: 0 }] as { accountId: string; debit: number; credit: number }[],
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

    // Period lock check — use today's date for manual JEs
    const jeDate = new Date().toISOString().slice(0, 10);
    if (isPeriodLocked(jeDate, db.settings.lockedPeriods ?? [])) {
      addToast(`الفترة المحاسبية ${jeDate.slice(0, 7)} مقفلة — لا يمكن إضافة قيود فيها.`, "error");
      return;
    }

    const lines: JournalLine[] = jeForm.lines
      .filter((l) => l.accountId && (+l.debit > 0 || +l.credit > 0))
      .map((l) => ({
        accountId:   l.accountId,
        accountName: db.accounts.find((a) => a.id === l.accountId)?.name || "",
        debit:  +l.debit,
        credit: +l.credit,
      }));
    if (lines.length < 2) { addToast(t("fillRequired"), "error"); return; }
    try {
      const je = AccountingEngine.postJE(jeForm.description, jeForm.reference, lines);
      rerender();
      logActivity(user?.id || "", user?.name || "", "CREATE", "Accounting", `رحّل القيد ${je.id}`);
      addToast(t("jePosted"), "success");
      setShowJE(false);
      setJeForm({ description: "", reference: "", lines: [{ accountId: "", debit: 0, credit: 0 }, { accountId: "", debit: 0, credit: 0 }] });
    } catch (e: any) { addToast(e.message, "error"); }
  };

  const updateJELine = (i: number, patch: Partial<typeof jeForm.lines[0]>) => {
    const lines = [...jeForm.lines]; lines[i] = { ...lines[i], ...patch };
    setJeForm({ ...jeForm, lines });
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "journal", label: t("journal") },
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
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: C.surfaceAlt, padding: 4, borderRadius: 8, border: `1px solid ${C.border}`, width: "fit-content" }}>
        {TABS.map((tab) => (
          <button key={tab.id} style={{ ...S.btn(view === tab.id ? "primary" : "ghost"), padding: "7px 14px", fontSize: 12, border: "none" }} onClick={() => setView(tab.id)}>{tab.label}</button>
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
            headers={[{ label: t("status") }, { label: t("credits") }, { label: t("debits") }, { label: t("description") }, { label: t("reference") }, { label: t("date") }, { label: t("jeRef") }]}
            rows={db.journalEntries.map((je) => {
              const d = je.lines.reduce((s, l) => s + l.debit, 0);
              const c = je.lines.reduce((s, l) => s + l.credit, 0);
              return [
                <StatusBadge key="st" status={je.status} />,
                <span key="c" style={{ color: C.danger,  fontWeight: 700 }}>{fmt(c)}</span>,
                <span key="d" style={{ color: C.success, fontWeight: 700 }}>{fmt(d)}</span>,
                <span key="desc" style={{ fontSize: 12 }}>{je.description}</span>,
                <span key="ref" style={{ color: C.accentMid }}>{je.reference || "—"}</span>,
                fmtDate(je.date),
                <span key="id" style={{ color: C.purple, fontWeight: 700 }}>{je.id}</span>,
              ];
            })}
            emptyMsg={t("noJEsYet")}
          />
        </div>
      )}

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
          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <div style={{ flex: 2 }}>
              <label style={S.label}>{t("entryDescription")} *</label>
              <input style={S.input} value={jeForm.description} onChange={(e) => setJeForm({ ...jeForm, description: e.target.value })} placeholder={t("entryDescription")} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.label}>{t("reference")}</label>
              <input style={S.input} value={jeForm.reference} onChange={(e) => setJeForm({ ...jeForm, reference: e.target.value })} placeholder="#" />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <button style={{ ...S.btn("outline") }} onClick={() => setJeForm({ ...jeForm, lines: [...jeForm.lines, { accountId: "", debit: 0, credit: 0 }] })}>{t("addLine")}</button>
            <label style={S.label}>{t("lineItems")}</label>
          </div>

          <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 130px 36px" }}>
              {[t("account"), t("debits"), t("credits"), ""].map((h, i) => <div key={i} style={S.th}>{h}</div>)}
            </div>
            {jeForm.lines.map((line, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 130px 130px 36px", borderBottom: `1px solid ${C.border}` }}>
                <select style={{ ...S.select, border: "none", borderRadius: 0, borderLeft: `1px solid ${C.border}` }} value={line.accountId} onChange={(e) => updateJELine(i, { accountId: e.target.value })}>
                  <option value="">{t("selectAccount")}</option>
                  {db.accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                </select>
                <input style={{ ...S.input, border: "none", borderRadius: 0, borderLeft: `1px solid ${C.border}`, color: C.success }} type="number" min="0" value={line.debit || ""} placeholder="0" onChange={(e) => updateJELine(i, { debit: +e.target.value, credit: 0 })} />
                <input style={{ ...S.input, border: "none", borderRadius: 0, borderLeft: `1px solid ${C.border}`, color: C.danger }} type="number" min="0" value={line.credit || ""} placeholder="0" onChange={(e) => updateJELine(i, { credit: +e.target.value, debit: 0 })} />
                <button style={{ background: "transparent", border: "none", cursor: "pointer", color: C.danger, fontSize: 16 }} onClick={() => { if (jeForm.lines.length > 2) setJeForm({ ...jeForm, lines: jeForm.lines.filter((_, j) => j !== i) }); }}>×</button>
              </div>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 130px 36px", background: C.surfaceAlt }}>
              <div style={{ ...S.th, fontSize: 12 }}>{t("totals")}</div>
              <div style={{ ...S.th, color: C.success }}>{fmt(totalD)}</div>
              <div style={{ ...S.th, color: C.danger }}>{fmt(totalC)}</div>
              <div />
            </div>
          </div>

          <div style={{ margin: "12px 0", padding: 10, borderRadius: 7, background: balanced ? C.successLight : C.dangerLight, fontSize: 12, fontWeight: 700, color: balanced ? C.success : C.danger }}>
            {balanced ? t("entryBalanced") : `${t("entryUnbalanced")} ${fmt(Math.abs(totalD - totalC))}`}
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-start" }}>
            <button style={{ ...S.btn("outline") }} onClick={() => setShowJE(false)}>{t("cancel")}</button>
            <button style={{ ...S.btn("primary"), border: "none", opacity: balanced ? 1 : 0.5 }} onClick={handlePostJE} disabled={!balanced}>{t("postJournalEntry")}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
