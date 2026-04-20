"use client";

import { useState } from "react";
import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { DB, Supplier } from "@/lib/db/database";
import { fmt, uid, logActivity } from "@/lib/engine/helpers";
import { useAuth } from "@/hooks/useAuth";
import { KPI }         from "@/components/ui/KPI";
import { DataTable }   from "@/components/ui/DataTable";
import { Modal }       from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface Props { addToast: (msg: string, type?: "success" | "error" | "info") => void; }
const empty = { name: "", email: "", phone: "", address: "", taxId: "", creditTerms: "Net 30", currency: "SAR", status: "active" };

export function Suppliers({ addToast }: Props) {
  const { t } = useLang();
  const { user } = useAuth();
  const db = DB.get();
  const [suppliers, setSuppliers] = useState<Supplier[]>([...db.suppliers]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...empty });

  const handleAdd = () => {
    if (!form.name) { addToast(t("fillRequired"), "error"); return; }
    const s: Supplier = {
      id: uid(),
      code: `SUPP-${String(db.suppliers.length + 1).padStart(4, "0")}`,
      name: form.name, email: form.email, phone: form.phone,
      address: form.address, taxId: form.taxId,
      creditTerms: form.creditTerms,
      balance: 0, currency: form.currency,
      status: form.status as "active" | "inactive",
    };
    db.suppliers.push(s);
    DB.save();
    setSuppliers([...db.suppliers]);
    addToast(t("supplierCreated"), "success");
    setShowModal(false);
    setForm({ ...empty });
  };

  const outAP = suppliers.reduce((s, su) => s + (su.balance || 0), 0);

  return (
    <div>
      <div style={S.pageTitle}>{t("suppliersTitle")}</div>
      <div style={S.pageSub}>{t("suppliersSubtitle")}</div>

      <div style={S.grid(4)}>
        <KPI label={t("totalSuppliers")} value={suppliers.length} color={C.accentMid} icon="🏢" />
        <KPI label={t("active")} value={suppliers.filter((s) => s.status === "active").length} color={C.success} icon="✅" />
        <KPI label={t("totalAP")} value={fmt(outAP)} color={C.danger} icon="💳" />
        <KPI label={t("overdue")} value="0" color={C.success} icon="✓" />
      </div>

      <div style={S.card}>
        <div style={S.sectionHeader}>
          <button style={{ ...S.btn("primary"), border: "none" }} onClick={() => setShowModal(true)}>{t("newSupplier")}</button>
          <div style={S.sectionTitle}>{t("supplierDirectory")} ({suppliers.length})</div>
        </div>
        <DataTable
          headers={[
            { label: t("status") }, { label: t("outstanding") }, { label: t("terms") },
            { label: t("phone") }, { label: t("email") }, { label: t("supplier") }, { label: "الكود" },
          ]}
          rows={suppliers.map((s) => [
            <StatusBadge key="st" status={s.status} />,
            <span key="bal" style={{ fontWeight: 700, color: (s.balance || 0) > 0 ? C.danger : C.success }}>{fmt(s.balance || 0)}</span>,
            <span key="terms" style={S.badge("info")}>{s.creditTerms}</span>,
            s.phone || "—", s.email || "—",
            <span key="name" style={{ fontWeight: 700 }}>{s.name}</span>,
            <span key="code" style={{ color: C.textMuted, fontSize: 12 }}>{s.code}</span>,
          ])}
          emptyMsg={t("noSuppliersYet")}
        />
      </div>

      {showModal && (
        <Modal title={t("addSupplier")} onClose={() => setShowModal(false)}>
          {([
            ["name", t("supplier"), true],
            ["email", t("email"), false],
            ["phone", t("phone"), false],
            ["address", t("address"), false],
            ["taxId", "الرقم الضريبي", false],
            ["creditTerms", t("creditTerms"), false],
          ] as [string, string, boolean][]).map(([k, lbl, req]) => (
            <div key={k} style={S.formGroup}>
              <label style={S.label}>{lbl}{req ? " *" : ""}</label>
              <input style={S.input} value={(form as any)[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder={lbl} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-start" }}>
            <button style={{ ...S.btn("outline") }} onClick={() => setShowModal(false)}>{t("cancel")}</button>
            <button style={{ ...S.btn("primary"), border: "none" }} onClick={handleAdd}>{t("save")}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
