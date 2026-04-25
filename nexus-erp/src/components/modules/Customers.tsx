"use client";

import { useState, useMemo } from "react";
import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { DB, Customer, Invoice } from "@/lib/db/database";
import { AccountingEngine } from "@/lib/engine/accounting";
import { fmt, fmtDate, uid, logActivity } from "@/lib/engine/helpers";
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
  const [form, setForm]           = useState({ ...empty });
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null);
  const [search, setSearch]                 = useState("");

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

  // Live AR balance from journal entries (not from stored Customer.balance)
  const liveBalance = useMemo(() => {
    const arAcc = db.accounts.find((a) => a.code === "1100");
    if (!arAcc) return (c: Customer) => c.balance || 0;
    return (c: Customer) => AccountingEngine.computeCustomerBalance(c.id);
  }, [db.accounts, db.journalEntries]);

  const totalAR = useMemo(() =>
    customers.reduce((s, c) => s + liveBalance(c), 0),
    [customers, liveBalance]
  );

  const filtered = useMemo(() =>
    customers.filter((c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase())
    ),
    [customers, search]
  );

  // ── Customer ledger data ────────────────────────────────────────────────────
  const ledgerData = useMemo(() => {
    if (!ledgerCustomer) return null;
    const invoices  = db.invoices.filter((inv) => inv.customerId === ledgerCustomer.id && !inv.isReturned);
    const payments  = db.journalEntries.filter((je) =>
      je.sourceType === "payment" &&
      invoices.some((inv) => je.sourceId === inv.id || je.reference?.includes(inv.id))
    );
    const outstanding = invoices.filter((inv) => inv.status !== "paid");
    const totalInvAmount  = invoices.reduce((s, i) => s + i.total, 0);
    const totalPaid       = invoices.reduce((s, i) => s + (i.amountPaid || 0), 0);
    const totalDue        = invoices.reduce((s, i) => s + (i.amountDue || 0), 0);
    return { invoices, payments, outstanding, totalInvAmount, totalPaid, totalDue };
  }, [ledgerCustomer, db.invoices, db.journalEntries]);

  return (
    <div>
      <div style={S.pageTitle}>{t("customersTitle")}</div>
      <div style={S.pageSub}>{t("customersSubtitle")}</div>

      <div style={S.grid(4)}>
        <KPI label={t("totalCustomers")} value={customers.length}  color={C.accentMid} icon="👥" />
        <KPI label={t("active")} value={customers.filter((c) => c.status === "active").length} color={C.success} icon="✅" />
        <KPI label="ذمم مدينة (حي)" value={fmt(totalAR)}          color={C.warning}   icon="💳" />
        <KPI label={t("avgCreditLimit")} value={customers.length > 0 ? fmt(customers.reduce((s, c) => s + (c.creditLimit || 0), 0) / customers.length) : fmt(0)} color={C.purple} icon="⭐" />
      </div>

      <div style={S.card}>
        <div style={S.sectionHeader}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              style={{ ...S.input, width: 220, fontSize: 13 }}
              placeholder="بحث بالاسم أو الكود أو البريد..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button style={{ ...S.btn("primary"), border: "none" }} onClick={() => setShowModal(true)}>{t("newCustomer")}</button>
          </div>
          <div style={S.sectionTitle}>{t("customerDirectory")} ({filtered.length})</div>
        </div>
        <DataTable
          headers={[
            { label: t("status") }, { label: t("currency") }, { label: "الرصيد (حي)" },
            { label: t("creditLimit") }, { label: "فواتير" }, { label: "مستحق" },
            { label: t("phone") }, { label: t("email") },
            { label: t("customer") }, { label: "الكود" }, { label: "" },
          ]}
          rows={filtered.map((c) => {
            const bal = liveBalance(c);
            const invCount  = db.invoices.filter((i) => i.customerId === c.id && !i.isReturned).length;
            const outstanding = db.invoices.filter((i) => i.customerId === c.id && i.status !== "paid" && !i.isReturned).reduce((s, i) => s + (i.amountDue || 0), 0);
            return [
              <StatusBadge key="st" status={c.status} />,
              <span key="cur" style={S.badge("info")}>{c.currency}</span>,
              <span key="bal" style={{ fontWeight: 700, color: bal > 0 ? C.warning : C.success }}>{fmt(bal)}</span>,
              fmt(c.creditLimit || 0),
              <span key="inv">{invCount}</span>,
              <span key="due" style={{ fontWeight: 700, color: outstanding > 0 ? C.danger : C.success }}>
                {outstanding > 0 ? fmt(outstanding) : "✓"}
              </span>,
              c.phone || "—", c.email || "—",
              <span key="name" style={{ fontWeight: 700 }}>{c.name}</span>,
              <span key="code" style={{ color: C.textMuted, fontSize: 12 }}>{c.code}</span>,
              <button key="ldg"
                style={{ ...S.btn("outline"), fontSize: 11, padding: "3px 10px" }}
                onClick={() => setLedgerCustomer(c)}
              >دفتر الأستاذ</button>,
            ];
          })}
          emptyMsg={t("noCustomersYet")}
        />
      </div>

      {/* ── Add Customer Modal ── */}
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

      {/* ── Customer Ledger Modal ── */}
      {ledgerCustomer && ledgerData && (
        <Modal title={`دفتر الأستاذ — ${ledgerCustomer.name}`} onClose={() => setLedgerCustomer(null)} wide>
          {/* Summary bar */}
          <div style={{ background: C.surfaceAlt, borderRadius: 10, padding: "12px 16px", marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13 }}>
              <span>الرصيد الحالي: <strong style={{ color: liveBalance(ledgerCustomer) > 0 ? C.warning : C.success }}>
                {fmt(liveBalance(ledgerCustomer))}
              </strong></span>
              <span>إجمالي المشتريات: <strong style={{ color: C.accent }}>{fmt(ledgerData.totalInvAmount)}</strong></span>
              <span>إجمالي المدفوع: <strong style={{ color: C.success }}>{fmt(ledgerData.totalPaid)}</strong></span>
              <span>إجمالي المستحق: <strong style={{ color: ledgerData.totalDue > 0 ? C.danger : C.success }}>
                {ledgerData.totalDue > 0 ? fmt(ledgerData.totalDue) : "✓ لا ديون"}
              </strong></span>
              <span>عدد الفواتير: <strong>{ledgerData.invoices.length}</strong></span>
            </div>
          </div>

          {/* Outstanding invoices */}
          {ledgerData.outstanding.length > 0 && (
            <div style={{ background: "#FFF7ED", border: `1px solid ${C.warning}`, borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
              <div style={{ fontWeight: 700, color: C.warning, marginBottom: 8, fontSize: 13 }}>
                ⚠️ فواتير غير مسددة ({ledgerData.outstanding.length})
              </div>
              {ledgerData.outstanding.map((inv: Invoice) => (
                <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderBottom: `1px dashed ${C.border}` }}>
                  <span><strong>{inv.id}</strong> — {fmtDate(inv.date)}</span>
                  <span style={{ fontWeight: 700, color: C.danger }}>{fmt(inv.amountDue || 0)}</span>
                </div>
              ))}
            </div>
          )}

          {/* All invoices */}
          <div style={{ fontWeight: 700, fontSize: 13, color: C.textSec, marginBottom: 8 }}>سجل الفواتير</div>
          <DataTable
            headers={[
              { label: "رقم الفاتورة" }, { label: "التاريخ" }, { label: "نوع الدفع" },
              { label: "الإجمالي" }, { label: "المدفوع" }, { label: "المستحق" },
              { label: "المندوب" }, { label: "الحالة" }, { label: "قيد" },
            ]}
            rows={ledgerData.invoices.map((inv: Invoice) => [
              <span key="id" style={{ fontWeight: 700, color: C.accent }}>{inv.id}</span>,
              fmtDate(inv.date),
              <span key="tp" style={S.badge("info")}>{inv.paymentType === "cash" ? "نقدي" : "آجل"}</span>,
              <span key="tot" style={{ fontWeight: 700 }}>{fmt(inv.total)}</span>,
              <span key="paid" style={{ color: C.success }}>{fmt(inv.amountPaid || 0)}</span>,
              <span key="due" style={{ fontWeight: 700, color: (inv.amountDue || 0) > 0 ? C.danger : C.success }}>
                {(inv.amountDue || 0) > 0 ? fmt(inv.amountDue) : "✓"}
              </span>,
              <span key="rep" style={{ fontSize: 11, color: C.textSec }}>{inv.salesRepName || "—"}</span>,
              <span key="st" style={S.badge(inv.status === "paid" ? "success" : inv.status === "overdue" ? "danger" : "warning")}>
                {inv.status}
              </span>,
              <span key="je" style={{ fontSize: 11, color: C.purple }}>{inv.journalEntryId || "—"}</span>,
            ])}
            emptyMsg="لا توجد فواتير لهذا العميل"
          />
        </Modal>
      )}
    </div>
  );
}
