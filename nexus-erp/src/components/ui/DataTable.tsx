"use client";

import { ReactNode, useState, useRef, useEffect, CSSProperties } from "react";
import { C, S, MOTION, ELEVATION } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { EmptyState } from "./EmptyState";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Column {
  label: string;
  align?: "right" | "left" | "center";
  width?: number | string;
  shrink?: boolean;
  editable?: boolean;
}

interface BulkAction {
  id: string;
  label: string;
  variant?: "danger" | "default";
}

interface EditingCell {
  row: number;
  col: number;
  value: string;
}

interface DataTableProps {
  headers: Column[];
  rows: ReactNode[][];

  // Empty state
  emptyMsg?: string;
  emptyDesc?: string;
  emptyIcon?: string | ReactNode;
  emptyAction?: ReactNode;

  // Display options
  zebra?: boolean;
  stickyHeader?: boolean;
  maxHeight?: number | string;
  compact?: boolean;

  // Bulk selection
  selectable?: boolean;
  bulkActions?: BulkAction[];
  onBulkAction?: (selectedIndices: number[], actionId: string) => void;

  // Inline editing
  rawData?: (string | null)[][];
  onCellChange?: (rowIndex: number, colIndex: number, newValue: string) => void;

  // Row interaction
  onRowClick?: (rowIndex: number) => void;
}

// ── Checkbox ──────────────────────────────────────────────────────────────────

