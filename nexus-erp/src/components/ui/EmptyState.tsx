"use client";

import { ReactNode } from "react";
import { C, ELEVATION } from "@/lib/engine/design";

interface EmptyStateProps {
  icon?: string | ReactNode;
  title: string;
  desc?: string;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon, title, desc, action, compact }: EmptyStateProps) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: compact ? "32px 24px" : "56px 32px",
      textAlign: "center",
      gap: 0,
    }}>
      {/* Icon container */}
      {icon && (
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: C.surfaceAlt,
          border: `1px solid ${C.border}`,
          boxShadow: ELEVATION[1],
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: typeof icon === "string" ? 24 : 20,
          color: C.textMuted,
          marginBottom: 16,
          flexShrink: 0,
        }}>
          {icon}
        </div>
      )}

      <div style={{
        fontSize: compact ? 14 : 15,
        fontWeight: 600,
        color: C.textSec,
        marginBottom: 6,
        letterSpacing: "-0.01em",
      }}>
        {title}
      </div>

      {desc && (
        <div style={{
          fontSize: 13,
          color: C.textMuted,
          lineHeight: 1.6,
          maxWidth: 320,
          marginBottom: action ? 0 : 0,
        }}>
          {desc}
        </div>
      )}

      {action && (
        <div style={{ marginTop: 20 }}>
          {action}
        </div>
      )}
    </div>
  );
}
