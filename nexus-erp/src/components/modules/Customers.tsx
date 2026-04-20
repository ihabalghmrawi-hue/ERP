"use client";

import { useState } from "react";
import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { DB, Customer } from "@/lib/db/database";
import { fmt, uid, logActivity } from "@/lib/engine/helpers";
import { useAuth } from "@/hooks/useAuth";
import { KPI }         from "@/components/ui/KPI";
import { DataTable }   from "@/components/ui/DataTable";
import { Modal }       from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface Props { addToast: (msg: string, type?: "success" | "error" | "info") => void; }
const empty = { name: "", email: "", phone: "", address: "", taxId: "", creditLimit: "", currency: "SAR", status: "active" };

export function Customers({ addToast }: Props) {
  const { t } = useLang();
  const { user } = useAuth();
  const db = DB.get();
  const [customers, setCustomers] = useState<Customer[]>([...db.customers]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...empty });

  const handleAdd = () => {
    if (!form.name) { addToast(t("fillRequired"), "error"); return; }
    const c: Customer = {
      id: uid(),
      code: `CUST-${String(db.customers.length + 1).padStart(4, "0")}`,
      name: form.name, email: form.email, phone: form.phone,
      address: form.address, taxId: form.taxId,
      creditLimit: +form.creditLimit || 0,
      balance: 0, currency: form.currency,
      status: form.status as "active" | "inactive",
    };
    db.customers.push(c);
    DB.save();
    setCustomers([...db.customers]);
    logActivity(user?.id || "", user?.name || "", "CREATE", "Customers", `أضاف العميل ${c.name}`);
    addToast(t("customerCreated"), "success");
    setShowModal(false);
    setForm({ ...empty });
  };

  const outAR = customers.reduce((s, c) => s + (c.balance || 0), 0);

  return (
    <div>
      <div style={S.pageTitle}>{t("customersTitle")}</div>
      <div style={S.pageSub}>{t("customersSubtitle")}</div>

      <div style={S.grid(4)}>
        <KPI label={t("totalCustomers")} value={customers.length} color={C.accentMid} icon="👥" />
        <KPI label={t("active")} value={customers.filter((c) => c.status === "active").length} color={C.success} icon="✅" />
        <KPI label={t("totalAR")} value={fmt(outAR)} color={C.warning} icon="💳" />
        <KPI label={t("avgCreditLimit")} value={customers.length > 0 ? fmt(customers.reduce((s, c) => s + (c.creditLimit || 0), 0) / customers.length) : fmt(0)} color={C.purple} icon="⭐" />
      </div>

      <div style={S.card}>
        <div style={S.sectionHeader}>
          <button style={{ ...S.btn("primary"), border: "none" }} onClick={() => setShowModal(true)}>{t("newCustomer")}</button>
          <div style={S.sectionTitle}>{t("customerDirectory")} ({customers.length})</div>
        </div>
        <DataTable
          headers={[
            { label: t("status") }, { label: t("currency") }, { label: t("balance") },
            { label: t("creditLimit") }, { label: t("phone") }, { label: t("email") },
            { label: t("customer") }, { label: "الكود" },
          ]}
          rows={customers.map((c) => [
            <StatusBadge key="st" status={c.status} />,
            <span key="cur" style={S.badge("info")}>{c.currency}</span>,
            <span key="bal" style={{ fontWeight: 700, color: (c.balance || 0) > 0 ? C.warning : C.success }}>{fmt(c.balance || 0)}</span>,
            fmt(c.creditLimit || 0), c.phone || "—", c.email || "—",
            <span key="name" style={{ fontWeight: 700 }}>{c.name}</span>,
            <span key="code" style={{ color: C.textMuted, fontSize: 12 }}>{c.code}</span>,
          ])}
          emptyMsg={t("noCustomersYet")}
        />
      </div>

      {showModal && (
        <Modal title={t("addCustomer")} onClose={() => setShowModal(false)}>
          {([
            ["name", t("customer"), true, "text"],
            ["email", t("email"), false, "email"],
            ["phone", t("phone"), false, "text"],
            ["address", t("address"), false, "text"],
            ["taxId", "الرقم الضريبي", false, "text"],
            ["creditLimit", t("creditLimit"), false, "number"],
          ] as [string, string, boolean, string][]).map(([k, lbl, req, type]) => (
            <div key={k} style={S.formGroup}>
              <label style={S.label}>{lbl}{req ? " *" : ""}</label>
              <input style={S.input} type={type} value={(form as any)[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder={lbl} />
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
