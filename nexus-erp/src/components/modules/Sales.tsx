"use client";

import { useState } from "react";
import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { useAuth } from "@/hooks/useAuth";
import { DB, Invoice, InvoiceLine } from "@/lib/db/database";
import { AccountingEngine } from "@/lib/engine/accounting";
import { TaxService, VatMode } from "@/lib/engine/tax";
import { fmt, fmtDate, uid, today, logActivity, logError } from "@/lib/engine/helpers";
import { hasPermission, isPeriodLocked } from "@/lib/engine/permissions";
import { KPI }         from "@/components/ui/KPI";
import { DataTable }   from "@/components/ui/DataTable";
import { Modal }       from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface Props { addToast: (msg: string, type?: "success" | "error" | "info") => void; }
interface LineForm { productId: string; qty: number; discount: number; }

function calcLine(
  line: LineForm,
  vatRate: number,
  vatMode: VatMode,
  customerExempt: boolean,
) {
  const db = DB.get();
  const p  = db.products.find((x) => x.id === line.productId);
  if (!p) return { ...line, unitPrice: 0, subtotal: 0, tax: 0, total: 0, taxRate: vatRate, taxExempt: false };
  const gross   = p.sellPrice * (line.qty || 1) * (1 - (line.discount || 0) / 100);
  const exempt  = TaxService.isExempt(p.taxExempt || false, customerExempt);
  const result  = TaxService.calcLine(gross, vatRate, vatMode, exempt);
  return {
    ...line,
    unitPrice: p.sellPrice,
    subtotal:  result.subtotal,
    tax:       result.tax,
    total:     result.total,
    taxRate:   result.taxRate,
    taxExempt: result.exempt,
  };
}

