"use client";

import { ReactNode } from "react";
import { S } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

export function Modal({ title, onClose, children, wide }: ModalProps) {
  const { t } = useLang();
  return (
    <div
      style={S.modal}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={S.modalBox(wide)}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>
          <button
            onClick={onClose}
            style={{ ...S.btn("ghost"), fontSize: 20, padding: "0 6px", lineHeight: 1, border: "none" }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
