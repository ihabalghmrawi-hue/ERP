// RBAC Permission System

export type Permission =
  | "view_dashboard"
  | "view_sales"       | "create_sales"
  | "view_purchases"   | "create_purchases"
  | "view_inventory"   | "manage_inventory"
  | "view_accounting"  | "create_accounting"
  | "view_reports"
  | "view_treasury"    | "manage_treasury"
  | "view_customers"   | "manage_customers"
  | "view_suppliers"   | "manage_suppliers"
  | "manage_users"
  | "manage_settings"
  | "access_pos"
  | "approve_invoices"
  | "delete_records"
  | "export_data";

export type UserRole = "admin" | "accountant" | "sales" | "cashier" | "viewer";

export const ALL_PERMISSIONS: Permission[] = [
  "view_dashboard",
  "view_sales",        "create_sales",
  "view_purchases",    "create_purchases",
  "view_inventory",    "manage_inventory",
  "view_accounting",   "create_accounting",
  "view_reports",
  "view_treasury",     "manage_treasury",
  "view_customers",    "manage_customers",
  "view_suppliers",    "manage_suppliers",
  "manage_users",
  "manage_settings",
  "access_pos",
  "approve_invoices",
  "delete_records",
  "export_data",
];

export interface PermissionGroup {
  label: string;
  permissions: { key: Permission; label: string }[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: "لوحة التحكم",
    permissions: [{ key: "view_dashboard", label: "عرض لوحة التحكم" }],
  },
  {
    label: "المبيعات",
    permissions: [
      { key: "view_sales",       label: "عرض المبيعات" },
      { key: "create_sales",     label: "إنشاء فواتير مبيعات" },
      { key: "approve_invoices", label: "اعتماد الفواتير" },
    ],
  },
  {
    label: "المشتريات",
    permissions: [
      { key: "view_purchases",   label: "عرض المشتريات" },
      { key: "create_purchases", label: "إنشاء أوامر شراء" },
    ],
  },
  {
    label: "المخازن",
    permissions: [
      { key: "view_inventory",   label: "عرض المخزون" },
      { key: "manage_inventory", label: "إدارة المخزون" },
    ],
  },
  {
    label: "المحاسبة والخزينة",
    permissions: [
      { key: "view_accounting",  label: "عرض المحاسبة" },
      { key: "create_accounting",label: "إنشاء قيود يومية" },
      { key: "view_reports",     label: "عرض التقارير" },
      { key: "view_treasury",    label: "عرض الخزينة" },
      { key: "manage_treasury",  label: "إدارة الخزينة" },
    ],
  },
  {
    label: "العملاء والموردون",
    permissions: [
      { key: "view_customers",   label: "عرض العملاء" },
      { key: "manage_customers", label: "إدارة العملاء" },
      { key: "view_suppliers",   label: "عرض الموردين" },
      { key: "manage_suppliers", label: "إدارة الموردين" },
    ],
  },
  {
    label: "النظام والبيانات",
    permissions: [
      { key: "manage_users",     label: "إدارة المستخدمين" },
      { key: "manage_settings",  label: "إدارة الإعدادات" },
      { key: "access_pos",       label: "الوصول لنقطة البيع (POS)" },
      { key: "delete_records",   label: "حذف السجلات" },
      { key: "export_data",      label: "تصدير البيانات" },
    ],
  },
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [...ALL_PERMISSIONS],

  accountant: [
    "view_dashboard",
    "view_sales",
    "view_purchases",    "create_purchases",
    "view_inventory",
    "view_accounting",   "create_accounting",
    "view_reports",
    "view_treasury",     "manage_treasury",
    "view_customers",    "manage_customers",
    "view_suppliers",    "manage_suppliers",
    "export_data",
  ],

  sales: [
    "view_dashboard",
    "view_sales",        "create_sales",
    "view_inventory",
    "view_customers",    "manage_customers",
  ],

  cashier: [
    "view_dashboard",
    "access_pos",
    "view_inventory",
  ],

  viewer: [
    "view_dashboard",
    "view_reports",
    "view_inventory",
    "view_customers",
  ],
};

// Which permission is required to access each page
export const PAGE_PERMISSION: Record<string, Permission> = {
  dashboard:  "view_dashboard",
  sales:      "view_sales",
  purchases:  "view_purchases",
  inventory:  "view_inventory",
  treasury:   "view_treasury",
  customers:  "view_customers",
  suppliers:  "view_suppliers",
  accounting: "view_accounting",
  reports:    "view_reports",
  users:      "manage_users",
  settings:   "manage_settings",
  pos:        "access_pos",
  audit_log:      "manage_users",
  reconciliation: "manage_treasury",
};

export function hasPermission(
  user: { role?: string; permissions?: string[] } | null,
  perm: Permission,
): boolean {
  if (!user) return false;
  if (user.permissions === undefined || user.permissions === null) {
    const role = user.role as UserRole;
    return (ROLE_PERMISSIONS[role] ?? []).includes(perm);
  }
  return user.permissions.includes(perm);
}

export function getDefaultPermissions(role: UserRole): Permission[] {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}

// Check if a date falls in a locked accounting period
export function isPeriodLocked(date: string, lockedPeriods: string[]): boolean {
  if (!lockedPeriods?.length) return false;
  const period = date.slice(0, 7); // "YYYY-MM"
  return lockedPeriods.includes(period);
}
