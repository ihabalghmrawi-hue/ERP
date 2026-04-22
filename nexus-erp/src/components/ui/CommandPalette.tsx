"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import { C, S, ELEVATION, MOTION } from "@/lib/engine/design";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CommandKind = "navigate" | "action";

export interface PaletteCommand {
  id: string;
  label: string;
  sublabel: string;
  icon: ReactNode;
  kind?: CommandKind;   // default "navigate"
  shortcut?: string;
  accent?: string;      // custom accent color for action commands
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelect: (id: string, kind: CommandKind) => void;
  commands: PaletteCommand[];
  placeholder?: string;
}

// ── Sub-components ────────────────────────────────────────────────────────────

const KBD = ({ children }: { children: ReactNode }) => (
  <kbd style={{
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    padding: "2px 6px", borderRadius: 5,
    background: C.surfaceAlt, border: `1px solid ${C.borderDark}`,
    fontSize: 10.5, fontWeight: 600, color: C.textMuted,
    fontFamily: "system-ui, monospace", lineHeight: 1.6,
  }}>
    {children}
  </kbd>
);

const SectionLabel = ({ label }: { label: string }) => (
  <div style={{
    padding: "8px 16px 4px",
    fontSize: 10, fontWeight: 700,
    color: C.textMuted, letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    userSelect: "none" as const,
    borderTop: `1px solid ${C.border}`,
  }}>
    {label}
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

export function CommandPalette({ open, onClose, onSelect, commands, placeholder }: CommandPaletteProps) {
  const [query, setQuery]       = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);
  const isAr = (placeholder ?? "").includes("ب") || !placeholder;

  // ── Filter ──────────────────────────────────────────────────────────────────
  const filtered = query.trim()
    ? commands.filter(c =>
        c.label.includes(query) ||
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.sublabel.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  // Separate actions and navigation so actions always appear first
  const actions   = filtered.filter(c => c.kind === "action");
  const navItems  = filtered.filter(c => c.kind !== "action");

  // Flat list for keyboard indexing — actions first
  const flatList  = [...actions, ...navItems];
  const totalCount = flatList.length;

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => { setSelected(0); }, [query]);

  useEffect(() => {
    const item = listRef.current?.querySelector(`[data-palette-idx="${selected}"]`) as HTMLElement | null;
    item?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  // ── Keyboard ─────────────────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected(s => Math.min(s + 1, totalCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected(s => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = flatList[selected];
      if (cmd) { onSelect(cmd.id, cmd.kind ?? "navigate"); onClose(); }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!open) return null;

  // ── Render helpers ────────────────────────────────────────────────────────────
  const renderItem = (cmd: PaletteCommand, flatIdx: number) => {
    const isSelected = flatIdx === selected;
    const isAction   = cmd.kind === "action";
    const iconAccent = cmd.accent ?? (isAction ? C.accent : undefined);

    return (
      <div
        key={cmd.id}
        data-palette-idx={flatIdx}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "9px 16px",
          cursor: "pointer",
          background: isSelected
            ? (isAction ? `${C.accent}0D` : C.accentLight)
            : "transparent",
          borderInlineStart: `3px solid ${isSelected ? (iconAccent ?? C.accent) : "transparent"}`,
          transition: `background ${MOTION.instant}, border-color ${MOTION.instant}`,
        }}
        onMouseEnter={() => setSelected(flatIdx)}
        onClick={() => { onSelect(cmd.id, cmd.kind ?? "navigate"); onClose(); }}
      >
        {/* Icon box */}
        <span style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: isSelected
            ? (iconAccent ? `${iconAccent}20` : C.accentLight)
            : (isAction ? `${C.accent}0A` : C.surfaceAlt),
          border: `1px solid ${isSelected
            ? (iconAccent ? `${iconAccent}40` : `${C.accent}40`)
            : (isAction ? `${C.accent}20` : C.border)}`,
          color: isSelected
            ? (iconAccent ?? C.accent)
            : (isAction ? C.accent : C.textMuted),
          transition: `all ${MOTION.fast}`,
        }}>
          {cmd.icon}
        </span>

        {/* Label + sublabel */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13,
            fontWeight: isSelected ? 600 : (isAction ? 500 : 400),
            color: isSelected ? (isAction ? C.accent : C.text) : C.text,
            lineHeight: 1.4,
          }}>
            {cmd.label}
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
            {cmd.sublabel}
          </div>
        </div>

        {/* Keyboard hints */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {cmd.shortcut && <KBD>{cmd.shortcut}</KBD>}
          {isSelected && <KBD>↵</KBD>}
        </div>
      </div>
    );
  };

  return (
    <div
      data-modal=""
      style={{ ...S.modal, alignItems: "flex-start", paddingTop: "10vh" }}
      onClick={onClose}
    >
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          width: "100%", maxWidth: 560,
          overflow: "hidden",
          boxShadow: ELEVATION[5],
        }}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* ── Search input ───────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "13px 16px",
          borderBottom: `1px solid ${C.border}`,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke={C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={placeholder ?? "بحث في الوحدات والإجراءات..."}
            style={{
              flex: 1, border: "none", outline: "none",
              fontSize: 14, color: C.text,
              background: "transparent", fontFamily: "inherit",
              caretColor: C.accent,
            }}
          />
          <KBD>Esc</KBD>
        </div>

        {/* ── Results ─────────────────────────────── */}
        <div ref={listRef} style={{ maxHeight: 380, overflowY: "auto" }}>
          {totalCount === 0 ? (
            <div style={{
              padding: "40px 16px", textAlign: "center",
              color: C.textMuted, fontSize: 13,
            }}>
              <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.3 }}>⌕</div>
              {isAr ? `لا نتائج لـ "${query}"` : `No results for "${query}"`}
            </div>
          ) : (
            <>
              {/* Quick actions section */}
              {actions.length > 0 && (
                <>
                  <SectionLabel label={isAr ? "إجراءات سريعة" : "Quick Actions"} />
                  {actions.map((cmd, i) => renderItem(cmd, i))}
                </>
              )}

              {/* Navigation section */}
              {navItems.length > 0 && (
                <>
                  <SectionLabel label={isAr ? "التنقل" : "Navigate"} />
                  {navItems.map((cmd, i) => renderItem(cmd, actions.length + i))}
                </>
              )}
            </>
          )}
        </div>

        {/* ── Footer ──────────────────────────────── */}
        <div style={{
          padding: "7px 16px",
          borderTop: `1px solid ${C.border}`,
          background: C.surfaceAlt,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <span style={{ fontSize: 10.5, color: C.textMuted }}>↑↓ تنقل</span>
          <span style={{ fontSize: 10.5, color: C.textMuted }}>↵ تنفيذ</span>
          <span style={{ fontSize: 10.5, color: C.textMuted }}>Esc إغلاق</span>
          <span style={{ marginInlineStart: "auto", fontSize: 10.5, color: C.textMuted, opacity: 0.6 }}>
            {totalCount} نتيجة
          </span>
        </div>
      </div>
    </div>
  );
}
