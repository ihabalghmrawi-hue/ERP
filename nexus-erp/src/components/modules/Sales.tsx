"use client";

import { useState, useEffect } from "react";
import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { useAuth } from "@/hooks/useAuth";
import { DB, Invoice, InvoiceLine } from "@/lib/db/database";
import { AccountingEngine } from "@/lib/engine/accounting";
import { TaxService, VatMode } from "@/lib/engine/tax";
import { fmt, fmtDate, uid, today, logActivity, logError } from "@/lib/engine/helpers";
import { hasPermission, isPeriodLocked } from "@/lib/engine/permissions";
import { zatcaQRDataURL } from "@/lib/engine/zatca";
import { KPI }         from "@/components/ui/KPI";
import { TenantDB } from "@/saas/tenantDB";
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

  const [invoices, setInvoices]     = useState<Invoice[]>([...db.invoices]);
  const [showModal, setShowModal]   = useState(false);
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [payInvoice, setPayInvoice]       = useState<Invoice | null>(null);
  const [jeInvoice, setJeInvoice]         = useState<Invoice | null>(null);
  const [returnInvoice, setReturnInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount]         = useState("");
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

      // Notify customer by email (fire-and-forget)
      (async () => {
        try {
          const cid = TenantDB.getCurrentCompanyId();
          if (!cid) return;
          const cust = DB.get().customers.find((c) => c.id === inv.customerId);
          const to = cust?.email;
          if (!to) return;
          const subject = `تم اعتماد الفاتورة ${inv.id}`;
          const message = `فاتورتك ${inv.id} بمبلغ ${inv.total} تم اعتمادها بتاريخ ${inv.approvedAt} بواسطة ${inv.approvedBy}.`;
          await fetch(`/api/email/send-test?companyId=${cid}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to, subject, message }),
          });
        } catch (e) { /* ignore */ }
      })();
    } catch (e: any) { addToast(e.message, "error"); }
  };

  const handleRegisterPayment = (inv: Invoice) => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0 || amount > (inv.amountDue || 0)) {
      addToast("أدخل مبلغاً صحيحاً لا يتجاوز المبلغ المستحق", "error"); return;
    }
    try {
      const je = AccountingEngine.postCashReceipt(inv.customerId, amount, `تسديد جزئي للفاتورة ${inv.id}`, inv.id);
      inv.amountPaid = (inv.amountPaid || 0) + amount;
      inv.amountDue  = Math.max(0, (inv.amountDue || 0) - amount);
      if (inv.amountDue === 0) inv.status = "paid";
      DB.save();
      setInvoices([...db.invoices]);
      logActivity(user?.id || "", user?.name || "", "UPDATE", "Sales", `سدد ${fmt(amount)} على الفاتورة ${inv.id} (قيد: ${je.id})`);
      addToast(`تم تسجيل الدفع ${fmt(amount)} — قيد: ${je.id}`, "success");
      setPayInvoice(null);
      setPayAmount("");
    } catch (e: any) { addToast(e.message, "error"); }
  };

  const handleReturn = (inv: Invoice) => {
    try {
      const je = AccountingEngine.postSalesReturn(inv);
      inv.isReturned  = true;
      inv.returnJEId  = je.id;
      inv.returnDate  = new Date().toISOString().slice(0, 10);
      inv.status      = "returned" as any;
      inv.amountDue   = 0;
      DB.save();
      setInvoices([...db.invoices]);
      logActivity(user?.id || "", user?.name || "", "RETURN", "Sales", `مرتجع الفاتورة ${inv.id} — قيد عكسي: ${je.id}`);
      addToast(`تم ترحيل مرتجع الفاتورة ${inv.id} — قيد: ${je.id}`, "success");
      setReturnInvoice(null);
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

    // Notify customer by email about rejection (fire-and-forget)
    (async () => {
      try {
        const cid = TenantDB.getCurrentCompanyId();
        if (!cid) return;
        const cust = DB.get().customers.find((c) => c.id === inv.customerId);
        const to = cust?.email;
        if (!to) return;
        const subject = `تم رفض الفاتورة ${inv.id}`;
        const message = `فاتورتك ${inv.id} تم رفضها. السبب: ${inv.rejectedReason || "—"}`;
        await fetch(`/api/email/send-test?companyId=${cid}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to, subject, message }),
        });
      } catch (e) { /* ignore */ }
    })();
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
            { label: "" },
            ...(canApprove ? [{ label: "إجراء" }] : []),
            { label: "الموافقة" }, { label: t("jeRef") }, { label: t("status") }, { label: t("total") },
            { label: "مستحق" }, { label: "ضريبة" }, { label: t("type") }, { label: t("customer") },
            { label: t("date") }, { label: t("invoiceNo") },
          ]}
          rows={filtered.map((inv) => [
            <span key="acts" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <button onClick={() => setPrintInvoice(inv)} style={{ ...S.btn("outline"), padding: "3px 8px", fontSize: 11 }}>🖨</button>
              {(inv.journalEntryId || inv.returnJEId) && (
                <button onClick={() => setJeInvoice(inv)} style={{ ...S.btn("outline"), padding: "3px 8px", fontSize: 11 }}>📒</button>
              )}
              {inv.approvalStatus === "approved" && inv.status !== "paid" && !inv.isReturned && (
                <button onClick={() => { setPayInvoice(inv); setPayAmount(String(inv.amountDue || "")); }} style={{ ...S.btn("sm"), background: C.success, color: "#fff", border: "none", fontSize: 11, padding: "3px 8px" }}>💰 دفع</button>
              )}
              {(inv.approvalStatus === "approved" || !inv.approvalStatus) && !inv.isReturned && (
                <button onClick={() => setReturnInvoice(inv)} style={{ ...S.btn("sm"), background: C.danger, color: "#fff", border: "none", fontSize: 11, padding: "3px 8px" }}>↩ مرتجع</button>
              )}
            </span>,
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
            <span key="due" style={{ fontWeight: 700, color: (inv.amountDue || 0) > 0 ? C.danger : C.success }}>
              {(inv.amountDue || 0) > 0 ? fmt(inv.amountDue) : "✓"}
            </span>,
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

      {printInvoice && (
        <InvoicePrintModal invoice={printInvoice} onClose={() => setPrintInvoice(null)} />
      )}

      {/* Payment Registration Modal */}
      {payInvoice && (
        <Modal title={`تسجيل دفع — ${payInvoice.id}`} onClose={() => { setPayInvoice(null); setPayAmount(""); }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.textSec, marginBottom: 8 }}>
              <span>إجمالي الفاتورة</span><span style={{ fontWeight: 700 }}>{fmt(payInvoice.total)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.success, marginBottom: 8 }}>
              <span>المدفوع سابقاً</span><span style={{ fontWeight: 700 }}>{fmt(payInvoice.amountPaid || 0)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, color: C.danger, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
              <span>المبلغ المستحق</span><span>{fmt(payInvoice.amountDue || 0)}</span>
            </div>
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>المبلغ المُسدَّد *</label>
            <input
              style={S.input} type="number" min="0.01" step="0.01"
              max={payInvoice.amountDue || 0}
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="أدخل المبلغ"
            />
          </div>
          <div style={{ background: C.accentLight, borderRadius: 7, padding: 10, marginBottom: 16, fontSize: 12, color: C.accentMid }}>
            سيتم تسجيل قيد: مدين الصندوق / دائن العملاء
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-start" }}>
            <button style={{ ...S.btn("outline") }} onClick={() => { setPayInvoice(null); setPayAmount(""); }}>إلغاء</button>
            <button style={{ ...S.btn("primary"), border: "none" }} onClick={() => handleRegisterPayment(payInvoice)}>✓ تسجيل الدفع</button>
          </div>
        </Modal>
      )}

      {/* Return Confirmation Modal */}
      {returnInvoice && (
        <Modal title={`مرتجع مبيعات — ${returnInvoice.id}`} onClose={() => setReturnInvoice(null)}>
          <div style={{ background: "#FFF3CD", border: `1px solid ${C.warning}`, borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#856404" }}>
            ⚠️ سيتم إنشاء <strong>قيد عكسي</strong> يلغي الإيراد ويُعيد المخزون. هذا الإجراء لا يمكن التراجع عنه.
          </div>
          <div style={{ fontSize: 14, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: C.textSec }}>الفاتورة</span><strong>{returnInvoice.id}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: C.textSec }}>العميل</span><strong>{returnInvoice.customerName}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: C.textSec }}>الإجمالي</span><strong style={{ color: C.danger }}>{fmt(returnInvoice.total)}</strong>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-start" }}>
            <button style={{ ...S.btn("outline") }} onClick={() => setReturnInvoice(null)}>إلغاء</button>
            <button style={{ ...S.btn("danger"), border: "none" }} onClick={() => handleReturn(returnInvoice)}>↩ تأكيد المرتجع وترحيل القيد</button>
          </div>
        </Modal>
      )}

      {/* Journal Entry Viewer */}
      {jeInvoice && (() => {
        const allJEs = DB.get().journalEntries;
        const jeIds = [jeInvoice.journalEntryId, jeInvoice.returnJEId].filter(Boolean) as string[];
        const jes = jeIds.map(id => allJEs.find(j => j.id === id)).filter(Boolean) as typeof allJEs;
        const srcLabel: Record<string, string> = {
          invoice: "فاتورة مبيعات", payment: "سند قبض", refund: "مرتجع",
          purchase: "فاتورة شراء", purchase_payment: "سند دفع", reversal: "قيد عكسي", manual: "يدوي",
        };
        return (
          <Modal title={`القيود المحاسبية — ${jeInvoice.id}`} onClose={() => setJeInvoice(null)} wide>
            {jes.length === 0 && (
              <div style={{ color: C.textMuted, padding: 20, textAlign: "center" }}>لا توجد قيود مرتبطة</div>
            )}
            {jes.map((je) => (
              <div key={je.id} style={{ marginBottom: 24 }}>
                {/* JE Header */}
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
              <button style={{ ...S.btn("outline") }} onClick={() => setJeInvoice(null)}>إغلاق</button>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

// ── Invoice Print Modal with ZATCA QR ──────────────────────────────────────
function InvoicePrintModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const db = DB.get();
  const settings = db.settings;
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!settings.vatEnabled) return;
    zatcaQRDataURL({
      sellerName:   settings.companyName || "شركة",
      vatNumber:    settings.taxNumber   || "000000000000000",
      invoiceDate:  invoice.date,
      totalWithVat: invoice.total,
      vatAmount:    invoice.taxAmount || 0,
    }).then(setQrUrl).catch(() => {});
  }, [invoice.id]);

  function handlePrint() {
    window.print();
  }

  return (
    <Modal title={`فاتورة ${invoice.id}`} onClose={onClose} wide>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 16 }}>
        <button style={{ ...S.btn("primary"), border: "none", padding: "7px 20px" }} onClick={handlePrint}>🖨 طباعة</button>
        <button style={{ ...S.btn("outline") }} onClick={onClose}>إغلاق</button>
      </div>

      <div id="invoice-print" style={{ fontFamily: "'Tajawal','Cairo',sans-serif", direction: "rtl", fontSize: 13, color: "#111", maxWidth: 720, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, paddingBottom: 16, borderBottom: "2px solid #1A5276" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#1A5276" }}>{settings.companyName || "اسم الشركة"}</div>
            {settings.taxNumber && <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>الرقم الضريبي: {settings.taxNumber}</div>}
            {settings.address  && <div style={{ fontSize: 12, color: "#555" }}>{settings.address}</div>}
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#1A5276", marginBottom: 4 }}>فاتورة ضريبية</div>
            <div style={{ fontSize: 13, color: "#555" }}>{invoice.id}</div>
            <div style={{ fontSize: 12, color: "#888" }}>{invoice.date}</div>
          </div>
        </div>

        {/* Customer info */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16, padding: "12px 16px", background: "#F8F8F6", borderRadius: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>العميل</div>
            <div style={{ fontWeight: 700 }}>{invoice.customerName}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>تاريخ الاستحقاق</div>
            <div style={{ fontWeight: 700 }}>{invoice.dueDate || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>نوع الدفع</div>
            <div>{invoice.paymentType === "cash" ? "نقداً" : "آجل"}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>الحالة</div>
            <div style={{ fontWeight: 700, color: invoice.status === "paid" ? "#1E8449" : invoice.status === "overdue" ? "#A93226" : "#B7770D" }}>
              {invoice.status === "paid" ? "مدفوعة" : invoice.status === "overdue" ? "متأخرة" : "مستحقة"}
            </div>
          </div>
        </div>

        {/* Lines table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#1A5276", color: "white" }}>
              {["المنتج / الخدمة", "الكمية", "سعر الوحدة", "خصم%", "المبلغ قبل الضريبة", "الضريبة", "الإجمالي"].map(h => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "start", fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "#F8F8F6" : "white", borderBottom: "1px solid #E2DDD5" }}>
                <td style={{ padding: "7px 10px" }}>{line.productName}</td>
                <td style={{ padding: "7px 10px" }}>{line.qty}</td>
                <td style={{ padding: "7px 10px", direction: "ltr" }}>{line.unitPrice.toLocaleString("ar-SA")}</td>
                <td style={{ padding: "7px 10px" }}>{line.discount ? `${line.discount}%` : "—"}</td>
                <td style={{ padding: "7px 10px", direction: "ltr" }}>{line.subtotal.toLocaleString("ar-SA")}</td>
                <td style={{ padding: "7px 10px", direction: "ltr" }}>{(line.tax || 0).toLocaleString("ar-SA")}</td>
                <td style={{ padding: "7px 10px", fontWeight: 700, direction: "ltr" }}>{line.total.toLocaleString("ar-SA")}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals + QR */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          {/* QR code */}
          <div style={{ textAlign: "center" }}>
            {qrUrl ? (
              <>
                <img src={qrUrl} alt="ZATCA QR" style={{ width: 120, height: 120 }} />
                <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>رمز QR — متوافق مع ZATCA</div>
              </>
            ) : settings.vatEnabled ? (
              <div style={{ width: 120, height: 120, background: "#F0EEE8", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#888" }}>QR</div>
            ) : null}
          </div>

          {/* Totals */}
          <div style={{ minWidth: 260 }}>
            {[
              { label: "المجموع الفرعي", value: invoice.subtotal },
              ...(settings.vatEnabled ? [{ label: `${settings.vatName || "ضريبة القيمة المضافة"} (${((settings.vatRate || 0) * 100).toFixed(0)}%)`, value: invoice.taxAmount || 0 }] : []),
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 12px", fontSize: 13 }}>
                <span style={{ color: "#555" }}>{label}</span>
                <span style={{ direction: "ltr" }}>{value.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} {settings.baseCurrency}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 12px", background: "#1A5276", color: "white", borderRadius: 6, marginTop: 6, fontWeight: 800, fontSize: 15 }}>
              <span>الإجمالي</span>
              <span style={{ direction: "ltr" }}>{invoice.total.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} {settings.baseCurrency}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div style={{ marginTop: 16, padding: "10px 14px", background: "#F8F8F6", borderRadius: 8, fontSize: 12, color: "#555" }}>
            <span style={{ fontWeight: 700 }}>ملاحظات: </span>{invoice.notes}
          </div>
        )}
      </div>

      <style>{`
        @media print {
          body > * { display: none !important; }
          .modal-overlay { position: static !important; background: none !important; }
          .modal-container { box-shadow: none !important; max-height: none !important; overflow: visible !important; }
          #invoice-print { display: block !important; }
          button { display: none !important; }
        }
      `}</style>
    </Modal>
  );
}