export function Sales({ addToast }: Props) {
  const { t } = useLang();
  const { user } = useAuth();
  const db       = DB.get();
  const settings = db.settings;

  const [invoices, setInvoices] = useState<Invoice[]>([...db.invoices]);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch]       = useState("");

  const [vatEnabled,   setVatEnabled]   = useState(settings.vatEnabled   || false);
  const [vatInclusive, setVatInclusive] = useState(settings.vatInclusive || false);
  const [form, setForm] = useState({
    customerId: "", paymentType: "credit",
    lines: [{ productId: "", qty: 1, discount: 0 }] as LineForm[],
    notes: "",
  });

  const activeVatRate    = vatEnabled ? (settings.vatRate || 0) : 0;
  const vatMode: VatMode = vatInclusive ? "inclusive" : "exclusive";
  const custExempt       = !!db.customers.find((c) => c.id === form.customerId)?.taxExempt;

  const formLines    = form.lines.map((l) => calcLine(l, activeVatRate, vatMode, custExempt));
  const sums         = TaxService.sumLines(formLines.map((l) => ({
    grossAmount: l.subtotal + l.tax, subtotal: l.subtotal, tax: l.tax,
    total: l.total, taxRate: l.taxRate, mode: vatMode, exempt: l.taxExempt,
  })));

  const canApprove = hasPermission(user, "approve_invoices");

  const handleCreate = () => {
    const cust = db.customers.find((c) => c.id === form.customerId);
    if (!cust || form.lines.some((l) => !l.productId || l.qty < 1)) {
      addToast(t("fillRequired"), "error"); return;
    }

    // Period lock check
    const invoiceDate = today();
    if (isPeriodLocked(invoiceDate, settings.lockedPeriods ?? [])) {
      addToast(`الفترة المحاسبية ${invoiceDate.slice(0, 7)} مقفلة — لا يمكن إنشاء فواتير فيها.`, "error");
      return;
    }

    const isCash     = form.paymentType === "cash";
    const needsApproval = settings.requireInvoiceApproval && !isCash;

    const id = `INV-${String(DB.nextId("inv")).padStart(4, "0")}`;
    const invoiceLines: InvoiceLine[] = formLines.map((l) => ({
      productId:   l.productId,
      productName: db.products.find((p) => p.id === l.productId)?.name || "",
      qty: l.qty, unitPrice: l.unitPrice, discount: l.discount,
      taxRate: l.taxRate, subtotal: l.subtotal, tax: l.tax, total: l.total,
      taxExempt: l.taxExempt,
    }));
    const invoice: Invoice = {
      id, date: invoiceDate,
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      customerId: cust.id, customerName: cust.name,
      status: isCash ? "paid" : "outstanding",
      paymentType: form.paymentType as "cash" | "credit",
      currency: settings.baseCurrency || "SAR",
      lines: invoiceLines, subtotal: sums.subtotal, taxAmount: sums.tax, total: sums.total,
      vatEnabled, vatInclusive,
      amountPaid: isCash ? sums.total : 0,
      amountDue:  isCash ? 0 : sums.total,
      notes: form.notes,
      approvalStatus: needsApproval ? "pending" : "approved",
    };
    try {
      // Only post to accounting if approved (cash is auto-approved)
      if (!needsApproval) {
        const je = AccountingEngine.postSalesInvoice(invoice);
        invoice.journalEntryId = je.id;
      }
      db.invoices.unshift(invoice);
      DB.save();
      setInvoices([...db.invoices]);
      logActivity(user?.id || "", user?.name || "", "CREATE", "Sales", `أنشأ الفاتورة ${id}${needsApproval ? " (بانتظار الموافقة)" : ""}`);
      addToast(needsApproval ? `تم إنشاء الفاتورة ${id} — بانتظار موافقة المدير` : t("invoiceCreated"), needsApproval ? "info" : "success");
      setShowModal(false);
      setForm({ customerId: "", paymentType: "credit", lines: [{ productId: "", qty: 1, discount: 0 }], notes: "" });
    } catch (e: any) {
      addToast(e.message, "error");
      logError(user?.id || "", user?.name || "", "Sales", e.message);
    }
  };

  const handleApprove = (inv: Invoice) => {
    if (!canApprove) return;
    try {
      inv.approvalStatus = "approved";
      inv.approvedBy     = user?.name || "admin";
      inv.approvedAt     = new Date().toISOString();
      if (!inv.journalEntryId) {
        const je = AccountingEngine.postSalesInvoice(inv);
        inv.journalEntryId = je.id;
      }
      DB.save();
      setInvoices([...db.invoices]);
      logActivity(user?.id || "", user?.name || "", "APPROVE", "Sales", `اعتمد الفاتورة ${inv.id}`);
      addToast(`تم اعتماد الفاتورة ${inv.id} وتسجيلها محاسبياً`, "success");
    } catch (e: any) { addToast(e.message, "error"); }
  };

  const handleReject = (inv: Invoice) => {
    if (!canApprove) return;
    const reason = window.prompt("سبب الرفض (اختياري):");
    inv.approvalStatus  = "rejected";
    inv.rejectedReason  = reason || "";
    DB.save();
    setInvoices([...db.invoices]);
    logActivity(user?.id || "", user?.name || "", "REJECT", "Sales", `رفض الفاتورة ${inv.id}`);
    addToast(`تم رفض الفاتورة ${inv.id}`, "info");
  };

  const filtered = invoices.filter((inv) => inv.id.includes(search) || inv.customerName?.includes(search));
  const totals = {
    total:       invoices.reduce((s, i) => s + i.total, 0),
    paid:        invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0),
    outstanding: invoices.filter((i) => i.status === "outstanding").reduce((s, i) => s + i.total, 0),
  };

  const updateLine = (i: number, patch: Partial<LineForm>) => {
    const lines = [...form.lines]; lines[i] = { ...lines[i], ...patch }; setForm({ ...form, lines });
  };
  const removeLine = (i: number) => setForm({ ...form, lines: form.lines.filter((_, j) => j !== i) });

  const vatRateLabel = `${((settings.vatRate || 0) * 100).toFixed(0)}%`;

  return (
    <div>
      <div style={S.pageTitle}>{t("salesManagement")}</div>
      <div style={S.pageSub}>{t("salesSubtitle")}</div>

      <div style={S.grid(3)}>
        <KPI label={t("totalInvoiced")} value={fmt(totals.total)}       color={C.success}   icon="📄" />
        <KPI label={t("amountPaid")}    value={fmt(totals.paid)}        color={C.accentMid} icon="✅" />
        <KPI label={t("outstanding")}   value={fmt(totals.outstanding)} color={C.warning}   icon="⏳" />
      </div>

      <div style={S.card}>
        <div style={S.sectionHeader}>
          <button style={{ ...S.btn("primary"), border: "none" }} onClick={() => setShowModal(true)}>{t("newInvoice")}</button>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input style={{ ...S.input, width: 200 }} placeholder={t("searchInvoices")} value={search} onChange={(e) => setSearch(e.target.value)} />
            <div style={S.sectionTitle}>{t("salesInvoices")} ({invoices.length})</div>
          </div>
        </div>
        {/* Pending approval banner */}
        {invoices.some(i => i.approvalStatus === "pending") && (
          <div style={{ background: "#FFF8E1", border: `1px solid ${C.warning}`, borderRadius: 8, padding: "10px 16px", marginBottom: 12, fontSize: 13, color: C.warning, fontWeight: 700 }}>
            ⚠️ يوجد {invoices.filter(i => i.approvalStatus === "pending").length} فاتورة بانتظار الموافقة
          </div>
        )}
        <DataTable
          headers={[
            ...(canApprove ? [{ label: "إجراء" }] : []),
            { label: "الموافقة" }, { label: t("jeRef") }, { label: t("status") }, { label: t("total") },
            { label: "ضريبة" }, { label: t("type") }, { label: t("customer") },
            { label: t("date") }, { label: t("invoiceNo") },
          ]}
          rows={filtered.map((inv) => [
            ...(canApprove ? [
              inv.approvalStatus === "pending" ? (
                <span key="act" style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => handleApprove(inv)} style={{ ...S.btn("sm"), background: C.success, color: "#fff", border: "none", fontSize: 11, padding: "3px 8px" }}>✓ اعتماد</button>
                  <button onClick={() => handleReject(inv)}  style={{ ...S.btn("sm"), background: C.danger,  color: "#fff", border: "none", fontSize: 11, padding: "3px 8px" }}>✗ رفض</button>
                </span>
              ) : <span key="act">—</span>,
            ] : []),
            <span key="ap" style={{ fontSize: 11, fontWeight: 700, color:
              inv.approvalStatus === "pending"  ? C.warning :
              inv.approvalStatus === "rejected" ? C.danger  :
              !inv.approvalStatus               ? C.textMuted : C.success }}>
              {inv.approvalStatus === "pending"  ? "⏳ انتظار" :
               inv.approvalStatus === "rejected" ? "✗ مرفوض"  :
               !inv.approvalStatus               ? "—"         : "✓ معتمد"}
            </span>,
            <span key="je" style={{ color: C.purple, fontSize: 12 }}>{inv.journalEntryId || "—"}</span>,
            <StatusBadge key="st" status={inv.status} />,
            <span key="tot" style={{ fontWeight: 800, color: C.text }}>{fmt(inv.total)}</span>,
            <span key="tax" style={{ fontSize: 12, color: (inv.taxAmount || 0) > 0 ? C.warning : C.textMuted }}>
              {(inv.taxAmount || 0) > 0 ? fmt(inv.taxAmount) : "معفى"}
            </span>,
            <span key="tp" style={S.badge("info")}>{inv.paymentType === "cash" ? t("cash") : t("credit")}</span>,
            inv.customerName, fmtDate(inv.date),
            <span key="id" style={{ color: C.accent, fontWeight: 700 }}>{inv.id}</span>,
          ])}
          emptyMsg={t("noInvoicesYet")}
        />
      </div>

      {showModal && (
        <Modal title={t("createSalesInvoice")} onClose={() => setShowModal(false)} wide>
          {/* Customer + Payment Type */}
          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>{t("customer")} *</label>
              <select style={S.select} value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
                <option value="">{t("selectCustomer")}</option>
                {db.customers.filter((c) => c.status === "active").map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.taxExempt ? " 🟢 معفى" : ""}
                  </option>
                ))}
              </select>
              {custExempt && (
                <div style={{ fontSize: 11, color: C.success, marginTop: 4, fontWeight: 600 }}>
                  ✅ هذا العميل معفى من الضريبة — لن يتم احتساب VAT
                </div>
              )}
            </div>
            <div style={{ flex: 0.5 }}>
              <label style={S.label}>{t("paymentType")}</label>
              <select style={S.select} value={form.paymentType} onChange={(e) => setForm({ ...form, paymentType: e.target.value })}>
                <option value="credit">{t("credit")}</option>
                <option value="cash">{t("cash")}</option>
              </select>
            </div>
          </div>

          <div style={S.divider} />

          {/* Lines */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <button style={{ ...S.btn("outline") }} onClick={() => setForm({ ...form, lines: [...form.lines, { productId: "", qty: 1, discount: 0 }] })}>{t("addLine")}</button>
            <label style={S.label}>{t("lineItems")}</label>
          </div>

          {form.lines.map((line, i) => {
            const cl = calcLine(line, activeVatRate, vatMode, custExempt);
            const prod = db.products.find((p) => p.id === line.productId);
            return (
              <div key={i} style={{ background: C.surfaceAlt, borderRadius: 8, padding: 12, marginBottom: 8, border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ flex: 2, minWidth: 180 }}>
                    <select style={S.select} value={line.productId} onChange={(e) => updateLine(i, { productId: e.target.value })}>
                      <option value="">{t("selectProduct")}</option>
                      {db.products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.taxExempt ? " 🟢" : ""} ({t("stock")}: {p.qty || 0})
                        </option>
                      ))}
                    </select>
                  </div>
                  <input style={{ ...S.input, flex: "0 0 70px" }} type="number" min="1" value={line.qty} placeholder={t("qty")} onChange={(e) => updateLine(i, { qty: +e.target.value })} />
                  <input style={{ ...S.input, flex: "0 0 70px" }} type="number" min="0" max="100" value={line.discount} placeholder="خصم%" onChange={(e) => updateLine(i, { discount: +e.target.value })} />
                  <span style={{ flex: "0 0 95px", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>{fmt(cl.total)}</span>
                  {form.lines.length > 1 && <button style={{ ...S.btn("danger"), padding: "6px 10px", border: "none" }} onClick={() => removeLine(i)}>×</button>}
                </div>
                {line.productId && (
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6, textAlign: "right", display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    <span>سعر الوحدة: {fmt(cl.unitPrice)}</span>
                    <span>الوعاء: {fmt(cl.subtotal)}</span>
                    {cl.taxExempt ? (
                      <span style={{ color: C.success, fontWeight: 600 }}>🟢 معفى من الضريبة</span>
                    ) : (
                      <span style={{ color: C.warning }}>
                        {settings.vatName}: {fmt(cl.tax)}
                        {vatInclusive && <span style={{ color: C.textMuted }}> (مستخرج)</span>}
                      </span>
                    )}
                    {prod?.taxExempt && <span style={S.badge("success")}>معفى</span>}
                  </div>
                )}
              </div>
            );
          })}

          <div style={S.divider} />

          {/* VAT Controls */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            {/* Enable toggle */}
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

            {/* Inclusive / Exclusive */}
            {vatEnabled && !custExempt && (
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

          {/* Inclusive note */}
          {vatEnabled && vatInclusive && !custExempt && (
            <div style={{ background: C.goldLight, borderRadius: 7, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: C.gold, border: `1px solid ${C.gold}30` }}>
              💡 <strong>السعر شامل الضريبة:</strong> الضريبة تُستخرج تلقائياً من السعر — الوعاء الضريبي = الإجمالي ÷ (1 + {vatRateLabel})
            </div>
          )}

          {/* Summary */}
          <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "12px 16px", marginBottom: 16, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.textSec, marginBottom: 6 }}>
              <span>الوعاء الضريبي (قبل الضريبة)</span>
              <span style={{ fontWeight: 600 }}>{fmt(sums.subtotal)}</span>
            </div>
            {vatEnabled && sums.tax > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.warning, marginBottom: 6 }}>
                <span>
                  {settings.vatName} ({vatRateLabel})
                  {vatInclusive && <span style={{ fontSize: 11, color: C.textMuted }}> — مستخرج من السعر</span>}
                </span>
                <span style={{ fontWeight: 700 }}>{fmt(sums.tax)}</span>
              </div>
            )}
            {vatEnabled && sums.tax === 0 && custExempt && (
              <div style={{ fontSize: 12, color: C.success, marginBottom: 6 }}>✅ العميل معفى — ضريبة: 0.00</div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, fontWeight: 800, color: C.text, borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
              <span>{t("total")}</span>
              <span>{fmt(sums.total)}</span>
            </div>
          </div>

          <div style={{ background: C.accentLight, borderRadius: 7, padding: 10, marginBottom: 16, fontSize: 12, color: C.accentMid }}>{t("autoJENote")}</div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-start" }}>
            <button style={{ ...S.btn("outline") }} onClick={() => setShowModal(false)}>{t("cancel")}</button>
            <button style={{ ...S.btn("primary"), border: "none" }} onClick={handleCreate}>{t("createAndPost")}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
