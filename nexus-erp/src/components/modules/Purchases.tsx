"use client";

import { useState } from "react";
import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { useAuth } from "@/hooks/useAuth";
import { DB, PurchaseOrder, POLine } from "@/lib/db/database";
import { AccountingEngine } from "@/lib/engine/accounting";
import { TaxService, VatMode } from "@/lib/engine/tax";
import { fmt, fmtDate, today, logActivity } from "@/lib/engine/helpers";
import { KPI }         from "@/components/ui/KPI";
import { DataTable }   from "@/components/ui/DataTable";
import { Modal }       from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface Props { addToast: (msg: string, type?: "success" | "error" | "info") => void; }
interface LineForm { productId: string; qty: number; unitCost: number; }

function calcPOLine(
  line: LineForm,
  vatRate: number,
  vatMode: VatMode,
  supplierExempt: boolean,
) {
  const db = DB.get();
  const p  = db.products.find((x) => x.id === line.productId);
  const gross  = (line.qty || 1) * (line.unitCost || 0);
  const exempt = TaxService.isExempt(p?.taxExempt || false, supplierExempt);
  const result = TaxService.calcLine(gross, vatRate, vatMode, exempt);
  return { ...line, subtotal: result.subtotal, tax: result.tax, total: result.total, taxRate: result.taxRate, taxExempt: result.exempt };
}

