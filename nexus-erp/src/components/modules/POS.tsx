"use client";

import { useState, useMemo } from "react";
import { S, C } from "@/lib/engine/design";
import { useAuth } from "@/hooks/useAuth";
import { DB, Invoice, InvoiceLine } from "@/lib/db/database";
import { AccountingEngine } from "@/lib/engine/accounting";
import { TaxService, VatMode } from "@/lib/engine/tax";
import { fmt, today, uid, logActivity } from "@/lib/engine/helpers";
import { Modal } from "@/components/ui/Modal";
import { POSReceipt, printReceipt } from "@/components/ui/POSReceipt";

interface Props { addToast: (msg: string, type?: "success" | "error" | "info") => void; }
interface CartItem { productId: string; name: string; price: number; qty: number; taxExempt: boolean; }

export function POS({ addToast }: Props) {
  const { user } = useAuth();
  const db       = DB.get();
  const settings = db.settings;

  const vatEnabled   = settings.vatEnabled   || false;
  const vatRate      = vatEnabled ? (settings.vatRate || 0) : 0;
  const vatMode: VatMode = settings.vatInclusive ? "inclusive" : "exclusive";

  const [search,     setSearch]     = useState("");
  const [cart,       setCart]       = useState<CartItem[]>([]);
  const [payMode,    setPayMode]    = useState<"cash" | "credit">("cash");
  const [customerId, setCustomerId] = useState("");
  const [lastInvId,  setLastInvId]  = useState<string | null>(null);
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [printMode, setPrintMode] = useState<"thermal" | "a4">("thermal");

  // Session management
  const [showOpenSession, setShowOpenSession] = useState(false);
  const [showCloseSession, setShowCloseSession] = useState(false);
  const [openingBalance, setOpeningBalance] = useState("0");
  const [actualCash, setActualCash] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [cashAccountId, setCashAccountId] = useState(
    db.accounts.find((a) => a.code === "1010")?.id || ""
  );

  // Active session for this user
  const activeSession = useMemo(() =>
    AccountingEngine.getActivePOSSession(user?.id || ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db.posSessions?.length, user?.id]
  );

  const cashAccounts = db.accounts.filter(
    (a) => a.type === "asset" && a.category === "current_asset"
  );

  const filtered = useMemo(() =>
    db.products.filter((p) =>
      p.qty > 0 &&
      (p.name.toLowerCase().includes(search.toLowerCase()) ||
       (p.sku || "").toLowerCase().includes(search.toLowerCase()))
    ), [search, db.products]);

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
      if (existing) return prev.map((c) => c.productId === productId ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { productId, name: p.name, price: p.sellPrice, qty: 1, taxExempt: p.taxExempt || false }];
    });
  };

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) { setCart((p) => p.filter((c) => c.productId !== productId)); return; }
    setCart((p) => p.map((c) => c.productId === productId ? { ...c, qty } : c));
  };

  function handleOpenSession() {
    if (!cashAccountId) { addToast("اختر حساب الصندوق", "error"); return; }
    const bal = parseFloat(openingBalance);
    if (isNaN(bal) || bal < 0) { addToast("الرصيد الافتتاحي غير صحيح", "error"); return; }
    try {
      AccountingEngine.openPOSSession({
        userId: user?.id || "system",
        userName: user?.name || "مستخدم",
        cashAccountId,
        openingBalance: bal,
      });
      addToast("تم فتح الوردية بنجاح", "success");
      setShowOpenSession(false);
    } catch (e: any) {
      addToast(e.message || "خطأ في فتح الوردية", "error");
    }
  }

  function handleCloseSession() {
    if (!activeSession) return;
    const actual = parseFloat(actualCash);
    if (isNaN(actual) || actual < 0) { addToast("أدخل المبلغ الفعلي للصندوق", "error"); return; }
    try {
      const { session, reconciliationJE } = AccountingEngine.closePOSSession({
        sessionId: activeSession.id,
        actualCash: actual,
        userId: user?.id || "system",
        userName: user?.name || "مستخدم",
        notes: closeNotes,
      });
      const diff = session.difference || 0;
      const diffLabel = diff === 0
        ? "✅ لا فروقات"
        : diff < 0
          ? `⚠️ عجز ${fmt(Math.abs(diff))}`
          : `📈 زيادة ${fmt(diff)}`;
      addToast(`تم إغلاق الوردية ${session.id}. ${diffLabel}${reconciliationJE ? ` — قيد تسوية: ${reconciliationJE.id}` : ""}`, diff === 0 ? "success" : "info");
      setShowCloseSession(false);
      setActualCash("");
      setCloseNotes("");
    } catch (e: any) {
      addToast(e.message || "خطأ في إغلاق الوردية", "error");
    }
  }

  const handleCheckout = () => {
    if (cart.length === 0) { addToast("السلة فارغة", "error"); return; }
    if (payMode === "credit" && !customerId) { addToast("اختر العميل للدفع الآجل", "error"); return; }

    const cust = customerId
      ? db.customers.find((c) => c.id === customerId)
      : { id: "walk-in", name: "عميل نقدي" };
    if (!cust) { addToast("العميل غير موجود", "error"); return; }

    const invId = `INV-${String(DB.nextId("inv")).padStart(4, "0")}`;
    const lines: InvoiceLine[] = cartLines.map((l) => ({
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
    }));

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

      // Update active POS session totals
      if (activeSession) {
        AccountingEngine.updatePOSSessionTotals(activeSession.id, sums.total, payMode === "cash" ? "cash" : "card");
      }

      DB.save();
      logActivity(user?.id || "", user?.name || "", "CREATE", "POS", `بيع نقدي ${invId}`);
      setLastInvId(invId);
      setPrintInvoice(invoice);
      setCart([]);
      setSearch("");
      setCustomerId("");
      addToast(`✅ تمت عملية البيع — ${invId}`, "success");
    } catch (e: any) {
      addToast(e.message, "error");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Session Banner */}
      <div style={{
        background: activeSession ? C.successLight : "#fff3cd",
        border: `1px solid ${activeSession ? C.success : C.warning}`,
        borderRadius: 10,
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 8,
      }}>
        {activeSession ? (
          <>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, color: C.success }}>🟢 وردية مفتوحة: {activeSession.id}</span>
              <span style={{ color: C.text, fontSize: 13 }}>مبيعات: {fmt(activeSession.totalSales)}</span>
              <span style={{ color: C.text, fontSize: 13 }}>نقدي: {fmt(activeSession.totalCash)}</span>
              <span style={{ color: C.text, fontSize: 13 }}>فواتير: {activeSession.invoiceCount}</span>
              <span style={{ color: C.text, fontSize: 13 }}>صندوق متوقع: {fmt(activeSession.expectedCash)}</span>
            </div>
            <button
              style={{ ...S.btn("danger"), border: "none", fontSize: 12, padding: "6px 16px", borderRadius: 8 }}
              onClick={() => setShowCloseSession(true)}
            >
              🔴 إغلاق الوردية
            </button>
          </>
        ) : (
          <>
            <span style={{ fontWeight: 700, color: C.warning }}>⚠️ لا توجد وردية مفتوحة — ابدأ وردية جديدة للبيع</span>
            <button
              style={{ ...S.btn("primary"), border: "none", fontSize: 12, padding: "6px 16px", borderRadius: 8 }}
              onClick={() => setShowOpenSession(true)}
            >
              🟢 فتح وردية
            </button>
          </>
        )}
      </div>

      {/* Main POS Layout */}
      <div style={{ display: "flex", gap: 16, height: "calc(100vh - 200px)", minHeight: 460 }}>
        {/* ── Left: Product Grid ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
          <div style={{ background: C.surface, borderRadius: 12, padding: "14px 18px", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.accent, marginBottom: 4 }}>
              🖥️ نقطة البيع (POS)
            </div>
            <div style={{ fontSize: 12, color: C.textMuted }}>
              {db.products.filter((p) => p.qty > 0).length} منتج متاح
            </div>
          </div>

          <input
            style={{ ...S.input, fontSize: 14 }}
            placeholder="🔍 ابحث عن منتج بالاسم أو الكود..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

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
                    textAlign: "center", transition: "all 0.15s", position: "relative",
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

          <div style={{ background: C.surface, borderRadius: 12, padding: "14px 16px", border: `1px solid ${C.border}` }}>
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

            <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textSec, marginBottom: 4 }}>
                <span>الوعاء</span><span>{fmt(sums.subtotal)}</span>
              </div>
              {vatEnabled && sums.tax > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.warning, marginBottom: 4 }}>
                  <span>{settings.vatName || "VAT"}</span><span>{fmt(sums.tax)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: C.text, borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
                <span>الإجمالي</span>
                <span style={{ color: C.accent }}>{fmt(sums.total)}</span>
              </div>
            </div>

            {lastInvId && printInvoice && (
              <div style={{ background: C.successLight, borderRadius: 7, padding: "6px 10px", marginBottom: 10, fontSize: 11, color: C.success, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>✅ آخر فاتورة: {lastInvId}</span>
                <button
                  style={{ ...S.btn("primary"), border: "none", padding: "3px 10px", fontSize: 10, borderRadius: 6 }}
                  onClick={() => setPrintInvoice(printInvoice)}
                >
                  🖨️ طباعة
                </button>
              </div>
            )}

            <button
              style={{ ...S.btn("primary"), border: "none", width: "100%", padding: "14px 0", fontSize: 15, fontWeight: 800, borderRadius: 10, opacity: (cart.length === 0 || !activeSession) ? 0.5 : 1 }}
              onClick={handleCheckout}
              disabled={cart.length === 0 || !activeSession}
            >
              {!activeSession ? "⚠️ افتح وردية أولاً" : payMode === "cash" ? "💵 إتمام البيع النقدي" : "📋 إنشاء فاتورة آجلة"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Open Session Modal ── */}
      {showOpenSession && (
        <Modal title="🟢 فتح وردية جديدة" onClose={() => setShowOpenSession(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={S.label}>حساب الصندوق *</label>
              <select style={S.input} value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)}>
                <option value="">— اختر —</option>
                {cashAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name} ({fmt(a.balance || 0)})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={S.label}>الرصيد الافتتاحي (نقدي فعلي في الصندوق)</label>
              <input type="number" min="0" step="0.01" style={S.input} value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)} placeholder="0.00" />
            </div>
            <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "10px 12px", fontSize: 13, color: C.textSec }}>
              <strong>الكاشير:</strong> {user?.name || "—"}<br />
              <strong>وقت الفتح:</strong> {new Date().toLocaleString("ar-SA")}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button style={{ ...S.btn("primary"), border: "none" }} onClick={handleOpenSession}>فتح الوردية</button>
            <button style={{ ...S.btn("outline") }} onClick={() => setShowOpenSession(false)}>إلغاء</button>
          </div>
        </Modal>
      )}

      {/* ── Receipt Print Modal ── */}
      {printInvoice && (
        <Modal title={`🖨️ طباعة الفاتورة — ${printInvoice.id}`} onClose={() => setPrintInvoice(null)} wide>
          {/* Print mode selector */}
          <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>حجم الطباعة:</span>
            {(["thermal", "a4"] as const).map((m) => (
              <button key={m} onClick={() => setPrintMode(m)} style={{
                padding: "4px 14px", borderRadius: 7, border: `1.5px solid ${printMode === m ? "#2563EB" : "#e2e8f0"}`,
                background: printMode === m ? "#eff6ff" : "#fff", color: printMode === m ? "#2563EB" : "#64748b",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>
                {m === "thermal" ? "🖨️ حراري 80mm" : "📄 A4"}
              </button>
            ))}
          </div>

          {/* Preview */}
          <div style={{ background: "#f1f5f9", borderRadius: 10, padding: 16, maxHeight: 480, overflowY: "auto", display: "flex", justifyContent: "center" }}>
            <div style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.12)", background: "#fff" }}>
              <POSReceipt
                invoice={printInvoice}
                settings={settings}
                cashierName={user?.name || "الكاشير"}
                printMode={printMode}
              />
            </div>
          </div>

          <div className="no-print" style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button style={{ ...S.btn("primary"), border: "none", flex: 1, fontWeight: 800 }} onClick={printReceipt}>
              🖨️ طباعة
            </button>
            <button style={{ ...S.btn("outline") }} onClick={() => setPrintInvoice(null)}>إغلاق</button>
          </div>
        </Modal>
      )}

      {/* ── Close Session Modal ── */}
      {showCloseSession && activeSession && (
        <Modal title={`🔴 إغلاق الوردية — ${activeSession.id}`} onClose={() => setShowCloseSession(false)} wide>
          {/* Session Summary */}
          <div style={{ background: C.surfaceAlt, borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: C.text }}>ملخص الوردية</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", fontSize: 13 }}>
              <span style={{ color: C.textMuted }}>إجمالي المبيعات</span>
              <span style={{ fontWeight: 700 }}>{fmt(activeSession.totalSales)}</span>
              <span style={{ color: C.textMuted }}>مبيعات نقدية</span>
              <span style={{ fontWeight: 700, color: C.success }}>{fmt(activeSession.totalCash)}</span>
              <span style={{ color: C.textMuted }}>مبيعات آجلة/بطاقة</span>
              <span style={{ fontWeight: 700 }}>{fmt(activeSession.totalCard)}</span>
              <span style={{ color: C.textMuted }}>عدد الفواتير</span>
              <span style={{ fontWeight: 700 }}>{activeSession.invoiceCount}</span>
              <span style={{ color: C.textMuted }}>رصيد افتتاحي</span>
              <span style={{ fontWeight: 700 }}>{fmt(activeSession.openingBalance)}</span>
              <span style={{ color: C.textMuted, fontWeight: 700 }}>الصندوق المتوقع</span>
              <span style={{ fontWeight: 800, color: C.accent }}>{fmt(activeSession.expectedCash)}</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={S.label}>المبلغ الفعلي في الصندوق (العد الفعلي) *</label>
              <input type="number" min="0" step="0.01" style={S.input} value={actualCash}
                onChange={(e) => setActualCash(e.target.value)} placeholder="0.00" autoFocus />
              {actualCash !== "" && !isNaN(parseFloat(actualCash)) && (
                <div style={{
                  marginTop: 6, padding: "6px 10px", borderRadius: 6, fontSize: 13, fontWeight: 700,
                  background: parseFloat(actualCash) === activeSession.expectedCash ? C.successLight
                    : parseFloat(actualCash) < activeSession.expectedCash ? "#fff3cd" : "#d4edda",
                  color: parseFloat(actualCash) === activeSession.expectedCash ? C.success
                    : parseFloat(actualCash) < activeSession.expectedCash ? C.warning : C.success,
                }}>
                  {parseFloat(actualCash) === activeSession.expectedCash ? "✅ لا فروقات"
                    : parseFloat(actualCash) < activeSession.expectedCash
                      ? `⚠️ عجز: ${fmt(activeSession.expectedCash - parseFloat(actualCash))}`
                      : `📈 زيادة: ${fmt(parseFloat(actualCash) - activeSession.expectedCash)}`}
                </div>
              )}
            </div>
            <div>
              <label style={S.label}>ملاحظات (اختياري)</label>
              <input type="text" style={S.input} value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)} placeholder="أي ملاحظات على الوردية..." />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button style={{ ...S.btn("danger"), border: "none" }} onClick={handleCloseSession}>إغلاق الوردية</button>
            <button style={{ ...S.btn("outline") }} onClick={() => setShowCloseSession(false)}>إلغاء</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
