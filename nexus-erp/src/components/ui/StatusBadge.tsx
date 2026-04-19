"use client";

import { S } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";

type BadgeColor = "success" | "warning" | "danger" | "info" | "purple" | "gold";

const STATUS_MAP: Record<string, [BadgeColor, string]> = {
  paid:        ["success", "paidStatus"],
  outstanding: ["warning", "outstandingStatus"],
  overdue:     ["danger",  "overdueStatus"],
  posted:      ["success", "postedStatus"],
  draft:       ["gold",    "draftStatus"],
  pending:     ["warning", "pendingStatus"],
  received:    ["success", "receivedStatus"],
  partial:     ["warning", "partialStatus"],
  cancelled:   ["danger",  "cancelledStatus"],
  active:      ["success", "activeStatus"],
  inactive:    ["danger",  "inactiveStatus"],
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useLang();
  const [color, key] = STATUS_MAP[status] ?? ["info", status];
  return <span style={S.badge(color)}>{t(key)}</span>;
}
