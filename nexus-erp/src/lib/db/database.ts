// ─── Types ────────────────────────────────────────────────────
export interface Account {
  id: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense" | "cogs" | "contra_revenue" | "contra_asset";
  category: string;
  parentId?: string;
  balance: number;
}

export interface JournalLine {
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
  status: "posted" | "draft";
  createdBy: string;
  lines: JournalLine[];
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  creditLimit: number;
  balance: number;
  currency: string;
  taxId?: string;
  taxExempt?: boolean;
  status: "active" | "inactive";
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  creditTerms: string;
  balance: number;
  currency: string;
  taxId?: string;
  taxExempt?: boolean;
  status: "active" | "inactive";
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category?: string;
  warehouseId?: string;
  unitCost: number;
  sellPrice: number;
  taxRate: number;
  taxExempt?: boolean;
  qty: number;
  reorderPoint: number;
  unit?: string;
}

export interface InvoiceLine {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  subtotal: number;
  tax: number;
  total: number;
  taxExempt?: boolean;
}

export interface Invoice {
  id: string;
  date: string;
  dueDate: string;
  customerId: string;
  customerName: string;
  status: "paid" | "outstanding" | "overdue";
  paymentType: "cash" | "credit";
  currency: string;
  lines: InvoiceLine[];
  subtotal: number;
  taxAmount: number;
  total: number;
  vatEnabled?: boolean;
  vatInclusive?: boolean;
  amountPaid?: number;
  amountDue?: number;
  notes?: string;
  journalEntryId?: string;
}

export interface POLine {
  productId: string;
  productName: string;
  qty: number;
  unitCost: number;
  subtotal: number;
  taxRate: number;
  tax: number;
  total: number;
  taxExempt?: boolean;
}

export interface PurchaseOrder {
  id: string;
  date: string;
  supplierId: string;
  supplierName: string;
  status: "pending" | "received" | "partial";
  currency: string;
  lines: POLine[];
  subtotal: number;
  taxAmount: number;
  total: number;
  vatEnabled?: boolean;
  vatInclusive?: boolean;
  amountPaid: number;
  amountDue: number;
  journalEntryId?: string;
}

export interface TreasuryTransaction {
  id: string;
  date: string;
  type: "receipt" | "payment" | "transfer";
  accountId?: string;
  accountName?: string;
  amount: number;
  ref?: string;
  description: string;
  reconciled: boolean;
}

export interface Warehouse {
  id: string;
  name: string;
  location?: string;
  manager?: string;
  isDefault: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: "admin" | "accountant" | "sales" | "viewer";
  status: "active" | "inactive";
  companyId?: string;
  lastLogin: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  userId: string;
  user: string;
  action: string;
  module: string;
  description: string;
}

export interface InventoryMovement {
  id: string;
  date: string;
  type: "in" | "out" | "transfer" | "adjustment";
  productId: string;
  productName: string;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  quantity: number;
  reference: string;
  notes?: string;
  createdBy?: string;
}

export interface AppSettings {
  companyName: string;
  taxNumber: string;
  address: string;
  country: string;
  baseCurrency: string;
  fiscalYearStart: string;
  lang: "ar" | "en";
  vatEnabled: boolean;
  vatRate: number;
  vatName: string;
}

export interface DatabaseState {
  users: User[];
  accounts: Account[];
  journalEntries: JournalEntry[];
  customers: Customer[];
  suppliers: Supplier[];
  products: Product[];
  invoices: Invoice[];
  purchaseOrders: PurchaseOrder[];
  treasury: TreasuryTransaction[];
  warehouses: Warehouse[];
  inventoryMovements: InventoryMovement[];
  activityLog: ActivityLog[];
  settings: AppSettings;
  counters: { je: number; inv: number; po: number; tx: number };
}

