"use client";

import { ToastItem } from "@/hooks/useToast";
import { S } from "@/lib/engine/design";

export function Toast({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div style={S.notif}>
      {toasts.map((t) => (
        <div key={t.id} style={S.toast(t.type)}>
          <span style={{ marginLeft: 8 }}>
            {t.type === "success" ? "✅" : t.type === "error" ? "❌" : "ℹ️"}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  );
}
