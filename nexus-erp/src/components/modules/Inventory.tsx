"use client";

import { useState } from "react";
import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { useAuth } from "@/hooks/useAuth";
import { DB, Product, Warehouse } from "@/lib/db/database";
import { AccountingEngine } from "@/lib/engine/accounting";
import { fmt, fmtNum, uid, logActivity } from "@/lib/engine/helpers";
import { KPI }        from "@/components/ui/KPI";
import { DataTable }  from "@/components/ui/DataTable";
import { Modal }      from "@/components/ui/Modal";
import { StatusBadge} from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";

interface Props { addToast: (msg: string, type?: "success" | "error" | "info") => void; }

const emptyProd = { name: "", sku: "", category: "", warehouseId: "", unitCost: "", sellPrice: "", taxRate: "15", qty: "0", reorderPoint: "5", unit: "" };
const emptyWH   = { name: "", location: "", manager: "" };

export function Inventory({ addToast }: Props) {
  const { t } = useLang();
  const { user } = useAuth();
  const db = DB.get();

  const [, tick] = useState(0);
  const rerender = () => tick((x) => x + 1);

  const [search, setSearch]         = useState("");
  const [showProduct, setShowProduct] = useState(false);
  const [showWH, setShowWH]           = useState(false);
  const [prodForm, setProdForm]       = useState({ ...emptyProd });
  const [whForm, setWhForm]           = useState({ ...emptyWH });

  const inv       = AccountingEngine.getInventoryValuation();
  const filtered  = inv.filter((p) => p.name?.includes(search) || p.sku?.includes(search));
  const totalValue = inv.reduce((s, p) => s + p.value, 0);
  const lowStock   = inv.filter((p) => (p.qty || 0) <= (p.reorderPoint || 0));

  const handleAddProduct = () => {
    if (!prodForm.name || !prodForm.sku) { addToast(t("fillRequired"), "error"); return; }
    const product: Product = {
      id: uid(), sku: prodForm.sku, name: prodForm.name,
      category: prodForm.category, warehouseId: prodForm.warehouseId,
      unitCost: +prodForm.unitCost, sellPrice: +prodForm.sellPrice,
      taxRate: +(prodForm.taxRate || 0) / 100,
      qty: +prodForm.qty, reorderPoint: +prodForm.reorderPoint,
      unit: prodForm.unit,
    };
    db.products.push(product);
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

      <div style={S.card}>
        <div style={S.sectionHeader}>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...S.btn("outline") }} onClick={() => setShowWH(true)}>{t("addWarehouse")}</button>
            <button style={{ ...S.btn("primary"), border: "none" }} onClick={() => setShowProduct(true)}>{t("newProduct")}</button>
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

      {/* Warehouses card */}
      {db.warehouses.length > 0 && (
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
    </div>
  );
}
