// ═══════════════════════════════════════════════════════════
//  BOB ERP SaaS — Core Types
//  Multi-tenancy · Subscriptions · Plans · Billing
// ═══════════════════════════════════════════════════════════

// ─── Subscription Plans ──────────────────────────────────
export type PlanId = "trial" | "starter" | "pro" | "enterprise";

export interface Plan {
  id: PlanId;
  nameAr: string;
  nameEn: string;
  priceMonthly: number;   // SAR
  priceYearly: number;    // SAR (with discount)
  currency: string;
  limits: PlanLimits;
  features: string[];
}

export interface PlanLimits {
  users: number;           // max users per company (-1 = unlimited)
  invoicesPerMonth: number; // -1 = unlimited
  productsTotal: number;    // -1 = unlimited
  warehousesTotal: number;  // -1 = unlimited
  storageGB: number;        // -1 = unlimited
}

export const PLANS: Record<PlanId, Plan> = {
  trial: {
    id: "trial",
    nameAr: "تجريبي",
    nameEn: "Trial",
    priceMonthly: 0,
    priceYearly: 0,
    currency: "SAR",
    limits: { users: 2, invoicesPerMonth: 20, productsTotal: 50, warehousesTotal: 1, storageGB: 1 },
    features: ["جميع الوحدات الأساسية", "دعم عبر البريد", "تقارير محدودة"],
  },
  starter: {
    id: "starter",
    nameAr: "البداية",
    nameEn: "Starter",
    priceMonthly: 199,
    priceYearly: 1990,
    currency: "SAR",
    limits: { users: 5, invoicesPerMonth: 200, productsTotal: 500, warehousesTotal: 2, storageGB: 10 },
    features: ["جميع وحدات المبيعات والمشتريات", "تقارير كاملة", "دعم عبر الواتساب", "2 مستودع"],
  },
  pro: {
    id: "pro",
    nameAr: "الاحترافي",
    nameEn: "Pro",
    priceMonthly: 499,
    priceYearly: 4990,
    currency: "SAR",
    limits: { users: 20, invoicesPerMonth: -1, productsTotal: -1, warehousesTotal: 10, storageGB: 50 },
    features: ["كل مزايا Starter", "مستخدمون غير محدودون", "فواتير غير محدودة", "API Access", "دعم أولوية"],
  },
  enterprise: {
    id: "enterprise",
    nameAr: "المؤسسي",
    nameEn: "Enterprise",
    priceMonthly: 999,
    priceYearly: 9990,
    currency: "SAR",
    limits: { users: -1, invoicesPerMonth: -1, productsTotal: -1, warehousesTotal: -1, storageGB: -1 },
    features: ["كل مزايا Pro", "مخصص بالكامل", "دعم 24/7", "SLA مضمون", "تدريب مجاني"],
  },
};

// ─── Subscription ─────────────────────────────────────────
export type SubscriptionStatus = "active" | "trial" | "expired" | "cancelled" | "suspended";

export interface Subscription {
  id: string;
  companyId: string;
  planId: PlanId;
  status: SubscriptionStatus;
  billingCycle: "monthly" | "yearly";
  startDate: string;       // ISO date
  endDate: string;         // ISO date — access blocked after this
  trialEndDate?: string;   // Only for trial
  autoRenew: boolean;
  lastPaymentDate?: string;
  nextPaymentDate?: string;
  amountPaid: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Company (Tenant) ─────────────────────────────────────
export type CompanyStatus = "active" | "suspended" | "pending" | "cancelled";

export interface Company {
  id: string;              // tenant ID — used as localStorage key prefix
  name: string;
  nameEn?: string;
  email: string;           // owner email
  phone?: string;
  country: string;
  city?: string;
  address?: string;
  taxNumber?: string;
  logo?: string;
  status: CompanyStatus;
  subscription: Subscription;
  createdAt: string;
  updatedAt: string;
  // Usage tracking
  usageStats: UsageStats;
}

export interface UsageStats {
  totalInvoices: number;
  invoicesThisMonth: number;
  totalProducts: number;
  totalUsers: number;
  totalWarehouses: number;
  lastActivity: string;
}

// ─── Super Admin ───────────────────────────────────────────
export interface SuperAdmin {
  id: string;
  name: string;
  email: string;
  password: string;        // hashed in production (bcrypt)
  role: "superadmin";
  createdAt: string;
  lastLogin: string;
}

// ─── SaaS-level DB (global, not per-tenant) ───────────────
export interface SaaSDatabase {
  companies: Company[];
  superAdmins: SuperAdmin[];
  globalCounters: { company: number; subscription: number };
}

// ─── Access Check Result ───────────────────────────────────
export interface AccessCheckResult {
  allowed: boolean;
  reason?: "expired" | "suspended" | "limit_reached" | "no_subscription";
  message?: string;
  daysLeft?: number;
}