// ─── Default Chart of Accounts ─────────────────────────────────
export function createDefaultAccounts(): Account[] {
  return [
    { id: "acc_1000", code: "1000", name: "الأصول", type: "asset", category: "asset_group", balance: 0 },
    { id: "acc_1010", code: "1010", name: "الصندوق", type: "asset", category: "current_asset", parentId: "acc_1000", balance: 0 },
    { id: "acc_1020", code: "1020", name: "البنك", type: "asset", category: "current_asset", parentId: "acc_1000", balance: 0 },
    { id: "acc_1100", code: "1100", name: "الذمم المدينة", type: "asset", category: "current_asset", parentId: "acc_1000", balance: 0 },
    { id: "acc_1200", code: "1200", name: "المخزون", type: "asset", category: "current_asset", parentId: "acc_1000", balance: 0 },

    { id: "acc_2000", code: "2000", name: "الخصوم", type: "liability", category: "liability_group", balance: 0 },
    { id: "acc_2010", code: "2010", name: "الذمم الدائنة", type: "liability", category: "current_liability", parentId: "acc_2000", balance: 0 },
    { id: "acc_2100", code: "2100", name: "ضريبة المدخلات (VAT مستردة)", type: "asset", category: "current_asset", parentId: "acc_1000", balance: 0 },
    { id: "acc_2200", code: "2200", name: "ضريبة المخرجات (VAT مستحقة)", type: "liability", category: "current_liability", parentId: "acc_2000", balance: 0 },

    { id: "acc_3000", code: "3000", name: "حقوق الملكية", type: "equity", category: "equity", balance: 0 },

    { id: "acc_4000", code: "4000", name: "إيراد المبيعات", type: "revenue", category: "revenue", balance: 0 },
    { id: "acc_4010", code: "4010", name: "عائدات أخرى", type: "revenue", category: "revenue", balance: 0 },

    { id: "acc_5000", code: "5000", name: "تكلفة البضاعة المباعة", type: "cogs", category: "cogs", balance: 0 },

    { id: "acc_6000", code: "6000", name: "المصروفات التشغيلية", type: "expense", category: "expense", balance: 0 },
    { id: "acc_6010", code: "6010", name: "مصاريف الشحن والتسليم", type: "expense", category: "expense", balance: 0 },
  ];
}

// ─── Initial State ────────────────────────────────────────────
export function createInitialDatabaseState(): DatabaseState {
  return {
    users: [],
    accounts: createDefaultAccounts(),
    journalEntries: [],
    customers: [],
    suppliers: [],
    products: [],
    invoices: [],
    purchaseOrders: [],
    treasury: [],
    warehouses: [],
    inventoryMovements: [],
    activityLog: [],
    settings: {
      companyName: "",
      taxNumber: "",
      address: "",
      country: "SA",
      baseCurrency: "SAR",
      fiscalYearStart: "01-01",
      lang: "ar",
      vatEnabled: false,
      vatRate: 0.15,
      vatName: "ضريبة القيمة المضافة",
    },
    counters: { je: 1, inv: 1, po: 1, tx: 1 },
  };
}

function createInitialState(): DatabaseState {
  return createInitialDatabaseState();
}

// ─── Database Singleton with localStorage ────────────────────
const DB_KEY = "nexus_erp_data";

let _state: DatabaseState | null = null;

function loadFromStorage(): DatabaseState {
  if (typeof window === "undefined") return createInitialState();
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw) as DatabaseState;
  } catch {}
  return createInitialState();
}

function saveToStorage(state: DatabaseState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(state));
  } catch {}
}

// ─── Active tenant ID when running in SaaS mode ──────────
let _tenantId: string | null = null;

export const DB = {
  get(): DatabaseState {
    // If SaaS mode: TenantDB is the source of truth; DB is a proxy
    if (_tenantId) {
      // dynamically import TenantDB to avoid circular deps at module load
      // The _state is already synced via _syncFromTenant below
      if (_state) return _state;
    }
    if (!_state) _state = loadFromStorage();
    return _state;
  },

  save(): void {
    if (_tenantId) {
      // Save back to TenantDB (SaaS mode)
      try {
        const key = `nexus_tenant_${_tenantId}`;
        if (typeof window !== "undefined" && _state) {
          localStorage.setItem(key, JSON.stringify(_state));
        }
      } catch {}
      return;
    }
    if (_state) saveToStorage(_state);
  },

  nextId(type: keyof DatabaseState["counters"]): number {
    const state = this.get();
    const id = state.counters[type];
    state.counters[type]++;
    this.save();
    return id;
  },

  reset(): void {
    _state = createInitialState();
    if (typeof window !== "undefined") {
      if (_tenantId) {
        localStorage.removeItem(`nexus_tenant_${_tenantId}`);
      } else {
        localStorage.removeItem(DB_KEY);
      }
    }
  },

  reload(): void {
    if (_tenantId) {
      try {
        const key = `nexus_tenant_${_tenantId}`;
        const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
        _state = raw ? JSON.parse(raw) : createInitialState();
      } catch { _state = createInitialState(); }
      return;
    }
    _state = loadFromStorage();
  },

  // ── Called by SaaSShell to sync tenant data into DB ────
  _syncFromTenant(tenantState: DatabaseState, tenantId: string): void {
    _state = tenantState;
    _tenantId = tenantId;
  },

  // ── Called on logout to detach tenant ─────────────────
  _detachTenant(): void {
    _state = null;
    _tenantId = null;
  },
};
