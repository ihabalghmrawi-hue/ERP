"use client";

import { useState } from "react";
import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { useAuth } from "@/hooks/useAuth";
import { DB, PurchaseOrder, POLine } from "@/lib/db/database";
import { AccountingEngine } from "@/lib/engine/accounting";
import { fmt, fmtDate, today, logActivity } from "@/lib/engine/helpers";
import { KPI }         from "@/components/ui/KPI";
import { DataTable }   from "@/components/ui/DataTable";
import { Modal }       from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface Props { addToast: (msg: string, type?: "success" | "error" | "info") => void; }
interface LineForm { productId: string; qty: number; unitCost: number; }

export function Purchases({ addToast }: Props) {
  const { t } = useLang();
  const { user } = useAuth();
  const db = DB.get();
  const settings = db.settings;
  const [pos, setPOs] = useState<PurchaseOrder[]>([...db.purchaseOrders]);
  const [showModal, setShowModal] = useState(false);
  const [vatEnabled, setVatEnabled] = useState(settings.vatEnabled || false);
  const [form, setForm] = useState({ supplierId: "", lines: [{ productId: "", qty: 1, unitCost: 0 }] as LineForm[] });

  const activeVatRate  = vatEnabled ? (settings.vatRate || 0) : 0;
  const formSubtotal   = form.lines.reduce((s, l) => s + (l.qty || 0) * (l.unitCost || 0), 0);
  const formTax        = formSubtotal * activeVatRate;
  const formTotal      = formSubtotal + formTax;

  const handleCreate = () => {
    const supp = db.suppliers.find((s) => s.id === form.supplierId);
    if (!supp || form.lines.some((l) => !l.productId)) { addToast(t("fillRequired"), "error"); return; }

    const id = `PO-${String(DB.nextId("po")).padStart(4, "0")}`;
    const poLines: POLine[] = form.lines.map((l) => {
      const lineSubtotal = (l.qty || 0) * (l.unitCost || 0);
      const lineTax      = lineSubtotal * activeVatRate;
      return {
        productId: l.productId,
        productName: db.products.find((p) => p.id === l.productId)?.name || "",
        qty: l.qty, unitCost: l.unitCost,
        subtotal: lineSubtotal, taxRate: activeVatRate, tax: lineTax,
        total: lineSubtotal + lineTax,
      };
    });
    const po: PurchaseOrder = {
      id, date: today(), supplierId: supp.id, supplierName: supp.name,
      status: "received", currency: "SAR", lines: poLines,
      subtotal: formSubtotal, taxAmount: formTax, total: formTotal,
      vatEnabled,
      amountPaid: 0, amountDue: formTotal,
    };
    try {
      const je = AccountingEngine.postPurchaseInvoice(po);
      po.journalEntryId = je.id;
      db.purchaseOrders.unshift(po);
      DB.save();
      setPOs([...db.purchaseOrders]);
      logActivity(user?.id || "", user?.name || "", "CREATE", "Purchases", `أنشأ أمر الشراء ${id}`);
      addToast(t("poCreated"), "success");
      setShowModal(false);
      setForm({ supplierId: "", lines: [{ productId: "", qty: 1, unitCost: 0 }] });
    } catch (e: any) { addToast(e.message, "error"); }
  };

  const totals = {
    total: pos.reduce((s, p) => s + p.total, 0),
    paid:  pos.reduce((s, p) => s + (p.amountPaid || 0), 0),
    due:   pos.reduce((s, p) => s + (p.amountDue || 0), 0),
  };

  const updateLine = (i: number, patch: Partial<LineForm>) => {
    const lines = [...form.lines]; lines[i] = { ...lines[i], ...patch }; setForm({ ...form, lines });
  };

  return (
    <div>
      <div style={S.pageTitle}>{t("purchasesManagement")}</div>
      <div style={S.pageSub}>{t("purchasesSubtitle")}</div>

      <div style={S.grid(3)}>
        <KPI label={t("totalPurchases")} value={fmt(totals.total)} color={C.warning}   icon="📥" />
        <KPI label={t("amountPaid")}     value={fmt(totals.paid)}  color={C.success}   icon="✅" />
        <KPI label={t("amountDue")}      value={fmt(totals.due)}   color={C.danger}    icon="⚠️" />
      </div>

      <div style={S.card}>
        <div style={S.sectionHeader}>
          <button style={{ ...S.btn("primary"), border: "none" }} onClick={() => setShowModal(true)}>{t("newPO")}</button>
          <div style={S.sectionTitle}>{t("purchaseOrders")} ({pos.length})</div>
        </div>
        <DataTable
          headers={[
            { label: t("jeRef") }, { label: t("status") }, { label: t("due") },
            { label: t("paid") }, { label: t("total") }, { label: t("supplier") },
            { label: t("date") }, { label: "رقم الأمر" },
          ]}
          rows={pos.map((po) => [
            <span key="je" style={{ color: C.purple, fontSize: 12 }}>{po.journalEntryId || "—"}</span>,
            <StatusBadge key="st" status={po.status} />,
            <span key="due" style={{ color: po.amountDue > 0 ? C.danger : C.success, fontWeight: 700 }}>{fmt(po.amountDue)}</span>,
            fmt(po.amountPaid),
            <span key="tot" style={{ fontWeight: 800 }}>{fmt(po.total)}</span>,
            po.supplierName, fmtDate(po.date),
            <span key="id" style={{ color: C.accent, fontWeight: 700 }}>{po.id}</span>,
          ])}
          emptyMsg={t("noPOsYet")}
        />
      </div>

      {showModal && (
        <Modal title={t("createPO")} onClose={() => setShowModal(false)} wide>
          <div style={S.formGroup}>
            <label style={S.label}>{t("supplier")} *</label>
            <select style={S.select} value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
              <option value="">{t("selectSupplier")}</option>
              {db.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div style={S.divider} />
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <button style={{ ...S.btn("outline") }} onClick={() => setForm({ ...form, lines: [...form.lines, { productId: "", qty: 1, unitCost: 0 }] })}>{t("addLine")}</button>
            <label style={S.label}>{t("lineItems")}</label>
          </div>

          {form.lines.map((line, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 2 }}>
                <select style={S.select} value={line.productId} onChange={(e) => {
                  const p = db.products.find((x) => x.id === e.target.value);
                  updateLine(i, { productId: e.target.value, unitCost: p?.unitCost || 0 });
                }}>
                  <option value="">{t("selectProduct")}</option>
                  {db.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <input style={{ ...S.input, flex: "0 0 75px" }} type="number" min="1" value={line.qty} placeholder={t("qty")} onChange={(e) => updateLine(i, { qty: +e.target.value })} />
              <input style={{ ...S.input, flex: "0 0 100px" }} type="number" min="0" value={line.unitCost} placeholder={t("unitCost")} onChange={(e) => updateLine(i, { unitCost: +e.target.value })} />
              <span style={{ flex: "0 0 90px", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>{fmt(line.qty * line.unitCost)}</span>
              {form.lines.length > 1 && <button style={{ ...S.btn("danger"), padding: "6px 10px", border: "none" }} onClick={() => setForm({ ...form, lines: form.lines.filter((_, j) => j !== i) })}>×</button>}
            </div>
          ))}

          <div style={S.divider} />

          {/* VAT Toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, padding: "10px 14px", background: vatEnabled ? C.successLight : C.surfaceAlt, borderRadius: 8, border: `1px solid ${vatEnabled ? C.success : C.border}` }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={vatEnabled}
                onChange={(e) => setVatEnabled(e.target.checked)}
                style={{ width: 16, height: 16, cursor: "pointer" }}
              />
              <span style={{ fontWeight: 700, fontSize: 13, color: vatEnabled ? C.success : C.textMuted }}>
                {settings.vatName || "ضريبة القيمة المضافة"} ({((settings.vatRate || 0) * 100).toFixed(0)}%)
              </span>
            </label>
            {vatEnabled && (
              <span style={{ ...S.badge("success"), marginRight: "auto" }}>مفعّلة</span>
            )}
          </div>

          {/* Summary */}
          <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "12px 16px", marginBottom: 16, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.textSec, marginBottom: 6 }}>
              <span>{t("subtotal")}</span>
              <span style={{ fontWeight: 600 }}>{fmt(formSubtotal)}</span>
            </div>
            {vatEnabled && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.warning, marginBottom: 6 }}>
                <span>{settings.vatName || "الضريبة"} ({((settings.vatRate || 0) * 100).toFixed(0)}%)</span>
                <span style={{ fontWeight: 600 }}>{fmt(formTax)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, fontWeight: 800, color: C.text, borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
              <span>{t("total")}</span>
              <span>{fmt(formTotal)}</span>
            </div>
          </div>

          <div style={{ background: C.warningLight, borderRadius: 7, padding: 10, marginBottom: 16, fontSize: 12, color: C.warning }}>{t("autoPONote")}</div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-start" }}>
            <button style={{ ...S.btn("outline") }} onClick={() => setShowModal(false)}>{t("cancel")}</button>
            <button style={{ ...S.btn("primary"), border: "none" }} onClick={handleCreate}>{t("createPOAndPost")}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
