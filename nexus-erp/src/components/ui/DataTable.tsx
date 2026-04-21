"use client";

import { ReactNode } from "react";
import { C, S, MOTION } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { EmptyState } from "./EmptyState";

interface Column {
  label: string;
  align?: "right" | "left" | "center";
  width?: number | string;
  shrink?: boolean;
}

interface DataTableProps {
  headers: Column[];
  rows: ReactNode[][];
  emptyMsg?: string;
  emptyDesc?: string;
  emptyIcon?: string | ReactNode;
  emptyAction?: ReactNode;
  zebra?: boolean;
  stickyHeader?: boolean;
  maxHeight?: number | string;
  compact?: boolean;
}

export function DataTable({
  headers, rows,
  emptyMsg, emptyDesc, emptyIcon, emptyAction,
  zebra = false,
  stickyHeader = false,
  maxHeight,
  compact = false,
}: DataTableProps) {
  const { t } = useLang();

  const cellPad = compact ? "7px 12px" : "11px 14px";

  return (
    <div style={{
      overflowX: "auto",
      overflowY: maxHeight ? "auto" : undefined,
      maxHeight,
      borderRadius: 10,
      border: `1px solid ${C.border}`,
    }}>
      <table style={{ ...S.table, borderCollapse: "separate", borderSpacing: 0 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                style={{
                  ...S.th,
                  padding: compact ? "7px 12px" : S.th.padding,
                  textAlign: h.align || "right",
                  width: h.width,
                  minWidth: h.shrink ? undefined : 80,
                  whiteSpace: "nowrap",
                  position: stickyHeader ? "sticky" : undefined,
                  top: stickyHeader ? 0 : undefined,
                  zIndex: stickyHeader ? 10 : undefined,
                  background: C.surfaceAlt,
                  // Bordered bottom on sticky header so it doesn't bleed
                  boxShadow: stickyHeader ? `0 1px 0 ${C.border}` : undefined,
                  borderBottom: stickyHeader ? "none" : S.th.borderBottom as string,
                  // First/last cell rounding
                  borderRadius: i === 0
                    ? "10px 0 0 0"
                    : i === headers.length - 1
                    ? "0 10px 0 0"
                    : undefined,
                }}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} style={{ padding: 0, border: "none" }}>
                <EmptyState
                  icon={emptyIcon ?? "📋"}
                  title={emptyMsg ?? t("noRecords")}
                  desc={emptyDesc}
                  action={emptyAction}
                  compact
                />
              </td>
            </tr>
          ) : (
            rows.map((row, i) => {
              const isEven  = i % 2 === 0;
              const zebraFg = zebra && !isEven ? C.surfaceAlt : "transparent";
              return (
                <tr
                  key={i}
                  data-trow=""
                  style={{
                    background: zebraFg,
                    transition: `background ${MOTION.fast}`,
                  }}
                >
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      style={{
                        ...S.td,
                        padding: cellPad,
                        textAlign: headers[j]?.align || "right",
                        // Remove bottom border on last row
                        borderBottom: i === rows.length - 1 ? "none" : S.td.borderBottom as string,
                        // Let GLOBAL_CSS [data-trow]:hover td handle background
                        background: "inherit",
                        transition: `background ${MOTION.fast}`,
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
