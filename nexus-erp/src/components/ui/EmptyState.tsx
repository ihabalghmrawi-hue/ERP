"use client";

import { ReactNode } from "react";
import { C } from "@/lib/engine/design";

interface EmptyStateProps {
  icon?: string;
  title: string;
  desc?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, desc, action }: EmptyStateProps) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", color: C.textMuted }}>
      {icon && (
        <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>{icon}</div>
      )}
      <div style={{ fontSize: 15, fontWeight: 700, color: C.textSec, marginBottom: 6 }}>
        {title}
      </div>
      {desc && (
        <div style={{ fontSize: 13, color: C.textMuted }}>{desc}</div>
      )}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}
