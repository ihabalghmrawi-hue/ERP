"use client";

import { useState, useEffect, useRef } from "react";
import { S, C, ELEVATION, MOTION } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { useAuth } from "@/hooks/useAuth";
import { fmtDate } from "@/lib/engine/helpers";
import { DB } from "@/lib/db/database";

interface TopbarProps {
  pageLabel: string;
  companyName?: string;
  onOpenPalette?: () => void;
}

type SyncState = "live" | "saving" | "synced" | "offline";

interface Notification {
  id: number;
  title: string;
  body: string;
  time: string;
  type: "info" | "warning" | "success";
  read: boolean;
}

const MOCK_NOTIFS: Notification[] = [
  { id: 1, title: "مخزون منخفض", body: "المنتج «ورق A4» — 3 علب متبقية فقط", time: "منذ 5 د", type: "warning", read: false },
  { id: 2, title: "فاتورة جديدة", body: "تم استلام فاتورة #1042 من المورد", time: "منذ 1 س", type: "info", read: false },
];

const SYNC_COLORS: Record<SyncState, string> = {
  live:    C.success,
  saving:  C.warning,
  synced:  C.accentMid,
  offline: C.danger,
};
const SYNC_LABELS_AR: Record<SyncState, string> = {
  live:    "متصل",
  saving:  "جارٍ الحفظ...",
  synced:  "تمت المزامنة",
  offline: "غير متصل",
};
const SYNC_LABELS_EN: Record<SyncState, string> = {
  live:    "Live",
  saving:  "Saving...",
  synced:  "Synced",
  offline: "Offline",
};