export function Purchases({ addToast }: Props) {
  const { t } = useLang();
  const { user } = useAuth();
  const db       = DB.get();
  const settings = db.settings;

  const [pos, setPOs]       = useState<PurchaseOrder[]>([...db.purchaseOrders]);
  const [showModal, setShowModal] = useState(false);
  const [payPO, setPayPO]       = useState<PurchaseOrder | null>(null);
  const [jePO, setJePO]         = useState<PurchaseOrder | null>(null);
  const [returnPO, setReturnPO] = useState<PurchaseOrder | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [vatEnabled,   setVatEnabled]   = useState(settings.vatEnabled   || false);
  const [vatInclusive, setVatInclusive] = useState(settings.vatInclusive || false);
  const [form, setForm] = useState({ supplierId: "", lines: [{ productId: "", qty: 1, unitCost: 0 }] as LineForm[] });

  const activeVatRate    = vatEnabled ? (settings.vatRate || 0) : 0;
  const vatMode: VatMode = vatInclusive ? "inclusive" : "exclusive";
  const suppExempt       = !!db.suppliers.find((s) => s.id === form.supplierId)?.taxExempt;
  const vatRateLabel     = `${((settings.vatRate || 0) * 100).toFixed(0)}%`;

  const formLines = form.lines.map((l) => calcPOLine(l, activeVatRate, vatMode, suppExempt));
  const sums      = TaxService.sumLines(formLines.map((l) => ({
    grossAmount: l.subtotal + l.tax, subtotal: l.subtotal, tax: l.tax,
    total: l.total, taxRate: l.taxRate, mode: vatMode, exempt: l.taxExempt,
  })));

  const handleCreate = () => {
    const supp = db.suppliers.find((s) => s.id === form.supplierId);
    if (!supp || form.lines.some((l) => !l.productId)) { addToast(t("fillRequired"), "error"); return; }

    const id = `PO-${String(DB.nextId("po")).padStart(4, "0")}`;
    const poLines: POLine[] = formLines.map((l) => ({
      productId:   l.productId,
      productName: db.products.find((p) => p.id === l.productId)?.name || "",
      qty: l.qty, unitCost: l.unitCost,
      subtotal: l.subtotal, taxRate: l.taxRate, tax: l.tax, total: l.total,
      taxExempt: l.taxExempt,
    }));
    const po: PurchaseOrder = {
      id, date: today(), supplierId: supp.id, supplierName: supp.name,
      status: "received", currency: settings.baseCurrency || "SAR", lines: poLines,
      subtotal: sums.subtotal, taxAmount: sums.tax, total: sums.total,
      vatEnabled, vatInclusive,
      amountPaid: 0, amountDue: sums.total,
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

  const handleRegisterPayment = (po: PurchaseOrder) => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0 || amount > (po.amountDue || 0)) {
      addToast("أدخل مبلغاً صحيحاً لا يتجاوز المبلغ المستحق", "error"); return;
    }
    try {
      const je = AccountingEngine.postCashPayment(po.supplierId, amount, `تسديد جزئي لأمر الشراء ${po.id}`, po.id);
      po.amountPaid = (po.amountPaid || 0) + amount;
      po.amountDue  = Math.max(0, (po.amountDue || 0) - amount);
      if (po.amountDue === 0) po.status = "received";
      DB.save();
      setPOs([...db.purchaseOrders]);
      logActivity(user?.id || "", user?.name || "", "UPDATE", "Purchases", `سدد ${fmt(amount)} على أمر الشراء ${po.id} (قيد: ${je.id})`);
      addToast(`تم تسجيل الدفع ${fmt(amount)} — قيد: ${je.id}`, "success");
      setPayPO(null);
      setPayAmount("");
    } catch (e: any) { addToast(e.message, "error"); }
  };

  const handleReturn = (po: PurchaseOrder) => {
    try {
      const je = AccountingEngine.postPurchaseReturn(po);
      po.isReturned  = true;
      po.returnJEId  = je.id;
      po.returnDate  = new Date().toISOString().slice(0, 10);
      po.status      = "returned" as any;
      po.amountDue   = 0;
      DB.save();
      setPOs([...db.purchaseOrders]);
      logActivity(user?.id || "", user?.name || "", "RETURN", "Purchases", `مرتجع أمر الشراء ${po.id} — قيد عكسي: ${je.id}`);
      addToast(`تم ترحيل مرتجع أمر الشراء ${po.id} — قيد: ${je.id}`, "success");
      setReturnPO(null);
    } catch (e: any) { addToast(e.message, "error"); }
  };

  const totals = {
    total: pos.reduce((s, p) => s + p.total, 0),
    paid:  pos.reduce((s, p) => s + (p.amountPaid || 0), 0),
    due:   pos.reduce((s, p) => s + (p.amountDue  || 0), 0),
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
            { label: "" },
            { label: t("jeRef") }, { label: t("status") }, { label: t("due") },
            { label: t("paid") }, { label: "ضريبة" }, { label: t("total") },
            { label: t("supplier") }, { label: t("date") }, { label: "رقم الأمر" },
          ]}
          rows={pos.map((po) => [
            <span key="acts" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {(po.journalEntryId || po.returnJEId) && (
                <button onClick={() => setJePO(po)} style={{ ...S.btn("outline"), padding: "3px 8px", fontSize: 11 }}>📒</button>
              )}
              {(po.amountDue || 0) > 0 && !po.isReturned && (
                <button onClick={() => { setPayPO(po); setPayAmount(String(po.amountDue || "")); }} style={{ ...S.btn("sm"), background: C.warning, color: "#fff", border: "none", fontSize: 11, padding: "3px 8px" }}>💰 دفع</button>
              )}
              {!po.isReturned && (
                <button onClick={() => setReturnPO(po)} style={{ ...S.btn("sm"), background: C.danger, color: "#fff", border: "none", fontSize: 11, padding: "3px 8px" }}>↩ مرتجع</button>
              )}
            </span>,
            <span key="je" style={{ color: C.purple, fontSize: 12 }}>{po.journalEntryId || "—"}</span>,
            <StatusBadge key="st" status={po.status} />,
            <span key="due" style={{ color: (po.amountDue || 0) > 0 ? C.danger : C.success, fontWeight: 700 }}>{fmt(po.amountDue || 0)}</span>,
            fmt(po.amountPaid || 0),
            <span key="tax" style={{ fontSize: 12, color: (po.taxAmount || 0) > 0 ? C.warning : C.textMuted }}>
              {(po.taxAmount || 0) > 0 ? fmt(po.taxAmount) : "معفى"}
            </span>,
            <span key="tot" style={{ fontWeight: 800 }}>{fmt(po.total)}</span>,
            po.supplierName, fmtDate(po.date),
            <span key="id" style={{ color: C.accent, fontWeight: 700 }}>{po.id}</span>,
          ])}
          emptyMsg={t("noPOsYet")}
        />
      </div>

      {/* Payment Registration Modal */}
      {payPO && (
        <Modal title={`تسجيل دفع للمورد — ${payPO.id}`} onClose={() => { setPayPO(null); setPayAmount(""); }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.textSec, marginBottom: 8 }}>
              <span>إجمالي أمر الشراء</span><span style={{ fontWeight: 700 }}>{fmt(payPO.total)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.success, marginBottom: 8 }}>
              <span>المدفوع سابقاً</span><span style={{ fontWeight: 700 }}>{fmt(payPO.amountPaid || 0)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, color: C.danger, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
              <span>المبلغ المستحق للمورد</span><span>{fmt(payPO.amountDue || 0)}</span>
            </div>
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>المبلغ المُدفَع *</label>
            <input
              style={S.input} type="number" min="0.01" step="0.01"
              max={payPO.amountDue || 0}
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="أدخل المبلغ"
            />
          </div>
          <div style={{ background: C.warningLight, borderRadius: 7, padding: 10, marginBottom: 16, fontSize: 12, color: C.warning }}>
            سيتم تسجيل قيد: مدين الموردون / دائن الصندوق
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-start" }}>
            <button style={{ ...S.btn("outline") }} onClick={() => { setPayPO(null); setPayAmount(""); }}>إلغاء</button>
            <button style={{ ...S.btn("primary"), border: "none" }} onClick={() => handleRegisterPayment(payPO)}>✓ تسجيل الدفع</button>
          </div>
        </Modal>
      )}

      {/* Return Confirmation Modal */}
      {returnPO && (
        <Modal title={`مرتجع مشتريات — ${returnPO.id}`} onClose={() => setReturnPO(null)}>
          <div style={{ background: "#FFF3CD", border: `1px solid ${C.warning}`, borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#856404" }}>
            ⚠️ سيتم إنشاء <strong>قيد عكسي</strong> يلغي الشراء ويُزيل المخزون. هذا الإجراء لا يمكن التراجع عنه.
          </div>
          <div style={{ fontSize: 14, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: C.textSec }}>أمر الشراء</span><strong>{returnPO.id}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: C.textSec }}>المورد</span><strong>{returnPO.supplierName}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: C.textSec }}>الإجمالي</span><strong style={{ color: C.danger }}>{fmt(returnPO.total)}</strong>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-start" }}>
            <button style={{ ...S.btn("outline") }} onClick={() => setReturnPO(null)}>إلغاء</button>
            <button style={{ ...S.btn("danger"), border: "none" }} onClick={() => handleReturn(returnPO)}>↩ تأكيد المرتجع وترحيل القيد</button>
          </div>
        </Modal>
      )}

      {/* Journal Entry Viewer */}
      {jePO && (() => {
        const allJEs = DB.get().journalEntries;
        const jeIds = [jePO.journalEntryId, jePO.returnJEId].filter(Boolean) as string[];
        const jes = jeIds.map(id => allJEs.find(j => j.id === id)).filter(Boolean) as typeof allJEs;
        const srcLabel: Record<string, string> = {
          invoice: "فاتورة مبيعات", payment: "سند قبض", refund: "مرتجع",
          purchase: "فاتورة شراء", purchase_payment: "سند دفع", reversal: "قيد عكسي", manual: "يدوي",
        };
        return (
          <Modal title={`القيود المحاسبية — ${jePO.id}`} onClose={() => setJePO(null)} wide>
            {jes.length === 0 && (
              <div style={{ color: C.textMuted, padding: 20, textAlign: "center" }}>لا توجد قيود مرتبطة</div>
            )}
            {jes.map((je) => (
              <div key={je.id} style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontWeight: 800, color: C.purple, fontSize: 14 }}>{je.id}</span>
                  <span style={{ fontSize: 12, color: C.textSec }}>{je.date}</span>
                  <span style={{ ...S.badge(je.status === "reversed" ? "danger" : "success"), fontSize: 11 }}>
                    {je.status === "reversed" ? "✗ معكوس" : "✓ مرحّل"}
                  </span>
                  <span style={{ ...S.badge("info"), fontSize: 11 }}>{srcLabel[je.sourceType] || je.sourceType}</span>
                  {je.reversalOf && <span style={{ fontSize: 11, color: C.warning }}>يعكس: {je.reversalOf}</span>}
                  {je.reversedBy && <span style={{ fontSize: 11, color: C.danger }}>معكوس بـ: {je.reversedBy}</span>}
                  <span style={{ fontSize: 12, color: C.textMuted, flex: 1 }}>{je.description}</span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: C.accent, color: "#fff" }}>
                      {["الحساب", "مدين", "دائن"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {je.lines.map((line, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? C.surfaceAlt : C.surface, borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: "8px 12px" }}>{line.accountName}</td>
                        <td style={{ padding: "8px 12px", color: line.debit > 0 ? C.success : C.textMuted, fontWeight: line.debit > 0 ? 700 : 400, direction: "ltr" }}>
                          {line.debit > 0 ? fmt(line.debit) : "—"}
                        </td>
                        <td style={{ padding: "8px 12px", color: line.credit > 0 ? C.danger : C.textMuted, fontWeight: line.credit > 0 ? 700 : 400, direction: "ltr" }}>
                          {line.credit > 0 ? fmt(line.credit) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: C.surfaceAlt, fontWeight: 800, borderTop: `2px solid ${C.border}` }}>
                      <td style={{ padding: "8px 12px" }}>الإجمالي</td>
                      <td style={{ padding: "8px 12px", color: C.success, direction: "ltr" }}>{fmt(je.lines.reduce((s, l) => s + (l.debit || 0), 0))}</td>
                      <td style={{ padding: "8px 12px", color: C.danger, direction: "ltr" }}>{fmt(je.lines.reduce((s, l) => s + (l.credit || 0), 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 4 }}>
              <button style={{ ...S.btn("outline") }} onClick={() => setJePO(null)}>إغلاق</button>
            </div>
          </Modal>
        );
      })()}

      {showModal && (
        <Modal title={t("createPO")} onClose={() => setShowModal(false)} wide>
          <div style={S.formGroup}>
            <label style={S.label}>{t("supplier")} *</label>
            <select style={S.select} value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
              <option value="">{t("selectSupplier")}</option>
              {db.suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.taxExempt ? " 🟢 معفى" : ""}</option>
              ))}
            </select>
            {suppExempt && (
              <div style={{ fontSize: 11, color: C.success, marginTop: 4, fontWeight: 600 }}>
                ✅ هذا المورد معفى من الضريبة — لن يتم احتساب VAT
              </div>
            )}
          </div>

          <div style={S.divider} />
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <button style={{ ...S.btn("outline") }} onClick={() => setForm({ ...form, lines: [...form.lines, { productId: "", qty: 1, unitCost: 0 }] })}>{t("addLine")}</button>
            <label style={S.label}>{t("lineItems")}</label>
          </div>

          {form.lines.map((line, i) => {
            const cl   = calcPOLine(line, activeVatRate, vatMode, suppExempt);
            const prod = db.products.find((p) => p.id === line.productId);
            return (
              <div key={i} style={{ background: C.surfaceAlt, borderRadius: 8, padding: 10, marginBottom: 8, border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 2 }}>
                    <select style={S.select} value={line.productId} onChange={(e) => {
                      const p = db.products.find((x) => x.id === e.target.value);
                      updateLine(i, { productId: e.target.value, unitCost: p?.unitCost || 0 });
                    }}>
                      <option value="">{t("selectProduct")}</option>
                      {db.products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}{p.taxExempt ? " 🟢" : ""}</option>
                      ))}
                    </select>
                  </div>
                  <input style={{ ...S.input, flex: "0 0 70px" }} type="number" min="1" value={line.qty} placeholder={t("qty")} onChange={(e) => updateLine(i, { qty: +e.target.value })} />
                  <input style={{ ...S.input, flex: "0 0 100px" }} type="number" min="0" value={line.unitCost} placeholder={t("unitCost")} onChange={(e) => updateLine(i, { unitCost: +e.target.value })} />
                  <span style={{ flex: "0 0 90px", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>{fmt(cl.total)}</span>
                  {form.lines.length > 1 && <button style={{ ...S.btn("danger"), padding: "6px 10px", border: "none" }} onClick={() => setForm({ ...form, lines: form.lines.filter((_, j) => j !== i) })}>×</button>}
                </div>
                {line.productId && (
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6, textAlign: "right", display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <span>الوعاء: {fmt(cl.subtotal)}</span>
                    {cl.taxExempt
                      ? <span style={{ color: C.success, fontWeight: 600 }}>🟢 معفى</span>
                      : <span style={{ color: C.warning }}>{settings.vatName}: {fmt(cl.tax)}{vatInclusive && <span style={{ color: C.textMuted }}> (مستخرج)</span>}</span>
                    }
                  </div>
                )}
              </div>
            );
          })}

          <div style={S.divider} />

          {/* VAT Controls */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{
              flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", borderRadius: 8, border: `1px solid ${vatEnabled ? C.success : C.border}`,
              background: vatEnabled ? C.successLight : C.surfaceAlt,
            }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
                <input type="checkbox" checked={vatEnabled} onChange={(e) => setVatEnabled(e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
                <span style={{ fontWeight: 700, fontSize: 13, color: vatEnabled ? C.success : C.textMuted }}>
                  {settings.vatName || "VAT"} ({vatRateLabel})
                </span>
              </label>
            </div>
            {vatEnabled && !suppExempt && (
              <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
                {(["exclusive", "inclusive"] as VatMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setVatInclusive(m === "inclusive")}
                    style={{
                      padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
                      background: vatMode === m ? C.accent : C.surface,
                      color: vatMode === m ? "#fff" : C.textMuted,
                      transition: "all 0.15s",
                    }}
                  >
                    {m === "exclusive" ? "غير شامل الضريبة" : "شامل الضريبة"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {vatEnabled && vatInclusive && !suppExempt && (
            <div style={{ background: C.goldLight, borderRadius: 7, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: C.gold, border: `1px solid ${C.gold}30` }}>
              💡 <strong>السعر شامل الضريبة:</strong> الضريبة مضمّنة في تكلفة الوحدة — الوعاء = السعر ÷ (1 + {vatRateLabel})
            </div>
          )}

          {/* Summary */}
          <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "12px 16px", marginBottom: 16, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.textSec, marginBottom: 6 }}>
              <span>الوعاء الضريبي</span>
              <span style={{ fontWeight: 600 }}>{fmt(sums.subtotal)}</span>
            </div>
            {vatEnabled && sums.tax > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.warning, marginBottom: 6 }}>
                <span>
                  {settings.vatName} ({vatRateLabel})
                  {vatInclusive && <span style={{ fontSize: 11, color: C.textMuted }}> — مستخرج</span>}
                </span>
                <span style={{ fontWeight: 700 }}>{fmt(sums.tax)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, fontWeight: 800, color: C.text, borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
              <span>{t("total")}</span>
              <span>{fmt(sums.total)}</span>
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
