"use client";

import { ReactNode } from "react";
import { C, S, ELEVATION, MOTION } from "@/lib/engine/design";

interface KPIProps {
  label: string;
  value: string | number;
  color: string;
  icon?: string | ReactNode;
  change?: number;
  changeLabel?: string;
  sublabel?: string;
}

export function KPI({ label, value, color, icon, change, changeLabel, sublabel }: KPIProps) {
  const isUp      = change !== undefined && change >= 0;
  const hasChange = change !== undefined;

  return (
    <div
      data-card-hover=""
      style={{
        ...S.kpiCard(color),
        cursor: "default",
        transition: `transform ${MOTION.normal}, box-shadow ${MOTION.normal}, border-color ${MOTION.normal}`,
      }}
    >
      {/* Subtle tinted background wash */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "inherit",
        background: `linear-gradient(135deg, ${color}08 0%, transparent 60%)`,
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.kpiLabel}>{label}</div>
          <div style={S.kpiValue}>{value}</div>

          {sublabel && (
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3, lineHeight: 1.4 }}>
              {sublabel}
            </div>
          )}

          {hasChange && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 3, marginTop: 6,
              padding: "2px 7px", borderRadius: 6,
              background: isUp ? C.successLight : C.dangerLight,
              border: `1px solid ${isUp ? C.success + "30" : C.danger + "30"}`,
            }}>
              {isUp ? (
                <svg width="9" height="9" viewBox="0 0 10 10" fill={C.success}>
                  <path d="M5 1 L9 7 L1 7 Z"/>
                </svg>
              ) : (
                <svg width="9" height="9" viewBox="0 0 10 10" fill={C.danger}>
                  <path d="M5 9 L9 3 L1 3 Z"/>
                </svg>
              )}
              <span style={{ fontSize: 11, fontWeight: 700, color: isUp ? C.success : C.danger }}>
                {Math.abs(change)}%
              </span>
              {changeLabel && (
                <span style={{ fontSize: 10.5, color: C.textMuted }}>
                  {changeLabel}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Icon badge */}
        {icon && (
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: `${color}18`,
            border: `1px solid ${color}28`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: typeof icon === "string" ? 18 : 14,
            color: color,
          }}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
