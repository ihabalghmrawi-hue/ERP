import { CSSProperties } from "react";

// ─────────────────────────────────────────────────────────────────────────────
//  BOB ERP — Design System v3
//  Inspired by: Linear, Stripe Dashboard, Vercel
//  Principles: Data-dense, minimal chrome, excellent contrast, RTL-first
// ─────────────────────────────────────────────────────────────────────────────

export const C = {
  // ── Backgrounds ─────────────────────────────────────────────────────────
  bg:          "#F8FAFC",   // slate-50  — page background
  surface:     "#FFFFFF",   // pure white — cards, modals
  surfaceAlt:  "#F1F5F9",   // slate-100 — alternate rows, tags
  surfaceHover:"#E2E8F0",   // slate-200 — interactive hover fill

  // ── Borders ─────────────────────────────────────────────────────────────
  border:      "#E2E8F0",   // slate-200
  borderDark:  "#CBD5E1",   // slate-300

  // ── Brand / Accent ───────────────────────────────────────────────────────
  accent:      "#2563EB",   // blue-600  — primary CTA
  accentLight: "#EFF6FF",   // blue-50
  accentMid:   "#3B82F6",   // blue-500
  accentDark:  "#1D4ED8",   // blue-700  — hover state

  // ── Semantic ─────────────────────────────────────────────────────────────
  success:      "#059669",  // emerald-600
  successLight: "#ECFDF5",  // emerald-50
  warning:      "#D97706",  // amber-600
  warningLight: "#FFFBEB",  // amber-50
  danger:       "#DC2626",  // red-600
  dangerLight:  "#FEF2F2",  // red-50
  purple:       "#7C3AED",  // violet-600
  purpleLight:  "#F5F3FF",  // violet-50
  gold:         "#B45309",  // amber-700
  goldLight:    "#FEF3C7",  // amber-100

  // ── Text ─────────────────────────────────────────────────────────────────
  text:         "#0F172A",  // slate-900 — headings, primary
  textSec:      "#334155",  // slate-700 — body text
  textMuted:    "#94A3B8",  // slate-400 — captions, labels

  // ── Sidebar (deep navy) ───────────────────────────────────────────────────
  sidebar:       "#0F172A", // slate-900
  sidebarActive: "#1E3A5F", // custom deep blue
  sidebarHover:  "#1E293B", // slate-800
  sidebarText:   "#94A3B8", // slate-400
  sidebarAccent: "#60A5FA", // blue-400
  sidebarBorder: "rgba(148,163,184,0.12)",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
//  Style primitives
// ─────────────────────────────────────────────────────────────────────────────

export const S = {
  // ── Layout ─────────────────────────────────────────────────────────────
  app: {
    minHeight: "100vh",
    background: C.bg,
    display: "flex",
    fontFamily: "'Cairo', 'IBM Plex Sans Arabic', 'Inter', system-ui, sans-serif",
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
  } as CSSProperties,

  // ── Sidebar ─────────────────────────────────────────────────────────────
  sidebar: {
    width: 232,
    minHeight: "100vh",
    background: C.sidebar,
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    position: "sticky",
    top: 0,
    height: "100vh",
    overflowY: "auto",
    borderLeft: `1px solid ${C.sidebarBorder}`,
  } as CSSProperties,

  sidebarLogo: {
    padding: "20px 16px 18px",
    borderBottom: `1px solid ${C.sidebarBorder}`,
    display: "flex",
    alignItems: "center",
    gap: 10,
  } as CSSProperties,

  logoText: {
    fontSize: 15,
    fontWeight: 700,
    color: "#F1F5F9",
    letterSpacing: "-0.01em",
  } as CSSProperties,

  logoSub: {
    fontSize: 10,
    color: C.sidebarText,
    opacity: 0.55,
    marginTop: 2,
    letterSpacing: "0.01em",
  } as CSSProperties,

  nav: {
    flex: 1,
    padding: "10px 10px",
    overflowY: "auto",
  } as CSSProperties,

  navSection: { marginBottom: 24 } as CSSProperties,

  navSectionTitle: {
    fontSize: 9.5,
    letterSpacing: "0.1em",
    color: C.sidebarText,
    opacity: 0.45,
    textTransform: "uppercase" as const,
    padding: "0 8px 6px",
    fontWeight: 600,
  } as CSSProperties,

  navItem: (active: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    color: active ? "#F1F5F9" : C.sidebarText,
    background: active ? C.sidebarActive : "transparent",
    marginBottom: 1,
    transition: "all 0.12s ease",
    outline: "none",
    userSelect: "none" as const,
  }),

  // ── Main area ─────────────────────────────────────────────────────────
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    overflow: "hidden",
  } as CSSProperties,

  topbar: {
    height: 52,
    background: C.surface,
    borderBottom: `1px solid ${C.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    flexShrink: 0,
    gap: 16,
  } as CSSProperties,

  content: {
    flex: 1,
    padding: "24px 28px",
    overflowY: "auto",
  } as CSSProperties,

  // ── Page header ────────────────────────────────────────────────────────
  pageTitle: {
    fontSize: 19,
    fontWeight: 700,
    color: C.text,
    marginBottom: 2,
    letterSpacing: "-0.02em",
  } as CSSProperties,

  pageSub: {
    fontSize: 12,
    color: C.textMuted,
    marginBottom: 22,
    lineHeight: 1.6,
  } as CSSProperties,

  // ── Grid ───────────────────────────────────────────────────────────────
  grid: (cols: number): CSSProperties => ({
    display: "grid",
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap: 14,
    marginBottom: 20,
  }),

  // ── Cards ─────────────────────────────────────────────────────────────
  card: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: "20px 22px",
    boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 2px 6px rgba(15,23,42,0.03)",
  } as CSSProperties,

  kpiCard: (color: string): CSSProperties => ({
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: "18px 20px",
    position: "relative",
    overflow: "hidden",
    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
    borderTop: `3px solid ${color}`,
  }),

  kpiIcon: {
    fontSize: 18,
    marginBottom: 10,
    display: "block",
    opacity: 0.8,
  } as CSSProperties,

  kpiLabel: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: 600,
    marginBottom: 6,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  } as CSSProperties,

  kpiValue: {
    fontSize: 22,
    fontWeight: 700,
    color: C.text,
    letterSpacing: "-0.03em",
    lineHeight: 1.2,
  } as CSSProperties,

  // ── Tables ─────────────────────────────────────────────────────────────
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 13,
  } as CSSProperties,

  th: {
    padding: "9px 14px",
    textAlign: "right" as const,
    fontSize: 11,
    color: C.textMuted,
    fontWeight: 600,
    borderBottom: `1.5px solid ${C.border}`,
    background: C.surface,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    whiteSpace: "nowrap" as const,
  } as CSSProperties,

  td: {
    padding: "11px 14px",
    borderBottom: `1px solid ${C.border}`,
    color: C.textSec,
    fontSize: 13,
    textAlign: "right" as const,
    lineHeight: 1.5,
  } as CSSProperties,

  // ── Buttons ────────────────────────────────────────────────────────────
  btn: (v: "primary" | "outline" | "ghost" | "danger" | "sm" = "primary"): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding:
      v === "sm"
        ? "5px 11px"
        : v === "ghost"
        ? "7px 14px"
        : "8px 16px",
    borderRadius: 8,
    border:
      v === "outline"
        ? `1px solid ${C.border}`
        : v === "ghost"
        ? "none"
        : "none",
    cursor: "pointer",
    fontSize: v === "sm" ? 11.5 : 13,
    fontWeight: 500,
    fontFamily: "inherit",
    letterSpacing: "-0.01em",
    background:
      v === "primary" ? C.accent
      : v === "ghost"  ? "transparent"
      : v === "danger" ? C.danger
      : v === "sm"     ? C.surfaceAlt
      : C.surfaceAlt,
    color:
      v === "primary" ? "#fff"
      : v === "ghost"  ? C.textMuted
      : v === "danger" ? "#fff"
      : C.textSec,
    transition: "all 0.13s ease",
    outline: "none",
    textDecoration: "none",
    whiteSpace: "nowrap" as const,
    boxShadow:
      v === "primary"
        ? "0 1px 2px rgba(37,99,235,0.2), inset 0 1px 0 rgba(255,255,255,0.1)"
        : "none",
  }),

  // ── Badges ─────────────────────────────────────────────────────────────
  badge: (c: "success" | "warning" | "danger" | "info" | "purple" | "gold"): CSSProperties => {
    const map: Record<string, [string, string]> = {
      success: [C.successLight, C.success],
      warning: [C.warningLight, C.warning],
      danger:  [C.dangerLight,  C.danger],
      info:    [C.accentLight,  C.accent],
      purple:  [C.purpleLight,  C.purple],
      gold:    [C.goldLight,    C.gold],
    };
    const [bg, fg] = map[c] ?? map.info;
    return {
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 8px",
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      background: bg,
      color: fg,
      letterSpacing: "0.01em",
      whiteSpace: "nowrap" as const,
    };
  },

  // ── Form elements ─────────────────────────────────────────────────────
  input: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: "8px 12px",
    color: C.text,
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
    textAlign: "right" as const,
    transition: "border-color 0.13s, box-shadow 0.13s",
    lineHeight: 1.5,
  } as CSSProperties,

  select: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: "8px 12px",
    color: C.text,
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
    textAlign: "right" as const,
    transition: "border-color 0.13s",
    cursor: "pointer",
  } as CSSProperties,

  label: {
    fontSize: 12,
    color: C.textSec,
    fontWeight: 600,
    marginBottom: 5,
    display: "block",
    letterSpacing: "0.01em",
  } as CSSProperties,

  formGroup: { marginBottom: 14 } as CSSProperties,

  // ── Modal ──────────────────────────────────────────────────────────────
  modal: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(15,23,42,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
    padding: 16,
  } as CSSProperties,

  modalBox: (wide = false): CSSProperties => ({
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 14,
    padding: "26px 28px",
    width: "100%",
    maxWidth: wide ? 820 : 560,
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 24px 64px rgba(15,23,42,0.18), 0 4px 16px rgba(15,23,42,0.08)",
  }),

  // ── Section layout ────────────────────────────────────────────────────
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  } as CSSProperties,

  sectionTitle: {
    fontSize: 13.5,
    fontWeight: 600,
    color: C.text,
    letterSpacing: "-0.01em",
  } as CSSProperties,

  divider: {
    border: "none",
    borderTop: `1px solid ${C.border}`,
    margin: "16px 0",
  } as CSSProperties,

  // ── Toast / Notifications ─────────────────────────────────────────────
  notif: {
    position: "fixed" as const,
    bottom: 20,
    left: 20,
    zIndex: 2000,
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  } as CSSProperties,

  toast: (type: "success" | "error" | "info"): CSSProperties => ({
    background: C.surface,
    border: `1px solid ${
      type === "success" ? C.success
      : type === "error"  ? C.danger
      : C.accentMid
    }`,
    borderRadius: 10,
    padding: "12px 16px",
    fontSize: 13,
    color: C.text,
    maxWidth: 360,
    minWidth: 260,
    boxShadow: "0 8px 24px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.06)",
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    lineHeight: 1.5,
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
//  Design Tokens — spacing, radius, motion, elevation
// ─────────────────────────────────────────────────────────────────────────────

export const SP = {
  0: 0,   1: 4,   2: 8,   3: 12,  4: 16,
  5: 20,  6: 24,  7: 28,  8: 32,  10: 40,
  12: 48, 16: 64,
} as const;

export const R = {
  sm:   4,
  md:   6,
  base: 8,
  lg:   10,
  xl:   12,
  "2xl": 16,
  full: 9999,
} as const;

export const MOTION = {
  instant: "0.07s ease",
  fast:    "0.12s ease",
  normal:  "0.18s ease",
  slow:    "0.28s cubic-bezier(0.16,1,0.3,1)",
  spring:  "0.35s cubic-bezier(0.34,1.56,0.64,1)",
} as const;

export const ELEVATION = {
  0: "none",
  1: "0 1px 2px rgba(15,23,42,0.04), 0 1px 1px rgba(15,23,42,0.03)",
  2: "0 1px 3px rgba(15,23,42,0.08), 0 2px 6px rgba(15,23,42,0.04)",
  3: "0 4px 12px rgba(15,23,42,0.10), 0 2px 4px rgba(15,23,42,0.06)",
  4: "0 8px 24px rgba(15,23,42,0.12), 0 4px 8px rgba(15,23,42,0.06)",
  5: "0 24px 64px rgba(15,23,42,0.18), 0 8px 24px rgba(15,23,42,0.08)",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
//  Global CSS — injected once in ERPShell
//  Covers hover states, focus rings, transitions, scrollbar, font
// ─────────────────────────────────────────────────────────────────────────────
export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; }

  html, body {
    margin: 0; padding: 0;
    font-family: 'Cairo', 'IBM Plex Sans Arabic', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background: ${C.bg};
    color: ${C.text};
  }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${C.borderDark}; border-radius: 99px; transition: background 0.2s; }
  ::-webkit-scrollbar-thumb:hover { background: #94A3B8; }

  /* ── Sidebar scrollbar (thinner) ── */
  nav::-webkit-scrollbar { width: 2px; }
  nav::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.15); border-radius: 99px; }

  /* ── Branded focus ring ── */
  input:focus, select:focus, textarea:focus {
    border-color: ${C.accentMid} !important;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.14) !important;
    outline: none;
  }

  /* ── Smooth base transitions ── */
  button, input, select, textarea { transition: all 0.12s ease; }
  [data-navitem] { transition: background 0.12s ease, color 0.12s ease; }

  /* ── Button states ── */
  button { cursor: pointer; }
  button:active:not(:disabled) { transform: scale(0.97); transition: transform 0.06s ease; }
  button[data-variant="primary"]:hover  { background: ${C.accentDark} !important; box-shadow: 0 2px 8px rgba(37,99,235,0.3) !important; }
  button[data-variant="outline"]:hover  { background: ${C.surfaceAlt} !important; border-color: ${C.borderDark} !important; }
  button[data-variant="ghost"]:hover    { background: ${C.surfaceAlt} !important; color: ${C.textSec} !important; }
  button[data-variant="danger"]:hover   { filter: brightness(1.08); box-shadow: 0 2px 8px rgba(220,38,38,0.25) !important; }
  button[data-variant="sm"]:hover       { background: ${C.surfaceHover} !important; }

  /* ── Nav item hover ── */
  [data-navitem]:hover { background: ${C.sidebarHover} !important; color: #CBD5E1 !important; }
  [data-navitem][data-active] { position: relative; }
  [data-navitem][data-active]:hover { background: ${C.sidebarActive} !important; }

  /* ── Active nav indicator bar (RTL-aware) ── */
  [data-navitem][data-active]::before {
    content: '';
    position: absolute;
    inset-inline-start: 0;
    top: 4px;
    bottom: 4px;
    width: 3px;
    background: ${C.sidebarAccent};
    border-radius: 0 3px 3px 0;
    transition: opacity 0.15s ease;
  }
  [dir="ltr"] [data-navitem][data-active]::before { border-radius: 0 3px 3px 0; }
  [dir="rtl"] [data-navitem][data-active]::before { border-radius: 3px 0 0 3px; }

  /* ── CSS Tooltip (for collapsed sidebar icons) ── */
  [data-tooltip] { position: relative; }
  [data-tooltip]::after {
    content: attr(data-tooltip);
    position: absolute;
    inset-block-start: 50%;
    transform: translateY(-50%);
    background: #1E293B;
    color: #E2E8F0;
    padding: 5px 10px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s ease 0.12s;
    z-index: 999;
    box-shadow: 0 4px 14px rgba(0,0,0,0.25);
    border: 1px solid rgba(255,255,255,0.06);
  }
  [dir="ltr"] [data-tooltip]::after { left: calc(100% + 10px); }
  [dir="rtl"] [data-tooltip]::after { right: calc(100% + 10px); }
  [data-tooltip]:hover::after { opacity: 1; }

  /* ── Table row hover ── */
  [data-trow] { transition: background 0.08s ease; }
  [data-trow]:hover td { background: ${C.surfaceAlt} !important; cursor: default; }
  [data-trow]:hover td:first-child { border-radius: 0 6px 6px 0; }
  [data-trow]:hover td:last-child  { border-radius: 6px 0 0 6px; }

  /* ── Card hover (interactive) ── */
  [data-card-hover] { transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease; }
  [data-card-hover]:hover {
    border-color: ${C.accentMid} !important;
    box-shadow: 0 4px 16px rgba(37,99,235,0.10) !important;
    transform: translateY(-1px);
  }

  /* ── Page enter animation ── */
  @keyframes pageEnter {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .page-enter { animation: pageEnter 0.22s cubic-bezier(0.16,1,0.3,1) forwards; }

  /* ── Fade-in (general) ── */
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .fade-in { animation: fadeIn 0.18s ease forwards; }

  /* ── Modal ── */
  [data-modal] { animation: fadeIn 0.15s ease forwards; }

  /* ── Loading skeleton ── */
  @keyframes shimmer {
    0%   { background-position: -700px 0; }
    100% { background-position: 700px 0; }
  }
  .skeleton {
    background: linear-gradient(90deg, ${C.surfaceAlt} 25%, ${C.surfaceHover} 37%, ${C.surfaceAlt} 63%);
    background-size: 1400px 100%;
    animation: shimmer 1.5s ease infinite;
    border-radius: 6px;
  }

  /* ── Notification badge pulse ── */
  @keyframes badgePulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.4); }
    50%       { box-shadow: 0 0 0 4px rgba(220,38,38,0); }
  }
  .badge-pulse { animation: badgePulse 2s ease infinite; }

  /* ── Live dot pulse ── */
  @keyframes livePulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.45; }
  }
  .live-dot { animation: livePulse 2.2s ease infinite; }

  /* ── Number inputs no spinner ── */
  input[type="number"]::-webkit-inner-spin-button,
  input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; }
  input[type="number"] { -moz-appearance: textfield; }

  /* ── Selection ── */
  ::selection { background: rgba(59,130,246,0.18); color: ${C.text}; }

  /* ── KPI trend arrow ── */
  .trend-up   { color: ${C.success}; }
  .trend-down { color: ${C.danger}; }

  /* ── Dropdown menus ── */
  [data-dropdown] {
    animation: fadeIn 0.14s ease forwards;
    transform-origin: top;
  }

  /* ── Inline editable cells ── */
  [data-editable-cell] {
    cursor: text;
    position: relative;
    transition: background 0.1s ease;
  }
  [data-editable-cell]:hover {
    background: ${C.accentLight} !important;
  }
  [data-editable-cell]::after {
    content: '';
    position: absolute;
    inset-inline-end: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 12px;
    height: 12px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'/%3E%3Cpath d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-size: contain;
    opacity: 0;
    transition: opacity 0.12s ease;
    pointer-events: none;
  }
  [data-editable-cell]:hover::after { opacity: 0.6; }

  /* ── Bulk selection highlight ── */
  tr[style*="accent08"] td,
  tr[data-selected] td {
    background: ${C.accentLight} !important;
  }

  /* ── Skeleton animation delay support ── */
  .skeleton[style*="animationDelay"] {
    animation-fill-mode: both;
  }
`;