export function Topbar({ pageLabel, companyName: companyNameProp, onOpenPalette }: TopbarProps) {
  const { lang } = useLang();
  const { user } = useAuth();
  const settings = DB.get().settings;
  const companyName = companyNameProp || settings.companyName || "BOB ERP";
  const isAr = lang === "ar";

  const [syncState] = useState<SyncState>("live");
  const [notifOpen, setNotifOpen]     = useState(false);
  const [notifs, setNotifs]           = useState(MOCK_NOTIFS);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifs.filter(n => !n.read).length;

  // Close notifications on outside click
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (!notifRef.current?.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  const markAllRead = () => setNotifs(n => n.map(x => ({ ...x, read: true })));

  const syncColor = SYNC_COLORS[syncState];
  const syncLabel = isAr ? SYNC_LABELS_AR[syncState] : SYNC_LABELS_EN[syncState];

  return (
    <div style={S.topbar}>

      {/* ── Breadcrumb ─────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500, whiteSpace: "nowrap", opacity: 0.8 }}>
          {companyName}
        </span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.borderDark} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points={isAr ? "15 18 9 12 15 6" : "9 18 15 12 9 6"}/>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: "nowrap" }}>
          {pageLabel}
        </span>
      </div>

      {/* ── Search / ⌘K ────────────────────────── */}
      <button
        onClick={onOpenPalette}
        data-variant="ghost"
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: C.surfaceAlt, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: "5px 11px",
          cursor: "pointer", flex: "0 0 200px",
          color: C.textMuted, fontFamily: "inherit",
          transition: `border-color ${MOTION.fast}, box-shadow ${MOTION.fast}`,
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = C.borderDark;
          (e.currentTarget as HTMLElement).style.boxShadow = ELEVATION[1];
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = C.border;
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <span style={{ flex: 1, fontSize: 12, textAlign: isAr ? "right" : "left" }}>
          {isAr ? "بحث سريع..." : "Quick search..."}
        </span>
        <kbd style={{
          display: "inline-flex", alignItems: "center",
          padding: "1px 5px", borderRadius: 4,
          background: C.border, border: `1px solid ${C.borderDark}`,
          fontSize: 10, color: C.textMuted, fontFamily: "system-ui, monospace",
          letterSpacing: "0.02em",
        }}>
          ⌘K
        </kbd>
      </button>

      {/* ── Right controls ──────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>

        {/* Sync indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            className={syncState === "live" ? "live-dot" : undefined}
            style={{
              width: 7, height: 7, borderRadius: "50%",
              background: syncColor,
              boxShadow: `0 0 0 2px ${syncColor}22`,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 11.5, color: C.textMuted, whiteSpace: "nowrap" }}>
            {syncLabel}
          </span>
          <span style={{ fontSize: 11.5, color: C.textMuted, opacity: 0.55 }}>
            · {fmtDate(new Date().toISOString())}
          </span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 18, background: C.border }} />

        {/* Notifications bell */}
        <div ref={notifRef} style={{ position: "relative" }}>
          <button
            onClick={() => setNotifOpen(o => !o)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 32, height: 32, borderRadius: 8,
              background: notifOpen ? C.surfaceAlt : "transparent",
              border: `1px solid ${notifOpen ? C.border : "transparent"}`,
              color: C.textMuted, cursor: "pointer", position: "relative",
              transition: `all ${MOTION.fast}`,
            }}
            onMouseEnter={e => { if (!notifOpen) (e.currentTarget as HTMLElement).style.background = C.surfaceAlt; }}
            onMouseLeave={e => { if (!notifOpen) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadCount > 0 && (
              <span
                className="badge-pulse"
                style={{
                  position: "absolute", top: 5, insetInlineEnd: 5,
                  width: 8, height: 8, borderRadius: "50%",
                  background: C.danger,
                  border: `2px solid ${C.surface}`,
                }}
              />
            )}
          </button>

          {/* Notifications dropdown */}
          {notifOpen && (
            <div
              data-dropdown=""
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                insetInlineEnd: 0,
                width: 320,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                boxShadow: ELEVATION[4],
                overflow: "hidden",
                zIndex: 500,
              }}
            >
              {/* Dropdown header */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 14px",
                borderBottom: `1px solid ${C.border}`,
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                  {isAr ? "الإشعارات" : "Notifications"}
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    style={{
                      border: "none", background: "none",
                      fontSize: 11, color: C.accent, cursor: "pointer",
                      fontFamily: "inherit", padding: 0,
                    }}
                  >
                    {isAr ? "تعيين الكل مقروء" : "Mark all read"}
                  </button>
                )}
              </div>

              {/* Items */}
              {notifs.length === 0 ? (
                <div style={{ padding: "24px 14px", textAlign: "center", color: C.textMuted, fontSize: 13 }}>
                  {isAr ? "لا توجد إشعارات" : "No notifications"}
                </div>
              ) : (
                notifs.map(n => (
                  <div key={n.id} style={{
                    padding: "11px 14px",
                    borderBottom: `1px solid ${C.border}`,
                    background: n.read ? "transparent" : C.accentLight,
                    display: "flex", gap: 10, alignItems: "flex-start",
                    cursor: "pointer",
                    transition: `background ${MOTION.fast}`,
                  }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.surfaceAlt}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = n.read ? "transparent" : C.accentLight}
                  >
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%", marginTop: 5, flexShrink: 0,
                      background: n.type === "warning" ? C.warning : n.type === "success" ? C.success : C.accentMid,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text, marginBottom: 2 }}>
                        {n.title}
                      </div>
                      <div style={{ fontSize: 11.5, color: C.textSec, lineHeight: 1.5 }}>{n.body}</div>
                      <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 4 }}>{n.time}</div>
                    </div>
                  </div>
                ))
              )}

              {/* Footer */}
              <div style={{ padding: "10px 14px", textAlign: "center" }}>
                <button style={{
                  border: "none", background: "none",
                  fontSize: 12, color: C.accent, cursor: "pointer", fontFamily: "inherit",
                }}>
                  {isAr ? "عرض كل الإشعارات" : "View all notifications"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User pill */}
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "4px 10px 4px 6px", borderRadius: 8,
          border: `1px solid ${C.border}`, cursor: "pointer",
          background: C.surface,
          transition: `border-color ${MOTION.fast}, box-shadow ${MOTION.fast}`,
        }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = C.borderDark;
            (e.currentTarget as HTMLElement).style.boxShadow = ELEVATION[1];
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = C.border;
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }}
        >
          <div style={{
            width: 24, height: 24, borderRadius: 6, flexShrink: 0,
            background: `linear-gradient(135deg, ${C.accentMid} 0%, ${C.purple} 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, color: "#fff",
          }}>
            {(user?.name ?? "U").slice(0, 1).toUpperCase()}
          </div>
          <span style={{ fontSize: 12, fontWeight: 500, color: C.textSec }}>
            {user?.name?.split(" ")[0] ?? ""}
          </span>
        </div>
      </div>
    </div>
  );
}
