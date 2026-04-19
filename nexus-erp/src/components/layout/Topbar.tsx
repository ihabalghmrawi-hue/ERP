"use client";

import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { fmtDate } from "@/lib/engine/helpers";

interface TopbarProps {
  pageLabel: string;
  companyName?: string;
}

export function Topbar({ pageLabel, companyName }: TopbarProps) {
  const { lang } = useLang();

  return (
    <div style={S.topbar}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.success, boxShadow: `0 0 6px ${C.success}` }} />
        <span style={{ fontSize: 12, color: C.success, fontWeight: 700 }}>
          {lang === "ar" ? "متصل" : "Live"}
        </span>
        <span style={{ fontSize: 12, color: C.textMuted }}>
          {fmtDate(new Date().toISOString())}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {companyName && (
          <>
            <span style={{ fontSize: 12, color: C.accent, fontWeight: 700 }}>{companyName}</span>
            <span style={{ color: C.borderDark }}>›</span>
          </>
        )}
        <span style={{ fontSize: 13, color: C.textMuted }}>📊 BOB ERP</span>
        <span style={{ color: C.borderDark }}>›</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{pageLabel}</span>
      </div>
    </div>
  );
}
