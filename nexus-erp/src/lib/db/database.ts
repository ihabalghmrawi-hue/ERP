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
  notes?: string;
  journalEntryId?: string;
}

export interface POLine {
  productId: string;
  productName: string;
  qty: number;
  unitCost: number;
  total: number;
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

export interface AppSettings {
  companyName: string;
  taxNumber: string;
  address: string;
  baseCurrency: string;
  fiscalYearStart: string;
  lang: "ar" | "en";
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
  activityLog: ActivityLog[];
  settings: AppSettings;
  counters: { je: number; inv: number; po: number; tx: number };
}

// ─── Initial State ────────────────────────────────────────────
function createInitialState(): DatabaseState {
  return {
    users: [],
    accounts: [],
    journalEntries: [],
    customers: [],
    suppliers: [],
    products: [],
    invoices: [],
    purchaseOrders: [],
    treasury: [],
    warehouses: [],
    activityLog: [],
    settings: {
      companyName: "",
      taxNumber: "",
      address: "",
      baseCurrency: "SAR",
      fiscalYearStart: "01-01",
      lang: "ar",
    },
    counters: { je: 1, inv: 1, po: 1, tx: 1 },
  };
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