function Checkbox({
  checked, indeterminate, onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={e => e.stopPropagation()}
      style={{
        width: 15, height: 15, cursor: "pointer",
        accentColor: C.accent,
        borderRadius: 4, flexShrink: 0,
      }}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DataTable({
  headers, rows,
  emptyMsg, emptyDesc, emptyIcon, emptyAction,
  zebra = false,
  stickyHeader = false,
  maxHeight,
  compact = false,
  selectable = false,
  bulkActions,
  onBulkAction,
  rawData,
  onCellChange,
  onRowClick,
}: DataTableProps) {
  const { t } = useLang();

  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [editingCell, setEditingCell]   = useState<EditingCell | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const allSelected  = rows.length > 0 && selectedRows.size === rows.length;
  const someSelected = selectedRows.size > 0 && !allSelected;
  const hasSelection = selectedRows.size > 0;

  // Focus edit input when a cell enters edit mode
  useEffect(() => {
    if (editingCell) {
      requestAnimationFrame(() => {
        editInputRef.current?.focus();
        editInputRef.current?.select();
      });
    }
  }, [editingCell]);

  const toggleAll = () => {
    if (allSelected) setSelectedRows(new Set());
    else setSelectedRows(new Set(rows.map((_, i) => i)));
  };

  const toggleRow = (i: number) => {
    const next = new Set(selectedRows);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelectedRows(next);
  };

  const commitEdit = () => {
    if (!editingCell) return;
    onCellChange?.(editingCell.row, editingCell.col, editingCell.value);
    setEditingCell(null);
  };

  const cancelEdit = () => setEditingCell(null);

  const cellPad = compact ? "7px 12px" : "11px 14px";

  // Merged headers (with checkbox column prepended if selectable)
  const displayHeaders: Column[] = selectable
    ? [{ label: "", width: 40, shrink: true }, ...headers]
    : headers;

  // ── Styles ──────────────────────────────────────────────────────────────────

  const thStyle = (i: number, h: Column): CSSProperties => ({
    ...S.th,
    padding: compact ? "7px 12px" : S.th.padding as string,
    textAlign: i === 0 && selectable ? "center" : (h.align || "right"),
    width: h.width,
    minWidth: h.shrink ? undefined : (i === 0 && selectable ? 40 : 80),
    whiteSpace: "nowrap",
    position: stickyHeader ? "sticky" : undefined,
    top: stickyHeader ? 0 : undefined,
    zIndex: stickyHeader ? 10 : undefined,
    background: C.surfaceAlt,
    boxShadow: stickyHeader ? `0 1px 0 ${C.border}` : undefined,
    borderBottom: stickyHeader ? "none" : `1.5px solid ${C.border}`,
  });

  return (
    <div>
      {/* ── Bulk action bar ──────────────────────── */}
      {hasSelection && bulkActions && bulkActions.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 14px",
          background: C.accentLight,
          border: `1px solid ${C.accentMid}30`,
          borderBottom: "none",
          borderRadius: "10px 10px 0 0",
        }}>
          <span style={{
            fontSize: 12.5, fontWeight: 700, color: C.accent, flexShrink: 0,
          }}>
            {selectedRows.size} {t ? t("selected") || "محدد" : "محدد"}
          </span>
          <div style={{ width: 1, height: 14, background: `${C.accent}40` }} />
          {bulkActions.map(action => (
            <button
              key={action.id}
              onClick={() => onBulkAction?.(Array.from(selectedRows), action.id)}
              style={{
                ...S.btn(action.variant === "danger" ? "danger" : "sm"),
                fontSize: 12,
              }}
            >
              {action.label}
            </button>
          ))}
          <button
            onClick={() => setSelectedRows(new Set())}
            style={{
              marginInlineStart: "auto",
              border: "none", background: "none",
              fontSize: 11.5, color: C.accent,
              cursor: "pointer", fontFamily: "inherit",
              opacity: 0.8,
            }}
          >
            إلغاء التحديد ✕
          </button>
        </div>
      )}

      {/* ── Table ───────────────────────────────── */}
      <div style={{
        overflowX: "auto",
        overflowY: maxHeight ? "auto" : undefined,
        maxHeight,
        borderRadius: hasSelection && bulkActions?.length ? "0 0 10px 10px" : 10,
        border: `1px solid ${C.border}`,
      }}>
        <table style={{ ...S.table, borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr>
              {displayHeaders.map((h, i) => (
                <th key={i} style={thStyle(i, h)}>
                  {i === 0 && selectable ? (
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <Checkbox
                        checked={allSelected}
                        indeterminate={someSelected}
                        onChange={toggleAll}
                      />
                    </div>
                  ) : h.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={displayHeaders.length} style={{ padding: 0, border: "none" }}>
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
              rows.map((row, ri) => {
                const isSelected = selectedRows.has(ri);
                const zebraFg    = zebra && ri % 2 !== 0 ? C.surfaceAlt : "transparent";

                return (
                  <tr
                    key={ri}
                    data-trow=""
                    onClick={() => onRowClick?.(ri)}
                    style={{
                      background: isSelected
                        ? `${C.accent}08`
                        : zebraFg,
                      cursor: onRowClick ? "pointer" : "default",
                      transition: `background ${MOTION.fast}`,
                      outline: isSelected ? `2px solid ${C.accent}20` : "none",
                      outlineOffset: -2,
                    }}
                  >
                    {/* Checkbox cell */}
                    {selectable && (
                      <td style={{
                        ...S.td,
                        padding: "0 14px",
                        textAlign: "center",
                        width: 40,
                        borderBottom: ri === rows.length - 1 ? "none" : `1px solid ${C.border}`,
                        background: "inherit",
                      }}>
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleRow(ri)}
                        />
                      </td>
                    )}

                    {/* Data cells */}
                    {row.map((cell, ci) => {
                      const colDef   = headers[ci];
                      const isEditable = colDef?.editable && rawData;
                      const isEditing  = editingCell?.row === ri && editingCell?.col === ci;
                      const rawValue   = rawData?.[ri]?.[ci] ?? "";

                      return (
                        <td
                          key={ci}
                          data-editable-cell={isEditable ? "" : undefined}
                          style={{
                            ...S.td,
                            padding: isEditing ? "5px 8px" : cellPad,
                            textAlign: colDef?.align || "right",
                            borderBottom: ri === rows.length - 1
                              ? "none"
                              : `1px solid ${C.border}`,
                            background: isEditing ? C.accentLight : "inherit",
                            transition: `background ${MOTION.fast}`,
                            position: "relative",
                          }}
                          onClick={isEditable && !isEditing ? (e) => {
                            e.stopPropagation();
                            setEditingCell({ row: ri, col: ci, value: rawValue ?? "" });
                          } : undefined}
                        >
                          {isEditing ? (
                            <input
                              ref={editInputRef}
                              value={editingCell.value}
                              onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)}
                              onBlur={commitEdit}
                              onKeyDown={e => {
                                if (e.key === "Enter")  { e.preventDefault(); commitEdit(); }
                                if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                                if (e.key === "Tab")    { commitEdit(); }
                              }}
                              style={{
                                width: "100%", border: "none", outline: "none",
                                background: "transparent",
                                fontSize: 13, color: C.text,
                                fontFamily: "inherit",
                                textAlign: colDef?.align || "right",
                                caretColor: C.accent,
                              }}
                            />
                          ) : (
                            cell
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Selection count summary ─────────────── */}
      {hasSelection && (
        <div style={{
          padding: "5px 14px",
          fontSize: 11, color: C.textMuted,
        }}>
          {selectedRows.size} من {rows.length} صفوف محددة
        </div>
      )}
    </div>
  );
}
