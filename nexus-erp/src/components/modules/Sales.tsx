"use client";

import { useState } from "react";
import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { useAuth } from "@/hooks/useAuth";
import { DB, Invoice, InvoiceLine } from "@/lib/db/database";
import { AccountingEngine } from "@/lib/engine/accounting";
import { fmt, fmtDate, uid, today, logActivity } from "@/lib/engine/helpers";
import { KPI }         from "@/components/ui/KPI";
import { DataTable }   from "@/components/ui/DataTable";
import { Modal }       from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface Props { addToast: (msg: string, type?: "success" | "error" | "info") => void; }

interface LineForm { productId: string; qty: number; discount: number; }

function calcLine(line: LineForm, vatRate = 0) {
  const db = DB.get();
  const p  = db.products.find((x) => x.id === line.productId);
  if (!p) return { ...line, unitPrice: 0, subtotal: 0, tax: 0, total: 0, taxRate: vatRate };
  const sub  = p.sellPrice * line.qty * (1 - (line.discount || 0) / 100);
  const tax  = sub * vatRate;
  return { ...line, unitPrice: p.sellPrice, subtotal: sub, tax, total: sub + tax, taxRate: vatRate };
}

export function Sales({ addToast }: Props) {
  const { t } = useLang();
  const { user } = useAuth();
  const db = DB.get();
  const settings = db.settings;
  const [invoices, setInvoices] = useState<Invoice[]>([...db.invoices]);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch]       = useState("");
  const [vatEnabled, setVatEnabled] = useState(settings.vatEnabled || false);
  const [form, setForm] = useState({ customerId: "", paymentType: "credit", lines: [{ productId: "", qty: 1, discount: 0 }] as LineForm[], notes: "" });

  const activeVatRate = vatEnabled ? (settings.vatRate || 0) : 0;
  const formLines    = form.lines.map((l) => calcLine(l, activeVatRate));
  const formSubtotal = formLines.reduce((s, l) => s + l.subtotal, 0);
  const formTax      = formLines.reduce((s, l) => s + l.tax, 0);
  const formTotal    = formLines.reduce((s, l) => s + l.total, 0);

  const handleCreate = () => {
    const cust = db.customers.find((c) => c.id === form.customerId);
    if (!cust || form.lines.some((l) => !l.productId || l.qty < 1)) {
      addToast(t("fillRequired"), "error"); return;
    }
    const id = `INV-${String(DB.nextId("inv")).padStart(4, "0")}`;
    const invoiceLines: InvoiceLine[] = formLines.map((l) => ({
      productId: l.productId,
      productName: db.products.find((p) => p.id === l.productId)?.name || "",
      qty: l.qty, unitPrice: l.unitPrice, discount: l.discount,
      taxRate: l.taxRate, subtotal: l.subtotal, tax: l.tax, total: l.total,
    }));
    const invoice: Invoice = {
      id, date: today(),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      customerId: cust.id, customerName: cust.name,
      status: form.paymentType === "cash" ? "paid" : "outstanding",
      paymentType: form.paymentType as "cash" | "credit", currency: "SAR",
      lines: invoiceLines, subtotal: formSubtotal, taxAmount: formTax, total: formTotal,
      vatEnabled,
      notes: form.notes,
    };
    try {
      const je = AccountingEngine.postSalesInvoice(invoice);
      invoice.journalEntryId = je.id;
      db.invoices.unshift(invoice);
      DB.save();
      setInvoices([...db.invoices]);
      logActivity(user?.id || "", user?.name || "", "CREATE", "Sales", `أنشأ الفاتورة ${id}`);
      addToast(t("invoiceCreated"), "success");
      setShowModal(false);
      setForm({ customerId: "", paymentType: "credit", lines: [{ productId: "", qty: 1, discount: 0 }], notes: "" });
    } catch (e: any) { addToast(e.message, "error"); }
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
        <DataTable
          headers={[
            { label: t("jeRef") }, { label: t("status") }, { label: t("total") },
            { label: t("type") }, { label: t("dueDate") }, { label: t("customer") },
            { label: t("date") }, { label: t("invoiceNo") },
          ]}
          rows={filtered.map((inv) => [
            <span key="je" style={{ color: C.purple, fontSize: 12 }}>{inv.journalEntryId || "—"}</span>,
            <StatusBadge key="st" status={inv.status} />,
            <span key="tot" style={{ fontWeight: 800, color: C.text }}>{fmt(inv.total)}</span>,
            <span key="tp" style={S.badge("info")}>{inv.paymentType === "cash" ? t("cash") : t("credit")}</span>,
            fmtDate(inv.dueDate), inv.customerName, fmtDate(inv.date),
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
                {db.customers.filter((c) => c.status === "active").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
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

          {/* Lines header */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <button style={{ ...S.btn("outline") }} onClick={() => setForm({ ...form, lines: [...form.lines, { productId: "", qty: 1, discount: 0 }] })}>{t("addLine")}</button>
            <label style={S.label}>{t("lineItems")}</label>
          </div>

          {form.lines.map((line, i) => {
            const cl = calcLine(line);
            return (
              <div key={i} style={{ background: C.surfaceAlt, borderRadius: 8, padding: 12, marginBottom: 8, border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ flex: 2, minWidth: 180 }}>
                    <select style={S.select} value={line.productId} onChange={(e) => updateLine(i, { productId: e.target.value })}>
                      <option value="">{t("selectProduct")}</option>
                      {db.products.map((p) => <option key={p.id} value={p.id}>{p.name} ({t("stock")}: {p.qty || 0})</option>)}
                    </select>
                  </div>
                  <input style={{ ...S.input, flex: "0 0 75px" }} type="number" min="1" value={line.qty} placeholder={t("qty")} onChange={(e) => updateLine(i, { qty: +e.target.value })} />
                  <input style={{ ...S.input, flex: "0 0 75px" }} type="number" min="0" max="100" value={line.discount} placeholder={t("discPct")} onChange={(e) => updateLine(i, { discount: +e.target.value })} />
                  <span style={{ flex: "0 0 90px", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>{fmt(cl.total)}</span>
                  {form.lines.length > 1 && <button style={{ ...S.btn("danger"), padding: "6px 10px", border: "none" }} onClick={() => removeLine(i)}>×</button>}
                </div>
                {line.productId && (
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6, textAlign: "right" }}>
                    {t("unitPrice")}: {fmt(cl.unitPrice)} · {t("subtotal")}: {fmt(cl.subtotal)} · {t("tax")}: {fmt(cl.tax)}
                  </div>
                )}
              </div>
            );
          })}

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
