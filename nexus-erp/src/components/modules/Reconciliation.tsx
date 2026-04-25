"use client";

import { useState, useMemo } from "react";
import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { DB } from "@/lib/db/database";
import { BankStatement, BankStatementLine, TreasuryTransaction } from "@/lib/db/database";
import { useAuth } from "@/hooks/useAuth";
import { logActivity } from "@/lib/engine/helpers";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function fmt(n: number, currency = "SAR") {
  return n.toLocaleString("ar-SA", { style: "currency", currency, minimumFractionDigits: 2 });
}

type View = "list" | "detail" | "new";

export function Reconciliation() {
  const { t } = useLang();
  const { user, can } = useAuth();
  const [view, setView]                     = useState<View>("list");
  const [selectedId, setSelectedId]         = useState<string | null>(null);
  const [showImport, setShowImport]         = useState(false);

  const db = DB.get();
  const statements: BankStatement[] = db.bankStatements ?? [];

  function openStatement(id: string) {
    setSelectedId(id);
    setView("detail");
  }

  function onCreated(id: string) {
    setSelectedId(id);
    setView("detail");
  }

  if (view === "new") {
    return (
      <NewStatementForm
        onCreated={onCreated}
        onBack={() => setView("list")}
        user={user}
      />
    );
  }

  if (view === "detail" && selectedId) {
    const stmt = statements.find((s) => s.id === selectedId);
    if (!stmt) { setView("list"); return null; }
    return (
      <StatementDetail
        statement={stmt}
        onBack={() => setView("list")}
        onUpdate={() => setView("list")}
        canEdit={can("manage_treasury")}
        user={user}
      />
    );
  }

  // ── List view ──────────────────────────────────────────────────────────
  const statusColor = (s: BankStatement["status"]) =>
    s === "reconciled" ? C.success : s === "in_progress" ? C.gold : C.textMuted;
  const statusLabel = (s: BankStatement["status"]) =>
    s === "reconciled" ? "مُسوَّى" : s === "in_progress" ? "جارٍ" : "مسودة";

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>🏦 تسوية البنك</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>
            مطابقة حركات الحساب البنكي مع قيود الخزينة
          </div>
        </div>
        {can("manage_treasury") && (
          <button
            style={{ ...S.btn("primary"), border: "none", padding: "9px 20px" }}
            onClick={() => setView("new")}
          >
            + كشف جديد
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "إجمالي الكشوفات", value: statements.length, color: C.accent },
          { label: "جارٍ التسوية", value: statements.filter(s => s.status === "in_progress").length, color: C.gold },
          { label: "مكتملة", value: statements.filter(s => s.status === "reconciled").length, color: C.success },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...S.card, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {statements.length === 0 ? (
        <div style={{ ...S.card, textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏦</div>
          <div style={{ color: C.textMuted, fontSize: 14 }}>لا توجد كشوفات بنكية بعد</div>
          {can("manage_treasury") && (
            <button
              style={{ ...S.btn("primary"), border: "none", padding: "9px 20px", marginTop: 16 }}
              onClick={() => setView("new")}
            >
              إنشاء أول كشف
            </button>
          )}
        </div>
      ) : (
        <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.surfaceAlt }}>
                {["الحساب البنكي", "الفترة", "الرصيد الافتتاحي", "الرصيد الختامي", "الحركات", "نسبة التطابق", "الحالة", ""].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "start", fontWeight: 700, color: C.textSec, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...statements].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((s) => {
                const matched = s.lines.filter(l => l.status === "matched").length;
                const pct = s.lines.length > 0 ? Math.round((matched / s.lines.length) * 100) : 0;
                return (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>{s.accountName}</td>
                    <td style={{ padding: "10px 14px", color: C.textSec, direction: "ltr", whiteSpace: "nowrap" }}>
                      {s.fromDate} → {s.toDate}
                    </td>
                    <td style={{ padding: "10px 14px" }}>{fmt(s.openingBalance)}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: s.closingBalance >= 0 ? C.success : C.danger }}>
                      {fmt(s.closingBalance)}
                    </td>
                    <td style={{ padding: "10px 14px" }}>{s.lines.length}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? C.success : C.gold, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 12, color: C.textSec, minWidth: 36 }}>{pct}%</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: statusColor(s.status) }}>
                        {statusLabel(s.status)}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <button
                        style={{ ...S.btn("outline"), padding: "4px 12px", fontSize: 12 }}
                        onClick={() => openStatement(s.id)}
                      >
                        فتح
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── New Statement Form ─────────────────────────────────────────────────────
function NewStatementForm({
  onCreated, onBack, user,
}: {
  onCreated: (id: string) => void;
  onBack: () => void;
  user: any;
}) {
  const db = DB.get();
  const bankAccounts = db.accounts.filter(a => a.category === "current_asset" && (a.name.includes("بنك") || a.name.includes("Bank")));

  const [form, setForm] = useState({
    accountId:      bankAccounts[0]?.id ?? "",
    bankName:       "",
    fromDate:       new Date().toISOString().slice(0, 7) + "-01",
    toDate:         new Date().toISOString().slice(0, 10),
    openingBalance: "",
    closingBalance: "",
  });
  const [lines, setLines]   = useState<BankStatementLine[]>([]);
  const [newLine, setNewLine] = useState({ date: new Date().toISOString().slice(0, 10), description: "", amount: "", reference: "" });
  const [csvError, setCsvError] = useState("");

  function addLine() {
    if (!newLine.date || !newLine.description || !newLine.amount) return;
    const line: BankStatementLine = {
      id: uid(),
      date:        newLine.date,
      description: newLine.description,
      amount:      parseFloat(newLine.amount),
      reference:   newLine.reference || undefined,
      status:      "unmatched",
    };
    setLines([...lines, line]);
    setNewLine({ date: newLine.date, description: "", amount: "", reference: "" });
  }

  function removeLine(id: string) {
    setLines(lines.filter(l => l.id !== id));
  }

  function handleCSV(text: string) {
    setCsvError("");
    const rows = text.trim().split("\n").slice(1); // skip header
    const parsed: BankStatementLine[] = [];
    for (const row of rows) {
      const cols = row.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
      if (cols.length < 3) continue;
      const amount = parseFloat(cols[2]);
      if (isNaN(amount)) continue;
      parsed.push({
        id: uid(),
        date:        cols[0],
        description: cols[1],
        amount,
        reference:   cols[3] || undefined,
        status:      "unmatched",
      });
    }
    if (parsed.length === 0) { setCsvError("لم يتم العثور على بيانات صالحة"); return; }
    setLines(prev => [...prev, ...parsed]);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => handleCSV((ev.target?.result as string) ?? "");
    reader.readAsText(file);
  }

  function save() {
    const acct = db.accounts.find(a => a.id === form.accountId);
    if (!acct) return;
    const db2 = DB.get();
    const id = `BS-${String(db2.counters.bs ?? 1).padStart(4, "0")}`;
    db2.counters.bs = (db2.counters.bs ?? 1) + 1;
    const stmt: BankStatement = {
      id,
      accountId:      form.accountId,
      accountName:    acct.name,
      bankName:       form.bankName || acct.name,
      fromDate:       form.fromDate,
      toDate:         form.toDate,
      statementDate:  form.toDate,
      openingBalance: parseFloat(form.openingBalance) || 0,
      closingBalance: parseFloat(form.closingBalance) || 0,
      lines,
      status:         lines.length > 0 ? "in_progress" : "draft",
      createdBy:      user?.name ?? "system",
      createdAt:      new Date().toISOString(),
    };
    if (!db2.bankStatements) db2.bankStatements = [];
    db2.bankStatements.push(stmt);
    DB.save();
    logActivity(user?.id ?? "", user?.name ?? "", "create", "reconciliation", `إنشاء كشف بنكي ${id} — ${stmt.accountName}`);
    onCreated(id);
  }

  return (
    <div style={{ padding: "24px 28px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button style={{ ...S.btn("outline"), border: "none", padding: "6px 14px" }} onClick={onBack}>← رجوع</button>
        <div style={{ fontSize: 18, fontWeight: 800 }}>كشف بنكي جديد</div>
      </div>

      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 4 }}>الحساب البنكي *</label>
            <select
              style={{ ...S.input, width: "100%" }}
              value={form.accountId}
              onChange={e => setForm({ ...form, accountId: e.target.value })}
            >
              {db.accounts.filter(a => a.category === "current_asset").map(a => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 4 }}>اسم البنك</label>
            <input style={{ ...S.input, width: "100%" }} value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} placeholder="بنك الراجحي..." />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 4 }}>من تاريخ *</label>
            <input type="date" style={{ ...S.input, width: "100%", direction: "ltr" }} value={form.fromDate} onChange={e => setForm({ ...form, fromDate: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 4 }}>إلى تاريخ *</label>
            <input type="date" style={{ ...S.input, width: "100%", direction: "ltr" }} value={form.toDate} onChange={e => setForm({ ...form, toDate: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 4 }}>الرصيد الافتتاحي</label>
            <input type="number" style={{ ...S.input, width: "100%", direction: "ltr" }} value={form.openingBalance} onChange={e => setForm({ ...form, openingBalance: e.target.value })} placeholder="0.00" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 4 }}>الرصيد الختامي</label>
            <input type="number" style={{ ...S.input, width: "100%", direction: "ltr" }} value={form.closingBalance} onChange={e => setForm({ ...form, closingBalance: e.target.value })} placeholder="0.00" />
          </div>
        </div>
      </div>

      {/* CSV import */}
      <div style={{ ...S.card, marginBottom: 16, background: C.accentLight, border: `1px solid ${C.accent}30` }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>📁 استيراد من ملف CSV</div>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>
          الصيغة المطلوبة: <span style={{ direction: "ltr", display: "inline-block" }}>date, description, amount, reference (header row required)</span>
        </div>
        <input type="file" accept=".csv,.txt" onChange={handleFileUpload} style={{ fontSize: 13 }} />
        {csvError && <div style={{ color: C.danger, fontSize: 12, marginTop: 6 }}>{csvError}</div>}
      </div>

      {/* Manual entry */}
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>✍️ إدخال يدوي للحركات</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr auto", gap: 8, alignItems: "end", marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: C.textSec, display: "block", marginBottom: 3 }}>التاريخ</label>
            <input type="date" style={{ ...S.input, direction: "ltr" }} value={newLine.date} onChange={e => setNewLine({ ...newLine, date: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.textSec, display: "block", marginBottom: 3 }}>البيان</label>
            <input style={S.input} value={newLine.description} onChange={e => setNewLine({ ...newLine, description: e.target.value })} placeholder="مدفوعات..." onKeyDown={e => e.key === "Enter" && addLine()} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.textSec, display: "block", marginBottom: 3 }}>المبلغ (+/-)</label>
            <input type="number" style={{ ...S.input, direction: "ltr" }} value={newLine.amount} onChange={e => setNewLine({ ...newLine, amount: e.target.value })} placeholder="500.00" onKeyDown={e => e.key === "Enter" && addLine()} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.textSec, display: "block", marginBottom: 3 }}>المرجع</label>
            <input style={S.input} value={newLine.reference} onChange={e => setNewLine({ ...newLine, reference: e.target.value })} placeholder="CHQ-001" />
          </div>
          <button style={{ ...S.btn("primary"), border: "none", padding: "8px 16px", height: 36, alignSelf: "flex-end" }} onClick={addLine}>+</button>
        </div>

        {lines.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.surfaceAlt }}>
                {["التاريخ", "البيان", "المبلغ", "المرجع", ""].map(h => (
                  <th key={h} style={{ padding: "6px 10px", textAlign: "start", fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map(l => (
                <tr key={l.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "6px 10px", direction: "ltr" }}>{l.date}</td>
                  <td style={{ padding: "6px 10px" }}>{l.description}</td>
                  <td style={{ padding: "6px 10px", color: l.amount >= 0 ? C.success : C.danger, direction: "ltr" }}>
                    {l.amount >= 0 ? "+" : ""}{l.amount.toLocaleString("ar-SA")}
                  </td>
                  <td style={{ padding: "6px 10px", color: C.textMuted }}>{l.reference ?? "—"}</td>
                  <td style={{ padding: "6px 10px" }}>
                    <button style={{ background: "none", border: "none", cursor: "pointer", color: C.danger, fontSize: 16 }} onClick={() => removeLine(l.id)}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button style={{ ...S.btn("primary"), border: "none", padding: "10px 28px" }} onClick={save}>
          حفظ وبدء التسوية
        </button>
        <button style={{ ...S.btn("outline") }} onClick={onBack}>إلغاء</button>
      </div>
    </div>
  );
}

// ── Statement Detail / Reconciliation Workspace ───────────────────────────
function StatementDetail({
  statement, onBack, onUpdate, canEdit, user,
}: {
  statement: BankStatement;
  onBack: () => void;
  onUpdate: () => void;
  canEdit: boolean;
  user: any;
}) {
  const db = DB.get();
  const currency = db.settings.baseCurrency;

  // Treasury transactions in the same period
  const treasuryInRange = useMemo(() => {
    return db.treasury.filter(t => t.date >= statement.fromDate && t.date <= statement.toDate);
  }, [statement.fromDate, statement.toDate, db.treasury]);

  // Lines state (local copy for editing)
  const [lines, setLines] = useState<BankStatementLine[]>(statement.lines);
  const [filter, setFilter] = useState<"all" | "unmatched" | "matched" | "ignored">("all");
  const [saved, setSaved] = useState(false);

  const matched   = lines.filter(l => l.status === "matched").length;
  const unmatched = lines.filter(l => l.status === "unmatched").length;
  const ignored   = lines.filter(l => l.status === "ignored").length;
  const pct = lines.length > 0 ? Math.round((matched / lines.length) * 100) : 0;

  const displayLines = filter === "all" ? lines : lines.filter(l => l.status === filter);

  function matchLine(lineId: string, txId: string) {
    setLines(prev => prev.map(l =>
      l.id === lineId ? { ...l, status: "matched", matchedTransactionId: txId } : l
    ));
  }

  function unmatchLine(lineId: string) {
    setLines(prev => prev.map(l =>
      l.id === lineId ? { ...l, status: "unmatched", matchedTransactionId: undefined } : l
    ));
  }

  function ignoreLine(lineId: string) {
    setLines(prev => prev.map(l =>
      l.id === lineId ? { ...l, status: "ignored", matchedTransactionId: undefined } : l
    ));
  }

  function autoMatch() {
    let count = 0;
    setLines(prev => prev.map(l => {
      if (l.status !== "unmatched") return l;
      const match = treasuryInRange.find(t => {
        const txAmt = t.type === "in" ? t.amount : -t.amount;
        return Math.abs(txAmt - l.amount) < 0.01 && !prev.some(x => x.matchedTransactionId === t.id);
      });
      if (match) { count++; return { ...l, status: "matched", matchedTransactionId: match.id }; }
      return l;
    }));
    if (count > 0) setSaved(false);
  }

  function saveChanges() {
    const db2 = DB.get();
    const idx = db2.bankStatements.findIndex(s => s.id === statement.id);
    if (idx < 0) return;
    const isReconciled = unmatched === 0 && lines.length > 0;
    db2.bankStatements[idx] = {
      ...db2.bankStatements[idx],
      lines,
      status: isReconciled ? "reconciled" : lines.some(l => l.status === "matched") ? "in_progress" : "draft",
      reconciledAt: isReconciled ? new Date().toISOString() : undefined,
    };
    DB.save();
    setSaved(true);
    logActivity(user?.id ?? "", user?.name ?? "", "update", "reconciliation", `تحديث تسوية ${statement.id}`);
  }

  const txMap = useMemo(() => {
    const m: Record<string, TreasuryTransaction> = {};
    db.treasury.forEach(t => { m[t.id] = t; });
    return m;
  }, [db.treasury]);

  const usedTxIds = new Set(lines.filter(l => l.matchedTransactionId).map(l => l.matchedTransactionId!));

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button style={{ ...S.btn("outline"), border: "none", padding: "6px 14px" }} onClick={onBack}>← رجوع</button>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{statement.id} — {statement.accountName}</div>
            <div style={{ fontSize: 13, color: C.textMuted, direction: "ltr" }}>
              {statement.fromDate} → {statement.toDate}
            </div>
          </div>
        </div>
        {canEdit && (
          <div style={{ display: "flex", gap: 10 }}>
            <button style={{ ...S.btn("outline"), padding: "7px 16px", fontSize: 13 }} onClick={autoMatch}>
              ⚡ مطابقة تلقائية
            </button>
            <button
              style={{ ...S.btn("primary"), border: "none", padding: "7px 18px", fontSize: 13 }}
              onClick={saveChanges}
            >
              {saved ? "✓ محفوظ" : "حفظ التسوية"}
            </button>
          </div>
        )}
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "الرصيد الافتتاحي", value: fmt(statement.openingBalance, currency), color: C.textSec },
          { label: "الرصيد الختامي",   value: fmt(statement.closingBalance, currency), color: C.success },
          { label: "مطابق",  value: matched,   color: C.success },
          { label: "غير مطابق", value: unmatched, color: unmatched > 0 ? C.danger : C.textMuted },
          { label: "مستثنى", value: ignored,  color: C.textMuted },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...S.card, textAlign: "center", padding: "12px 8px" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ ...S.card, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, minWidth: 100 }}>نسبة التسوية</div>
        <div style={{ flex: 1, height: 10, background: C.border, borderRadius: 5, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? C.success : C.gold, borderRadius: 5, transition: "width 0.4s" }} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: pct === 100 ? C.success : C.gold, minWidth: 48 }}>{pct}%</div>
        {pct === 100 && <span style={{ fontSize: 13, color: C.success, fontWeight: 700 }}>✓ مكتملة</span>}
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["all", "unmatched", "matched", "ignored"] as const).map(f => (
          <button
            key={f}
            style={{
              ...S.btn(filter === f ? "primary" : "outline"),
              border: filter === f ? "none" : undefined,
              padding: "5px 14px", fontSize: 13,
            }}
            onClick={() => setFilter(f)}
          >
            {{ all: `الكل (${lines.length})`, unmatched: `غير مطابق (${unmatched})`, matched: `مطابق (${matched})`, ignored: `مستثنى (${ignored})` }[f]}
          </button>
        ))}
      </div>

      {/* Lines table */}
      <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.surfaceAlt }}>
              {["التاريخ", "البيان", "المبلغ", "مرجع", "القيد المقابل", "الحالة", canEdit ? "إجراء" : ""].map(h => (
                <th key={h} style={{ padding: "9px 12px", textAlign: "start", fontWeight: 700, color: C.textSec, borderBottom: `1px solid ${C.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayLines.map(line => {
              const matchedTx = line.matchedTransactionId ? txMap[line.matchedTransactionId] : null;
              const bgColor = line.status === "matched" ? C.successLight : line.status === "ignored" ? C.surfaceAlt : "white";
              return (
                <tr key={line.id} style={{ borderBottom: `1px solid ${C.border}`, background: bgColor }}>
                  <td style={{ padding: "9px 12px", direction: "ltr" }}>{line.date}</td>
                  <td style={{ padding: "9px 12px" }}>{line.description}</td>
                  <td style={{ padding: "9px 12px", fontWeight: 600, color: line.amount >= 0 ? C.success : C.danger, direction: "ltr" }}>
                    {line.amount >= 0 ? "+" : ""}{line.amount.toLocaleString("ar-SA")}
                  </td>
                  <td style={{ padding: "9px 12px", color: C.textMuted, direction: "ltr" }}>{line.reference ?? "—"}</td>
                  <td style={{ padding: "9px 12px" }}>
                    {matchedTx ? (
                      <span style={{ fontSize: 12, color: C.success }}>✓ {matchedTx.description}</span>
                    ) : line.status === "ignored" ? (
                      <span style={{ fontSize: 12, color: C.textMuted }}>مستثنى</span>
                    ) : canEdit ? (
                      <MatchSelector
                        line={line}
                        treasury={treasuryInRange.filter(t => !usedTxIds.has(t.id) || t.id === line.matchedTransactionId)}
                        onMatch={(txId) => matchLine(line.id, txId)}
                      />
                    ) : (
                      <span style={{ color: C.textMuted }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "9px 12px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                      background: line.status === "matched" ? C.successLight : line.status === "ignored" ? C.surfaceAlt : "#FEF9E7",
                      color: line.status === "matched" ? C.success : line.status === "ignored" ? C.textMuted : C.warning,
                    }}>
                      {line.status === "matched" ? "مطابق" : line.status === "ignored" ? "مستثنى" : "غير مطابق"}
                    </span>
                  </td>
                  {canEdit && (
                    <td style={{ padding: "9px 12px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {line.status === "matched" && (
                          <button style={{ ...S.btn("outline"), padding: "3px 10px", fontSize: 11 }} onClick={() => unmatchLine(line.id)}>إلغاء</button>
                        )}
                        {line.status === "unmatched" && (
                          <button style={{ ...S.btn("outline"), padding: "3px 10px", fontSize: 11, color: C.textMuted }} onClick={() => ignoreLine(line.id)}>تجاهل</button>
                        )}
                        {line.status === "ignored" && (
                          <button style={{ ...S.btn("outline"), padding: "3px 10px", fontSize: 11 }} onClick={() => unmatchLine(line.id)}>إعادة</button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MatchSelector({
  line, treasury, onMatch,
}: {
  line: BankStatementLine;
  treasury: TreasuryTransaction[];
  onMatch: (txId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  // Suggest transactions with matching amount
  const suggestions = treasury.filter(t => {
    const txAmt = t.type === "in" ? t.amount : -t.amount;
    return Math.abs(txAmt - line.amount) < 0.01;
  });

  const others = treasury.filter(t => !suggestions.find(s => s.id === t.id));

  if (!open) {
    return (
      <button style={{ ...S.btn("outline"), padding: "3px 10px", fontSize: 11 }} onClick={() => setOpen(true)}>
        {suggestions.length > 0 ? `⭐ ربط (${suggestions.length} مقترح)` : "ربط"}
      </button>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{
        position: "absolute", zIndex: 100, top: 0, right: 0, minWidth: 320,
        background: "white", border: `1px solid ${C.border}`, borderRadius: 8,
        boxShadow: "0 4px 20px rgba(0,0,0,0.1)", padding: 8, maxHeight: 260, overflowY: "auto",
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, padding: "4px 6px", color: C.textSec, marginBottom: 4 }}>اختر حركة الخزينة:</div>
        {suggestions.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: C.gold, padding: "2px 6px", marginBottom: 4 }}>⭐ مبالغ متطابقة</div>
            {suggestions.map(t => (
              <TxOption key={t.id} tx={t} onSelect={() => { onMatch(t.id); setOpen(false); }} />
            ))}
            {others.length > 0 && <div style={{ height: 1, background: C.border, margin: "6px 0" }} />}
          </>
        )}
        {others.slice(0, 30).map(t => (
          <TxOption key={t.id} tx={t} onSelect={() => { onMatch(t.id); setOpen(false); }} />
        ))}
        <button style={{ width: "100%", textAlign: "center", padding: "5px", fontSize: 12, color: C.textMuted, background: "none", border: "none", cursor: "pointer", marginTop: 4 }} onClick={() => setOpen(false)}>
          إلغاء
        </button>
      </div>
    </div>
  );
}

function TxOption({ tx, onSelect }: { tx: TreasuryTransaction; onSelect: () => void }) {
  const sign = tx.type === "in" ? "+" : "-";
  const color = tx.type === "in" ? C.success : C.danger;
  return (
    <div
      onClick={onSelect}
      style={{ padding: "6px 8px", cursor: "pointer", borderRadius: 6, display: "flex", justifyContent: "space-between", fontSize: 12 }}
      onMouseEnter={e => (e.currentTarget.style.background = C.accentLight)}
      onMouseLeave={e => (e.currentTarget.style.background = "")}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span>{tx.description}</span>
        <span style={{ color: C.textMuted, fontSize: 11, direction: "ltr" }}>{tx.date}</span>
      </div>
      <span style={{ fontWeight: 700, color }}>{sign}{tx.amount.toLocaleString("ar-SA")}</span>
    </div>
  );
}
