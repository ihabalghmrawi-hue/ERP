export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function fmt(n: number | null | undefined, curr?: string): string {
  if (n === undefined || n === null) return "—";
  let currency = curr;
  if (!currency) {
    try {
      const { DB } = require("../db/database");
      currency = DB.get().settings.baseCurrency || "SAR";
    } catch {
      currency = "SAR";
    }
  }
  try {
    return new Intl.NumberFormat("ar-SA", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    // Fallback if currency code is invalid
    return new Intl.NumberFormat("ar-SA", {
      style: "currency",
      currency: "SAR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  }
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

export function fmtNum(n: number | null | undefined): string {
  return new Intl.NumberFormat("ar-SA").format(n || 0);
}

export function logActivity(
  userId: string,
  userName: string,
  action: string,
  module: string,
  description: string,
  oldValues?: Record<string, any>,
  newValues?: Record<string, any>,
  ipAddress?: string,
  userAgent?: string
): void {
  import("../db/database").then(({ DB }) => {
    DB.get().activityLog.unshift({
      id: uid(),
      timestamp: new Date().toLocaleString("ar-SA"),
      userId,
      user: userName,
      action,
      module,
      description,
      oldValues,
      newValues,
      ipAddress,
      userAgent,
      readonly: true,
    });
    DB.save();
  });
  // Send asynchronously to server-side Audit API (non-blocking)
  try {
    if (typeof window !== "undefined") {
      const payload = {
        userId,
        userName,
        action,
        module,
        description,
        oldValues,
        newValues,
        ipAddress,
        userAgent: userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : ""),
      };
      void fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
  } catch {}
}

export function logError(
  userId: string,
  userName: string,
  module: string,
  error: string,
  ipAddress?: string,
  userAgent?: string
): void {
  import("../db/database").then(({ DB }) => {
    DB.get().activityLog.unshift({
      id: uid(),
      timestamp: new Date().toLocaleString("ar-SA"),
      userId,
      user: userName,
      action: "ERROR",
      module,
      description: `خطأ: ${error}`,
      ipAddress,
      userAgent,
      readonly: true,
    });
    DB.save();
  });
  try {
    if (typeof window !== "undefined") {
      const payload = { userId, userName, module, error, ipAddress, userAgent: userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : "") };
      void fetch("/api/audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => {});
    }
  } catch {}
}
