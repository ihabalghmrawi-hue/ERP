"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import { C, S, ELEVATION } from "@/lib/engine/design";

export interface PaletteCommand {
  id: string;
  label: string;
  sublabel: string;
  icon: ReactNode;
  shortcut?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  commands: PaletteCommand[];
  placeholder?: string;
}

const KBD: React.FC<{ children: ReactNode }> = ({ children }) => (
  <kbd style={{
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    padding: "2px 6px", borderRadius: 5,
    background: C.surfaceAlt, border: `1px solid ${C.borderDark}`,
    fontSize: 10.5, fontWeight: 600, color: C.textMuted,
    fontFamily: "system-ui, monospace", lineHeight: 1.6,
    letterSpacing: "0.02em",
  }}>
    {children}
  </kbd>
);

export function CommandPalette({ open, onClose, onSelect, commands, placeholder }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);
  const isAr = placeholder?.includes("ب") ?? true;

  const filtered = query.trim()
    ? commands.filter(c =>
        c.label.includes(query) ||
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.sublabel.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => { setSelected(0); }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    const item = listRef.current?.children[selected] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected(s => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected(s => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selected]) { onSelect(filtered[selected].id); onClose(); }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      data-modal=""
      style={{
        ...S.modal,
        alignItems: "flex-start",
        paddingTop: "12vh",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          width: "100%",
          maxWidth: 560,
          overflow: "hidden",
          boxShadow: ELEVATION[5],
        }}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* ── Search input ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "13px 16px",
          borderBottom: `1px solid ${C.border}`,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

        {/* ── Results list ── */}
        <div ref={listRef} style={{ maxHeight: 360, overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{
              padding: "36px 16px", textAlign: "center",
              color: C.textMuted, fontSize: 13,
            }}>
              {isAr ? `لا نتائج لـ "${query}"` : `No results for "${query}"`}
            </div>
          ) : (
            filtered.map((cmd, i) => {
              const isSelected = i === selected;
              return (
                <div
                  key={cmd.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 16px",
                    cursor: "pointer",
                    background: isSelected ? C.accentLight : "transparent",
                    borderLeft: isSelected ? `3px solid ${C.accent}` : "3px solid transparent",
                    transition: "background 0.08s, border-color 0.08s",
                  }}
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => { onSelect(cmd.id); onClose(); }}
                >
                  <span style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: isSelected ? C.accentLight : C.surfaceAlt,
                    border: `1px solid ${isSelected ? C.accent + "40" : C.border}`,
                    color: isSelected ? C.accent : C.textMuted,
                    transition: "all 0.08s",
                  }}>
                    {cmd.icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: isSelected ? 600 : 500, color: C.text }}>
                      {cmd.label}
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
                      {cmd.sublabel}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    {cmd.shortcut && <KBD>{cmd.shortcut}</KBD>}
                    {isSelected && <KBD>↵</KBD>}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: "8px 16px",
          borderTop: `1px solid ${C.border}`,
          background: C.surfaceAlt,
          display: "flex", alignItems: "center", gap: 16,
        }}>
          {(["↑↓ تنقل", "↵ فتح", "Esc إغلاق"] as const).map(hint => (
            <span key={hint} style={{ fontSize: 11, color: C.textMuted }}>{hint}</span>
          ))}
          <span style={{ marginInlineStart: "auto", fontSize: 11, color: C.textMuted, opacity: 0.6 }}>
            {filtered.length} نتيجة
          </span>
        </div>
      </div>
    </div>
  );
}
