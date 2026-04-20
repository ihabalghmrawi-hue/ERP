"use client";

import { useState } from "react";
import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { useAuth } from "@/hooks/useAuth";
import { DB, Product, Warehouse } from "@/lib/db/database";
import { AccountingEngine } from "@/lib/engine/accounting";
import { InventoryManager } from "@/lib/engine/inventory";
import { fmt, fmtNum, uid, logActivity } from "@/lib/engine/helpers";
import { KPI }        from "@/components/ui/KPI";
import { DataTable }  from "@/components/ui/DataTable";
import { Modal }      from "@/components/ui/Modal";
import { StatusBadge} from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";

interface Props { addToast: (msg: string, type?: "success" | "error" | "info") => void; }

const emptyProd = { name: "", sku: "", category: "", warehouseId: "", unitCost: "", sellPrice: "", taxRate: "15", taxExempt: false, qty: "0", reorderPoint: "5", unit: "" };
const emptyWH   = { name: "", location: "", manager: "" };
const emptyTransfer = { productId: "", fromWarehouseId: "", toWarehouseId: "", qty: "", notes: "" };

export function Inventory({ addToast }: Props) {
  const { t } = useLang();
  const { user } = useAuth();
  const db = DB.get();

  const [, tick] = useState(0);
  const rerender = () => tick((x) => x + 1);

  const [search, setSearch]         = useState("");
  const [activeTab, setActiveTab]   = useState<"products" | "transfers" | "movements">("products");
  const [showProduct, setShowProduct] = useState(false);
  const [showWH, setShowWH]           = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [prodForm, setProdForm]       = useState({ ...emptyProd });
  const [whForm, setWhForm]           = useState({ ...emptyWH });
  const [transferForm, setTransferForm] = useState({ ...emptyTransfer });

  const inv       = AccountingEngine.getInventoryValuation();
  const filtered  = inv.filter((p) => p.name?.includes(search) || p.sku?.includes(search));
  const totalValue = inv.reduce((s, p) => s + p.value, 0);
  const lowStock   = InventoryManager.getLowStockItems();
  const report     = InventoryManager.getInventoryReport();

  const handleAddProduct = () => {
    if (!prodForm.name || !prodForm.sku) { addToast(t("fillRequired"), "error"); return; }
    const product: Product = {
      id: uid(), sku: prodForm.sku, name: prodForm.name,
      category: prodForm.category, warehouseId: prodForm.warehouseId,
      unitCost: +prodForm.unitCost, sellPrice: +prodForm.sellPrice,
      taxRate: +(prodForm.taxRate || 0) / 100,
      taxExempt: (prodForm as any).taxExempt || false,
      qty: +prodForm.qty, reorderPoint: +prodForm.reorderPoint,
      unit: prodForm.unit,
    };
    db.products.push(product);
    InventoryManager.recordMovement("in", product.id, product.qty, `PROD-CREATION-${product.id}`, { notes: `إنشاء المنتج ${product.name}`, createdBy: user?.name });
    DB.save();
    rerender();
    logActivity(user?.id || "", user?.name || "", "CREATE", "Inventory", `أضاف المنتج ${product.name}`);
    addToast(t("productCreated"), "success");
    setShowProduct(false);
    setProdForm({ ...emptyProd });
  };

  const handleAddWH = () => {
    if (!whForm.name) { addToast(t("fillRequired"), "error"); return; }
    const wh: Warehouse = { id: uid(), ...whForm, isDefault: db.warehouses.length === 0 };
    db.warehouses.push(wh);
    DB.save();
    rerender();
    addToast(t("warehouseCreated"), "success");
    setShowWH(false);
    setWhForm({ ...emptyWH });
  };

  const handleTransfer = () => {
    if (!transferForm.productId || !transferForm.fromWarehouseId || !transferForm.toWarehouseId || !transferForm.qty) {
      addToast(t("fillRequired"), "error");
      return;
    }
    try {
      InventoryManager.transferProduct(
        transferForm.productId,
        +transferForm.qty,
        transferForm.fromWarehouseId,
        transferForm.toWarehouseId,
        transferForm.notes || undefined,
        user?.name
      );
      rerender();
      logActivity(user?.id || "", user?.name || "", "UPDATE", "Inventory", `حول منتج بين المستودعات`);
      addToast(t("transferSuccess"), "success");
      setShowTransfer(false);
      setTransferForm({ ...emptyTransfer });
    } catch (e: any) {
      addToast(e.message, "error");
    }
  };

  return (
    <div>
      <div style={S.pageTitle}>{t("inventoryManagement")}</div>
      <div style={S.pageSub}>{t("inventorySubtitle")}</div>

      <div style={S.grid(4)}>
        <KPI label={t("totalSKUs")}      value={db.products.length}  color={C.accentMid} icon="📦" />
        <KPI label={t("inventoryValue")} value={fmt(totalValue)}     color={C.success}   icon="💎" />
        <KPI label={t("lowStockItems")}  value={lowStock.length}     color={lowStock.length > 0 ? C.danger : C.success} icon="⚠️" />
        <KPI label={t("warehouses")}     value={db.warehouses.length} color={C.purple}   icon="🏭" />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, borderBottom: `2px solid ${C.border}` }}>
        {(["products", "transfers", "movements"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: activeTab === tab ? 700 : 500,
              color: activeTab === tab ? C.accentMid : C.textMuted,
              background: "none",
              border: "none",
              borderBottom: activeTab === tab ? `3px solid ${C.accentMid}` : "none",
              cursor: "pointer",
              marginBottom: -2,
            }}
          >
            {tab === "products" && t("productInventory")} {tab === "transfers" && "تحويلات المخزون"} {tab === "movements" && "حركات المخزون"}
          </button>
        ))}
      </div>

      {/* Products Tab */}
      {activeTab === "products" && (
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn("outline") }} onClick={() => setShowWH(true)}>{t("addWarehouse")}</button>
              <button style={{ ...S.btn("primary"), border: "none" }} onClick={() => setShowProduct(true)}>{t("newProduct")}</button>
              {db.warehouses.length > 0 && <button style={{ ...S.btn("outline") }} onClick={() => setShowTransfer(true)}>تحويل مخزون</button>}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input style={{ ...S.input, width: 220 }} placeholder={t("searchProducts")} value={search} onChange={(e) => setSearch(e.target.value)} />
              <div style={S.sectionTitle}>{t("productInventory")} ({db.products.length})</div>
            </div>
          </div>
          <DataTable
            headers={[
              { label: t("status") }, { label: t("stockValue") }, { label: t("margin") },
              { label: t("sellPrice") }, { label: t("unitCost") }, { label: t("qty") },
              { label: t("warehouse") }, { label: t("category") }, { label: t("productName") }, { label: t("sku") },
            ]}
            rows={filtered.map((p) => [
              <StatusBadge key="st" status={(p.qty || 0) <= (p.reorderPoint || 0) ? "overdue" : "active"} />,
              <span key="val" style={{ fontWeight: 700, color: C.accentMid }}>{fmt(p.value)}</span>,
              <span key="mg" style={{ color: C.success, fontWeight: 700 }}>{p.margin}%</span>,
              fmt(p.sellPrice), fmt(p.unitCost),
              <span key="qty" style={{ fontWeight: 800, color: (p.qty || 0) <= (p.reorderPoint || 0) ? C.danger : C.text }}>{fmtNum(p.qty || 0)} {p.unit}</span>,
              p.warehouseId ? (db.warehouses.find((w) => w.id === p.warehouseId)?.name || p.warehouseId) : "—",
              p.category || "—",
              <span key="name" style={{ fontWeight: 700 }}>{p.name}</span>,
              <span key="sku" style={{ color: C.textMuted, fontSize: 12 }}>{p.sku}</span>,
            ])}
            emptyMsg={t("noProductsYet")}
          />
        </div>
      )}

      {/* Warehouses card */}
      {activeTab === "products" && db.warehouses.length > 0 && (
        <div style={S.card}>
          <div style={S.sectionTitle}>{t("warehouses")}</div>
          <div style={{ marginTop: 12 }}>
            {db.warehouses.map((wh) => {
              const items = db.products.filter((p) => p.warehouseId === wh.id);
              const value = items.reduce((s, p) => s + (p.qty || 0) * p.unitCost, 0);
              return (
                <div key={wh.id} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 800, color: C.accentMid, fontSize: 14 }}>{fmt(value)}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{items.length} {t("totalSKUs")}</div>
                    {wh.isDefault && <span style={S.badge("success")}>افتراضي</span>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{wh.name}</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>{wh.location}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{t("warehouseManager")}: {wh.manager}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Low Stock Alert */}
      {activeTab === "products" && lowStock.length > 0 && (
        <div style={{ ...S.card, borderLeft: `4px solid ${C.danger}` }}>
          <div style={{ ...S.sectionTitle, color: C.danger }}>⚠️ تنبيهات المخزون المنخفض</div>
          <div style={{ marginTop: 12 }}>
            {lowStock.map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontWeight: 700, color: C.text }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{p.sku}</div>
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ color: C.danger, fontWeight: 700 }}>متوفر: {fmtNum(p.qty || 0)} {p.unit}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>الحد الأدنى: {fmtNum(p.reorderPoint || 0)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transfers Tab */}
      {activeTab === "transfers" && (
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <div style={S.sectionTitle}>تحويلات المخزون بين المستودعات</div>
            {db.warehouses.length >= 2 && <button style={{ ...S.btn("primary"), border: "none" }} onClick={() => setShowTransfer(true)}>تحويل جديد</button>}
          </div>
          {db.warehouses.length < 2 ? (
            <EmptyState icon="📦" title="لا توجد مستودعات كافية" desc="أنشئ مستودعين على الأقل لتفعيل التحويلات" />
          ) : (
            <DataTable
              headers={[{ label: "تاريخ" }, { label: "المنتج" }, { label: "الكمية" }, { label: "من" }, { label: "إلى" }, { label: "ملاحظات" }]}
              rows={db.inventoryMovements
                .filter((m) => m.type === "transfer")
                .slice(-20)
                .reverse()
                .map((m) => [
                  m.date,
                  <span key="prod" style={{ fontWeight: 700 }}>{m.productName}</span>,
                  <span key="qty" style={{ fontWeight: 700, color: C.accentMid }}>{fmtNum(m.quantity)}</span>,
                  db.warehouses.find((w) => w.id === m.fromWarehouseId)?.name || "—",
                  db.warehouses.find((w) => w.id === m.toWarehouseId)?.name || "—",
                  <span key="notes" style={{ fontSize: 12, color: C.textMuted }}>{m.notes || "—"}</span>,
                ])}
              emptyMsg="لا توجد تحويلات"
            />
          )}
        </div>
      )}

      {/* Movements Tab */}
      {activeTab === "movements" && (
        <div style={S.card}>
          <div style={S.sectionTitle}>سجل حركات المخزون</div>
          <DataTable
            headers={[{ label: "تاريخ" }, { label: "النوع" }, { label: "المنتج" }, { label: "الكمية" }, { label: "المرجع" }, { label: "الملاحظات" }]}
            rows={db.inventoryMovements
              .slice(-50)
              .reverse()
              .map((m) => [
                m.date,
                <span
                  key="type"
                  style={{
                    padding: "3px 8px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    background:
                      m.type === "in"
                        ? C.successLight
                        : m.type === "out"
                        ? C.dangerLight
                        : m.type === "transfer"
                        ? C.accentLight
                        : C.warningLight,
                    color: m.type === "in" ? C.success : m.type === "out" ? C.danger : m.type === "transfer" ? C.accentMid : C.warning,
                  }}
                >
                  {m.type === "in" ? "إدخال" : m.type === "out" ? "إخراج" : m.type === "transfer" ? "تحويل" : "تعديل"}
                </span>,
                <span key="prod" style={{ fontWeight: 700 }}>{m.productName}</span>,
                <span key="qty" style={{ fontWeight: 700, color: m.type === "out" ? C.danger : C.success }}>
                  {m.type === "out" ? "-" : "+"}{fmtNum(m.quantity)}
                </span>,
                <span key="ref" style={{ fontSize: 12, color: C.textMuted }}>{m.reference}</span>,
                <span key="notes" style={{ fontSize: 12, color: C.textMuted }}>{m.notes || "—"}</span>,
              ])}
            emptyMsg="لا توجد حركات مخزون"
          />
        </div>
      )}

      {/* Modal: Add Product */}
      {showProduct && (
        <Modal title={t("addProduct")} onClose={() => setShowProduct(false)}>
          {(["name","sku","category","unitCost","sellPrice","taxRate","qty","reorderPoint","unit"] as const).map((k) => (
            <div key={k} style={S.formGroup}>
              <label style={S.label}>{t(k === "name" ? "productNameLabel" : k === "sku" ? "skuLabel" : k === "category" ? "categoryLabel" : k === "unitCost" ? "unitCostLabel" : k === "sellPrice" ? "sellPriceLabel" : k === "taxRate" ? "taxRateLabel" : k === "qty" ? "qty" : k === "reorderPoint" ? "reorderPointLabel" : "unitLabel")}</label>
              <input style={S.input} type={["unitCost","sellPrice","taxRate","qty","reorderPoint"].includes(k) ? "number" : "text"} value={prodForm[k]} onChange={(e) => setProdForm({ ...prodForm, [k]: e.target.value })} placeholder="" />
            </div>
          ))}
          <div style={S.formGroup}>
            <label style={S.label}>{t("warehouseLabel")}</label>
            <select style={S.select} value={prodForm.warehouseId} onChange={(e) => setProdForm({ ...prodForm, warehouseId: e.target.value })}>
              <option value="">—</option>
              {db.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          {/* Tax Exemption */}
          <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, border: `1px solid ${(prodForm as any).taxExempt ? C.success : C.border}`, background: (prodForm as any).taxExempt ? C.successLight : C.surfaceAlt }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={(prodForm as any).taxExempt || false}
                onChange={(e) => setProdForm({ ...prodForm, taxExempt: e.target.checked } as any)}
                style={{ width: 16, height: 16, cursor: "pointer" }}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: (prodForm as any).taxExempt ? C.success : C.text }}>
                  🟢 معفى من ضريبة القيمة المضافة
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                  عند التحديد، لن يتم احتساب VAT على هذا المنتج في أي فاتورة
                </div>
              </div>
            </label>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-start" }}>
            <button style={{ ...S.btn("outline") }} onClick={() => setShowProduct(false)}>{t("cancel")}</button>
            <button style={{ ...S.btn("primary"), border: "none" }} onClick={handleAddProduct}>{t("save")}</button>
          </div>
        </Modal>
      )}

      {/* Modal: Add Warehouse */}
      {showWH && (
        <Modal title={t("addWarehouse")} onClose={() => setShowWH(false)}>
          {([["name", t("warehouseName")], ["location", t("warehouseLocation")], ["manager", t("warehouseManager")]] as [keyof typeof whForm, string][]).map(([k, lbl]) => (
            <div key={k} style={S.formGroup}>
              <label style={S.label}>{lbl}</label>
              <input style={S.input} value={whForm[k]} onChange={(e) => setWhForm({ ...whForm, [k]: e.target.value })} placeholder={lbl} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-start" }}>
            <button style={{ ...S.btn("outline") }} onClick={() => setShowWH(false)}>{t("cancel")}</button>
            <button style={{ ...S.btn("primary"), border: "none" }} onClick={handleAddWH}>{t("save")}</button>
          </div>
        </Modal>
      )}

      {/* Modal: Transfer Stock */}
      {showTransfer && db.warehouses.length >= 2 && (
        <Modal title="تحويل مخزون" onClose={() => setShowTransfer(false)}>
          <div style={S.formGroup}>
            <label style={S.label}>المنتج</label>
            <select style={S.select} value={transferForm.productId} onChange={(e) => setTransferForm({ ...transferForm, productId: e.target.value })}>
              <option value="">— اختر منتج</option>
              {db.products.map((p) => <option key={p.id} value={p.id}>{p.name} ({fmtNum(p.qty || 0)} متاح)</option>)}
            </select>
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>المستودع المصدر</label>
            <select style={S.select} value={transferForm.fromWarehouseId} onChange={(e) => setTransferForm({ ...transferForm, fromWarehouseId: e.target.value })}>
              <option value="">— اختر مستودع</option>
              {db.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>المستودع الهدف</label>
            <select style={S.select} value={transferForm.toWarehouseId} onChange={(e) => setTransferForm({ ...transferForm, toWarehouseId: e.target.value })}>
              <option value="">— اختر مستودع</option>
              {db.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>الكمية</label>
            <input style={S.input} type="number" value={transferForm.qty} onChange={(e) => setTransferForm({ ...transferForm, qty: e.target.value })} placeholder="0" />
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>ملاحظات</label>
            <input style={S.input} value={transferForm.notes} onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })} placeholder="اختياري" />
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-start" }}>
            <button style={{ ...S.btn("outline") }} onClick={() => setShowTransfer(false)}>{t("cancel")}</button>
            <button style={{ ...S.btn("primary"), border: "none" }} onClick={handleTransfer}>تحويل</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
