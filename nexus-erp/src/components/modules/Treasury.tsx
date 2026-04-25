"use client";

import { useState } from "react";
import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { DB } from "@/lib/db/database";
import { AccountingEngine } from "@/lib/engine/accounting";
import { fmt, fmtDate } from "@/lib/engine/helpers";
import { KPI }       from "@/components/ui/KPI";
import { DataTable } from "@/components/ui/DataTable";
import { Modal }     from "@/components/ui/Modal";

interface Props { addToast: (msg: string, type?: "success" | "error" | "info") => void; }

type Tab = "overview" | "movements" | "add";

const typeLabels: Record<string, string> = {
  in: "وارد",
  out: "صادر",
  transfer: "تحويل",
};

const typeColors: Record<string, string> = {
  in: "success",
  out: "danger",
  transfer: "info",
};

const refTypeLabels: Record<string, string> = {
  invoice: "فاتورة",
  po: "شراء",
  manual: "يدوي",
  pos_session: "وردية POS",
  adjustment: "تسوية",
};

export function Treasury({ addToast }: Props) {
  const { t } = useLang();
  const [tab, setTab] = useState<Tab>("overview");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    type: "in" as "in" | "out" | "transfer",
    accountId: "",
    toAccountId: "",
    amount: "",
    description: "",
    date: new Date().toISOString().slice(0, 10),
  });

  const db = DB.get();

  const cashAccounts = db.accounts.filter(
    (a) => (a.type === "asset" || a.type === "liability") && a.category !== "asset_group" && a.category !== "liability_group"
  );
  const cashAccts = db.accounts.filter(
    (a) => a.type === "asset" && a.category === "current_asset"
  );
  const totalCash = cashAccts.reduce((s, a) => s + (a.balance || 0), 0);

  const movements = [...db.treasury].reverse();
  const totalIn   = db.treasury.filter((t) => t.type === "in").reduce((s, t) => s + t.amount, 0);
  const totalOut  = db.treasury.filter((t) => t.type === "out").reduce((s, t) => s + t.amount, 0);

  function handleAddMovement() {
    if (!form.accountId || !form.amount || !form.description) {
      addToast("يرجى تعبئة جميع الحقول المطلوبة", "error");
      return;
    }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      addToast("المبلغ غير صحيح", "error");
      return;
    }
    try {
      AccountingEngine.recordTreasuryMovement({
        type: form.type,
        accountId: form.accountId,
        toAccountId: form.type === "transfer" ? form.toAccountId : undefined,
        amount,
        description: form.description,
        referenceType: "manual",
        date: form.date,
      });
      addToast("تم تسجيل الحركة بنجاح", "success");
      setShowAdd(false);
      setForm({ type: "in", accountId: "", toAccountId: "", amount: "", description: "", date: new Date().toISOString().slice(0, 10) });
    } catch (e: any) {
      addToast(e.message || "خطأ في تسجيل الحركة", "error");
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 20px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontWeight: active ? 700 : 500,
    background: active ? C.accent : "transparent",
    color: active ? "#fff" : C.textMuted,
    transition: "all 0.2s",
  });

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: C.surface,
    color: C.text,
    fontSize: 14,
    boxSizing: "border-box" as const,
  };

  return (
    <div>
      <div style={S.pageTitle}>{t("treasuryTitle")}</div>
      <div style={S.pageSub}>{t("treasurySubtitle")}</div>

      {/* KPIs */}
      <div style={S.grid(4)}>
        <KPI label="إجمالي الأصول النقدية" value={fmt(totalCash)} color={C.success} icon="💰" />
        <KPI label="إجمالي الوارد"  value={fmt(totalIn)}  color={C.success} icon="⬆️" />
        <KPI label="إجمالي الصادر"  value={fmt(totalOut)}  color={C.danger}  icon="⬇️" />
        <KPI label="عدد الحركات"    value={String(db.treasury.length)} color={C.accentMid} icon="📋" />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button style={tabStyle(tab === "overview")}   onClick={() => setTab("overview")}>نظرة عامة</button>
        <button style={tabStyle(tab === "movements")}  onClick={() => setTab("movements")}>الحركات ({db.treasury.length})</button>
        <button
          style={{ ...tabStyle(false), marginInlineStart: "auto", background: C.success, color: "#fff" }}
          onClick={() => setShowAdd(true)}
        >
          + تسجيل حركة
        </button>
      </div>

      {/* Overview Tab */}
      {tab === "overview" && (
        <div style={S.grid(Math.min(cashAccounts.length, 3))}>
          {cashAccounts.map((a) => (
            <div key={a.id} style={{ ...S.card, padding: 20 }}>
              <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 4 }}>{a.code} — {a.category}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{a.name}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: (a.balance || 0) >= 0 ? C.success : C.danger }}>
                {fmt(a.balance || 0)}
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{a.type}</div>
            </div>
          ))}
        </div>
      )}

      {/* Movements Tab */}
      {tab === "movements" && (
        <div style={S.card}>
          <DataTable
            headers={[
              { label: "الحالة" }, { label: "المبلغ" }, { label: "النوع" },
              { label: "الحساب" }, { label: "الوصف" }, { label: "المرجع" },
              { label: "قيد" }, { label: "التاريخ" }, { label: "المعرف" },
            ]}
            rows={movements.map((tx) => [
              tx.reconciled
                ? <span key="r" style={S.badge("success")}>✓ مُسوَّى</span>
                : <span key="r" style={S.badge("warning")}>—</span>,
              <span key="a" style={{ fontWeight: 800, color: tx.type === "in" ? C.success : C.danger }}>
                {tx.type === "in" ? "+" : "-"}{fmt(tx.amount)}
              </span>,
              <span key="t" style={S.badge(typeColors[tx.type] as any)}>
                {typeLabels[tx.type] || tx.type}
              </span>,
              <span key="ac">{tx.accountName}{tx.toAccountName ? ` → ${tx.toAccountName}` : ""}</span>,
              tx.description,
              tx.referenceType
                ? <span key="ref" style={{ color: C.accentMid, fontSize: 12 }}>
                    {refTypeLabels[tx.referenceType] || tx.referenceType}{tx.referenceId ? ` #${tx.referenceId}` : ""}
                  </span>
                : <span key="ref" style={{ color: C.textMuted }}>—</span>,
              tx.journalEntryId
                ? <span key="je" style={{ color: C.accentMid, fontSize: 12 }}>{tx.journalEntryId}</span>
                : <span key="je" style={{ color: C.textMuted }}>—</span>,
              fmtDate(tx.date),
              <span key="id" style={{ color: C.textMuted, fontSize: 11 }}>{tx.id}</span>,
            ])}
            emptyMsg="لا توجد حركات خزينة بعد"
          />
        </div>
      )}

      {/* Add Movement Modal */}
      {showAdd && (
        <Modal title="تسجيل حركة خزينة" onClose={() => setShowAdd(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={S.label}>نوع الحركة *</label>
              <select style={S.input} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}>
                <option value="in">وارد (إيداع)</option>
                <option value="out">صادر (صرف)</option>
                <option value="transfer">تحويل بين حسابات</option>
              </select>
            </div>
            <div>
              <label style={S.label}>الحساب {form.type === "transfer" ? "(من)" : ""} *</label>
              <select style={S.input} value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
                <option value="">— اختر حساباً —</option>
                {cashAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
            </div>
            {form.type === "transfer" && (
              <div>
                <label style={S.label}>الحساب (إلى) *</label>
                <select style={S.input} value={form.toAccountId} onChange={(e) => setForm({ ...form, toAccountId: e.target.value })}>
                  <option value="">— اختر حساب الوجهة —</option>
                  {cashAccounts.filter((a) => a.id !== form.accountId).map((a) => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label style={S.label}>المبلغ *</label>
              <input type="number" min="0" step="0.01" style={S.input} value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
            </div>
            <div>
              <label style={S.label}>التاريخ *</label>
              <input type="date" style={S.input} value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label style={S.label}>الوصف / البيان *</label>
              <input type="text" style={S.input} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="وصف الحركة..." />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button style={{ ...S.btn("primary"), border: "none" }} onClick={handleAddMovement}>تسجيل</button>
            <button style={{ ...S.btn("outline") }} onClick={() => setShowAdd(false)}>إلغاء</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
