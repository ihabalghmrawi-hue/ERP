export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function fmt(n: number | null | undefined, curr = "SAR"): string {
  if (n === undefined || n === null) return "—";
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: curr,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
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
  description: string
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
    });
    DB.save();
  });
}
