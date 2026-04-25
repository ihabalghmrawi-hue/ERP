"use client";

import { useState, useMemo } from "react";
import { S, C } from "@/lib/engine/design";
import { DB, SalesRep } from "@/lib/db/database";
import { AccountingEngine } from "@/lib/engine/accounting";
import { fmt, fmtDate, uid, logActivity } from "@/lib/engine/helpers";
import { useAuth } from "@/hooks/useAuth";
import { KPI }       from "@/components/ui/KPI";
import { DataTable } from "@/components/ui/DataTable";
import { Modal }     from "@/components/ui/Modal";

interface Props { addToast: (msg: string, type?: "success" | "error" | "info") => void; }

const emptyForm = { name: "", phone: "", email: "", commissionRate: "0", status: "active" };

// ─── Commission Badge ──────────────────────────────────────────────────────────
function CommBadge({ rate }: { rate: number }) {
  const color = rate === 0 ? C.textMuted : rate < 3 ? C.accentMid : rate < 6 ? C.warning : C.success;
  return <span style={{ fontWeight: 700, color }}>{rate}%</span>;
}

export function SalesReps({ addToast }: Props) {
  const { user } = useAuth();
  const db = DB.get();

  const [reps, setReps]           = useState<SalesRep[]>(db.salesReps || []);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<SalesRep | null>(null);
  const [form, setForm]           = useState({ ...emptyForm });
  const [detailRep, setDetailRep] = useState<SalesRep | null>(null);
  const [fromDate, setFromDate]   = useState(() => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 2);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));

  function openAdd() {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  }

  function openEdit(r: SalesRep) {
    setEditing(r);
    setForm({ name: r.name, phone: r.phone || "", email: r.email || "", commissionRate: String(r.commissionRate), status: r.status });
    setShowModal(true);
  }

  function handleSave() {
    if (!form.name) { addToast("اسم المندوب مطلوب", "error"); return; }
    const rate = parseFloat(form.commissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) { addToast("نسبة العمولة يجب أن تكون بين 0 و 100", "error"); return; }

    if (!db.salesReps) db.salesReps = [];

    if (editing) {
      editing.name           = form.name;
      editing.phone          = form.phone;
      editing.email          = form.email;
      editing.commissionRate = rate;
      editing.status         = form.status as "active" | "inactive";
      logActivity(user?.id || "", user?.name || "", "UPDATE", "SalesReps", `عدّل المندوب ${editing.name}`);
      addToast("تم تحديث المندوب", "success");
    } else {
      const rep: SalesRep = {
        id:             uid(),
        code:           `SR-${String((db.salesReps.length + 1)).padStart(3, "0")}`,
        name:           form.name,
        phone:          form.phone || undefined,
        email:          form.email || undefined,
        commissionRate: rate,
        status:         form.status as "active" | "inactive",
        createdAt:      new Date().toISOString().slice(0, 10),
      };
      db.salesReps.push(rep);
      logActivity(user?.id || "", user?.name || "", "CREATE", "SalesReps", `أضاف المندوب ${rep.name}`);
      addToast("تم إضافة المندوب", "success");
    }

    DB.save();
    setReps([...(db.salesReps || [])]);
    setShowModal(false);
  }

  function toggleStatus(r: SalesRep) {
    r.status = r.status === "active" ? "inactive" : "active";
    DB.save();
    setReps([...(db.salesReps || [])]);
  }

  // ── Summary per rep ────────────────────────────────────────────────────────
  const repReports = useMemo(() =>
    AccountingEngine.getSalesRepReport(undefined, fromDate, toDate),
    [fromDate, toDate, reps]
  );

  const totalSales      = repReports.reduce((s, r) => s + r.totalSales, 0);
  const totalCommission = repReports.reduce((s, r) => s + r.commission, 0);
  const totalInvoices   = repReports.reduce((s, r) => s + r.invoices.length, 0);

  // ── Detail invoices for selected rep ──────────────────────────────────────
  const detailReport = useMemo(() => {
    if (!detailRep) return null;
    return AccountingEngine.getSalesRepReport(detailRep.id, fromDate, toDate)[0] || null;
  }, [detailRep, fromDate, toDate]);

  return (
    <div>
      <div style={S.pageTitle}>مندوبو المبيعات</div>
      <div style={S.pageSub}>إدارة المندوبين وتتبع العمولات والأداء</div>

      {/* KPIs */}
      <div style={S.grid(4)}>
        <KPI label="إجمالي المندوبين" value={reps.length}                        color={C.accentMid} icon="👤" />
        <KPI label="نشطون"            value={reps.filter((r) => r.status === "active").length} color={C.success}   icon="✅" />
        <KPI label="إجمالي المبيعات" value={fmt(totalSales)}                     color={C.accent}    icon="💰" />
        <KPI label="إجمالي العمولات" value={fmt(totalCommission)}                color={C.warning}   icon="🏆" />
      </div>

      {/* Date filter */}
      <div style={{ ...S.card, padding: "12px 18px", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.textSec }}>فترة التقرير:</span>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ ...S.input, width: 160 }} />
          <span style={{ color: C.textMuted }}>إلى</span>
          <input type="date" value={toDate}   onChange={(e) => setToDate(e.target.value)}   style={{ ...S.input, width: 160 }} />
          <span style={{ fontSize: 12, color: C.textMuted }}>إجمالي {totalInvoices} فاتورة</span>
        </div>
      </div>

      {/* Reps table */}
      <div style={S.card}>
        <div style={S.sectionHeader}>
          <button style={{ ...S.btn("primary"), border: "none" }} onClick={openAdd}>+ إضافة مندوب</button>
          <div style={S.sectionTitle}>قائمة المندوبين ({reps.length})</div>
        </div>
        <DataTable
          headers={[
            { label: "الحالة" }, { label: "نسبة العمولة" },
            { label: "المبيعات (الفترة)" }, { label: "العمولة المستحقة" }, { label: "عدد الفواتير" },
            { label: "الهاتف" }, { label: "اسم المندوب" }, { label: "الكود" }, { label: "" },
          ]}
          rows={reps.map((r) => {
            const report = repReports.find((x) => x.rep?.id === r.id);
            return [
              <span key="st" style={S.badge(r.status === "active" ? "success" : "warning")}>
                {r.status === "active" ? "نشط" : "معطل"}
              </span>,
              <CommBadge key="cr" rate={r.commissionRate} />,
              <span key="ts" style={{ fontWeight: 700, color: C.accent }}>{fmt(report?.totalSales || 0)}</span>,
              <span key="cm" style={{ fontWeight: 700, color: C.warning }}>{fmt(report?.commission || 0)}</span>,
              <span key="iv">{report?.invoices.length || 0}</span>,
              r.phone || "—",
              <span key="name" style={{ fontWeight: 700 }}>{r.name}</span>,
              <span key="code" style={{ color: C.textMuted, fontSize: 12 }}>{r.code}</span>,
              <span key="acts" style={{ display: "flex", gap: 4 }}>
                <button
                  style={{ ...S.btn("outline"), fontSize: 11, padding: "3px 8px" }}
                  onClick={() => setDetailRep(r)}
                >تفاصيل</button>
                <button
                  style={{ ...S.btn("outline"), fontSize: 11, padding: "3px 8px" }}
                  onClick={() => openEdit(r)}
                >✏️</button>
                <button
                  style={{ ...S.btn(r.status === "active" ? "danger" : "primary"), border: "none", fontSize: 11, padding: "3px 8px" }}
                  onClick={() => toggleStatus(r)}
                >{r.status === "active" ? "تعطيل" : "تفعيل"}</button>
              </span>,
            ];
          })}
          emptyMsg="لا يوجد مندوبو مبيعات بعد — أضف مندوباً جديداً"
        />
      </div>

      {/* Commission summary table */}
      {repReports.length > 0 && (
        <div style={{ ...S.card, marginTop: 16 }}>
          <div style={S.sectionTitle}>ملخص العمولات — {fromDate} → {toDate}</div>
          <DataTable
            headers={[
              { label: "المندوب" }, { label: "عدد الفواتير" }, { label: "إجمالي المبيعات" },
              { label: "نسبة العمولة" }, { label: "العمولة المستحقة" },
            ]}
            rows={repReports.map((r) => [
              <span key="n" style={{ fontWeight: 700 }}>{r.rep?.name}</span>,
              r.invoices.length,
              <span key="ts" style={{ fontWeight: 800, color: C.accent }}>{fmt(r.totalSales)}</span>,
              <CommBadge key="cr" rate={r.rep?.commissionRate || 0} />,
              <span key="cm" style={{ fontWeight: 800, color: C.warning }}>{fmt(r.commission)}</span>,
            ])}
            emptyMsg=""
          />
          {/* Totals row */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 32, padding: "12px 16px", borderTop: `2px solid ${C.border}`, fontWeight: 800, fontSize: 14 }}>
            <span>إجمالي المبيعات: <span style={{ color: C.accent }}>{fmt(totalSales)}</span></span>
            <span>إجمالي العمولات: <span style={{ color: C.warning }}>{fmt(totalCommission)}</span></span>
          </div>
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {showModal && (
        <Modal title={editing ? `تعديل — ${editing.name}` : "إضافة مندوب مبيعات"} onClose={() => setShowModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={S.label}>اسم المندوب *</label>
              <input style={S.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="الاسم الكامل" />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={S.label}>الهاتف</label>
                <input style={S.input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+966..." />
              </div>
              <div style={{ flex: 1 }}>
                <label style={S.label}>البريد الإلكتروني</label>
                <input style={S.input} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@..." />
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={S.label}>نسبة العمولة % *</label>
                <input style={S.input} type="number" min="0" max="100" step="0.1" value={form.commissionRate}
                  onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} placeholder="0.00" />
                {form.commissionRate && !isNaN(parseFloat(form.commissionRate)) && (
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                    مثال: على مبيعات 10,000 → عمولة {fmt(10000 * parseFloat(form.commissionRate) / 100)}
                  </div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <label style={S.label}>الحالة</label>
                <select style={S.select} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="active">نشط</option>
                  <option value="inactive">معطل</option>
                </select>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button style={{ ...S.btn("primary"), border: "none" }} onClick={handleSave}>
              {editing ? "حفظ التعديلات" : "إضافة"}
            </button>
            <button style={{ ...S.btn("outline") }} onClick={() => setShowModal(false)}>إلغاء</button>
          </div>
        </Modal>
      )}

      {/* ── Detail Modal: rep invoices ── */}
      {detailRep && detailReport && (
        <Modal title={`تفاصيل المندوب — ${detailRep.name}`} onClose={() => setDetailRep(null)} wide>
          {/* Summary */}
          <div style={{ background: C.surfaceAlt, borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap", fontSize: 13 }}>
              <span>نسبة العمولة: <strong style={{ color: C.warning }}>{detailRep.commissionRate}%</strong></span>
              <span>إجمالي المبيعات: <strong style={{ color: C.accent }}>{fmt(detailReport.totalSales)}</strong></span>
              <span>العمولة المستحقة: <strong style={{ color: C.warning }}>{fmt(detailReport.commission)}</strong></span>
              <span>عدد الفواتير: <strong>{detailReport.invoices.length}</strong></span>
            </div>
          </div>

          <DataTable
            headers={[
              { label: "رقم الفاتورة" }, { label: "التاريخ" }, { label: "العميل" },
              { label: "الإجمالي" }, { label: "العمولة" }, { label: "الحالة" },
            ]}
            rows={detailReport.invoices.map((inv) => {
              const comm = inv.total * (detailRep.commissionRate / 100);
              return [
                <span key="id" style={{ fontWeight: 700, color: C.accent }}>{inv.id}</span>,
                fmtDate(inv.date),
                inv.customerName,
                <span key="tot" style={{ fontWeight: 700 }}>{fmt(inv.total)}</span>,
                <span key="com" style={{ fontWeight: 700, color: C.warning }}>{fmt(comm)}</span>,
                <span key="st" style={S.badge(inv.status === "paid" ? "success" : inv.status === "overdue" ? "danger" : "warning")}>
                  {inv.status}
                </span>,
              ];
            })}
            emptyMsg="لا توجد فواتير في هذه الفترة"
          />
        </Modal>
      )}
    </div>
  );
}
