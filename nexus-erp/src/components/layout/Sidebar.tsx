"use client";

import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { useAuth } from "@/hooks/useAuth";
import { DB } from "@/lib/db/database";

type PageId =
  | "dashboard" | "sales" | "purchases" | "inventory" | "treasury"
  | "customers" | "suppliers" | "accounting" | "reports" | "users" | "settings";

interface SidebarProps {
  page: PageId;
  onNavigate: (page: PageId) => void;
}

export function Sidebar({ page, onNavigate }: SidebarProps) {
  const { t, dir } = useLang();
  const { user, logout } = useAuth();
  const settings = DB.get().settings;

  const nav = [
    {
      section: t("overview"),
      items: [{ id: "dashboard" as PageId, label: t("dashboard"), icon: "🏠" }],
    },
    {
      section: t("operations"),
      items: [
        { id: "sales"     as PageId, label: t("sales"),     icon: "📤" },
        { id: "purchases" as PageId, label: t("purchases"), icon: "📥" },
        { id: "inventory" as PageId, label: t("inventory"), icon: "📦" },
        { id: "treasury"  as PageId, label: t("treasury"),  icon: "🏦" },
      ],
    },
    {
      section: t("masterData"),
      items: [
        { id: "customers" as PageId, label: t("customers"), icon: "👥" },
        { id: "suppliers" as PageId, label: t("suppliers"), icon: "🏢" },
      ],
    },
    {
      section: t("finance"),
      items: [
        { id: "accounting" as PageId, label: t("accounting"), icon: "📊" },
        { id: "reports"    as PageId, label: t("reports"),    icon: "📈" },
      ],
    },
    {
      section: t("system"),
      items: [
        { id: "users"    as PageId, label: t("users"),    icon: "👤" },
        { id: "settings" as PageId, label: t("settings"), icon: "⚙️" },
      ],
    },
  ];

  return (
    <div
      style={{
        ...S.sidebar,
        order: dir === "rtl" ? 1 : 0,
      }}
    >
      {/* Logo */}
      <div style={S.sidebarLogo}>
        <div style={S.logoText}>
          <span style={{ marginLeft: 8, fontSize: 18 }}>📊</span>
          {settings.companyName || "BOB ERP"}
        </div>
        <div style={S.logoSub}>نظام المحاسبة المتكامل v2.0</div>
      </div>

      {/* Navigation */}
      <nav style={S.nav}>
        {nav.map(({ section, items }) => (
          <div key={section} style={S.navSection}>
            <div style={S.navSectionTitle}>{section}</div>
            {items.map((item) => (
              <div
                key={item.id}
                style={S.navItem(page === item.id)}
                onClick={() => onNavigate(item.id)}
              >
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        ))}
      </nav>

      {/* User profile + logout */}
      <div
        style={{
          padding: 14,
          borderTop: `1px solid rgba(255,255,255,0.08)`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "rgba(93,173,226,0.2)",
              border: `1.5px solid ${C.sidebarAccent}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              color: C.sidebarAccent,
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            {user?.name?.slice(0, 1)}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
              {user?.name}
            </div>
            <div style={{ fontSize: 10, color: C.sidebarText, opacity: 0.6 }}>
              {user?.role}
            </div>
          </div>
        </div>
        <button
          style={{
            ...S.btn("ghost"),
            color: C.sidebarText,
            fontSize: 12,
            padding: "6px 0",
            width: "100%",
            textAlign: dir === "rtl" ? "right" : "left",
            opacity: 0.7,
            border: "none",
          }}
          onClick={logout}
        >
          🚪 {t("settings") === "الإعدادات" ? "تسجيل الخروج" : "Sign Out"}
        </button>
      </div>
    </div>
  );
}
