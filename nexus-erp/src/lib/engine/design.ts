import { CSSProperties } from "react";

export const C = {
  bg: "#F7F6F3",
  surface: "#FFFFFF",
  surfaceAlt: "#F0EEE8",
  border: "#E2DDD5",
  borderDark: "#C8C2B8",
  accent: "#1A5276",
  accentLight: "#EBF5FB",
  accentMid: "#2E86C1",
  gold: "#B7860B",
  goldLight: "#FDF6E3",
  success: "#1E8449",
  successLight: "#E9F7EF",
  warning: "#B7770D",
  warningLight: "#FEF9E7",
  danger: "#A93226",
  dangerLight: "#FDEDEC",
  purple: "#6C3483",
  purpleLight: "#F4ECF7",
  text: "#1A1A1A",
  textSec: "#4A4A4A",
  textMuted: "#888888",
  sidebar: "#1A2744",
  sidebarActive: "#2E4073",
  sidebarText: "#C8D6E5",
  sidebarAccent: "#5DADE2",
} as const;

export const S = {
  app: {
    minHeight: "100vh",
    background: C.bg,
    display: "flex",
    fontFamily: "'Tajawal', 'Cairo', 'Segoe UI', sans-serif",
  } as CSSProperties,

  sidebar: {
    width: 220,
    minHeight: "100vh",
    background: C.sidebar,
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    position: "sticky",
    top: 0,
    height: "100vh",
    overflowY: "auto",
  } as CSSProperties,

  sidebarLogo: {
    padding: "20px 16px 16px",
    borderBottom: `1px solid rgba(255,255,255,0.08)`,
  } as CSSProperties,

  logoText: {
    fontSize: 16,
    fontWeight: 800,
    color: "#FFFFFF",
    letterSpacing: "0.03em",
  } as CSSProperties,

  logoSub: {
    fontSize: 10,
    color: C.sidebarText,
    opacity: 0.6,
    marginTop: 3,
  } as CSSProperties,

  nav: {
    flex: 1,
    padding: "12px 8px",
    overflowY: "auto",
  } as CSSProperties,

  navSection: { marginBottom: 20 } as CSSProperties,

  navSectionTitle: {
    fontSize: 9,
    letterSpacing: "0.18em",
    color: C.sidebarText,
    opacity: 0.4,
    textTransform: "uppercase",
    padding: "0 10px 7px",
    fontWeight: 700,
  } as CSSProperties,

  navItem: (active: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "9px 12px",
    borderRadius: 7,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: active ? 700 : 400,
    color: active ? "#FFFFFF" : C.sidebarText,
    background: active ? C.sidebarActive : "transparent",
    marginBottom: 2,
    transition: "all 0.15s",
    borderRight: active ? `3px solid ${C.sidebarAccent}` : "3px solid transparent",
  }),

  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  } as CSSProperties,

  topbar: {
    height: 56,
    background: C.surface,
    borderBottom: `1px solid ${C.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    flexShrink: 0,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  } as CSSProperties,

  content: {
    flex: 1,
    padding: 24,
    overflowY: "auto",
  } as CSSProperties,

  pageTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: C.text,
    marginBottom: 4,
  } as CSSProperties,

  pageSub: {
    fontSize: 12,
    color: C.textMuted,
    marginBottom: 24,
  } as CSSProperties,

  grid: (cols: number): CSSProperties => ({
    display: "grid",
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap: 16,
    marginBottom: 24,
  }),

  card: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  } as CSSProperties,

  kpiCard: (color: string): CSSProperties => ({
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: 20,
    borderTop: `3px solid ${color}`,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  }),

  kpiLabel: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: 600,
    marginBottom: 8,
  } as CSSProperties,

  kpiValue: {
    fontSize: 22,
    fontWeight: 800,
    color: C.text,
    letterSpacing: "-0.02em",
  } as CSSProperties,

  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  } as CSSProperties,

  th: {
    padding: "10px 14px",
    textAlign: "right",
    fontSize: 11,
    color: C.textMuted,
    fontWeight: 700,
    borderBottom: `2px solid ${C.border}`,
    background: C.surfaceAlt,
    letterSpacing: "0.02em",
  } as CSSProperties,

  td: {
    padding: "11px 14px",
    borderBottom: `1px solid ${C.border}`,
    color: C.textSec,
    fontSize: 13,
    textAlign: "right",
  } as CSSProperties,

  btn: (v: "primary" | "outline" | "ghost" | "danger" | "sm" = "primary"): CSSProperties => ({
    padding: v === "sm" ? "6px 12px" : "9px 18px",
    borderRadius: 7,
    border: v === "outline" ? `1px solid ${C.border}` : "none",
    cursor: "pointer",
    fontSize: v === "sm" ? 11 : 13,
    fontWeight: 600,
    fontFamily: "inherit",
    background:
      v === "primary" ? C.accent
      : v === "ghost"  ? "transparent"
      : v === "danger" ? C.danger
      : C.surfaceAlt,
    color:
      v === "primary" ? "#fff"
      : v === "ghost"  ? C.textMuted
      : v === "danger" ? "#fff"
      : C.text,
    transition: "all 0.15s",
  }),

  badge: (c: "success" | "warning" | "danger" | "info" | "purple" | "gold"): CSSProperties => {
    const map: Record<string, [string, string]> = {
      success: [C.successLight, C.success],
      warning: [C.warningLight, C.warning],
      danger:  [C.dangerLight,  C.danger],
      info:    [C.accentLight,  C.accentMid],
      purple:  [C.purpleLight,  C.purple],
      gold:    [C.goldLight,    C.gold],
    };
    const [bg, fg] = map[c] ?? map.info;
    return {
      display: "inline-flex",
      alignItems: "center",
      padding: "3px 9px",
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      background: bg,
      color: fg,
    };
  },

  input: {
    background: C.surfaceAlt,
    border: `1px solid ${C.border}`,
    borderRadius: 7,
    padding: "9px 12px",
    color: C.text,
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    textAlign: "right",
  } as CSSProperties,

  select: {
    background: C.surfaceAlt,
    border: `1px solid ${C.border}`,
    borderRadius: 7,
    padding: "9px 12px",
    color: C.text,
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    textAlign: "right",
  } as CSSProperties,

  modal: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    backdropFilter: "blur(3px)",
  } as CSSProperties,

  modalBox: (wide = false): CSSProperties => ({
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: 28,
    width: "92%",
    maxWidth: wide ? 800 : 580,
    maxHeight: "88vh",
    overflowY: "auto",
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
  }),

  label: {
    fontSize: 12,
    color: C.textSec,
    fontWeight: 700,
    marginBottom: 6,
    display: "block",
  } as CSSProperties,

  formGroup: { marginBottom: 16 } as CSSProperties,

  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  } as CSSProperties,

  sectionTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: C.text,
  } as CSSProperties,

  divider: {
    borderTop: `1px solid ${C.border}`,
    margin: "16px 0",
  } as CSSProperties,

  notif: {
    position: "fixed",
    bottom: 20,
    left: 20,
    zIndex: 2000,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  } as CSSProperties,

  toast: (type: "success" | "error" | "info"): CSSProperties => ({
    background: C.surface,
    border: `1.5px solid ${type === "success" ? C.success : type === "error" ? C.danger : C.accentMid}`,
    borderRadius: 8,
    padding: "12px 16px",
    fontSize: 13,
    color: C.text,
    maxWidth: 340,
    boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
    minWidth: 260,
  }),
};
