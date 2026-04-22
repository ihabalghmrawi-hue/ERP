export interface SuperAdmin {
  id: string;
  name: string;
  email: string;
  password: string; // bcrypt hash
  createdAt: string;
}

export type PlanId = "trial" | "starter" | "pro" | "enterprise";
export type CompanyStatus = "active" | "suspended" | "cancelled";
export type SubStatus = "trial" | "active" | "expired" | "cancelled";

export interface Subscription {
  planId: PlanId;
  status: SubStatus;
  startDate: string;
  endDate: string;
  billingCycle: "monthly" | "yearly";
  amount: number;
}

export interface UsageStats {
  totalInvoices: number;
  totalProducts: number;
  totalUsers: number;
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
}

export interface SaaSDatabase {
  companies: Company[];
  superAdmins: SuperAdmin[];
  globalCounters: { company: number; subscription: number };
}

export const PLANS: Record<PlanId, { nameAr: string; priceMonthly: number; priceYearly: number }> = {
  trial:      { nameAr: "تجريبي",     priceMonthly: 0,    priceYearly: 0 },
  starter:    { nameAr: "البداية",    priceMonthly: 99,   priceYearly: 999 },
  pro:        { nameAr: "الاحترافي",  priceMonthly: 299,  priceYearly: 2999 },
  enterprise: { nameAr: "المؤسسي",   priceMonthly: 999,  priceYearly: 9999 },
};
