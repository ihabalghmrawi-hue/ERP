import { DB, JournalLine, Invoice, PurchaseOrder, Customer, Supplier, Account } from "../db/database";
import { InventoryManager } from "./inventory";

/**
 * محرك المحاسبة المتقدم - Full Accounting Engine
 * يدعم جميع العمليات المحاسبية مع القيد المزدوج التلقائي
 * ومتكامل مع نظام إدارة المخزون
 */
export const AccountingEngine = {
  // ─────────────────────────────────────────────────────────────────
  // أدوات مساعدة للعثور على الحسابات
  // ─────────────────────────────────────────────────────────────────

  getAccountByCode(code: string): Account | null {
    return DB.get().accounts.find((a) => a.code === code) || null;
  },

  getAccountsByType(type: string): Account[] {
    return DB.get().accounts.filter((a) => a.type === type);
  },

  // ─────────────────────────────────────────────────────────────────
  // Helpers: compute account balances for a date range / as-of date
  // ─────────────────────────────────────────────────────────────────
  _computePeriodBalances(startDate?: string, endDate?: string): Record<string, number> {
    const db = DB.get();
    const balances: Record<string, number> = {};
    db.accounts.forEach((a) => (balances[a.id] = 0));

    db.journalEntries.forEach((je) => {
      const d = je.date;
      if (startDate && d < startDate) return;
      if (endDate && d > endDate) return;
      je.lines.forEach((ln) => {
        balances[ln.accountId] = (balances[ln.accountId] || 0) + (ln.debit || 0) - (ln.credit || 0);
      });
    });

    return balances;
  },

  // ─────────────────────────────────────────────────────────────────
  // Core: ترحيل قيد يومية
  // ─────────────────────────────────────────────────────────────────

  postJE(description: string, reference: string, lines: JournalLine[]) {
    const db = DB.get();
    const id = `JE-${String(DB.nextId("je")).padStart(4, "0")}`;

    const totalD = lines.reduce((s, l) => s + l.debit, 0);
    const totalC = lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalD - totalC) > 0.01) {
      throw new Error(`القيد غير متوازن: مدين ${totalD.toFixed(2)} ≠ دائن ${totalC.toFixed(2)}`);
    }

    const entry = {
      id,
      date: new Date().toISOString().slice(0, 10),
      reference,
      description,
      status: "posted" as const,
      createdBy: "system",
      lines,
    };

    db.journalEntries.unshift(entry);

    // تحديث أرصدة الحسابات
    lines.forEach(({ accountId, debit, credit }) => {
      const acc = db.accounts.find((a) => a.id === accountId);
      if (acc) acc.balance = (acc.balance || 0) + debit - credit;
    });

    DB.save();
    return entry;
  },

  // ─────────────────────────────────────────────────────────────────
  // المبيعات والمرتجعات
  // ─────────────────────────────────────────────────────────────────

  postSalesInvoice(invoice: Invoice) {
    const db = DB.get();

    const arAcc = this.getAccountByCode("1100"); // ذمم مدينة
    const revAcc = this.getAccountByCode("4000"); // إيراد المبيعات
    const taxAcc = this.getAccountByCode("2200"); // ضريبة مبيعات
    const cogsAcc = this.getAccountByCode("5000"); // تكلفة البضاعة
    const invAcc = this.getAccountByCode("1200"); // المخزون
    const cashAcc = this.getAccountByCode("1010"); // الصندوق

    if (!revAcc || !cogsAcc || !invAcc) {
      throw new Error(
        "يرجى إنشاء الحسابات المحاسبية الأساسية أولاً:\n• 4000 - إيراد المبيعات\n• 5000 - تكلفة البضاعة المباعة\n• 1200 - المخزون"
      );
    }

    // حساب تكلفة البضاعة (FIFO) وتسجيل حركات المخزون
    let totalCOGS = 0;
    invoice.lines.forEach((line) => {
      const p = db.products.find((x) => x.id === line.productId);
      if (p) {
        totalCOGS += p.unitCost * line.qty;
        // تحديث المخزون
        p.qty = (p.qty || 0) - line.qty;
        
        // تسجيل حركة المخزون
        try {
          InventoryManager.recordMovement("out", line.productId, line.qty, invoice.id, {
            notes: `مبيعة - فاتورة #${invoice.id}`,
            createdBy: "system",
          });
        } catch (e) {
          // إذا فشل التسجيل، نتابع مع العميلية (المخزون تم تحديثه بالفعل)
        }
      }
    });

    const isCredit = invoice.paymentType === "credit";
    const drAccount = isCredit ? arAcc : cashAcc;
    if (!drAccount) {
      throw new Error("لم يتم العثور على حساب العميل أو الصندوق");
    }

    const lines: JournalLine[] = [
      { accountId: drAccount.id, accountName: drAccount.name, debit: invoice.total, credit: 0 },
      { accountId: revAcc.id, accountName: revAcc.name, debit: 0, credit: invoice.subtotal },
    ];

    if (taxAcc && invoice.taxAmount > 0) {
      lines.push({ accountId: taxAcc.id, accountName: taxAcc.name, debit: 0, credit: invoice.taxAmount });
    }

    if (totalCOGS > 0) {
      lines.push({ accountId: cogsAcc.id, accountName: cogsAcc.name, debit: totalCOGS, credit: 0 });
      lines.push({ accountId: invAcc.id, accountName: invAcc.name, debit: 0, credit: totalCOGS });
    }

    // تحديث رصيد العميل
    const cust = db.customers.find((c) => c.id === invoice.customerId);
    if (cust && isCredit) {
      cust.balance = (cust.balance || 0) + invoice.total;
    }

    return this.postJE(`فاتورة مبيعات - ${invoice.customerName}`, invoice.id, lines);
  },

  postSalesReturn(invoice: Invoice) {
    const db = DB.get();

    const arAcc = this.getAccountByCode("1100");
    const revAcc = this.getAccountByCode("4000");
    const taxAcc = this.getAccountByCode("2200");
    const cogsAcc = this.getAccountByCode("5000");
    const invAcc = this.getAccountByCode("1200");

    if (!revAcc || !cogsAcc || !invAcc) {
      throw new Error("الحسابات الأساسية غير موجودة");
    }

    let totalCOGS = 0;
    invoice.lines.forEach((line) => {
      const p = db.products.find((x) => x.id === line.productId);
      if (p) {
        totalCOGS += p.unitCost * line.qty;
        // إرجاع المخزون
        p.qty = (p.qty || 0) + line.qty;
        
        // تسجيل حركة المخزون (إدخال)
        try {
          InventoryManager.recordMovement("in", line.productId, line.qty, invoice.id, {
            notes: `مرتجع مبيعات - فاتورة #${invoice.id}`,
            createdBy: "system",
          });
        } catch (e) {
          // نتابع مع العملية
        }
      }
    });

    const lines: JournalLine[] = [
      { accountId: revAcc.id, accountName: revAcc.name, debit: invoice.subtotal, credit: 0 },
      { accountId: arAcc!.id, accountName: arAcc!.name, debit: 0, credit: invoice.total },
    ];

    if (taxAcc && invoice.taxAmount > 0) {
      lines.push({ accountId: taxAcc.id, accountName: taxAcc.name, debit: invoice.taxAmount, credit: 0 });
    }

    if (totalCOGS > 0) {
      lines.push({ accountId: invAcc.id, accountName: invAcc.name, debit: totalCOGS, credit: 0 });
      lines.push({ accountId: cogsAcc.id, accountName: cogsAcc.name, debit: 0, credit: totalCOGS });
    }

    // تقليل رصيد العميل
    const cust = db.customers.find((c) => c.id === invoice.customerId);
    if (cust) {
      cust.balance = (cust.balance || 0) - invoice.total;
    }

    return this.postJE(`مرتجع مبيعات - ${invoice.customerName}`, invoice.id, lines);
  },

  // ─────────────────────────────────────────────────────────────────
  // المشتريات والمرتجعات
  // ─────────────────────────────────────────────────────────────────

  postPurchaseInvoice(po: PurchaseOrder) {
    const db = DB.get();

    const invAcc    = this.getAccountByCode("1200"); // المخزون
    const apAcc     = this.getAccountByCode("2010"); // ذمم دائنة
    const vatRecAcc = this.getAccountByCode("2100"); // ضريبة المدخلات

    if (!invAcc || !apAcc) {
      throw new Error("يرجى إنشاء الحسابات المحاسبية الأساسية:\n• 1200 - المخزون\n• 2010 - الذمم الدائنة");
    }

    // إضافة المخزون وتسجيل حركات (بتكلفة بدون ضريبة)
    po.lines.forEach((line) => {
      const p = db.products.find((x) => x.id === line.productId);
      if (p) {
        p.qty = (p.qty || 0) + line.qty;
        try {
          InventoryManager.recordMovement("in", line.productId, line.qty, po.id, {
            notes: `شراء - أمر الشراء #${po.id}`,
            createdBy: "system",
          });
        } catch (e) {
          // نتابع مع العملية
        }
      }
    });

    // تحديث رصيد المورد بالإجمالي (شامل الضريبة)
    const supp = db.suppliers.find((s) => s.id === po.supplierId);
    if (supp) {
      supp.balance = (supp.balance || 0) + po.total;
    }

    const jeLines: import("../db/database").JournalLine[] = [
      { accountId: invAcc.id, accountName: invAcc.name, debit: po.subtotal, credit: 0 },
    ];

    if (vatRecAcc && po.taxAmount > 0) {
      jeLines.push({ accountId: vatRecAcc.id, accountName: vatRecAcc.name, debit: po.taxAmount, credit: 0 });
    }

    jeLines.push({ accountId: apAcc.id, accountName: apAcc.name, debit: 0, credit: po.total });

    return this.postJE(`فاتورة شراء - ${po.supplierName}`, po.id, jeLines);
  },

  postPurchaseReturn(po: PurchaseOrder) {
    const db = DB.get();

    const invAcc = this.getAccountByCode("1200");
    const apAcc = this.getAccountByCode("2010");

    if (!invAcc || !apAcc) {
      throw new Error("الحسابات الأساسية غير موجودة");
    }

    // استرجاع المخزون وتسجيل حركات
    po.lines.forEach((line) => {
      const p = db.products.find((x) => x.id === line.productId);
      if (p) {
        p.qty = (p.qty || 0) - line.qty;
        
        // تسجيل حركة المخزون (إخراج)
        try {
          InventoryManager.recordMovement("out", line.productId, line.qty, po.id, {
            notes: `مرتجع شراء - أمر الشراء #${po.id}`,
            createdBy: "system",
          });
        } catch (e) {
          // نتابع مع العملية
        }
      }
    });

    // تقليل رصيد المورد
    const supp = db.suppliers.find((s) => s.id === po.supplierId);
    if (supp) {
      supp.balance = (supp.balance || 0) - po.total;
    }

    return this.postJE(`مرتجع شراء - ${po.supplierName}`, po.id, [
      { accountId: apAcc.id, accountName: apAcc.name, debit: po.total, credit: 0 },
      { accountId: invAcc.id, accountName: invAcc.name, debit: 0, credit: po.total },
    ]);
  },

  // ─────────────────────────────────────────────────────────────────
  // سندات القبض والدفع
  // ─────────────────────────────────────────────────────────────────

  postCashReceipt(customerId: string, amount: number, description: string = "") {
    const db = DB.get();
    const cashAcc = this.getAccountByCode("1010");
    const arAcc = this.getAccountByCode("1100");

    if (!cashAcc || !arAcc) throw new Error("الحسابات الأساسية غير موجودة");

    const customer = db.customers.find((c) => c.id === customerId);
    if (customer) {
      customer.balance = (customer.balance || 0) - amount;
    }

    return this.postJE(
      description || `سند قبض من ${customer?.name || "عميل"}`,
      `RC-${Date.now()}`,
      [
        { accountId: cashAcc.id, accountName: cashAcc.name, debit: amount, credit: 0 },
        { accountId: arAcc.id, accountName: arAcc.name, debit: 0, credit: amount },
      ]
    );
  },

  postCashPayment(supplierId: string, amount: number, description: string = "") {
    const db = DB.get();
    const cashAcc = this.getAccountByCode("1010");
    const apAcc = this.getAccountByCode("2010");

    if (!cashAcc || !apAcc) throw new Error("الحسابات الأساسية غير موجودة");

    const supplier = db.suppliers.find((s) => s.id === supplierId);
    if (supplier) {
      supplier.balance = (supplier.balance || 0) - amount;
    }

    return this.postJE(
      description || `أمر دفع للمورد ${supplier?.name || "مورد"}`,
      `PM-${Date.now()}`,
      [
        { accountId: apAcc.id, accountName: apAcc.name, debit: amount, credit: 0 },
        { accountId: cashAcc.id, accountName: cashAcc.name, debit: 0, credit: amount },
      ]
    );
  },

  // ─────────────────────────────────────────────────────────────────
  // كشف الحسابات (Ledgers)
  // ─────────────────────────────────────────────────────────────────

  getCustomerLedger(customerId: string) {
    const db = DB.get();
    const customer = db.customers.find((c) => c.id === customerId);
    if (!customer) return null;

    const invoices = db.invoices.filter((inv) => inv.customerId === customerId);
    const relatedJEs = db.journalEntries.filter((je) =>
      invoices.some((inv) => inv.journalEntryId === je.id)
    );

    return {
      customer,
      invoices,
      journalEntries: relatedJEs,
      balance: customer.balance || 0,
    };
  },

  getSupplierLedger(supplierId: string) {
    const db = DB.get();
    const supplier = db.suppliers.find((s) => s.id === supplierId);
    if (!supplier) return null;

    const pos = db.purchaseOrders.filter((po) => po.supplierId === supplierId);
    const relatedJEs = db.journalEntries.filter((je) =>
      pos.some((po) => po.journalEntryId === je.id)
    );

    return {
      supplier,
      purchaseOrders: pos,
      journalEntries: relatedJEs,
      balance: supplier.balance || 0,
    };
  },

  getAccountLedger(accountId: string) {
    const db = DB.get();
    const account = db.accounts.find((a) => a.id === accountId);
    if (!account) return null;

    const relatedLines = db.journalEntries.flatMap((je) =>
      je.lines.filter((line) => line.accountId === accountId).map((line) => ({ je, line }))
    );

    return {
      account,
      entries: relatedLines,
      balance: account.balance || 0,
    };
  },

  // ─────────────────────────────────────────────────────────────────
  // التقارير المالية
  // ─────────────────────────────────────────────────────────────────

  getIncomeStatement(startDate?: string, endDate?: string) {
    const db = DB.get();

    const periodBalances = startDate || endDate ? this._computePeriodBalances(startDate, endDate) : null;

    const revenue = db.accounts
      .filter((a) => a.type === "revenue")
      .reduce((s, a) => s + (periodBalances ? (periodBalances[a.id] || 0) : (a.balance || 0)), 0);

    const contraRevenue = db.accounts
      .filter((a) => a.type === "contra_revenue")
      .reduce((s, a) => s + Math.abs(periodBalances ? (periodBalances[a.id] || 0) : (a.balance || 0)), 0);

    const cogs = db.accounts
      .filter((a) => a.type === "cogs")
      .reduce((s, a) => s + (periodBalances ? (periodBalances[a.id] || 0) : (a.balance || 0)), 0);

    const expenses = db.accounts
      .filter((a) => a.type === "expense")
      .reduce((s, a) => s + (periodBalances ? (periodBalances[a.id] || 0) : (a.balance || 0)), 0);

    const netRev = revenue - contraRevenue;
    const grossP = netRev - cogs;
    const netInc = grossP - expenses;

    return {
      revenue,
      contraRevenue,
      netRevenue: netRev,
      cogs,
      grossProfit: grossP,
      expenses,
      netIncome: netInc,
      period: { startDate, endDate },
    };
  },

  getBalanceSheet(asOfDate?: string) {
    const db = DB.get();

    const balances = asOfDate ? this._computePeriodBalances(undefined, asOfDate) : null;
    const assets = db.accounts.filter((a) => a.type === "asset");
    const liabilities = db.accounts.filter((a) => a.type === "liability");
    const equity = db.accounts.filter((a) => a.type === "equity");

    const totalAssets = assets.reduce((s, a) => s + (balances ? (balances[a.id] || 0) : (a.balance || 0)), 0);
    const totalLiabilities = liabilities.reduce((s, a) => s + (balances ? (balances[a.id] || 0) : (a.balance || 0)), 0);
    const totalEquity = equity.reduce((s, a) => s + (balances ? (balances[a.id] || 0) : (a.balance || 0)), 0);

    return {
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
      isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
      asOfDate: asOfDate || new Date().toISOString().slice(0, 10),
    };
  },

  getTrialBalance(asOfDate?: string) {
    const db = DB.get();
    const balances = asOfDate ? this._computePeriodBalances(undefined, asOfDate) : null;
    return {
      accounts: db.accounts
        .filter((a) => (balances ? (balances[a.id] || 0) : (a.balance || 0)) !== 0)
        .map((a) => ({
          code: a.code,
          name: a.name,
          type: a.type,
          debit: (balances ? (balances[a.id] || 0) : (a.balance || 0)) > 0 ? (balances ? (balances[a.id] || 0) : (a.balance || 0)) : 0,
          credit: (balances ? (balances[a.id] || 0) : (a.balance || 0)) < 0 ? Math.abs(balances ? (balances[a.id] || 0) : (a.balance || 0)) : 0,
        })),
      totalDebits: db.accounts
        .filter((a) => (balances ? (balances[a.id] || 0) : (a.balance || 0)) > 0)
        .reduce((s, a) => s + (balances ? (balances[a.id] || 0) : (a.balance || 0)), 0),
      totalCredits: db.accounts
        .filter((a) => (balances ? (balances[a.id] || 0) : (a.balance || 0)) < 0)
        .reduce((s, a) => s + Math.abs(balances ? (balances[a.id] || 0) : (a.balance || 0)), 0),
    };
  },

  // ─────────────────────────────────────────────────────────────────
  // تقيييم المخزون والأرباح
  // ─────────────────────────────────────────────────────────────────

  getInventoryValuation() {
    return DB.get().products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      qty: p.qty || 0,
      unitCost: p.unitCost,
      sellPrice: p.sellPrice,
      reorderPoint: p.reorderPoint || 0,
      unit: p.unit || "وحدة",
      warehouseId: p.warehouseId,
      category: p.category,
      taxRate: p.taxRate,
      value: (p.qty || 0) * p.unitCost,
      margin: p.sellPrice > 0
        ? (((p.sellPrice - p.unitCost) / p.sellPrice) * 100).toFixed(1) + "%"
        : "0%",
    }));
  },

  getTotalInventoryValue() {
    return this.getInventoryValuation().reduce((s, p) => s + p.value, 0);
  },

  getCashPosition() {
    const db = DB.get();
    const cashAcc = this.getAccountByCode("1010");
    const bankAcc = this.getAccountByCode("1020");

    return {
      cash: cashAcc?.balance || 0,
      bank: bankAcc?.balance || 0,
      total: (cashAcc?.balance || 0) + (bankAcc?.balance || 0),
    };
  },

  getReceivables() {
    const db = DB.get();
    return db.customers
      .filter((c) => (c.balance || 0) > 0)
      .map((c) => ({
        ...c,
        balance: c.balance || 0,
      }))
      .sort((a, b) => (b.balance || 0) - (a.balance || 0));
  },

  getPayables() {
    const db = DB.get();
    return db.suppliers
      .filter((s) => (s.balance || 0) > 0)
      .map((s) => ({
        ...s,
        balance: s.balance || 0,
      }))
      .sort((a, b) => (b.balance || 0) - (a.balance || 0));
  },

  // ─────────────────────────────────────────────────────────────────
  // تقرير ضريبة القيمة المضافة (VAT Report)
  // ─────────────────────────────────────────────────────────────────

  getVATReport(startDate?: string, endDate?: string) {
    const db = DB.get();

    const filteredInvoices = db.invoices.filter((inv) => {
      if (startDate && inv.date < startDate) return false;
      if (endDate   && inv.date > endDate)   return false;
      return true;
    });

    const filteredPOs = db.purchaseOrders.filter((po) => {
      if (startDate && po.date < startDate) return false;
      if (endDate   && po.date > endDate)   return false;
      return true;
    });

    const outputVAT = filteredInvoices.reduce((s, i) => s + (i.taxAmount || 0), 0);
    const inputVAT  = filteredPOs.reduce((s, p) => s + (p.taxAmount || 0), 0);
    const netVAT    = outputVAT - inputVAT;

    const taxableInvoices = filteredInvoices.filter((i) => (i.taxAmount || 0) > 0);
    const taxablePOs      = filteredPOs.filter((p) => (p.taxAmount || 0) > 0);

    const totalSalesSubtotal  = taxableInvoices.reduce((s, i) => s + i.subtotal, 0);
    const totalPurchSubtotal  = taxablePOs.reduce((s, p) => s + p.subtotal, 0);

    return {
      outputVAT,
      inputVAT,
      netVAT,
      totalSalesSubtotal,
      totalPurchSubtotal,
      taxableInvoices,
      taxablePOs,
      period: { startDate, endDate },
    };
  },
};
