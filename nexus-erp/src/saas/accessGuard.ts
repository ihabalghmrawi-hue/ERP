"use client";

import { SaaSDB } from "./saasDB";
import { TenantDB } from "./tenantDB";
import { PLANS, PlanId } from "./types";

// ─── Check if company can access the system ───────────────
export function canAccess(companyId: string): {
  allowed: boolean;
  reason?: string;
  messageAr?: string;
  messageEn?: string;
  daysLeft?: number;
} {
  const result = SaaSDB.checkAccess(companyId);

  if (!result.allowed) {
    const messages: Record<string, { ar: string; en: string }> = {
      suspended: {
        ar: "تم تعليق حسابك. يرجى التواصل مع الدعم.",
        en: "Your account has been suspended. Please contact support.",
      },
      expired: {
        ar: "انتهت صلاحية اشتراكك. يرجى تجديد الاشتراك للمتابعة.",
        en: "Your subscription has expired. Please renew to continue.",
      },
      cancelled: {
        ar: "تم إلغاء اشتراكك.",
        en: "Your subscription has been cancelled.",
      },
      company_not_found: {
        ar: "لم يتم العثور على الشركة.",
        en: "Company not found.",
      },
    };
    const msg = messages[result.reason || ""] || { ar: "خطأ غير معروف", en: "Unknown error" };
    return { allowed: false, reason: result.reason, messageAr: msg.ar, messageEn: msg.en, daysLeft: 0 };
  }

  return { allowed: true, daysLeft: result.daysLeft };
}

// ─── Check if adding a record exceeds plan limits ─────────
export function canAddRecord(
  companyId: string,
  recordType: "invoice" | "product" | "user" | "warehouse"
): { allowed: boolean; messageAr?: string; limitReached?: boolean } {
  const company = SaaSDB.getCompany(companyId);
  if (!company) return { allowed: false, messageAr: "الشركة غير موجودة" };

  const plan = PLANS[company.subscription.planId];
  const db = TenantDB.get();

  const checks: Record<string, { current: number; limit: number; nameAr: string }> = {
    invoice: {
      current: company.usageStats.invoicesThisMonth,
      limit: plan.limits.invoicesPerMonth,
      nameAr: "الفواتير الشهرية",
    },
    product: {
      current: db.products.length,
      limit: plan.limits.productsTotal,
      nameAr: "المنتجات",
    },
    user: {
      current: db.users.length,
      limit: plan.limits.users,
      nameAr: "المستخدمين",
    },
    warehouse: {
      current: db.warehouses.length,
      limit: plan.limits.warehousesTotal,
      nameAr: "المستودعات",
    },
  };

  const check = checks[recordType];
  if (!check) return { allowed: true };
  if (check.limit === -1) return { allowed: true }; // unlimited

  if (check.current >= check.limit) {
    return {
      allowed: false,
      limitReached: true,
      messageAr: `وصلت للحد الأقصى من ${check.nameAr} (${check.limit}) في خطتك الحالية. يرجى الترقية للمتابعة.`,
    };
  }

  return { allowed: true };
}

// ─── Days until subscription expires ─────────────────────
export function getDaysLeft(companyId: string): number {
  const company = SaaSDB.getCompany(companyId);
  if (!company) return 0;
  const today = new Date();
  const end = new Date(company.subscription.endDate);
  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
}

// ─── Warning banner threshold ─────────────────────────────
export function shouldShowRenewalWarning(companyId: string): boolean {
  return getDaysLeft(companyId) <= 7;
}

// ─── Plan display helpers ──────────────────────────────────
export function getPlanName(planId: PlanId, lang: "ar" | "en"): string {
  const plan = PLANS[planId];
  return lang === "ar" ? plan.nameAr : plan.nameEn;
}

export function getPlanBadgeColor(planId: PlanId): string {
  return { trial: "#B7770D", starter: "#2E86C1", pro: "#6C3483", enterprise: "#1E8449" }[planId] || "#888";
}
