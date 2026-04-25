"use client";

import { Invoice, AppSettings } from "@/lib/db/database";
import { fmt, fmtDate } from "@/lib/engine/helpers";

// ─── Types ───────────────────────────────────────────────────────────────────
interface ReceiptProps {
  invoice: Invoice;
  settings: AppSettings;
  cashierName: string;
  printMode?: "thermal" | "a4";
}

// ─── CSS Styles ───────────────────────────────────────────────────────────────
const PRINT_STYLES = `
@media print {
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body > *:not(#pos-receipt-root) { display: none !important; }
  #pos-receipt-root { display: block !important; }
  .no-print { display: none !important; }
  @page { margin: 6mm; }
}
@media screen {
  .receipt-preview {
    font-family: 'Courier New', 'Lucida Console', monospace;
    direction: rtl;
    background: #fff;
  }
}
`;

// ─── Separator line ───────────────────────────────────────────────────────────
function Divider({ dashed }: { dashed?: boolean }) {
  return (
    <div style={{
      borderTop: dashed ? "1px dashed #000" : "1px solid #000",
      margin: "6px 0",
    }} />
  );
}

// ─── Row with label + value ───────────────────────────────────────────────────
function Row({ label, value, bold, large }: { label: string; value: string; bold?: boolean; large?: boolean }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      fontSize: large ? 13 : 11,
      fontWeight: bold ? 700 : 400,
      marginBottom: 2,
      lineHeight: 1.5,
    }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// ─── Main Receipt Component ───────────────────────────────────────────────────
export function POSReceipt({ invoice, settings, cashierName, printMode = "thermal" }: ReceiptProps) {
  const isA4 = printMode === "a4";
  const currency = settings.baseCurrency || "SAR";
  const now = new Date();
  const timeStr = now.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  const dateStr = fmtDate(invoice.date);

  const containerStyle: React.CSSProperties = {
    width: isA4 ? "100%" : 280,
    maxWidth: isA4 ? 680 : 280,
    margin: "0 auto",
    padding: isA4 ? "24px 32px" : "12px 14px",
    background: "#fff",
    fontFamily: "'Courier New', monospace",
    direction: "rtl",
    fontSize: 11,
    color: "#000",
    lineHeight: 1.6,
  };

  return (
    <div id="pos-receipt-root" className="receipt-preview" style={containerStyle}>
      <style>{PRINT_STYLES}</style>

      {/* ── Header ── */}
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <div style={{ fontSize: isA4 ? 20 : 14, fontWeight: 900, letterSpacing: 1, marginBottom: 2 }}>
          {settings.companyName || "المتجر"}
        </div>
        {settings.address && (
          <div style={{ fontSize: 10, color: "#444", marginBottom: 1 }}>{settings.address}</div>
        )}
        {settings.taxNumber && (
          <div style={{ fontSize: 10, color: "#444" }}>الرقم الضريبي: {settings.taxNumber}</div>
        )}
      </div>

      <Divider />

      {/* ── Invoice Meta ── */}
      <div style={{ marginBottom: 6 }}>
        <Row label="رقم الفاتورة" value={invoice.id} bold />
        <Row label="التاريخ" value={dateStr} />
        <Row label="الوقت" value={timeStr} />
        <Row label="الكاشير" value={cashierName} />
        {invoice.customerName && invoice.customerName !== "عميل نقدي" && (
          <Row label="العميل" value={invoice.customerName} />
        )}
      </div>

      <Divider dashed />

      {/* ── Column Headers ── */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 700, marginBottom: 3, borderBottom: "1px solid #000", paddingBottom: 2 }}>
        <span style={{ flex: 2 }}>الصنف</span>
        <span style={{ width: 30, textAlign: "center" }}>كمية</span>
        <span style={{ width: 54, textAlign: "left" }}>سعر</span>
        <span style={{ width: 60, textAlign: "left" }}>إجمالي</span>
      </div>

      {/* ── Line Items ── */}
      {invoice.lines.map((line, i) => (
        <div key={i} style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {line.productName}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#333" }}>
            <span style={{ flex: 2 }}></span>
            <span style={{ width: 30, textAlign: "center" }}>{line.qty}</span>
            <span style={{ width: 54, textAlign: "left" }}>{fmt(line.unitPrice)}</span>
            <span style={{ width: 60, textAlign: "left", fontWeight: 700 }}>{fmt(line.total)}</span>
          </div>
        </div>
      ))}

      <Divider dashed />

      {/* ── Totals ── */}
      <div style={{ marginBottom: 6 }}>
        <Row label="الوعاء" value={`${fmt(invoice.subtotal)} ${currency}`} />
        {invoice.vatEnabled && invoice.taxAmount > 0 && (
          <Row
            label={settings.vatName || "ضريبة القيمة المضافة"}
            value={`${fmt(invoice.taxAmount)} ${currency}`}
          />
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 900, marginTop: 4, paddingTop: 4, borderTop: "2px solid #000" }}>
          <span>الإجمالي</span>
          <span>{fmt(invoice.total)} {currency}</span>
        </div>
      </div>

      <Divider dashed />

      {/* ── Payment ── */}
      <div style={{ marginBottom: 6 }}>
        <Row
          label="طريقة الدفع"
          value={invoice.paymentType === "cash" ? "نقدي 💵" : "آجل 📋"}
          bold
        />
        {invoice.paymentType === "cash" && (
          <Row label="المدفوع" value={`${fmt(invoice.amountPaid || invoice.total)} ${currency}`} />
        )}
        {invoice.paymentType !== "cash" && invoice.amountDue && invoice.amountDue > 0 && (
          <Row label="المتبقي" value={`${fmt(invoice.amountDue)} ${currency}`} bold />
        )}
      </div>

      {/* ── VAT QR Placeholder (ZATCA) ── */}
      {invoice.vatEnabled && settings.taxNumber && (
        <>
          <Divider dashed />
          <div style={{ textAlign: "center", fontSize: 9, color: "#666", marginBottom: 4 }}>
            <div style={{ marginBottom: 2 }}>[ QR Code ]</div>
            <div>فاتورة ضريبية — نظام ZATCA</div>
          </div>
        </>
      )}

      <Divider />

      {/* ── Footer ── */}
      <div style={{ textAlign: "center", fontSize: 10, color: "#444", marginTop: 6 }}>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>شكراً لتسوّقكم معنا</div>
        <div>نتمنى أن نراكم مجدداً</div>
        {settings.address && (
          <div style={{ marginTop: 4, fontSize: 9 }}>{settings.address}</div>
        )}
      </div>
    </div>
  );
}

// ─── Print Trigger ────────────────────────────────────────────────────────────
export function printReceipt() {
  window.print();
}
