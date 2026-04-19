"use client";

import { ReactNode } from "react";
import { C, S } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";

interface Column {
  label: string;
  align?: "right" | "left" | "center";
}

interface DataTableProps {
  headers: Column[];
  rows: ReactNode[][];
  emptyMsg?: string;
}

export function DataTable({ headers, rows, emptyMsg }: DataTableProps) {
  const { t } = useLang();

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={S.table}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{ ...S.th, textAlign: h.align || "right" }}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={headers.length}
                style={{ ...S.td, textAlign: "center", padding: 40, color: C.textMuted }}
              >
                {emptyMsg || t("noRecords")}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLTableRowElement).style.background = C.surfaceAlt)
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")
                }
              >
                {row.map((cell, j) => (
                  <td
                    key={j}
                    style={{ ...S.td, textAlign: headers[j]?.align || "right" }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
