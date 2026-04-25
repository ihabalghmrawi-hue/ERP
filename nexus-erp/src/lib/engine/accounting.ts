import { DB, JournalLine, JournalEntry, JESourceType, Invoice, PurchaseOrder, Account, FinancialPeriod, TreasuryTransaction, POSSession } from "../db/database";
import { InventoryManager } from "./inventory";
import { isPeriodLocked } from "./permissions";

export interface GeneralLedgerEntry {
  jeId: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  sourceType: JESourceType;
  sourceId: string;
  status: JournalEntry["status"];
}

export const AccountingEngine = {
  // ─────────────────────────────────────────────────────────────────
  // Account lookup helpers
  // ─────────────────────────────────────────────────────────────────

  getAccountByCode(code: string): Account | null {
    return DB.get().accounts.find((a) => a.code === code) || null;
  },

  getAccountsByType(type: string): Account[] {
    return DB.get().accounts.filter((a) => a.type === type);
  },

  // ─────────────────────────────────────────────────────────────────
  // Period balance computation (for date-filtered reports)
  // ─────────────────────────────────────────────────────────────────

  _computePeriodBalances(startDate?: string, endDate?: string): Record<string, number> {
    const db = DB.get();
    const balances: Record<string, number> = {};
    db.accounts.forEach((a) => (balances[a.id] = 0));

    db.journalEntries.forEach((je) => {
      if (je.status === "reversed") return; // skip reversed entries
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
  // Core: post journal entry — validates balance before saving
  // ─────────────────────────────────────────────────────────────────

  postJE(
    description: string,
    reference: string,
    lines: JournalLine[],
    sourceType: JESourceType = "manual",
    sourceId: string = "",
    extra?: {
      reversalOf?: string;
      createdBy?: string;
      date?: string;           // override posting date (for backdated entries)
      currency?: string;
      exchangeRate?: number;
    }
  ): JournalEntry {
    const db = DB.get();
    const now = new Date().toISOString();
    const postingDate = extra?.date || now.slice(0, 10);

    // ── Period lock check ──────────────────────────────────
    if (isPeriodLocked(postingDate, db.settings.lockedPeriods ?? [], db.financialPeriods ?? [])) {
      throw new Error(
        `الفترة المحاسبية ${postingDate.slice(0, 7)} مغلقة — لا يمكن ترحيل قيود فيها. أعِد فتح الفترة أولاً.`
      );
    }

    // ── Integrity: at least 2 lines ─────────────────────────
    if (lines.length < 2) {
      throw new Error("القيد يجب أن يحتوي على سطرين على الأقل (مدين ودائن)");
    }

    // ── Integrity: debits must equal credits ────────────────
    const totalD = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalC = lines.reduce((s, l) => s + (l.credit || 0), 0);
    if (Math.abs(totalD - totalC) > 0.005) {
      throw new Error(
        `القيد غير متوازن: مجموع المدين ${totalD.toFixed(2)} ≠ مجموع الدائن ${totalC.toFixed(2)} — تم رفض الترحيل`
      );
    }

    // ── Integrity: no zero-value lines ──────────────────────
    if (lines.some((l) => (l.debit || 0) === 0 && (l.credit || 0) === 0)) {
      throw new Error("القيد يحتوي على سطر بقيمة صفر — يرجى حذف السطور الفارغة");
    }

    const id = `JE-${String(DB.nextId("je")).padStart(4, "0")}`;
    const entry: JournalEntry = {
      id,
      date: postingDate,
      reference,
      description,
      status: "posted",
      lines,
      sourceType,
      sourceId: sourceId || reference,
      createdBy: extra?.createdBy || "system",
      createdAt: now,
      ...(extra?.currency    ? { currency: extra.currency }       : {}),
      ...(extra?.exchangeRate ? { exchangeRate: extra.exchangeRate } : {}),
      ...(extra?.reversalOf  ? { reversalOf: extra.reversalOf }   : {}),
    };

    db.journalEntries.unshift(entry);

    // Update account running balances
    lines.forEach(({ accountId, debit, credit }) => {
      const acc = db.accounts.find((a) => a.id === accountId);
      if (acc) acc.balance = (acc.balance || 0) + (debit || 0) - (credit || 0);
    });

    DB.save();
    return entry;
  },

  // ─────────────────────────────────────────────────────────────────
  // Reversal Engine — reverse any posted JE
  // ─────────────────────────────────────────────────────────────────

  reverseJE(jeId: string, description?: string, reversedByUser?: string): JournalEntry {
    const db = DB.get();
    const original = db.journalEntries.find((je) => je.id === jeId);

    // ── Validation ──────────────────────────────────────────
    if (!original) throw new Error(`القيد ${jeId} غير موجود`);
    if (original.status === "reversed") {
      throw new Error(`القيد ${jeId} تم عكسه مسبقاً بالقيد ${original.reversedBy} — لا يمكن عكسه مرة أخرى`);
    }
    if (original.status === "draft") {
      throw new Error(`لا يمكن عكس قيد في حالة مسودة (draft)`);
    }

    // ── Period lock: reversal date must be in an open period ─
    const today = new Date().toISOString().slice(0, 10);
    if (isPeriodLocked(today, db.settings.lockedPeriods ?? [], db.financialPeriods ?? [])) {
      throw new Error(
        `الفترة الحالية ${today.slice(0, 7)} مغلقة — لا يمكن ترحيل القيد العكسي فيها. أعِد فتح الفترة أولاً.`
      );
    }

    const now = new Date().toISOString();
    const reversedLines: JournalLine[] = original.lines.map((l) => ({
      accountId:    l.accountId,
      accountName:  l.accountName,
      debit:        l.credit,
      credit:       l.debit,
      currency:     l.currency,
      exchangeRate: l.exchangeRate,
      foreignDebit: l.foreignCredit,
      foreignCredit: l.foreignDebit,
    }));

    const reversal = this.postJE(
      description || `عكس القيد ${jeId} — ${original.description}`,
      `REV-${original.reference}`,
      reversedLines,
      "reversal",
      jeId,
      { reversalOf: jeId, createdBy: reversedByUser || "system" }
    );

    // Mark original as fully reversed with audit trail
    original.status        = "reversed";
    original.reversedBy    = reversal.id;
    original.reversedByUser = reversedByUser || "system";
    original.reversedAt    = now;
    DB.save();

    return reversal;
  },

  // ─────────────────────────────────────────────────────────────────
  // Financial Period Management
  // ─────────────────────────────────────────────────────────────────

  createPeriod(
    name: string,
    startDate: string,
    endDate: string,
    createdBy: string
  ): FinancialPeriod {
    const db = DB.get();
    if (!db.financialPeriods) db.financialPeriods = [];

    // Overlap check
    const overlap = db.financialPeriods.find(
      (p) => startDate <= p.endDate && endDate >= p.startDate
    );
    if (overlap) {
      throw new Error(`يتداخل مع الفترة "${overlap.name}" (${overlap.startDate} → ${overlap.endDate})`);
    }

    const period: FinancialPeriod = {
      id: `FP-${String(DB.nextId("fp")).padStart(3, "0")}`,
      name,
      startDate,
      endDate,
      status: "open",
      openedBy: createdBy,
      openedAt: new Date().toISOString(),
    };

    db.financialPeriods.push(period);
    db.financialPeriods.sort((a, b) => a.startDate.localeCompare(b.startDate));
    DB.save();
    return period;
  },

  closePeriod(periodId: string, closedBy: string): FinancialPeriod {
    const db = DB.get();
    const period = db.financialPeriods?.find((p) => p.id === periodId);
    if (!period) throw new Error(`الفترة ${periodId} غير موجودة`);
    if (period.status === "closed") throw new Error(`الفترة "${period.name}" مغلقة مسبقاً`);

    period.status   = "closed";
    period.closedBy = closedBy;
    period.closedAt = new Date().toISOString();
    DB.save();
    return period;
  },

  openPeriod(periodId: string, openedBy: string): FinancialPeriod {
    const db = DB.get();
    const period = db.financialPeriods?.find((p) => p.id === periodId);
    if (!period) throw new Error(`الفترة ${periodId} غير موجودة`);
    if (period.status === "open") throw new Error(`الفترة "${period.name}" مفتوحة مسبقاً`);

    period.status   = "open";
    period.openedBy = openedBy;
    period.openedAt = new Date().toISOString();
    DB.save();
    return period;
  },

  getPeriodForDate(date: string): FinancialPeriod | null {
    const db = DB.get();
    return db.financialPeriods?.find(
      (p) => date >= p.startDate && date <= p.endDate
    ) || null;
  },

  // ─────────────────────────────────────────────────────────────────
  // Sales Invoice Posting
  // ─────────────────────────────────────────────────────────────────

  postSalesInvoice(invoice: Invoice): JournalEntry {
    // Guard: no double posting
    if (invoice.journalEntryId) {
      const db = DB.get();
      const existing = db.journalEntries.find((je) => je.id === invoice.journalEntryId);
      if (existing && existing.status !== "reversed") {
        throw new Error(`الفاتورة ${invoice.id} مرحّلة مسبقاً (قيد: ${invoice.journalEntryId})`);
      }
    }

    const db = DB.get();
    const arAcc   = this.getAccountByCode("1100");
    const revAcc  = this.getAccountByCode("4000");
    const taxAcc  = this.getAccountByCode("2200");
    const cogsAcc = this.getAccountByCode("5000");
    const invAcc  = this.getAccountByCode("1200");
    const cashAcc = this.getAccountByCode("1010");

    if (!revAcc || !cogsAcc || !invAcc) {
      throw new Error(
        "يرجى إنشاء الحسابات المحاسبية الأساسية:\n• 4000 - إيراد المبيعات\n• 5000 - تكلفة البضاعة\n• 1200 - المخزون"
      );
    }

    // Compute COGS and update inventory
    let totalCOGS = 0;
    invoice.lines.forEach((line) => {
      const p = db.products.find((x) => x.id === line.productId);
      if (p) {
        totalCOGS += p.unitCost * line.qty;
        p.qty = (p.qty || 0) - line.qty;
        try {
          InventoryManager.recordMovement("out", line.productId, line.qty, invoice.id, {
            notes: `مبيعة — فاتورة ${invoice.id}`,
            createdBy: "system",
          });
        } catch {}
      }
    });

    const isCredit  = invoice.paymentType === "credit";
    const drAccount = isCredit ? arAcc : cashAcc;
    if (!drAccount) throw new Error("لم يتم العثور على حساب الذمم أو الصندوق");

    // Lines: DR [AR or Cash] / CR Revenue / CR VAT Payable
    const lines: JournalLine[] = [
      { accountId: drAccount.id, accountName: drAccount.name, debit: invoice.total, credit: 0 },
      { accountId: revAcc.id,    accountName: revAcc.name,    debit: 0, credit: invoice.subtotal },
    ];

    if (taxAcc && (invoice.taxAmount || 0) > 0) {
      lines.push({ accountId: taxAcc.id, accountName: taxAcc.name, debit: 0, credit: invoice.taxAmount });
    }

    // COGS: DR COGS / CR Inventory
    if (totalCOGS > 0) {
      lines.push({ accountId: cogsAcc.id, accountName: cogsAcc.name, debit: totalCOGS, credit: 0 });
      lines.push({ accountId: invAcc.id,  accountName: invAcc.name,  debit: 0, credit: totalCOGS });
    }

    // Update customer AR balance
    const cust = db.customers.find((c) => c.id === invoice.customerId);
    if (cust && isCredit) {
      cust.balance = (cust.balance || 0) + invoice.total;
    }

    return this.postJE(
      `فاتورة مبيعات — ${invoice.customerName}`,
      invoice.id,
      lines,
      "invoice",
      invoice.id
    );
  },

  // ─────────────────────────────────────────────────────────────────
  // Sales Return — reverses original JE + restores inventory
  // ─────────────────────────────────────────────────────────────────

  postSalesReturn(invoice: Invoice): JournalEntry {
    if (invoice.isReturned) {
      throw new Error(`الفاتورة ${invoice.id} تم إرجاعها مسبقاً`);
    }

    const db = DB.get();

    // Restore inventory
    invoice.lines.forEach((line) => {
      const p = db.products.find((x) => x.id === line.productId);
      if (p) {
        p.qty = (p.qty || 0) + line.qty;
        try {
          InventoryManager.recordMovement("in", line.productId, line.qty, invoice.id, {
            notes: `مرتجع مبيعات — فاتورة ${invoice.id}`,
            createdBy: "system",
          });
        } catch {}
      }
    });

    // Reverse customer balance
    const cust = db.customers.find((c) => c.id === invoice.customerId);
    if (cust && invoice.paymentType === "credit") {
      cust.balance = Math.max(0, (cust.balance || 0) - invoice.total);
    }

    // If original JE exists: reverse it
    if (invoice.journalEntryId) {
      return this.reverseJE(
        invoice.journalEntryId,
        `مرتجع مبيعات — ${invoice.customerName} (فاتورة ${invoice.id})`
      );
    }

    // No original JE: build manual reversal entry
    const arAcc   = this.getAccountByCode("1100");
    const revAcc  = this.getAccountByCode("4000");
    const taxAcc  = this.getAccountByCode("2200");
    const cogsAcc = this.getAccountByCode("5000");
    const invAcc  = this.getAccountByCode("1200");

    if (!revAcc || !cogsAcc || !invAcc) throw new Error("الحسابات الأساسية غير موجودة");

    let totalCOGS = 0;
    invoice.lines.forEach((l) => {
      const p = db.products.find((x) => x.id === l.productId);
      if (p) totalCOGS += p.unitCost * l.qty;
    });

    const lines: JournalLine[] = [
      { accountId: revAcc.id,   accountName: revAcc.name,   debit: invoice.subtotal, credit: 0 },
      { accountId: arAcc!.id,   accountName: arAcc!.name,   debit: 0, credit: invoice.total },
    ];
    if (taxAcc && (invoice.taxAmount || 0) > 0) {
      lines.push({ accountId: taxAcc.id, accountName: taxAcc.name, debit: invoice.taxAmount, credit: 0 });
    }
    if (totalCOGS > 0) {
      lines.push({ accountId: invAcc.id,  accountName: invAcc.name,  debit: totalCOGS, credit: 0 });
      lines.push({ accountId: cogsAcc.id, accountName: cogsAcc.name, debit: 0, credit: totalCOGS });
    }

    return this.postJE(
      `مرتجع مبيعات — ${invoice.customerName} (فاتورة ${invoice.id})`,
      `RET-${invoice.id}`,
      lines,
      "refund",
      invoice.id
    );
  },

  // ─────────────────────────────────────────────────────────────────
  // Purchase Invoice Posting
  // ─────────────────────────────────────────────────────────────────

  postPurchaseInvoice(po: PurchaseOrder): JournalEntry {
    // Guard: no double posting
    if (po.journalEntryId) {
      const db = DB.get();
      const existing = db.journalEntries.find((je) => je.id === po.journalEntryId);
      if (existing && existing.status !== "reversed") {
        throw new Error(`أمر الشراء ${po.id} مرحّل مسبقاً (قيد: ${po.journalEntryId})`);
      }
    }

    const db = DB.get();
    const invAcc    = this.getAccountByCode("1200");
    const apAcc     = this.getAccountByCode("2010");
    const vatRecAcc = this.getAccountByCode("2100");

    if (!invAcc || !apAcc) {
      throw new Error("يرجى إنشاء الحسابات: 1200 - المخزون، 2010 - الذمم الدائنة");
    }

    // Receive inventory
    po.lines.forEach((line) => {
      const p = db.products.find((x) => x.id === line.productId);
      if (p) {
        p.qty = (p.qty || 0) + line.qty;
        try {
          InventoryManager.recordMovement("in", line.productId, line.qty, po.id, {
            notes: `شراء — أمر الشراء ${po.id}`,
            createdBy: "system",
          });
        } catch {}
      }
    });

    // Update supplier AP balance
    const supp = db.suppliers.find((s) => s.id === po.supplierId);
    if (supp) supp.balance = (supp.balance || 0) + po.total;

    // Lines: DR Inventory / DR VAT Recoverable / CR AP
    const jeLines: JournalLine[] = [
      { accountId: invAcc.id, accountName: invAcc.name, debit: po.subtotal, credit: 0 },
    ];
    if (vatRecAcc && (po.taxAmount || 0) > 0) {
      jeLines.push({ accountId: vatRecAcc.id, accountName: vatRecAcc.name, debit: po.taxAmount, credit: 0 });
    }
    jeLines.push({ accountId: apAcc.id, accountName: apAcc.name, debit: 0, credit: po.total });

    return this.postJE(
      `فاتورة شراء — ${po.supplierName}`,
      po.id,
      jeLines,
      "purchase",
      po.id
    );
  },

  // ─────────────────────────────────────────────────────────────────
  // Purchase Return — reverses original JE + removes inventory
  // ─────────────────────────────────────────────────────────────────

  postPurchaseReturn(po: PurchaseOrder): JournalEntry {
    if (po.isReturned) {
      throw new Error(`أمر الشراء ${po.id} تم إرجاعه مسبقاً`);
    }

    const db = DB.get();

    // Remove inventory
    po.lines.forEach((line) => {
      const p = db.products.find((x) => x.id === line.productId);
      if (p) {
        p.qty = Math.max(0, (p.qty || 0) - line.qty);
        try {
          InventoryManager.recordMovement("out", line.productId, line.qty, po.id, {
            notes: `مرتجع شراء — أمر الشراء ${po.id}`,
            createdBy: "system",
          });
        } catch {}
      }
    });

    // Reverse supplier balance
    const supp = db.suppliers.find((s) => s.id === po.supplierId);
    if (supp) supp.balance = Math.max(0, (supp.balance || 0) - po.total);

    // If original JE exists: reverse it
    if (po.journalEntryId) {
      return this.reverseJE(
        po.journalEntryId,
        `مرتجع شراء — ${po.supplierName} (أمر الشراء ${po.id})`
      );
    }

    // Manual reversal entry
    const invAcc = this.getAccountByCode("1200");
    const apAcc  = this.getAccountByCode("2010");
    if (!invAcc || !apAcc) throw new Error("الحسابات الأساسية غير موجودة");

    return this.postJE(
      `مرتجع شراء — ${po.supplierName} (أمر الشراء ${po.id})`,
      `RET-${po.id}`,
      [
        { accountId: apAcc.id,  accountName: apAcc.name,  debit: po.total, credit: 0 },
        { accountId: invAcc.id, accountName: invAcc.name, debit: 0, credit: po.total },
      ],
      "refund",
      po.id
    );
  },

  // ─────────────────────────────────────────────────────────────────
  // Cash Receipt (customer payment)
  // ─────────────────────────────────────────────────────────────────

  postCashReceipt(customerId: string, amount: number, description: string = "", invoiceId?: string): JournalEntry {
    const db = DB.get();
    const cashAcc = this.getAccountByCode("1010");
    const arAcc   = this.getAccountByCode("1100");
    if (!cashAcc || !arAcc) throw new Error("الحسابات الأساسية غير موجودة (1010, 1100)");

    const customer = db.customers.find((c) => c.id === customerId);
    if (customer) {
      customer.balance = Math.max(0, (customer.balance || 0) - amount);
    }

    return this.postJE(
      description || `سند قبض — ${customer?.name || "عميل"}`,
      invoiceId ? `RC-${invoiceId}` : `RC-${Date.now()}`,
      [
        { accountId: cashAcc.id, accountName: cashAcc.name, debit: amount,  credit: 0 },
        { accountId: arAcc.id,   accountName: arAcc.name,   debit: 0,       credit: amount },
      ],
      "payment",
      invoiceId || customerId
    );
  },

  // ─────────────────────────────────────────────────────────────────
  // Cash Payment (supplier payment)
  // ─────────────────────────────────────────────────────────────────

  postCashPayment(supplierId: string, amount: number, description: string = "", poId?: string): JournalEntry {
    const db = DB.get();
    const cashAcc = this.getAccountByCode("1010");
    const apAcc   = this.getAccountByCode("2010");
    if (!cashAcc || !apAcc) throw new Error("الحسابات الأساسية غير موجودة (1010, 2010)");

    const supplier = db.suppliers.find((s) => s.id === supplierId);
    if (supplier) {
      supplier.balance = Math.max(0, (supplier.balance || 0) - amount);
    }

    return this.postJE(
      description || `سند دفع — ${supplier?.name || "مورد"}`,
      poId ? `PM-${poId}` : `PM-${Date.now()}`,
      [
        { accountId: apAcc.id,   accountName: apAcc.name,   debit: amount, credit: 0 },
        { accountId: cashAcc.id, accountName: cashAcc.name, debit: 0,      credit: amount },
      ],
      "purchase_payment",
      poId || supplierId
    );
  },

  // ─────────────────────────────────────────────────────────────────
  // General Ledger — running balance per account
  // ─────────────────────────────────────────────────────────────────

  getGeneralLedger(
    accountId: string,
    startDate?: string,
    endDate?: string
  ): { account: Account | null; entries: GeneralLedgerEntry[]; openingBalance: number; closingBalance: number } {
    const db = DB.get();
    const account = db.accounts.find((a) => a.id === accountId) || null;

    // Gather all JE lines for this account, sorted by date asc
    const rawEntries = db.journalEntries
      .filter((je) => {
        if (je.status === "reversed") return false; // skip reversed
        return je.lines.some((l) => l.accountId === accountId);
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    // Opening balance = all entries before startDate
    let openingBalance = 0;
    if (startDate) {
      rawEntries
        .filter((je) => je.date < startDate)
        .forEach((je) => {
          je.lines.filter((l) => l.accountId === accountId).forEach((l) => {
            openingBalance += (l.debit || 0) - (l.credit || 0);
          });
        });
    }

    // Build running balance entries within date range
    let running = openingBalance;
    const entries: GeneralLedgerEntry[] = [];

    rawEntries
      .filter((je) => {
        if (startDate && je.date < startDate) return false;
        if (endDate && je.date > endDate) return false;
        return true;
      })
      .forEach((je) => {
        je.lines
          .filter((l) => l.accountId === accountId)
          .forEach((l) => {
            running += (l.debit || 0) - (l.credit || 0);
            entries.push({
              jeId: je.id,
              date: je.date,
              description: je.description,
              debit: l.debit || 0,
              credit: l.credit || 0,
              runningBalance: running,
              sourceType: je.sourceType || "manual",
              sourceId: je.sourceId || je.reference,
              status: je.status,
            });
          });
      });

    return { account, entries, openingBalance, closingBalance: running };
  },

  // ─────────────────────────────────────────────────────────────────
  // Customer & Supplier Ledgers
  // ─────────────────────────────────────────────────────────────────

  getCustomerLedger(customerId: string) {
    const db = DB.get();
    const customer = db.customers.find((c) => c.id === customerId);
    if (!customer) return null;
    const invoices    = db.invoices.filter((inv) => inv.customerId === customerId);
    const relatedJEs  = db.journalEntries.filter((je) =>
      invoices.some((inv) => inv.journalEntryId === je.id)
    );
    return { customer, invoices, journalEntries: relatedJEs, balance: customer.balance || 0 };
  },

  getSupplierLedger(supplierId: string) {
    const db = DB.get();
    const supplier = db.suppliers.find((s) => s.id === supplierId);
    if (!supplier) return null;
    const pos        = db.purchaseOrders.filter((po) => po.supplierId === supplierId);
    const relatedJEs = db.journalEntries.filter((je) =>
      pos.some((po) => po.journalEntryId === je.id)
    );
    return { supplier, purchaseOrders: pos, journalEntries: relatedJEs, balance: supplier.balance || 0 };
  },

  getAccountLedger(accountId: string) {
    const db = DB.get();
    const account = db.accounts.find((a) => a.id === accountId);
    if (!account) return null;
    const relatedLines = db.journalEntries.flatMap((je) =>
      je.lines.filter((line) => line.accountId === accountId).map((line) => ({ je, line }))
    );
    return { account, entries: relatedLines, balance: account.balance || 0 };
  },

  // ─────────────────────────────────────────────────────────────────
  // Financial Reports
  // ─────────────────────────────────────────────────────────────────

  getIncomeStatement(startDate?: string, endDate?: string) {
    const db = DB.get();
    const periodBalances = (startDate || endDate) ? this._computePeriodBalances(startDate, endDate) : null;
    const bal = (a: Account) => periodBalances ? (periodBalances[a.id] || 0) : (a.balance || 0);

    const revenue      = db.accounts.filter((a) => a.type === "revenue").reduce((s, a) => s + bal(a), 0);
    const contraRev    = db.accounts.filter((a) => a.type === "contra_revenue").reduce((s, a) => s + Math.abs(bal(a)), 0);
    const cogs         = db.accounts.filter((a) => a.type === "cogs").reduce((s, a) => s + bal(a), 0);
    const expenses     = db.accounts.filter((a) => a.type === "expense").reduce((s, a) => s + bal(a), 0);

    const netRev   = revenue - contraRev;
    const grossP   = netRev - cogs;
    const netInc   = grossP - expenses;

    return { revenue, contraRevenue: contraRev, netRevenue: netRev, cogs, grossProfit: grossP, expenses, netIncome: netInc, period: { startDate, endDate } };
  },

  getBalanceSheet(asOfDate?: string) {
    const db = DB.get();
    const balances = asOfDate ? this._computePeriodBalances(undefined, asOfDate) : null;
    const bal = (a: Account) => balances ? (balances[a.id] || 0) : (a.balance || 0);

    const assets      = db.accounts.filter((a) => a.type === "asset" || a.type === "contra_asset");
    const liabilities = db.accounts.filter((a) => a.type === "liability");
    const equity      = db.accounts.filter((a) => a.type === "equity");

    const totalAssets      = assets.reduce((s, a) => s + bal(a), 0);
    const totalLiabilities = liabilities.reduce((s, a) => s + Math.abs(bal(a)), 0);
    const totalEquity      = equity.reduce((s, a) => s + Math.abs(bal(a)), 0);

    return {
      assets, liabilities, equity,
      totalAssets, totalLiabilities, totalEquity,
      isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
      asOfDate: asOfDate || new Date().toISOString().slice(0, 10),
    };
  },

  getTrialBalance(asOfDate?: string) {
    const db = DB.get();
    const balances = asOfDate ? this._computePeriodBalances(undefined, asOfDate) : null;
    const bal = (a: Account) => balances ? (balances[a.id] || 0) : (a.balance || 0);

    const accounts = db.accounts
      .filter((a) => bal(a) !== 0)
      .map((a) => {
        const b = bal(a);
        return { code: a.code, name: a.name, type: a.type, debit: b > 0 ? b : 0, credit: b < 0 ? Math.abs(b) : 0 };
      });

    return {
      accounts,
      totalDebits:  accounts.reduce((s, a) => s + a.debit,  0),
      totalCredits: accounts.reduce((s, a) => s + a.credit, 0),
    };
  },

  // ─────────────────────────────────────────────────────────────────
  // Inventory & Cash
  // ─────────────────────────────────────────────────────────────────

  getInventoryValuation() {
    return DB.get().products.map((p) => ({
      id: p.id, sku: p.sku, name: p.name, qty: p.qty || 0,
      unitCost: p.unitCost, sellPrice: p.sellPrice,
      reorderPoint: p.reorderPoint || 0, unit: p.unit || "وحدة",
      warehouseId: p.warehouseId, category: p.category, taxRate: p.taxRate,
      value: (p.qty || 0) * p.unitCost,
      margin: p.sellPrice > 0 ? (((p.sellPrice - p.unitCost) / p.sellPrice) * 100).toFixed(1) + "%" : "0%",
    }));
  },

  getTotalInventoryValue() {
    return this.getInventoryValuation().reduce((s, p) => s + p.value, 0);
  },

  getCashPosition() {
    const cashAcc = this.getAccountByCode("1010");
    const bankAcc = this.getAccountByCode("1020");
    return { cash: cashAcc?.balance || 0, bank: bankAcc?.balance || 0, total: (cashAcc?.balance || 0) + (bankAcc?.balance || 0) };
  },

  getReceivables() {
    return DB.get().customers
      .filter((c) => (c.balance || 0) > 0)
      .map((c) => ({ ...c, balance: c.balance || 0 }))
      .sort((a, b) => b.balance - a.balance);
  },

  getPayables() {
    return DB.get().suppliers
      .filter((s) => (s.balance || 0) > 0)
      .map((s) => ({ ...s, balance: s.balance || 0 }))
      .sort((a, b) => b.balance - a.balance);
  },

  // ─────────────────────────────────────────────────────────────────
  // Adjusting Entries (Accruals, Prepayments, Depreciation)
  // ─────────────────────────────────────────────────────────────────

  postAdjustingEntry(params: {
    description: string;
    reference?: string;
    date?: string;
    lines: JournalLine[];
    createdBy?: string;
    currency?: string;
    exchangeRate?: number;
  }): JournalEntry {
    return this.postJE(
      params.description,
      params.reference || `ADJ-${Date.now()}`,
      params.lines,
      "adjustment",
      params.reference || "",
      {
        createdBy:    params.createdBy,
        date:         params.date,
        currency:     params.currency,
        exchangeRate: params.exchangeRate,
      }
    );
  },

  // ─────────────────────────────────────────────────────────────────
  // Audit Trail Query
  // ─────────────────────────────────────────────────────────────────

  getAuditTrail(filter?: {
    sourceType?: JESourceType;
    createdBy?: string;
    fromDate?: string;
    toDate?: string;
    status?: JournalEntry["status"];
  }) {
    const db = DB.get();
    return db.journalEntries.filter((je) => {
      if (filter?.sourceType && je.sourceType !== filter.sourceType) return false;
      if (filter?.createdBy  && je.createdBy  !== filter.createdBy)  return false;
      if (filter?.status     && je.status     !== filter.status)      return false;
      if (filter?.fromDate   && je.date < filter.fromDate)            return false;
      if (filter?.toDate     && je.date > filter.toDate)              return false;
      return true;
    });
  },

  // ─────────────────────────────────────────────────────────────────
  // Treasury: Record Cash Movement with mandatory JE
  // ─────────────────────────────────────────────────────────────────

  recordTreasuryMovement(params: {
    type: "in" | "out" | "transfer";
    accountId: string;
    toAccountId?: string;
    amount: number;
    description: string;
    referenceType?: TreasuryTransaction["referenceType"];
    referenceId?: string;
    sessionId?: string;
    userId?: string;
    userName?: string;
    date?: string;
  }): { tx: TreasuryTransaction; je: JournalEntry } {
    const db = DB.get();
    const account   = db.accounts.find((a) => a.id === params.accountId);
    const toAccount = params.toAccountId ? db.accounts.find((a) => a.id === params.toAccountId) : null;

    if (!account) throw new Error(`الحساب ${params.accountId} غير موجود`);
    if (params.type === "transfer" && !toAccount) throw new Error("يجب تحديد حساب الوجهة للتحويل");
    if (params.amount <= 0) throw new Error("المبلغ يجب أن يكون أكبر من صفر");

    // Build JE lines
    let jeLines: JournalLine[];
    if (params.type === "in") {
      // DR Cash account / CR offset (use equity/owner account 3000 for manual deposits)
      const offsetAcc = db.accounts.find((a) => a.code === "3000") || db.accounts[0];
      jeLines = [
        { accountId: account.id,   accountName: account.name,   debit: params.amount, credit: 0 },
        { accountId: offsetAcc.id, accountName: offsetAcc.name, debit: 0, credit: params.amount },
      ];
    } else if (params.type === "out") {
      const offsetAcc = db.accounts.find((a) => a.code === "6000") || db.accounts[0];
      jeLines = [
        { accountId: offsetAcc.id, accountName: offsetAcc.name, debit: params.amount, credit: 0 },
        { accountId: account.id,   accountName: account.name,   debit: 0, credit: params.amount },
      ];
    } else {
      // transfer: DR toAccount / CR fromAccount
      jeLines = [
        { accountId: toAccount!.id, accountName: toAccount!.name, debit: params.amount, credit: 0 },
        { accountId: account.id,    accountName: account.name,    debit: 0, credit: params.amount },
      ];
    }

    const je = this.postJE(
      params.description,
      `TX-${Date.now()}`,
      jeLines,
      "manual",
      params.referenceId || "",
      { createdBy: params.userId || "system", date: params.date }
    );

    const txId = `TX-${String(DB.nextId("tx")).padStart(4, "0")}`;
    const balanceAfter = account.balance; // already updated by postJE

    const tx: TreasuryTransaction = {
      id: txId,
      date: params.date || new Date().toISOString().slice(0, 10),
      type: params.type,
      accountId: account.id,
      accountName: account.name,
      toAccountId:   params.toAccountId,
      toAccountName: toAccount?.name,
      amount: params.amount,
      balanceAfter,
      description: params.description,
      referenceType: params.referenceType || "manual",
      referenceId:   params.referenceId,
      journalEntryId: je.id,
      sessionId: params.sessionId,
      userId:    params.userId,
      userName:  params.userName,
      reconciled: false,
    };

    db.treasury.push(tx);
    DB.save();
    return { tx, je };
  },

  // ─────────────────────────────────────────────────────────────────
  // POS Session Management
  // ─────────────────────────────────────────────────────────────────

  openPOSSession(params: {
    userId: string;
    userName: string;
    cashAccountId: string;
    openingBalance: number;
  }): POSSession {
    const db = DB.get();
    if (!db.posSessions) db.posSessions = [];

    // Check no open session for this user
    const existing = db.posSessions.find((s) => s.status === "open" && s.userId === params.userId);
    if (existing) {
      throw new Error(`لديك وردية مفتوحة بالفعل (${existing.id}) — أغلقها أولاً`);
    }

    const cashAccount = db.accounts.find((a) => a.id === params.cashAccountId);
    if (!cashAccount) throw new Error("حساب الصندوق غير موجود");

    const session: POSSession = {
      id: `PS-${String(DB.nextId("ps")).padStart(4, "0")}`,
      userId: params.userId,
      userName: params.userName,
      cashAccountId: params.cashAccountId,
      cashAccountName: cashAccount.name,
      openingBalance: params.openingBalance,
      expectedCash: params.openingBalance,
      totalSales: 0,
      totalCash: 0,
      totalCard: 0,
      invoiceCount: 0,
      status: "open",
      openedAt: new Date().toISOString(),
    };

    db.posSessions.push(session);
    DB.save();
    return session;
  },

  updatePOSSessionTotals(sessionId: string, invoiceTotal: number, paymentMethod: "cash" | "card"): void {
    const db = DB.get();
    const session = db.posSessions?.find((s) => s.id === sessionId);
    if (!session || session.status !== "open") return;

    session.totalSales += invoiceTotal;
    session.invoiceCount += 1;
    if (paymentMethod === "cash") {
      session.totalCash += invoiceTotal;
    } else {
      session.totalCard += invoiceTotal;
    }
    session.expectedCash = session.openingBalance + session.totalCash;
    DB.save();
  },

  closePOSSession(params: {
    sessionId: string;
    actualCash: number;
    userId: string;
    userName: string;
    notes?: string;
  }): { session: POSSession; reconciliationJE?: JournalEntry } {
    const db = DB.get();
    const session = db.posSessions?.find((s) => s.id === params.sessionId);
    if (!session) throw new Error(`الوردية ${params.sessionId} غير موجودة`);
    if (session.status === "closed") throw new Error(`الوردية ${params.sessionId} مغلقة مسبقاً`);

    const now = new Date().toISOString();
    session.actualCash = params.actualCash;
    session.difference = params.actualCash - session.expectedCash;
    session.status = "closed";
    session.closedAt = now;
    session.notes = params.notes;

    const diff = session.difference;
    let reconciliationJE: JournalEntry | undefined;

    // Post reconciliation JE only if there is a difference
    if (Math.abs(diff) > 0.005) {
      const cashAcc     = db.accounts.find((a) => a.id === session.cashAccountId);
      const shortageAcc = db.accounts.find((a) => a.code === "6020"); // عجز الصندوق
      const overageAcc  = db.accounts.find((a) => a.code === "4020"); // زيادة الصندوق

      if (cashAcc && (shortageAcc || overageAcc)) {
        let jeLines: JournalLine[];
        if (diff < 0) {
          // Shortage: actual < expected → DR Cash Shortage / CR Cash
          if (!shortageAcc) throw new Error("حساب عجز الصندوق (6020) غير موجود");
          jeLines = [
            { accountId: shortageAcc.id, accountName: shortageAcc.name, debit: Math.abs(diff), credit: 0 },
            { accountId: cashAcc.id,     accountName: cashAcc.name,     debit: 0, credit: Math.abs(diff) },
          ];
        } else {
          // Overage: actual > expected → DR Cash / CR Cash Over Income
          if (!overageAcc) throw new Error("حساب زيادة الصندوق (4020) غير موجود");
          jeLines = [
            { accountId: cashAcc.id,    accountName: cashAcc.name,    debit: Math.abs(diff), credit: 0 },
            { accountId: overageAcc.id, accountName: overageAcc.name, debit: 0, credit: Math.abs(diff) },
          ];
        }

        reconciliationJE = this.postJE(
          `تسوية وردية POS ${params.sessionId} — ${diff < 0 ? "عجز" : "زيادة"}: ${Math.abs(diff).toFixed(2)}`,
          `REC-${params.sessionId}`,
          jeLines,
          "adjustment",
          params.sessionId,
          { createdBy: params.userId }
        );

        session.reconciliationJEId = reconciliationJE.id;
      }
    }

    DB.save();
    return { session, reconciliationJE };
  },

  getActivePOSSession(userId: string): POSSession | null {
    const db = DB.get();
    return db.posSessions?.find((s) => s.status === "open" && s.userId === userId) || null;
  },

  // ─────────────────────────────────────────────────────────────────
  // VAT Report
  // ─────────────────────────────────────────────────────────────────

  getVATReport(startDate?: string, endDate?: string) {
    const db = DB.get();

    const filteredInvoices = db.invoices.filter((inv) => {
      if (inv.isReturned) return false;
      if (startDate && inv.date < startDate) return false;
      if (endDate   && inv.date > endDate)   return false;
      return true;
    });

    const filteredPOs = db.purchaseOrders.filter((po) => {
      if (po.isReturned) return false;
      if (startDate && po.date < startDate) return false;
      if (endDate   && po.date > endDate)   return false;
      return true;
    });

    const outputVAT = filteredInvoices.reduce((s, i) => s + (i.taxAmount || 0), 0);
    const inputVAT  = filteredPOs.reduce((s, p) => s + (p.taxAmount || 0), 0);
    const netVAT    = outputVAT - inputVAT;

    const taxableInvoices = filteredInvoices.filter((i) => (i.taxAmount || 0) > 0);
    const taxablePOs      = filteredPOs.filter((p) => (p.taxAmount || 0) > 0);

    return {
      outputVAT, inputVAT, netVAT,
      totalSalesSubtotal: taxableInvoices.reduce((s, i) => s + i.subtotal, 0),
      totalPurchSubtotal: taxablePOs.reduce((s, p) => s + p.subtotal, 0),
      taxableInvoices, taxablePOs,
      period: { startDate, endDate },
    };
  },
};
