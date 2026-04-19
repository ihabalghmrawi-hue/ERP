"use client";

import { C, S } from "@/lib/engine/design";

interface KPIProps {
  label: string;
  value: string | number;
  color: string;
  icon?: string;
  change?: number;
}

export function KPI({ label, value, color, icon, change }: KPIProps) {
  return (
    <div style={S.kpiCard(color)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={S.kpiLabel}>{label}</div>
          <div style={S.kpiValue}>{value}</div>
          {change !== undefined && (
            <div style={{ fontSize: 11, color: change >= 0 ? C.success : C.danger, marginTop: 4 }}>
              {change >= 0 ? "▲" : "▼"} {Math.abs(change)}%
            </div>
          )}
        </div>
        {icon && (
          <div style={{ fontSize: 28, opacity: 0.2 }}>{icon}</div>
        )}
      </div>
    </div>
  );
}
