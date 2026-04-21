"use client";

import { useState, ReactNode } from "react";
import { S, C, MOTION } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { useAuth } from "@/hooks/useAuth";
import { DB } from "@/lib/db/database";

export type PageId =
  | "dashboard" | "sales" | "purchases" | "inventory" | "treasury"
  | "customers" | "suppliers" | "accounting" | "reports" | "users" | "settings"
  | "pos" | "audit_log" | "reconciliation";

interface SidebarProps {
  page: PageId;
  onNavigate: (page: PageId) => void;
}

const ROLE_LABEL: Record<string, string> = {
  admin:      "مدير",
  accountant: "محاسب",
  sales:      "مبيعات",
  cashier:    "كاشير",
  viewer:     "مشاهد",
};

// ── Exported icon map — shared with CommandPalette ────────────────────────────
export const NAV_ICONS: Record<string, ReactNode> = {
  dashboard: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  pos: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
    </svg>
  ),
  sales: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.4 5h12.8M9 20a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm8 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
    </svg>
  ),
  purchases: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  ),
  inventory: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  ),
  treasury: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  ),
  customers: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  suppliers: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  accounting: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  ),
  reports: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  reconciliation: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  users: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  audit_log: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
};

const LogoutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const ChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

export function Sidebar({ page, onNavigate }: SidebarProps) {
  const { t, dir } = useLang();
  const { user, logout, can } = useAuth();
  const settings = DB.get().settings;
  const isRTL = dir === "rtl";

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar_collapsed") === "1"; }
    catch { return false; }
  });

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem("sidebar_collapsed", next ? "1" : "0"); } catch {}
  };

  const allSections = [
    {
      section: t("overview"),
      items: [
        { id: "dashboard" as PageId, label: t("dashboard"),  perm: "view_dashboard" },
        { id: "pos"       as PageId, label: "نقطة البيع",    perm: "access_pos"    },
      ],
    },
    {
      section: t("operations"),
      items: [
        { id: "sales"     as PageId, label: t("sales"),      perm: "view_sales"     },
        { id: "purchases" as PageId, label: t("purchases"),  perm: "view_purchases" },
        { id: "inventory" as PageId, label: t("inventory"),  perm: "view_inventory" },
        { id: "treasury"  as PageId, label: t("treasury"),   perm: "view_treasury"  },
      ],
    },
    {
      section: t("masterData"),
      items: [
        { id: "customers" as PageId, label: t("customers"),  perm: "view_customers" },
        { id: "suppliers" as PageId, label: t("suppliers"),  perm: "view_suppliers" },
      ],
    },
    {
      section: t("finance"),
      items: [
        { id: "accounting"     as PageId, label: t("accounting"),   perm: "view_accounting"  },
        { id: "reports"        as PageId, label: t("reports"),      perm: "view_reports"     },
        { id: "reconciliation" as PageId, label: "تسوية البنك",    perm: "manage_treasury"  },
      ],
    },
    {
      section: t("system"),
      items: [
        { id: "users"     as PageId, label: t("users"),        perm: "manage_users"    },
        { id: "audit_log" as PageId, label: "سجل التدقيق",   perm: "manage_users"    },
        { id: "settings"  as PageId, label: t("settings"),    perm: "manage_settings" },
      ],
    },
  ];

  const nav = allSections
    .map(sec => ({ ...sec, items: sec.items.filter(item => can(item.perm as any)) }))
    .filter(sec => sec.items.length > 0);

  const initials = (user?.name ?? "U")
    .split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const W = collapsed ? 56 : 232;

  return (
    <div style={{
      ...S.sidebar,
      width: W,
      minWidth: W,
      transition: `width ${MOTION.slow}, min-width ${MOTION.slow}`,
      overflow: "hidden",
      order: isRTL ? 1 : 0,
    }}>

      {/* ── Logo + collapse toggle ───────────────────────────────── */}
      <div style={{
        padding: collapsed ? "16px 12px" : "18px 14px 16px",
        borderBottom: `1px solid ${C.sidebarBorder}`,
        display: "flex",
        alignItems: "center",
        gap: 10,
        transition: `padding ${MOTION.slow}`,
        flexShrink: 0,
      }}>
        {/* Logo mark — click to expand when collapsed */}
        <div
          onClick={collapsed ? toggle : undefined}
          style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: collapsed ? "pointer" : "default",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
          </svg>
        </div>

        {/* Company name (hidden when collapsed) */}
        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
            <div style={{ ...S.logoText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {settings.companyName || "BOB ERP"}
            </div>
            <div style={S.logoSub}>نظام المحاسبة المتكامل</div>
          </div>
        )}

        {/* Collapse toggle (shown when expanded) */}
        {!collapsed && (
          <button
            onClick={toggle}
            title={isRTL ? "طي القائمة" : "Collapse"}
            style={{
              background: "transparent", border: "none",
              color: C.sidebarText, opacity: 0.4,
              padding: 4, cursor: "pointer",
              display: "flex", alignItems: "center", flexShrink: 0,
              borderRadius: 4,
              transition: "opacity 0.12s",
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "0.4")}
          >
            {isRTL ? <ChevronRight /> : <ChevronLeft />}
          </button>
        )}
      </div>

      {/* ── Navigation ──────────────────────────────────────────── */}
      <nav style={{ ...S.nav, padding: collapsed ? "8px 8px" : "10px 10px" }}>
        {nav.map(({ section, items }) => (
          <div key={section} style={{ ...S.navSection }}>
            {/* Section label — hidden when collapsed, replaced by a divider */}
            {collapsed
              ? <div style={{ height: 1, background: C.sidebarBorder, margin: "4px 4px 8px" }} />
              : <div style={S.navSectionTitle}>{section}</div>
            }

            {items.map(item => {
              const active = page === item.id;
              const icon = NAV_ICONS[item.id];
              return (
                <div
                  key={item.id}
                  data-navitem=""
                  data-active={active ? "" : undefined}
                  data-tooltip={collapsed ? item.label : undefined}
                  role="button"
                  tabIndex={0}
                  style={{
                    ...S.navItem(active),
                    justifyContent: collapsed ? "center" : "flex-start",
                    padding: collapsed ? "9px 8px" : "8px 10px",
                    gap: collapsed ? 0 : 10,
                    position: "relative",
                  }}
                  onClick={() => onNavigate(item.id)}
                  onKeyDown={e => e.key === "Enter" && onNavigate(item.id)}
                >
                  <span style={{
                    display: "flex", alignItems: "center", flexShrink: 0,
                    color: active ? C.sidebarAccent : C.sidebarText,
                    transition: `color ${MOTION.fast}`,
                  }}>
                    {icon}
                  </span>
                  {!collapsed && (
                    <>
                      <span style={{ flex: 1, lineHeight: 1.4 }}>{item.label}</span>
                      {active && (
                        <span style={{
                          width: 5, height: 5, borderRadius: "50%",
                          background: C.sidebarAccent, flexShrink: 0,
                          opacity: 0.8,
                        }} />
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── User footer ─────────────────────────────────────────── */}
      <div style={{
        padding: collapsed ? "10px 8px" : "12px 12px",
        borderTop: `1px solid ${C.sidebarBorder}`,
        flexShrink: 0,
        transition: `padding ${MOTION.slow}`,
      }}>
        {collapsed ? (
          /* Collapsed: avatar + logout stacked */
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div
              data-tooltip={user?.name}
              style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: `linear-gradient(135deg, ${C.accentMid} 0%, ${C.purple} 100%)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#fff",
                position: "relative",
              }}
            >
              {initials}
            </div>
            <button
              data-navitem=""
              data-tooltip={isRTL ? "تسجيل الخروج" : "Sign Out"}
              onClick={logout}
              style={{
                ...S.navItem(false),
                width: "100%", border: "none",
                justifyContent: "center",
                padding: "7px 8px",
              }}
            >
              <span style={{ display: "flex", color: C.sidebarText }}>
                <LogoutIcon />
              </span>
            </button>
          </div>
        ) : (
          /* Expanded: full user card */
          <>
            <div style={{
              display: "flex", alignItems: "center", gap: 9, marginBottom: 8,
              padding: "7px 8px", borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: `linear-gradient(135deg, ${C.accentMid} 0%, ${C.purple} 100%)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#fff",
              }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12.5, fontWeight: 600, color: "#E2E8F0",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {user?.name}
                </div>
                <div style={{ fontSize: 10.5, color: C.sidebarText, opacity: 0.65, marginTop: 1 }}>
                  {ROLE_LABEL[user?.role ?? ""] || user?.role}
                </div>
              </div>
            </div>

            <button
              data-navitem=""
              onClick={logout}
              style={{
                ...S.navItem(false),
                width: "100%", border: "none",
                justifyContent: "flex-start",
                gap: 8, fontSize: 12, opacity: 0.75,
              }}
            >
              <span style={{ display: "flex", color: C.sidebarText }}>
                <LogoutIcon />
              </span>
              <span style={{ color: C.sidebarText }}>
                {isRTL ? "تسجيل الخروج" : "Sign Out"}
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
