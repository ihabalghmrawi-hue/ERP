import { DB, Product, Warehouse } from "../db/database";
import { AccountingEngine } from "./accounting";

/**
 * InventoryManager - نظام إدارة المخزون المتكامل
 * يدعم:
 * - تحويل الأصناف بين المخازن
 * - حركة المخزون
 * - التحقق من الكميات
 * - تنبيهات المخزون المنخفض
 */

export interface InventoryMovement {
  id: string;
  date: string;
  type: "in" | "out" | "transfer" | "adjustment";
  productId: string;
  productName: string;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  quantity: number;
  reference: string; // invoice ID, PO ID, etc
  notes?: string;
  createdBy?: string;
}

export const InventoryManager = {
  // ─────────────────────────────────────────────────────────────────
  // التحقق من الكميات المتاحة
  // ─────────────────────────────────────────────────────────────────

  getProductStock(productId: string, warehouseId?: string): number {
    const db = DB.get();
    const product = db.products.find((p) => p.id === productId);
    if (!product) return 0;

    if (warehouseId) {
      // الكمية في مستودع محدد
      return (product.warehouseId === warehouseId ? product.qty : 0) || 0;
    }

    // الكمية الإجمالية
    return product.qty || 0;
  },

  isStockAvailable(productId: string, requestedQty: number, warehouseId?: string): boolean {
    const available = this.getProductStock(productId, warehouseId);
    return available >= requestedQty;
  },

  getAllProductsStock() {
    const db = DB.get();
    return db.products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      qty: p.qty || 0,
      reorderPoint: p.reorderPoint || 0,
      unit: p.unit || "",
      warehouseId: p.warehouseId,
      isLowStock: (p.qty || 0) <= (p.reorderPoint || 0),
    }));
  },

  getLowStockItems() {
    return this.getAllProductsStock().filter((p) => p.isLowStock);
  },

  // ─────────────────────────────────────────────────────────────────
  // معالجة حركة المخزون
  // ─────────────────────────────────────────────────────────────────

  recordMovement(
    type: "in" | "out" | "transfer" | "adjustment",
    productId: string,
    quantity: number,
    reference: string,
    options: {
      fromWarehouseId?: string;
      toWarehouseId?: string;
      notes?: string;
      createdBy?: string;
    } = {}
  ): InventoryMovement | null {
    const db = DB.get();
    const product = db.products.find((p) => p.id === productId);

    if (!product) {
      throw new Error(`المنتج ${productId} غير موجود`);
    }

    // التحقق من الكمية المتاحة للعمليات التي تقلل المخزون
    if ((type === "out" || type === "transfer") && !this.isStockAvailable(productId, quantity, options.fromWarehouseId)) {
      throw new Error(`الكمية المطلوبة (${quantity}) غير متوفرة. المتاح: ${this.getProductStock(productId, options.fromWarehouseId)}`);
    }

    const movement: InventoryMovement = {
      id: `MOV-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      type,
      productId,
      productName: product.name,
      fromWarehouseId: options.fromWarehouseId,
      toWarehouseId: options.toWarehouseId,
      quantity,
      reference,
      notes: options.notes,
      createdBy: options.createdBy,
    };

    // تطبيق الحركة على الكمية
    switch (type) {
      case "in":
        product.qty = (product.qty || 0) + quantity;
        if (options.toWarehouseId) {
          product.warehouseId = options.toWarehouseId;
        }
        break;

      case "out":
        product.qty = Math.max(0, (product.qty || 0) - quantity);
        break;

      case "transfer":
        // تحويل من مستودع إلى آخر (نفس المنتج)
        if (options.fromWarehouseId && options.toWarehouseId) {
          // في نظام متعدد المستودعات، يجب تتبع الكميات لكل مستودع
          // في الوقت الحالي نفترض منتج واحد
          product.warehouseId = options.toWarehouseId;
        }
        break;

      case "adjustment":
        // تعديل يدوي للكمية
        product.qty = Math.max(0, quantity);
        break;
    }

    DB.save();
    return movement;
  },

  // ─────────────────────────────────────────────────────────────────
  // تحويل الأصناف بين المخازن
  // ─────────────────────────────────────────────────────────────────

  transferProduct(
    productId: string,
    quantity: number,
    fromWarehouseId: string,
    toWarehouseId: string,
    notes?: string,
    createdBy?: string
  ): InventoryMovement | null {
    const db = DB.get();

    const fromWarehouse = db.warehouses.find((w) => w.id === fromWarehouseId);
    const toWarehouse = db.warehouses.find((w) => w.id === toWarehouseId);

    if (!fromWarehouse) {
      throw new Error(`المستودع المصدر ${fromWarehouseId} غير موجود`);
    }
    if (!toWarehouse) {
      throw new Error(`المستودع الهدف ${toWarehouseId} غير موجود`);
    }

    return this.recordMovement("transfer", productId, quantity, `TRANSFER-${Date.now()}`, {
      fromWarehouseId,
      toWarehouseId,
      notes: notes || `تحويل من ${fromWarehouse.name} إلى ${toWarehouse.name}`,
      createdBy,
    });
  },

  // ─────────────────────────────────────────────────────────────────
  // إدارة المستودعات
  // ─────────────────────────────────────────────────────────────────

  getAllWarehouses(): Warehouse[] {
    return DB.get().warehouses;
  },

  getWarehouseBalance(warehouseId: string) {
    const db = DB.get();
    const warehouse = db.warehouses.find((w) => w.id === warehouseId);
    if (!warehouse) return null;

    const products = db.products.filter((p) => p.warehouseId === warehouseId);
    const totalValue = products.reduce((sum, p) => sum + (p.qty || 0) * p.unitCost, 0);

    return {
      warehouse,
      productCount: products.length,
      totalValue,
      products,
    };
  },

  getAllWarehousesBalance() {
    const db = DB.get();
    return db.warehouses.map((warehouse) => {
      const products = db.products.filter((p) => p.warehouseId === warehouse.id);
      const totalValue = products.reduce((sum, p) => sum + (p.qty || 0) * p.unitCost, 0);

      return {
        warehouse,
        productCount: products.length,
        totalValue,
      };
    });
  },

  // ─────────────────────────────────────────────────────────────────
  // تقارير المخزون
  // ─────────────────────────────────────────────────────────────────

  getInventoryReport() {
    const db = DB.get();
    const totalProducts = db.products.length;
    const lowStockCount = this.getLowStockItems().length;
    const totalValue = db.products.reduce((sum, p) => sum + (p.qty || 0) * p.unitCost, 0);
    const turnoverValue = db.invoices.reduce((sum, inv) => sum + inv.total, 0);

    return {
      summary: {
        totalProducts,
        lowStockCount,
        totalValue,
        turnoverValue,
      },
      byWarehouse: this.getAllWarehousesBalance(),
      lowStockItems: this.getLowStockItems(),
      allProducts: this.getAllProductsStock(),
    };
  },

  getProductHistory(productId: string) {
    const db = DB.get();
    const product = db.products.find((p) => p.id === productId);
    if (!product) return null;

    // جمع جميع الفواتير والمشتريات المتعلقة بهذا المنتج
    const invoiceHistory = db.invoices
      .filter((inv) => inv.lines.some((l) => l.productId === productId))
      .map((inv) => ({
        type: "sales",
        date: inv.date,
        reference: inv.id,
        qty: inv.lines.find((l) => l.productId === productId)?.qty || 0,
        unitPrice: inv.lines.find((l) => l.productId === productId)?.unitPrice || 0,
      }));

    const poHistory = db.purchaseOrders
      .filter((po) => po.lines.some((l) => l.productId === productId))
      .map((po) => ({
        type: "purchase",
        date: po.date,
        reference: po.id,
        qty: po.lines.find((l) => l.productId === productId)?.qty || 0,
        unitCost: po.lines.find((l) => l.productId === productId)?.unitCost || 0,
      }));

    return {
      product,
      currentStock: product.qty || 0,
      currentValue: (product.qty || 0) * product.unitCost,
      salesHistory: invoiceHistory,
      purchaseHistory: poHistory,
      totalSalesQty: invoiceHistory.reduce((sum, h) => sum + h.qty, 0),
      totalPurchaseQty: poHistory.reduce((sum, h) => sum + h.qty, 0),
    };
  },

  // ─────────────────────────────────────────────────────────────────
  // التحقق من إمكانية البيع
  // ─────────────────────────────────────────────────────────────────

  validateSaleLines(lines: Array<{ productId: string; qty: number }>): { valid: boolean; errors: string[] } {
    const db = DB.get();
    const errors: string[] = [];

    lines.forEach(({ productId, qty }) => {
      const product = db.products.find((p) => p.id === productId);
      if (!product) {
        errors.push(`المنتج ${productId} غير موجود`);
        return;
      }

      if (qty < 1) {
        errors.push(`الكمية يجب أن تكون أكبر من 0 للمنتج ${product.name}`);
        return;
      }

      if (!this.isStockAvailable(productId, qty)) {
        const available = this.getProductStock(productId);
        errors.push(`المنتج ${product.name}: الكمية المطلوبة ${qty} غير متوفرة (المتاح: ${available})`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  // ─────────────────────────────────────────────────────────────────
  // إعادة حساب تقييم المخزون
  // ─────────────────────────────────────────────────────────────────

  recalculateInventoryValue() {
    const db = DB.get();
    let totalValue = 0;

    db.products.forEach((p) => {
      const value = (p.qty || 0) * p.unitCost;
      totalValue += value;
    });

    // تحديث حساب المخزون في الميزانية
    const invAcc = AccountingEngine.getAccountByCode("1200");
    if (invAcc) {
      invAcc.balance = totalValue;
      DB.save();
    }

    return totalValue;
  },
};
