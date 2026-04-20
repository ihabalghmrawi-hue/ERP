"use client";

import { useState, useMemo } from "react";
import { S, C } from "@/lib/engine/design";
import { useAuth } from "@/hooks/useAuth";
import { DB, Invoice, InvoiceLine } from "@/lib/db/database";
import { AccountingEngine } from "@/lib/engine/accounting";
import { TaxService, VatMode } from "@/lib/engine/tax";
import { fmt, today, uid, logActivity } from "@/lib/engine/helpers";

interface Props { addToast: (msg: string, type?: "success" | "error" | "info") => void; }
interface CartItem { productId: string; name: string; price: number; qty: number; taxExempt: boolean; }

export function POS({ addToast }: Props) {
  const { user } = useAuth();
  const db       = DB.get();
  const settings = db.settings;

  const vatEnabled   = settings.vatEnabled   || false;
  const vatRate      = vatEnabled ? (settings.vatRate || 0) : 0;
  const vatMode: VatMode = settings.vatInclusive ? "inclusive" : "exclusive";

  const [search,   setSearch]   = useState("");
  const [cart,     setCart]     = useState<CartItem[]>([]);
  const [payMode,  setPayMode]  = useState<"cash" | "credit">("cash");
  const [customerId, setCustomerId] = useState("");
  const [lastInvId, setLastInvId]   = useState<string | null>(null);

  const filtered = useMemo(() =>
    db.products.filter((p) =>
      p.qty > 0 &&
      (p.name.toLowerCase().includes(search.toLowerCase()) ||
       (p.sku || "").toLowerCase().includes(search.toLowerCase()))
    ), [search, db.products]);

  // Cart computed lines with tax
  const cartLines = cart.map((item) => {
    const gross  = item.price * item.qty;
    const result = TaxService.calcLine(gross, vatRate, vatMode, item.taxExempt);
    return { ...item, subtotal: result.subtotal, tax: result.tax, total: result.total };
  });
  const sums = TaxService.sumLines(cartLines.map((l) => ({
    grossAmount: l.subtotal + l.tax, subtotal: l.subtotal, tax: l.tax,
    total: l.total, taxRate: vatRate, mode: vatMode, exempt: l.taxExempt,
  })));

  const addToCart = (productId: string) => {
    const p = db.products.find((x) => x.id === productId);
    if (!p) return;
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === productId);
      if (existing) {
        return prev.map((c) =>
          c.productId === productId ? { ...c, qty: c.qty + 1 } : c
        );
      }
      return [...prev, { productId, name: p.name, price: p.sellPrice, qty: 1, taxExempt: p.taxExempt || false }];
    });
  };

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) { setCart((p) => p.filter((c) => c.productId !== productId)); return; }
    setCart((p) => p.map((c) => c.productId === productId ? { ...c, qty } : c));
  };

  const handleCheckout = () => {
    if (cart.length === 0) { addToast("السلة فارغة", "error"); return; }
    if (payMode === "credit" && !customerId) { addToast("اختر العميل للدفع الآجل", "error"); return; }

    const cust = customerId
      ? db.customers.find((c) => c.id === customerId)
      : { id: "walk-in", name: "عميل نقدي" };
    if (!cust) { addToast("العميل غير موجود", "error"); return; }

    const invId = `INV-${String(DB.nextId("inv")).padStart(4, "0")}`;
    const lines: InvoiceLine[] = cartLines.map((l) => {
      const p = db.products.find((x) => x.id === l.productId)!;
      return {
        productId:   l.productId,
        productName: l.name,
        qty:         l.qty,
        unitPrice:   l.price,
        discount:    0,
        subtotal:    l.subtotal,
        taxRate:     vatRate,
        tax:         l.tax,
        total:       l.total,
        taxExempt:   l.taxExempt,
      };
    });

    const invoice: Invoice = {
      id: invId, date: today(),
      customerId: cust.id, customerName: cust.name,
      status: payMode === "cash" ? "paid" : "outstanding",
      paymentType: payMode,
      currency: settings.baseCurrency || "SAR",
      lines,
      subtotal: sums.subtotal,
      taxAmount: sums.tax,
      total: sums.total,
      vatEnabled,
      vatInclusive: settings.vatInclusive || false,
      amountPaid:  payMode === "cash" ? sums.total : 0,
      amountDue:   payMode === "cash" ? 0 : sums.total,
      dueDate:     today(),
    };

    try {
      const je = AccountingEngine.postSalesInvoice(invoice);
      invoice.journalEntryId = je.id;
      db.invoices.unshift(invoice);
      DB.save();
      logActivity(user?.id || "", user?.name || "", "CREATE", "POS", `بيع نقدي ${invId}`);
      setLastInvId(invId);
      setCart([]);
      setSearch("");
      setCustomerId("");
      addToast(`✅ تمت عملية البيع — ${invId}`, "success");
    } catch (e: any) {
      addToast(e.message, "error");
    }
  };

  return (
    <div style={{ display: "flex", gap: 16, height: "calc(100vh - 120px)", minHeight: 500 }}>
      {/* ── Left: Product Grid ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ background: C.surface, borderRadius: 12, padding: "14px 18px", border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.accent, marginBottom: 4 }}>
            🖥️ نقطة البيع (POS)
          </div>
          <div style={{ fontSize: 12, color: C.textMuted }}>
            {db.products.filter((p) => p.qty > 0).length} منتج متاح
          </div>
        </div>

        {/* Search */}
        <input
          style={{ ...S.input, fontSize: 14 }}
          placeholder="🔍 ابحث عن منتج بالاسم أو الكود..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Product grid */}
        <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, paddingBottom: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ gridColumn: "1/-1", textAlign: "center", color: C.textMuted, padding: 40, fontSize: 14 }}>
              لا توجد منتجات
            </div>
          ) : filtered.map((p) => {
            const inCart = cart.find((c) => c.productId === p.id);
            return (
              <div
                key={p.id}
                onClick={() => addToCart(p.id)}
                style={{
                  background: inCart ? C.accentLight : C.surface,
                  border: `2px solid ${inCart ? C.accent : C.border}`,
                  borderRadius: 10, padding: "12px 10px", cursor: "pointer",
                  textAlign: "center", transition: "all 0.15s",
                  position: "relative",
                }}
              >
                {inCart && (
                  <div style={{
                    position: "absolute", top: 6, left: 6,
                    background: C.accent, color: "#fff",
                    borderRadius: "50%", width: 20, height: 20,
                    fontSize: 11, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {inCart.qty}
                  </div>
                )}
                <div style={{ fontSize: 22, marginBottom: 6 }}>📦</div>
                <div style={{ fontWeight: 700, fontSize: 12, color: C.text, marginBottom: 4, lineHeight: 1.3 }}>{p.name}</div>
                <div style={{ fontWeight: 800, fontSize: 13, color: C.accent }}>{fmt(p.sellPrice)}</div>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>مخزون: {p.qty}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right: Cart + Checkout ── */}
      <div style={{ width: 320, display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Cart header */}
        <div style={{ background: C.surface, borderRadius: 12, padding: "14px 18px", border: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              style={{ ...S.btn("danger"), padding: "4px 10px", fontSize: 11, border: "none" }}
              onClick={() => setCart([])}
              disabled={cart.length === 0}
            >
              مسح الكل
            </button>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>
              🛒 السلة ({cart.reduce((s, c) => s + c.qty, 0)})
            </div>
          </div>
        </div>

        {/* Cart items */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {cart.length === 0 ? (
            <div style={{ background: C.surface, borderRadius: 10, padding: 30, textAlign: "center", color: C.textMuted, fontSize: 13, border: `1px solid ${C.border}` }}>
              انقر على منتج لإضافته
            </div>
          ) : cartLines.map((item) => (
            <div key={item.productId} style={{ background: C.surface, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontWeight: 800, fontSize: 13, color: C.accent }}>{fmt(item.total)}</span>
                <span style={{ fontWeight: 600, fontSize: 12, color: C.text }}>{item.name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: C.textMuted }}>{fmt(item.price)} × {item.qty}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button
                    style={{ ...S.btn("danger"), width: 26, height: 26, padding: 0, fontSize: 14, border: "none", borderRadius: 6 }}
                    onClick={() => updateQty(item.productId, item.qty - 1)}
                  >−</button>
                  <span style={{ minWidth: 20, textAlign: "center", fontWeight: 700 }}>{item.qty}</span>
                  <button
                    style={{ ...S.btn("primary"), width: 26, height: 26, padding: 0, fontSize: 14, border: "none", borderRadius: 6 }}
                    onClick={() => updateQty(item.productId, item.qty + 1)}
                  >+</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary + Checkout */}
        <div style={{ background: C.surface, borderRadius: 12, padding: "14px 16px", border: `1px solid ${C.border}` }}>
          {/* Payment mode */}
          <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}`, marginBottom: 12 }}>
            {(["cash", "credit"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPayMode(m)}
                style={{
                  flex: 1, padding: "8px 0", border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 700,
                  background: payMode === m ? C.accent : C.surfaceAlt,
                  color: payMode === m ? "#fff" : C.textMuted,
                  transition: "all 0.15s",
                }}
              >
                {m === "cash" ? "💵 نقدي" : "📋 آجل"}
              </button>
            ))}
          </div>

          {/* Customer select (credit only) */}
          {payMode === "credit" && (
            <div style={{ marginBottom: 10 }}>
              <select style={{ ...S.select, fontSize: 12 }} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">اختر العميل...</option>
                {db.customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Totals */}
          <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textSec, marginBottom: 4 }}>
              <span>الوعاء</span>
              <span>{fmt(sums.subtotal)}</span>
            </div>
            {vatEnabled && sums.tax > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.warning, marginBottom: 4 }}>
                <span>{settings.vatName || "VAT"}</span>
                <span>{fmt(sums.tax)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: C.text, borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
              <span>الإجمالي</span>
              <span style={{ color: C.accent }}>{fmt(sums.total)}</span>
            </div>
          </div>

          {lastInvId && (
            <div style={{ background: C.successLight, borderRadius: 7, padding: "6px 10px", marginBottom: 10, fontSize: 11, color: C.success, fontWeight: 600, textAlign: "center" }}>
              ✅ آخر فاتورة: {lastInvId}
            </div>
          )}

          <button
            style={{ ...S.btn("primary"), border: "none", width: "100%", padding: "14px 0", fontSize: 15, fontWeight: 800, borderRadius: 10, opacity: cart.length === 0 ? 0.5 : 1 }}
            onClick={handleCheckout}
            disabled={cart.length === 0}
          >
            {payMode === "cash" ? "💵 إتمام البيع النقدي" : "📋 إنشاء فاتورة آجلة"}
          </button>
        </div>
      </div>
    </div>
  );
}
