"use client";

import { CSSProperties } from "react";
import { C, S } from "@/lib/engine/design";

// ── Primitive ─────────────────────────────────────────────────────────────────
interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: CSSProperties;
}
export function Skeleton({ width = "100%", height = 14, radius = 6, style }: SkeletonProps) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: radius, flexShrink: 0, ...style }}
    />
  );
}

// ── Text block ────────────────────────────────────────────────────────────────
export function SkeletonText({ lines = 3, gap = 8 }: { lines?: number; gap?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? "55%" : "100%"} height={12} />
      ))}
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
export function SkeletonKPI() {
  return (
    <div style={{
      ...S.card,
      borderTop: `3px solid ${C.border}`,
      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    }}>
      <div style={{ flex: 1 }}>
        <Skeleton width={72} height={9}  style={{ marginBottom: 10 }} />
        <Skeleton width={110} height={26} style={{ marginBottom: 10 }} />
        <Skeleton width={52} height={18} radius={6} />
      </div>
      <Skeleton width={38} height={38} radius={10} />
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────
export function SkeletonTable({ cols = 4, rows = 5 }: { cols?: number; rows?: number }) {
  const colWidths = Array.from({ length: cols }, (_, i) =>
    i === 0 ? "25%" : i === cols - 1 ? "10%" : `${Math.floor(60 / (cols - 2))}%`
  );

  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: 10, overflow: "hidden",
    }}>
      {/* Header row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: colWidths.join(" "),
        gap: 16, padding: "10px 14px",
        background: C.surfaceAlt,
        borderBottom: `1px solid ${C.border}`,
      }}>
        {colWidths.map((w, i) => (
          <Skeleton key={i} height={9} width="65%" />
        ))}
      </div>

      {/* Data rows */}
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} style={{
          display: "grid",
          gridTemplateColumns: colWidths.join(" "),
          gap: 16, padding: "12px 14px",
          borderBottom: ri < rows - 1 ? `1px solid ${C.border}` : "none",
          // Stagger animation delay so rows shimmer sequentially
          animationDelay: `${ri * 0.08}s`,
        }}>
          {colWidths.map((w, ci) => (
            <Skeleton key={ci} height={12}
              width={ci === 0 ? "85%" : ci === cols - 1 ? "50%" : "75%"}
              // Each cell gets a slightly different delay so they don't shimmer in unison
              style={{ animationDelay: `${(ri * cols + ci) * 0.04}s` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <Skeleton width={120} height={14} />
        <Skeleton width={60} height={22} radius={6} />
      </div>
      <SkeletonText lines={lines} />
    </div>
  );
}

// ── Page-level loading (grid of KPIs + table) ─────────────────────────────────
export function SkeletonPage({ kpis = 4, tableRows = 6 }: { kpis?: number; tableRows?: number }) {
  return (
    <div>
      {/* Page title */}
      <Skeleton width={160} height={20} style={{ marginBottom: 6 }} />
      <Skeleton width={240} height={11} style={{ marginBottom: 24 }} />

      {/* KPI row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${kpis}, 1fr)`,
        gap: 14, marginBottom: 24,
      }}>
        {Array.from({ length: kpis }).map((_, i) => <SkeletonKPI key={i} />)}
      </div>

      {/* Table */}
      <SkeletonTable rows={tableRows} />
    </div>
  );
}
