"use client";

import { CSSProperties } from "react";
import { C } from "@/lib/engine/design";

// ── Bar Chart ─────────────────────────────────────────────────────────────
export interface BarData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarData[];
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
  style?: CSSProperties;
}

export function BarChart({ data, height = 120, color = C.accent, formatValue, style }: BarChartProps) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const barW = Math.floor(100 / data.length);

  return (
    <div style={{ width: "100%", ...style }}>
      <svg viewBox={`0 0 ${data.length * 40} ${height + 24}`} style={{ width: "100%", height: height + 24, overflow: "visible" }}>
        {data.map((d, i) => {
          const barH  = Math.max(2, (d.value / max) * height);
          const x     = i * 40 + 4;
          const y     = height - barH;
          const c     = d.color ?? color;
          return (
            <g key={i}>
              <rect x={x} y={y} width={32} height={barH} rx={3} fill={c} opacity={0.85} />
              {/* value label on top */}
              {d.value > 0 && (
                <text x={x + 16} y={y - 3} textAnchor="middle" fontSize={8} fill={C.textSec}>
                  {formatValue ? formatValue(d.value) : d.value.toLocaleString()}
                </text>
              )}
              {/* x-axis label */}
              <text x={x + 16} y={height + 14} textAnchor="middle" fontSize={9} fill={C.textMuted}>
                {d.label}
              </text>
            </g>
          );
        })}
        {/* baseline */}
        <line x1={0} y1={height} x2={data.length * 40} y2={height} stroke={C.border} strokeWidth={1} />
      </svg>
    </div>
  );
}

// ── Mini Line Sparkline ───────────────────────────────────────────────────
interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
}

export function Sparkline({ data, width = 120, height = 36, color = C.accent, fill = true }: SparklineProps) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });
  const polyline = pts.join(" ");
  const area = `${pts[0]} ${pts.join(" ")} ${width},${height} 0,${height}`;

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {fill && <polygon points={area} fill={color} opacity={0.12} />}
      <polyline points={polyline} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {/* last point dot */}
      <circle cx={parseFloat(pts[pts.length - 1].split(",")[0])} cy={parseFloat(pts[pts.length - 1].split(",")[1])} r={3} fill={color} />
    </svg>
  );
}

// ── Donut Chart ───────────────────────────────────────────────────────────
export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutProps {
  slices: DonutSlice[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}

export function DonutChart({ slices, size = 100, centerLabel, centerValue }: DonutProps) {
  const total = slices.reduce((s, d) => s + d.value, 0) || 1;
  const r = 38; const cx = 50; const cy = 50;
  let cumAngle = -Math.PI / 2;

  function arc(startAngle: number, endAngle: number) {
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const large = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ flexShrink: 0 }}>
        {/* background circle */}
        <circle cx={cx} cy={cy} r={r} fill={C.border} opacity={0.3} />
        {slices.map((s, i) => {
          const angle = (s.value / total) * 2 * Math.PI;
          const start = cumAngle;
          cumAngle += angle;
          return <path key={i} d={arc(start, cumAngle)} fill={s.color} opacity={0.9} />;
        })}
        {/* inner hole */}
        <circle cx={cx} cy={cy} r={24} fill="white" />
        {centerValue && (
          <>
            <text x={cx} y={cy - 2} textAnchor="middle" fontSize={11} fontWeight="bold" fill={C.text}>{centerValue}</text>
            {centerLabel && <text x={cx} y={cy + 10} textAnchor="middle" fontSize={7} fill={C.textMuted}>{centerLabel}</text>}
          </>
        )}
      </svg>
      {/* legend */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ color: C.textSec }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
