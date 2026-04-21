"use client";

import {
  SaaSDatabase, Company, SuperAdmin, Subscription, SubscriptionStatus,
  UsageStats, PLANS, PlanId,
} from "./types";

// ─── Storage Keys ─────────────────────────────────────────
const SAAS_KEY   = "nexus_saas_global";   // companies + superadmins
const SESSION_KEY = "nexus_saas_session"; // who is logged in (super admin OR company)

// ─── Initial SaaS State ───────────────────────────────────
function createInitialSaaS(): SaaSDatabase {
  return {
    companies: [],
    superAdmins: [],
    globalCounters: { company: 1, subscription: 1 },
  };
}

// ─── SaaS DB Singleton ────────────────────────────────────
let _saas: SaaSDatabase | null = null;

function loadSaaS(): SaaSDatabase {
  if (typeof window === "undefined") return createInitialSaaS();
  let state = createInitialSaaS();
  try {
    const raw = localStorage.getItem(SAAS_KEY);
    if (raw) state = JSON.parse(raw) as SaaSDatabase;
  } catch {}
  return state;
}

function saveSaaS(state: SaaSDatabase): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SAAS_KEY, JSON.stringify(state));
  } catch {}
}

// ─── Helpers ──────────────────────────────────────────────
function uid(): string {
  return Math.random().toString(36).slice(2, 12);
}
function now(): string {
  return new Date().toISOString();
}
function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── SaaSDB API ───────────────────────────────────────────
export const SaaSDB = {

  // ── Init ──────────────────────────────────────────────
  get(): SaaSDatabase {
    if (!_saas) _saas = loadSaaS();
    return _saas;
  },

  save(): void {
    if (_saas) saveSaaS(_saas);
  },

  isBootstrapped(): boolean {
    return this.get().superAdmins.length > 0;
  },

  // ── Super Admin ────────────────────────────────────────
  createSuperAdmin(name: string, email: string, password: string): SuperAdmin {
    const db = this.get();
    if (db.superAdmins.length > 0) {
      throw new Error("تم إنشاء مدير النظام مسبقاً. لا يمكن إنشاء حساب Super Admin آخر.");
    }
    if (db.superAdmins.find(a => a.email === email)) {
      throw new Error("البريد الإلكتروني مستخدم بالفعل");
    }
    // For local client storage we avoid persisting plain passwords.
    const admin: SuperAdmin = {
      id: uid(), name, email, password: "",
      role: "superadmin", createdAt: now(), lastLogin: now(),
    };
    db.superAdmins.push(admin);
    this.save();
    return admin;
  },

  loginSuperAdmin(email: string, password: string): SuperAdmin | null {
    const admin = this.get().superAdmins.find(a => a.email === email && a.password === password);
    if (admin) {
      admin.lastLogin = now();
      this.save();
    }
    return admin || null;
  },

  resetSuperAdmin(): void {
    const db = this.get();
    db.superAdmins = [];
    this.save();
  },

  // ── Companies ──────────────────────────────────────────
  createCompany(data: {
    name: string;
    nameEn?: string;
    email: string;
    phone?: string;
    country: string;
    city?: string;
    planId: PlanId;
    billingCycle?: "monthly" | "yearly";
    trialDays?: number;
  }): Company {
    const db = this.get();
    if (db.companies.find(c => c.email === data.email)) {
      throw new Error("يوجد شركة مسجلة بهذا البريد الإلكتروني مسبقاً");
    }

    const companyNum = db.globalCounters.company++;
    const id = `company_${String(companyNum).padStart(5, "0")}`;
    const isTrial = !data.planId || data.planId === "trial" || (data.trialDays && data.trialDays > 0);
    const days = isTrial ? (data.trialDays || 14) : (data.billingCycle === "yearly" ? 365 : 30);
    const subNum = db.globalCounters.subscription++;

    const subscription: Subscription = {
      id: `SUB-${String(subNum).padStart(6, "0")}`,
      companyId: id,
      planId: isTrial ? "trial" : data.planId,
      status: isTrial ? "trial" : "active",
      billingCycle: data.billingCycle || "monthly",
      startDate: now().slice(0, 10),
      endDate: addDays(days),
      trialEndDate: isTrial ? addDays(days) : undefined,
      autoRenew: !isTrial,
      amountPaid: 0,
      createdAt: now(),
      updatedAt: now(),
    };

    const company: Company = {
      id, name: data.name, nameEn: data.nameEn,
      email: data.email, phone: data.phone,
      country: data.country, city: data.city,
      status: "active", subscription,
      createdAt: now(), updatedAt: now(),
      usageStats: {
        totalInvoices: 0, invoicesThisMonth: 0,
        totalProducts: 0, totalUsers: 1,
        totalWarehouses: 0, lastActivity: now(),
      },
    };

    db.companies.push(company);
    this.save();
    return company;
  },

  getCompany(id: string): Company | null {
    return this.get().companies.find(c => c.id === id) || null;
  },

  getCompanyByEmail(email: string): Company | null {
    return this.get().companies.find(c => c.email === email) || null;
  },

  updateCompany(id: string, patch: Partial<Company>): Company | null {
    const db = this.get();
    const idx = db.companies.findIndex(c => c.id === id);
    if (idx === -1) return null;
    db.companies[idx] = { ...db.companies[idx], ...patch, updatedAt: now() };
    this.save();
    return db.companies[idx];
  },

  suspendCompany(id: string, reason?: string): void {
    this.updateCompany(id, { status: "suspended" });
    const c = this.getCompany(id);
    if (c) {
      c.subscription.status = "suspended";
      c.subscription.notes = reason;
      this.save();
    }
  },

  activateCompany(id: string): void {
    const c = this.getCompany(id);
    if (!c) return;
    c.status = "active";
    c.subscription.status = this.checkAccess(id).allowed ? "active" : "expired";
    c.updatedAt = now();
    this.save();
  },

  deleteCompany(id: string): void {
    const db = this.get();
    db.companies = db.companies.filter(c => c.id !== id);
    // Also delete tenant data
    if (typeof window !== "undefined") {
      localStorage.removeItem(`nexus_tenant_${id}`);
    }
    this.save();
  },

  // ── Subscription Management ────────────────────────────
  renewSubscription(companyId: string, planId: PlanId, billingCycle: "monthly" | "yearly", amountPaid: number): void {
    const company = this.getCompany(companyId);
    if (!company) return;
    const days = billingCycle === "yearly" ? 365 : 30;
    company.subscription = {
      ...company.subscription,
      planId, billingCycle, status: "active",
      startDate: now().slice(0, 10),
      endDate: addDays(days),
      nextPaymentDate: addDays(days),
      lastPaymentDate: now().slice(0, 10),
      autoRenew: true,
      amountPaid: company.subscription.amountPaid + amountPaid,
      updatedAt: now(),
    };
    company.status = "active";
    company.updatedAt = now();
    this.save();
  },

  extendTrial(companyId: string, extraDays: number): void {
    const company = this.getCompany(companyId);
    if (!company) return;
    const currentEnd = new Date(company.subscription.endDate);
    currentEnd.setDate(currentEnd.getDate() + extraDays);
    company.subscription.endDate = currentEnd.toISOString().slice(0, 10);
    company.subscription.trialEndDate = company.subscription.endDate;
    company.subscription.updatedAt = now();
    this.save();
  },

  // ── Access Control ─────────────────────────────────────
  checkAccess(companyId: string): { allowed: boolean; reason?: string; daysLeft?: number } {
    const company = this.getCompany(companyId);
    if (!company) return { allowed: false, reason: "company_not_found" };
    if (company.status === "suspended") return { allowed: false, reason: "suspended" };
    if (company.status === "cancelled") return { allowed: false, reason: "cancelled" };

    const sub = company.subscription;
    if (sub.status === "cancelled") return { allowed: false, reason: "cancelled" };

    const today = new Date();
    const endDate = new Date(sub.endDate);
    const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      // Auto-update status
      sub.status = "expired";
      company.status = "suspended";
      this.save();
      return { allowed: false, reason: "expired", daysLeft: 0 };
    }

    return { allowed: true, daysLeft };
  },

  checkLimit(companyId: string, limitKey: keyof import("./types").PlanLimits, currentValue: number): boolean {
    const company = this.getCompany(companyId);
    if (!company) return false;
    const plan = PLANS[company.subscription.planId];
    const limit = plan.limits[limitKey];
    if (limit === -1) return true; // unlimited
    return currentValue < limit;
  },

  // ── Usage Stats ────────────────────────────────────────
  updateUsageStats(companyId: string, patch: Partial<UsageStats>): void {
    const company = this.getCompany(companyId);
    if (!company) return;
    company.usageStats = { ...company.usageStats, ...patch, lastActivity: now() };
    company.updatedAt = now();
    this.save();
  },

  // ── Dashboard Stats (for super admin) ─────────────────
  getGlobalStats() {
    const db = this.get();
    const now = new Date();
    const active    = db.companies.filter(c => c.status === "active").length;
    const trial     = db.companies.filter(c => c.subscription.status === "trial").length;
    const expired   = db.companies.filter(c => c.subscription.status === "expired" || c.status === "suspended").length;
    const mrr       = db.companies
      .filter(c => c.subscription.status === "active" && c.subscription.planId !== "trial")
      .reduce((s, c) => s + PLANS[c.subscription.planId].priceMonthly, 0);

    return {
      totalCompanies: db.companies.length,
      activeCompanies: active,
      trialCompanies: trial,
      expiredCompanies: expired,
      mrr,
      arr: mrr * 12,
    };
  },

  // ── Session Management ─────────────────────────────────
  setSession(data: { type: "superadmin" | "company"; id: string; name: string; email: string; userId?: string; token?: string }): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  },

  getSession(): { type: "superadmin" | "company"; id: string; name: string; email: string; userId?: string; token?: string } | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  clearSession(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(SESSION_KEY);
  },
};
