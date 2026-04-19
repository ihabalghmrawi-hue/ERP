import { DB, JournalLine, Invoice, PurchaseOrder } from "../db/database";

export const AccountingEngine = {
  // ── Core: ترحيل قيد يومية ─────────────────────────────────
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

  // ── فاتورة مبيعات → قيد تلقائي ──────────────────────────
  postSalesInvoice(invoice: Invoice) {
    const db = DB.get();

    const arAcc   = db.accounts.find((a) => a.code === "1100"); // ذمم مدينة
    const revAcc  = db.accounts.find((a) => a.code === "4000"); // إيراد المبيعات
    const taxAcc  = db.accounts.find((a) => a.code === "2200"); // ضريبة مبيعات
    const cogsAcc = db.accounts.find((a) => a.code === "5000"); // تكلفة البضاعة
    const invAcc  = db.accounts.find((a) => a.code === "1200"); // المخزون
    const cashAcc = db.accounts.find(
      (a) => a.type === "asset" && a.category === "current_asset" && a.code === "1010"
    );

    if (!revAcc || !cogsAcc || !invAcc) {
      throw new Error(
        "يرجى إنشاء الحسابات المحاسبية الأساسية أولاً:\n• 4000 - إيراد المبيعات\n• 5000 - تكلفة البضاعة المباعة\n• 1200 - المخزون"
      );
    }

    // حساب تكلفة البضاعة (FIFO)
    let totalCOGS = 0;
    invoice.lines.forEach((line) => {
      const p = db.products.find((x) => x.id === line.productId);
      if (p) totalCOGS += p.unitCost * line.qty;
    });

    const isCredit = invoice.paymentType === "credit";
    const drAccount = isCredit ? arAcc : cashAcc ?? arAcc;
    if (!drAccount) {
      throw new Error("لم يتم العثور على حساب الذمم المدينة (1100) أو الصندوق (1010)");
    }

    const lines: JournalLine[] = [
      { accountId: drAccount.id, accountName: drAccount.name, debit: invoice.total, credit: 0 },
      { accountId: revAcc.id,    accountName: revAcc.name,    debit: 0, credit: invoice.subtotal },
    ];

    if (taxAcc && invoice.taxAmount > 0) {
      lines.push({ accountId: taxAcc.id, accountName: taxAcc.name, debit: 0, credit: invoice.taxAmount });
    }

    if (totalCOGS > 0) {
      lines.push({ accountId: cogsAcc.id, accountName: cogsAcc.name, debit: totalCOGS, credit: 0 });
      lines.push({ accountId: invAcc.id,  accountName: invAcc.name,  debit: 0, credit: totalCOGS });
    }

    return this.postJE(`فاتورة مبيعات - ${invoice.customerName}`, invoice.id, lines);
  },

  // ── فاتورة مشتريات → قيد تلقائي ─────────────────────────
  postPurchaseInvoice(po: PurchaseOrder) {
    const db = DB.get();

    const invAcc = db.accounts.find((a) => a.code === "1200"); // المخزون
    const apAcc  = db.accounts.find((a) => a.code === "2000"); // ذمم دائنة

    if (!invAcc || !apAcc) {
      throw new Error(
        "يرجى إنشاء الحسابات المحاسبية الأساسية:\n• 1200 - المخزون\n• 2000 - الذمم الدائنة"
      );
    }

    return this.postJE(`فاتورة مشتريات - ${po.supplierName}`, po.id, [
      { accountId: invAcc.id, accountName: invAcc.name, debit: po.total,  credit: 0       },
      { accountId: apAcc.id,  accountName: apAcc.name,  debit: 0,         credit: po.total },
    ]);
  },

  // ── قائمة الدخل ──────────────────────────────────────────
  getIncomeStatement() {
    const db = DB.get();
    const revenue  = db.accounts.filter((a) => a.type === "revenue").reduce((s, a) => s + (a.balance || 0), 0);
    const contra   = db.accounts.filter((a) => a.type === "contra_revenue").reduce((s, a) => s + Math.abs(a.balance || 0), 0);
    const cogs     = db.accounts.filter((a) => a.type === "cogs").reduce((s, a) => s + (a.balance || 0), 0);
    const expenses = db.accounts.filter((a) => a.type === "expense").reduce((s, a) => s + (a.balance || 0), 0);
    const netRev   = revenue - contra;
    const grossP   = netRev - cogs;
    const netInc   = grossP - expenses;
    return { revenue, contraRevenue: contra, netRevenue: netRev, cogs, grossProfit: grossP, expenses, netIncome: netInc };
  },

  // ── الميزانية العمومية ────────────────────────────────────
  getBalanceSheet() {
    const db = DB.get();
    const assets      = db.accounts.filter((a) => a.type === "asset" || a.type === "contra_asset");
    const liabilities = db.accounts.filter((a) => a.type === "liability");
    const equity      = db.accounts.filter((a) => a.type === "equity");
    return {
      assets,
      liabilities,
      equity,
      totalAssets:      assets.reduce((s, a) => s + (a.balance || 0), 0),
      totalLiabilities: liabilities.reduce((s, a) => s + (a.balance || 0), 0),
      totalEquity:      equity.reduce((s, a) => s + (a.balance || 0), 0),
    };
  },

  // ── تقييم المخزون (FIFO) ─────────────────────────────────
  getInventoryValuation() {
    return DB.get().products.map((p) => ({
      ...p,
      value:  (p.qty || 0) * p.unitCost,
      margin: p.sellPrice > 0
        ? (((p.sellPrice - p.unitCost) / p.sellPrice) * 100).toFixed(1)
        : "0.0",
    }));
  },
};
