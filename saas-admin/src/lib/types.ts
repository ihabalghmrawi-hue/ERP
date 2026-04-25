export interface SuperAdmin {
  id: string;
  name: string;
  email: string;
  password: string;
  createdAt: string;
}

export type PlanId = "trial" | "starter" | "pro" | "enterprise";
export type CompanyStatus = "active" | "suspended" | "cancelled";
export type SubStatus = "trial" | "active" | "expired" | "cancelled";
export type Currency = "SAR" | "USD" | "EUR" | "AED" | "KWD" | "BHD" | "QAR" | "OMR" | "EGP";
export type InvoiceStatus = "paid" | "unpaid" | "overdue";
export type ActivityType =
  | "company_created" | "company_deleted" | "company_restored"
  | "subscription_renewed" | "subscription_suspended" | "subscription_activated"
  | "plan_changed" | "trial_extended" | "admin_login" | "admin_created";

export interface Subscription {
  planId: PlanId;
  status: SubStatus;
  startDate: string;
  endDate: string;
  billingCycle: "monthly" | "yearly";
  amount: number;
  currency: Currency;
}

export interface UsageStats {
  totalInvoices: number;
  totalProducts: number;
  totalUsers: number;
  totalWarehouses: number;
  invoicesThisMonth: number;
  lastActivity: string;
}

export interface Company {
  id: string;
  name: string;
  email: string;
  phone?: string;
  country: string;
  status: CompanyStatus;
  subscription: Subscription;
  usageStats: UsageStats;
  createdAt: string;
  deletedAt?: string;   // soft delete
  notes?: string;
}

export interface Invoice {
  id: string;
  companyId: string;
  companyName: string;
  planId: PlanId;
  amount: number;
  currency: Currency;
  status: InvoiceStatus;
  billingCycle: "monthly" | "yearly";
  issuedAt: string;
  dueAt: string;
  paidAt?: string;
  periodStart: string;
  periodEnd: string;
}

export interface ActivityLog {
  id: string;
  adminId: string;
  adminName: string;
  type: ActivityType;
  targetId?: string;
  targetName?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  companyId: string;
  companyName: string;
  type: "expiry_7d" | "expiry_3d" | "expiry_today" | "expired";
  sentAt: string;
  channel: "email" | "dashboard";
}

export interface SaaSDatabase {
  companies: Company[];
  superAdmins: SuperAdmin[];
  invoices: Invoice[];
  activityLogs: ActivityLog[];
  notifications: NotificationRecord[];
  globalCounters: { company: number; subscription: number; invoice: number };
}

export interface PlanConfig {
  nameAr: string;
  nameEn: string;
  priceMonthly: number;
  priceYearly: number;
  currency: Currency;
  limits: {
    users: number;
    invoicesPerMonth: number;
    productsTotal: number;
    warehousesTotal: number;
  };
  features: string[];
}

export const PLANS: Record<PlanId, PlanConfig> = {
  trial: {
    nameAr: "تجريبي", nameEn: "Trial",
    priceMonthly: 0, priceYearly: 0, currency: "SAR",
    limits: { users: 3, invoicesPerMonth: 20, productsTotal: 50, warehousesTotal: 1 },
    features: ["وصول كامل لمدة 14 يوم"],
  },
  starter: {
    nameAr: "البداية", nameEn: "Starter",
    priceMonthly: 99, priceYearly: 999, currency: "SAR",
    limits: { users: 5, invoicesPerMonth: 100, productsTotal: 500, warehousesTotal: 1 },
    features: ["5 مستخدمين", "100 فاتورة/شهر", "500 منتج", "مستودع واحد"],
  },
  pro: {
    nameAr: "الاحترافي", nameEn: "Pro",
    priceMonthly: 299, priceYearly: 2999, currency: "SAR",
    limits: { users: 20, invoicesPerMonth: 500, productsTotal: 5000, warehousesTotal: 5 },
    features: ["20 مستخدماً", "500 فاتورة/شهر", "5000 منتج", "5 مستودعات"],
  },
  enterprise: {
    nameAr: "المؤسسي", nameEn: "Enterprise",
    priceMonthly: 999, priceYearly: 9999, currency: "SAR",
    limits: { users: -1, invoicesPerMonth: -1, productsTotal: -1, warehousesTotal: -1 },
    features: ["مستخدمون غير محدودون", "فواتير غير محدودة", "منتجات غير محدودة", "مستودعات غير محدودة"],
  },
};

export const CURRENCIES: Record<Currency, { name: string; symbol: string }> = {
  SAR: { name: "ريال سعودي",   symbol: "ر.س" },
  USD: { name: "دولار أمريكي", symbol: "$"   },
  EUR: { name: "يورو",          symbol: "€"   },
  AED: { name: "درهم إماراتي", symbol: "د.إ" },
  KWD: { name: "دينار كويتي",  symbol: "د.ك" },
  BHD: { name: "دينار بحريني", symbol: "د.ب" },
  QAR: { name: "ريال قطري",    symbol: "ر.ق" },
  OMR: { name: "ريال عُماني",  symbol: "ر.ع" },
  EGP: { name: "جنيه مصري",    symbol: "ج.م" },
};
