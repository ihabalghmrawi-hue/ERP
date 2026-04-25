"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Company, PLANS, PlanId, CURRENCIES, Currency, Invoice, ActivityLog } from "@/lib/types";

// ── Design tokens ─────────────────────────────────────────────
const C = {
  bg: "#F1F5F9", surface: "#FFFFFF", border: "#E2E8F0",
  sidebar: "#0F172A", sidebarHover: "rgba(255,255,255,0.07)",
  accent: "#1D4ED8", accentLight: "#DBEAFE", accentMid: "#2563EB",
  success: "#059669", successLight: "#D1FAE5",
  warning: "#D97706", warningLight: "#FEF3C7",
  danger: "#DC2626", dangerLight: "#FEF2F2",
  purple: "#7C3AED", purpleLight: "#EDE9FE",
  text: "#0F172A", textSec: "#475569", textMuted: "#94A3B8",
};

type Tab = "overview" | "companies" | "new_company" | "invoices" | "activity" | "trash" | "profile" | "reset_admin";

// ── Helpers ────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString("ar-SA"); }
function fmtMoney(n: number, cur: Currency = "SAR") {
  return `${fmt(n)} ${CURRENCIES[cur]?.symbol ?? cur}`;
}
function daysLeft(endDate: string) {
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
}

// ── Shared UI components ───────────────────────────────────────
function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, color, background: bg }}>{label}</span>;
}

function planBadge(planId: PlanId) {
  const map: Record<PlanId, { color: string; bg: string }> = {
    trial:      { color: C.warning,  bg: C.warningLight },
    starter:    { color: C.accentMid, bg: C.accentLight },
    pro:        { color: C.purple,   bg: C.purpleLight },
    enterprise: { color: C.success,  bg: C.successLight },
  };
  return <Badge label={PLANS[planId].nameAr} {...map[planId]} />;
}

function statusBadge(company: Company) {
  const dl = daysLeft(company.subscription.endDate);
  if (company.subscription.status === "trial")   return <Badge label="تجريبي" color={C.warning} bg={C.warningLight} />;
  if (company.subscription.status === "expired" || company.status === "suspended")
    return <Badge label="موقوف" color={C.danger} bg={C.dangerLight} />;
  if (dl <= 3)  return <Badge label="ينتهي قريباً" color={C.danger} bg={C.dangerLight} />;
  if (dl <= 7)  return <Badge label="تحذير" color={C.warning} bg={C.warningLight} />;
  return <Badge label="نشط" color={C.success} bg={C.successLight} />;
}

function Stat({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: C.surface, borderRadius: 14, padding: "20px 24px", border: `1px solid ${C.border}`, flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: color || C.text }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: C.surface, borderRadius: 18, width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.textMuted }}>×</button>
        </div>
        <div style={{ padding: "24px" }}>{children}</div>
      </div>
    </div>
  );
}

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.textSec, marginBottom: 5 }}>{label}</label>
      <input style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.text, background: "#F8FAFC", outline: "none" }} {...props} />
    </div>
  );
}

function Select({ label, children, ...props }: { label: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.textSec, marginBottom: 5 }}>{label}</label>
      <select style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.text, background: "#F8FAFC", outline: "none" }} {...props}>{children}</select>
    </div>
  );
}

function Btn({ children, variant = "primary", size = "md", ...props }: { variant?: "primary"|"danger"|"ghost"|"success"|"warning"; size?: "sm"|"md" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const bg = variant === "primary" ? `linear-gradient(135deg,${C.accent},${C.purple})` : variant === "danger" ? C.danger : variant === "success" ? C.success : variant === "warning" ? C.warning : "transparent";
  const color = variant === "ghost" ? C.textSec : "#fff";
  const border = variant === "ghost" ? `1.5px solid ${C.border}` : "none";
  return (
    <button style={{ padding: size === "sm" ? "5px 12px" : "9px 18px", borderRadius: 8, background: bg, color, border, fontSize: size === "sm" ? 12 : 13, fontWeight: 700, cursor: "pointer", opacity: props.disabled ? 0.6 : 1 }} {...props}>{children}</button>
  );
}

// ── Overview Tab ───────────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/stats").then(r => r.json()),
      fetch("/api/notifications").then(r => r.json()),
    ]).then(([s, n]) => { setStats(s); setAlerts(n.alerts || []); setLoading(false); });
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>جارٍ التحميل...</div>;

  const mrr = stats?.mrr ?? 0;
  const arr = stats?.arr ?? 0;

  return (
    <div>
      {alerts.length > 0 && (
        <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: C.warning, marginBottom: 8, fontSize: 13 }}>⚠️ اشتراكات تنتهي قريباً ({alerts.length})</div>
          {alerts.slice(0, 3).map(({ company: c, daysLeft: dl }: any) => (
            <div key={c.id} style={{ fontSize: 12, color: C.textSec, marginBottom: 4 }}>
              • <strong>{c.name}</strong> — {dl <= 0 ? "انتهى اليوم" : `${dl} يوم متبقي`}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
        <Stat label="إجمالي الشركات" value={stats?.total ?? 0} />
        <Stat label="نشطة" value={stats?.active ?? 0} color={C.success} />
        <Stat label="تجريبية" value={stats?.trial ?? 0} color={C.warning} />
        <Stat label="موقوفة" value={stats?.expired ?? 0} color={C.danger} />
        <Stat label="MRR" value={fmtMoney(mrr)} sub="الإيراد الشهري" color={C.accent} />
        <Stat label="ARR" value={fmtMoney(arr)} sub="الإيراد السنوي" color={C.purple} />
      </div>

      {/* Plan distribution */}
      <div style={{ background: C.surface, borderRadius: 14, padding: "20px 24px", border: `1px solid ${C.border}`, marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>توزيع الخطط</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {(stats?.planDist || []).map((p: any) => (
            <div key={p.plan} style={{ flex: 1, minWidth: 100, textAlign: "center", padding: "12px", background: C.bg, borderRadius: 10 }}>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{p.count}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{PLANS[p.plan as PlanId]?.nameAr}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent companies */}
      <div style={{ background: C.surface, borderRadius: 14, padding: "20px 24px", border: `1px solid ${C.border}` }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>آخر الشركات المضافة</div>
        {(stats?.recent || []).map((c: any) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{c.email}</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {planBadge(c.plan)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Companies Tab ──────────────────────────────────────────────
function CompaniesTab({ onNew }: { onNew: () => void }) {
  const [data, setData] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");
  const [sort, setSort] = useState("createdAt_desc");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Company | null>(null);
  const [modal, setModal] = useState<null|"renew"|"suspend"|"delete"|"extend"|"detail">(null);
  const [saving, setSaving] = useState(false);
  const [renewForm, setRenewForm] = useState({ planId: "starter" as PlanId, billingCycle: "monthly", amount: "", currency: "SAR" as Currency });

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/companies?q=${encodeURIComponent(q)}&status=${status}&plan=${plan}&sort=${sort}&page=${page}&limit=20`);
    const j = await r.json();
    setData(j.data || []); setTotal(j.total || 0); setPages(j.pages || 1);
    setLoading(false);
  }, [q, status, plan, sort, page]);

  useEffect(() => { load(); }, [load]);

  const action = async (id: string, body: any) => {
    setSaving(true);
    await fetch(`/api/companies/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false); setModal(null); load();
  };

  const del = async (id: string) => {
    setSaving(true);
    await fetch(`/api/companies/${id}`, { method: "DELETE" });
    setSaving(false); setModal(null); load();
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="بحث باسم أو بريد..." style={{ flex: 1, minWidth: 180, padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13 }} />
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} style={{ padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13 }}>
          <option value="all">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="trial">تجريبي</option>
          <option value="expired">موقوف</option>
        </select>
        <select value={plan} onChange={e => { setPlan(e.target.value); setPage(1); }} style={{ padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13 }}>
          <option value="all">كل الخطط</option>
          {Object.entries(PLANS).map(([k, v]) => <option key={k} value={k}>{v.nameAr}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13 }}>
          <option value="createdAt_desc">الأحدث أولاً</option>
          <option value="createdAt_asc">الأقدم أولاً</option>
          <option value="endDate_asc">ينتهي قريباً</option>
          <option value="amount_desc">الأعلى قيمة</option>
          <option value="name_asc">الاسم أ-ي</option>
        </select>
        <Btn onClick={onNew}>+ شركة جديدة</Btn>
      </div>

      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>{total} شركة</div>

      {loading ? <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>جارٍ التحميل...</div> : (
        <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          {data.map((c, i) => {
            const dl = daysLeft(c.subscription.endDate);
            const urgent = dl <= 3 && c.subscription.status !== "expired";
            return (
              <div key={c.id} style={{ padding: "14px 20px", borderBottom: i < data.length - 1 ? `1px solid ${C.border}` : "none", background: urgent ? "#FFF7ED" : "transparent", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{c.email} · {c.country}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {statusBadge(c)}
                  {planBadge(c.subscription.planId)}
                </div>
                <div style={{ fontSize: 12, color: C.textSec, minWidth: 120, textAlign: "center" }}>
                  <div style={{ fontWeight: 700 }}>{fmtMoney(c.subscription.amount, c.subscription.currency)}</div>
                  <div style={{ color: dl <= 0 ? C.danger : dl <= 7 ? C.warning : C.textMuted }}>
                    {dl <= 0 ? "انتهى" : `${dl} يوم`} · {fmtDate(c.subscription.endDate)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Btn size="sm" variant="primary" onClick={() => { setSelected(c); setModal("detail"); }}>تفاصيل</Btn>
                  <Btn size="sm" variant="success" onClick={() => { setSelected(c); setRenewForm({ planId: c.subscription.planId, billingCycle: c.subscription.billingCycle, amount: String(c.subscription.amount), currency: c.subscription.currency || "SAR" }); setModal("renew"); }}>تجديد</Btn>
                  <Btn size="sm" variant="warning" onClick={() => { setSelected(c); setModal("extend"); }}>تمديد</Btn>
                  <Btn size="sm" variant="danger" onClick={() => { setSelected(c); setModal("delete"); }}>حذف</Btn>
                </div>
              </div>
            );
          })}
          {data.length === 0 && <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>لا توجد شركات</div>}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
          {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)} style={{ width: 32, height: 32, borderRadius: 8, border: `1.5px solid ${p === page ? C.accent : C.border}`, background: p === page ? C.accentLight : C.surface, color: p === page ? C.accent : C.text, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>{p}</button>
          ))}
        </div>
      )}

      {/* Renew Modal */}
      {modal === "renew" && selected && (
        <Modal title={`تجديد اشتراك — ${selected.name}`} onClose={() => setModal(null)}>
          <div style={{ background: C.accentLight, borderRadius: 10, padding: "12px 16px", marginBottom: 18, fontSize: 13 }}>
            <div><strong>الخطة الحالية:</strong> {PLANS[selected.subscription.planId].nameAr}</div>
            <div><strong>تاريخ الانتهاء:</strong> {fmtDate(selected.subscription.endDate)}</div>
          </div>
          <Select label="الخطة الجديدة" value={renewForm.planId} onChange={e => setRenewForm(f => ({ ...f, planId: e.target.value as PlanId }))}>
            {Object.entries(PLANS).filter(([k]) => k !== "trial").map(([k, v]) => <option key={k} value={k}>{v.nameAr}</option>)}
          </Select>
          <Select label="دورة الفوترة" value={renewForm.billingCycle} onChange={e => setRenewForm(f => ({ ...f, billingCycle: e.target.value as any }))}>
            <option value="monthly">شهري</option>
            <option value="yearly">سنوي</option>
          </Select>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 2 }}><Input label="المبلغ" type="number" value={renewForm.amount} onChange={e => setRenewForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div style={{ flex: 1 }}>
              <Select label="العملة" value={renewForm.currency} onChange={e => setRenewForm(f => ({ ...f, currency: e.target.value as Currency }))}>
                {Object.entries(CURRENCIES).map(([k, v]) => <option key={k} value={k}>{v.symbol} {k}</option>)}
              </Select>
            </div>
          </div>
          <div style={{ background: C.successLight, borderRadius: 10, padding: "10px 14px", fontSize: 12, color: C.success, marginBottom: 16 }}>
            ✓ سيتم تجديد الاشتراك لمدة {renewForm.billingCycle === "yearly" ? "سنة" : "30 يوم"} بمبلغ {fmtMoney(Number(renewForm.amount) || 0, renewForm.currency)} وإنشاء فاتورة تلقائياً.
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setModal(null)}>إلغاء</Btn>
            <Btn variant="primary" disabled={saving} onClick={() => action(selected.id, { action: "renew", ...renewForm, amount: Number(renewForm.amount) })}>
              {saving ? "جارٍ التجديد..." : "تأكيد التجديد"}
            </Btn>
          </div>
        </Modal>
      )}

      {/* Extend Trial Modal */}
      {modal === "extend" && selected && (
        <Modal title={`تمديد تجربة — ${selected.name}`} onClose={() => setModal(null)}>
          <Select label="عدد الأيام الإضافية" defaultValue="7" id="extDays">
            {[7, 14, 30].map(d => <option key={d} value={d}>{d} أيام</option>)}
          </Select>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <Btn variant="ghost" onClick={() => setModal(null)}>إلغاء</Btn>
            <Btn variant="warning" disabled={saving} onClick={() => action(selected.id, { action: "extend_trial", days: Number((document.getElementById("extDays") as HTMLSelectElement)?.value || 7) })}>
              {saving ? "جارٍ التمديد..." : "تمديد"}
            </Btn>
          </div>
        </Modal>
      )}

      {/* Delete Modal */}
      {modal === "delete" && selected && (
        <Modal title="تأكيد الحذف" onClose={() => setModal(null)}>
          <div style={{ textAlign: "center", padding: "8px 0 24px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>هل تريد حذف <span style={{ color: C.danger }}>{selected.name}</span>؟</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>سيتم نقل الشركة إلى سلة المهملات ويمكن استرجاعها لاحقاً.</div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <Btn variant="ghost" onClick={() => setModal(null)}>إلغاء</Btn>
            <Btn variant="danger" disabled={saving} onClick={() => del(selected.id)}>
              {saving ? "جارٍ الحذف..." : "حذف (مؤقت)"}
            </Btn>
          </div>
        </Modal>
      )}

      {/* Detail Modal */}
      {modal === "detail" && selected && (
        <CompanyDetailModal company={selected} onClose={() => { setModal(null); load(); }} />
      )}
    </div>
  );
}

function CompanyDetailModal({ company, onClose }: { company: Company; onClose: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/companies/${company.id}`).then(r => r.json()).then(setDetail);
  }, [company.id]);

  const markPaid = async (invId: string) => {
    setSaving(true);
    await fetch("/api/invoices", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: invId, status: "paid" }) });
    const d = await fetch(`/api/companies/${company.id}`).then(r => r.json());
    setDetail(d); setSaving(false);
  };

  return (
    <Modal title={company.name} onClose={onClose}>
      <div style={{ fontSize: 13, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            ["البريد", company.email], ["الهاتف", company.phone || "—"],
            ["الدولة", company.country], ["تاريخ الإنشاء", fmtDate(company.createdAt)],
            ["الخطة", PLANS[company.subscription.planId].nameAr],
            ["ينتهي في", fmtDate(company.subscription.endDate)],
            ["المبلغ", fmtMoney(company.subscription.amount, company.subscription.currency)],
            ["المستخدمون", detail?.stats?.users ?? "…"],
          ].map(([k, v]) => (
            <div key={k as string} style={{ background: C.bg, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700 }}>{k}</div>
              <div style={{ fontWeight: 700, marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Invoices */}
        {detail?.invoices?.length > 0 && (
          <div>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>الفواتير</div>
            {detail.invoices.map((inv: Invoice) => (
              <div key={inv.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                <div>
                  <span style={{ fontWeight: 700 }}>{inv.id}</span>
                  <span style={{ color: C.textMuted, marginRight: 8 }}>{fmtDate(inv.issuedAt)}</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontWeight: 700 }}>{fmtMoney(inv.amount, inv.currency)}</span>
                  {inv.status === "paid"
                    ? <Badge label="مدفوعة" color={C.success} bg={C.successLight} />
                    : <><Badge label="غير مدفوعة" color={C.warning} bg={C.warningLight} />
                        <Btn size="sm" variant="success" disabled={saving} onClick={() => markPaid(inv.id)}>تسجيل دفع</Btn></>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── New Company Tab ────────────────────────────────────────────
function NewCompanyTab({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", country: "SA", notes: "",
    planId: "trial" as PlanId, trialDays: "14", billingCycle: "monthly", amount: "", currency: "SAR" as Currency,
    adminName: "", adminEmail: "", adminPassword: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    setError(""); setSaving(true);
    const res = await fetch("/api/companies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, amount: Number(form.amount) || 0 }) });
    const d = await res.json();
    setSaving(false);
    if (!res.ok) { setError(d.error || "حدث خطأ"); return; }
    setSuccess("✓ تم إنشاء الشركة بنجاح");
    setTimeout(() => { setSuccess(""); onDone(); }, 1500);
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 24 }}>إضافة شركة جديدة</div>

      <div style={{ background: C.surface, borderRadius: 14, padding: 24, border: `1px solid ${C.border}`, marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16, color: C.accent }}>بيانات الشركة</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <Input label="اسم الشركة *" value={form.name} onChange={e => set("name", e.target.value)} />
          <Input label="البريد الإلكتروني للشركة *" type="email" value={form.email} onChange={e => set("email", e.target.value)} />
          <Input label="رقم الهاتف" value={form.phone} onChange={e => set("phone", e.target.value)} />
          <Select label="الدولة" value={form.country} onChange={e => set("country", e.target.value)}>
            {[["SA","السعودية"],["AE","الإمارات"],["KW","الكويت"],["BH","البحرين"],["QA","قطر"],["OM","عُمان"],["EG","مصر"],["JO","الأردن"]].map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        <Input label="ملاحظات" value={form.notes} onChange={e => set("notes", e.target.value)} />
      </div>

      <div style={{ background: C.surface, borderRadius: 14, padding: 24, border: `1px solid ${C.border}`, marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16, color: C.purple }}>الاشتراك</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <Select label="الخطة" value={form.planId} onChange={e => set("planId", e.target.value)}>
            {Object.entries(PLANS).map(([k, v]) => <option key={k} value={k}>{v.nameAr}</option>)}
          </Select>
          {form.planId === "trial"
            ? <Input label="مدة التجربة (أيام)" type="number" value={form.trialDays} onChange={e => set("trialDays", e.target.value)} />
            : <Select label="دورة الفوترة" value={form.billingCycle} onChange={e => set("billingCycle", e.target.value)}>
                <option value="monthly">شهري</option>
                <option value="yearly">سنوي</option>
              </Select>}
          {form.planId !== "trial" && <>
            <Input label="المبلغ" type="number" value={form.amount} onChange={e => set("amount", e.target.value)} />
            <Select label="العملة" value={form.currency} onChange={e => set("currency", e.target.value as Currency)}>
              {Object.entries(CURRENCIES).map(([k, v]) => <option key={k} value={k}>{v.symbol} {k} — {v.name}</option>)}
            </Select>
          </>}
        </div>
      </div>

      <div style={{ background: C.surface, borderRadius: 14, padding: 24, border: `1px solid ${C.border}`, marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16, color: C.success }}>حساب المدير الأول</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <Input label="الاسم *" value={form.adminName} onChange={e => set("adminName", e.target.value)} />
          <Input label="البريد الإلكتروني *" type="email" value={form.adminEmail} onChange={e => set("adminEmail", e.target.value)} />
        </div>
        <Input label="كلمة المرور *" type="password" value={form.adminPassword} onChange={e => set("adminPassword", e.target.value)} />
      </div>

      {error && <div style={{ background: C.dangerLight, border: `1px solid #FECACA`, borderRadius: 10, padding: "10px 16px", color: C.danger, fontSize: 13, marginBottom: 14 }}>{error}</div>}
      {success && <div style={{ background: C.successLight, border: `1px solid #A7F3D0`, borderRadius: 10, padding: "10px 16px", color: C.success, fontSize: 13, marginBottom: 14 }}>{success}</div>}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onDone}>إلغاء</Btn>
        <Btn variant="primary" disabled={saving} onClick={submit}>{saving ? "جارٍ الإنشاء..." : "إنشاء الشركة"}</Btn>
      </div>
    </div>
  );
}

// ── Invoices Tab ───────────────────────────────────────────────
function InvoicesTab() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/invoices?status=${statusFilter}`);
    setInvoices(await r.json());
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const markPaid = async (id: string) => {
    setSaving(true);
    await fetch("/api/invoices", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "paid" }) });
    load(); setSaving(false);
  };

  const totalUnpaid = invoices.filter(i => i.status !== "paid").reduce((s, i) => s + i.amount, 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13 }}>
          <option value="all">كل الفواتير</option>
          <option value="unpaid">غير مدفوعة</option>
          <option value="paid">مدفوعة</option>
          <option value="overdue">متأخرة</option>
        </select>
        {totalUnpaid > 0 && <span style={{ fontSize: 12, color: C.warning, fontWeight: 700 }}>إجمالي غير مدفوع: {fmt(totalUnpaid)} ر.س</span>}
      </div>

      <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        {invoices.length === 0 && <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>لا توجد فواتير</div>}
        {invoices.map((inv, i) => (
          <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: i < invoices.length - 1 ? `1px solid ${C.border}` : "none", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{inv.companyName}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{inv.id} · {fmtDate(inv.issuedAt)}</div>
            </div>
            <div style={{ fontSize: 12, color: C.textSec }}>{PLANS[inv.planId]?.nameAr} · {inv.billingCycle === "monthly" ? "شهري" : "سنوي"}</div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{fmtMoney(inv.amount, inv.currency)}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {inv.status === "paid"
                ? <Badge label="مدفوعة" color={C.success} bg={C.successLight} />
                : inv.status === "overdue"
                ? <Badge label="متأخرة" color={C.danger} bg={C.dangerLight} />
                : <Badge label="غير مدفوعة" color={C.warning} bg={C.warningLight} />}
              {inv.status !== "paid" && (
                <Btn size="sm" variant="success" disabled={saving} onClick={() => markPaid(inv.id)}>تسجيل دفع</Btn>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Activity Tab ───────────────────────────────────────────────
const ACTIVITY_LABELS: Record<string, { icon: string; label: string; color: string }> = {
  company_created:       { icon: "🏢", label: "إنشاء شركة",       color: C.success },
  company_deleted:       { icon: "🗑️", label: "حذف شركة",         color: C.danger },
  company_restored:      { icon: "♻️", label: "استرجاع شركة",     color: C.accent },
  subscription_renewed:  { icon: "🔄", label: "تجديد اشتراك",     color: C.accent },
  subscription_suspended:{ icon: "⏸️", label: "تعليق اشتراك",    color: C.warning },
  subscription_activated:{ icon: "✅", label: "تفعيل اشتراك",     color: C.success },
  plan_changed:          { icon: "📦", label: "تغيير الخطة",      color: C.purple },
  trial_extended:        { icon: "⏱️", label: "تمديد التجربة",    color: C.warning },
  admin_login:           { icon: "🔑", label: "دخول المدير",      color: C.textMuted },
  admin_created:         { icon: "👤", label: "إنشاء مدير",       color: C.accent },
};

function ActivityTab() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    fetch("/api/activity?limit=100").then(r => r.json()).then(setLogs);
  }, []);

  return (
    <div>
      <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        {logs.length === 0 && <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>لا يوجد سجل عمليات بعد</div>}
        {logs.map((log, i) => {
          const meta = ACTIVITY_LABELS[log.type] || { icon: "📋", label: log.type, color: C.textMuted };
          return (
            <div key={log.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px", borderBottom: i < logs.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <span style={{ fontSize: 20 }}>{meta.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  <span style={{ color: meta.color }}>{meta.label}</span>
                  {log.targetName && <span style={{ color: C.textSec }}> — {log.targetName}</span>}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted }}>بواسطة {log.adminName} · {new Date(log.createdAt).toLocaleString("ar-SA")}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Trash Tab ─────────────────────────────────────────────────
function TrashTab() {
  const [data, setData] = useState<Company[]>([]);
  const [saving, setSaving] = useState(false);

  const load = () => fetch("/api/companies?deleted=true").then(r => r.json()).then(j => setData(j.data || []));
  useEffect(() => { load(); }, []);

  const restore = async (id: string) => {
    setSaving(true);
    await fetch(`/api/companies/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "activate" }) });
    load(); setSaving(false);
  };

  const permDelete = async (id: string) => {
    if (!confirm("حذف نهائي لا يمكن التراجع عنه؟")) return;
    setSaving(true);
    await fetch(`/api/companies/${id}?hard=true`, { method: "DELETE" });
    load(); setSaving(false);
  };

  return (
    <div>
      <div style={{ background: C.dangerLight, borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: C.danger }}>
        ⚠️ الشركات المحذوفة مؤقتاً — يمكن استرجاعها أو حذفها نهائياً.
      </div>
      <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}` }}>
        {data.length === 0 && <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>سلة المهملات فارغة</div>}
        {data.map((c, i) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: i < data.length - 1 ? `1px solid ${C.border}` : "none" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{c.name}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{c.email} · حُذف {c.deletedAt ? fmtDate(c.deletedAt) : ""}</div>
            </div>
            <Btn size="sm" variant="success" disabled={saving} onClick={() => restore(c.id)}>استرجاع</Btn>
            <Btn size="sm" variant="danger" disabled={saving} onClick={() => permDelete(c.id)}>حذف نهائي</Btn>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Profile & Reset Admin Tabs ─────────────────────────────────
function ProfileTab({ adminName, adminEmail }: { adminName: string; adminEmail: string }) {
  const [form, setForm] = useState({ email: adminEmail, currentPassword: "", newPassword: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setErr(""); setMsg(""); setSaving(true);
    const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await res.json();
    setSaving(false);
    if (!res.ok) { setErr(d.error || "خطأ"); return; }
    setMsg("✓ تم التحديث");
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 24 }}>الملف الشخصي</div>
      <div style={{ background: C.surface, borderRadius: 14, padding: 24, border: `1px solid ${C.border}` }}>
        <Input label="البريد الإلكتروني" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        <Input label="كلمة المرور الحالية" type="password" value={form.currentPassword} onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))} />
        <Input label="كلمة المرور الجديدة (اختياري)" type="password" value={form.newPassword} onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))} />
        {err && <div style={{ color: C.danger, fontSize: 12, marginBottom: 12 }}>{err}</div>}
        {msg && <div style={{ color: C.success, fontSize: 12, marginBottom: 12 }}>{msg}</div>}
        <Btn variant="primary" disabled={saving} onClick={submit}>{saving ? "جارٍ الحفظ..." : "حفظ التغييرات"}</Btn>
      </div>
    </div>
  );
}

function ResetAdminTab() {
  const [form, setForm] = useState({ setupKey: "", name: "", email: "", password: "" });
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [saving, setSaving] = useState(false);
  const submit = async () => {
    setErr(""); setMsg(""); setSaving(true);
    const res = await fetch("/api/reset-admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await res.json(); setSaving(false);
    if (!res.ok) { setErr(d.error || "خطأ"); return; }
    setMsg("✓ تم إعادة تعيين المدير. أعد تسجيل الدخول.");
  };
  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>إعادة تعيين المدير العام</div>
      <div style={{ fontSize: 12, color: C.danger, marginBottom: 24 }}>⚠️ سيتم حذف حساب المدير الحالي واستبداله.</div>
      <div style={{ background: C.surface, borderRadius: 14, padding: 24, border: `1px solid ${C.border}` }}>
        <Input label="SETUP_SECRET" type="password" value={form.setupKey} onChange={e => setForm(f => ({ ...f, setupKey: e.target.value }))} />
        <Input label="الاسم الجديد" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <Input label="البريد الإلكتروني الجديد" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        <Input label="كلمة المرور الجديدة" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
        {err && <div style={{ color: C.danger, fontSize: 12, marginBottom: 12 }}>{err}</div>}
        {msg && <div style={{ color: C.success, fontSize: 12, marginBottom: 12 }}>{msg}</div>}
        <Btn variant="danger" disabled={saving} onClick={submit}>{saving ? "جارٍ الإعادة..." : "إعادة التعيين"}</Btn>
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────
export function DashboardClient({ adminName, adminEmail }: { adminName: string; adminEmail: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const NAV: { id: Tab; label: string; icon: string }[] = [
    { id: "overview",    label: "لوحة التحكم", icon: "📊" },
    { id: "companies",   label: "الشركات",      icon: "🏢" },
    { id: "invoices",    label: "الفواتير",      icon: "🧾" },
    { id: "activity",    label: "سجل العمليات",  icon: "📋" },
    { id: "trash",       label: "سلة المهملات",  icon: "🗑️" },
    { id: "profile",     label: "الملف الشخصي",  icon: "👤" },
    { id: "reset_admin", label: "إعادة التعيين",  icon: "🔑" },
  ];

  const TITLES: Record<Tab, string> = {
    overview: "لوحة التحكم", companies: "إدارة الشركات",
    new_company: "شركة جديدة", invoices: "الفواتير",
    activity: "سجل العمليات", trash: "سلة المهملات",
    profile: "الملف الشخصي", reset_admin: "إعادة تعيين المدير",
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, direction: "rtl" }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: C.sidebar, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "24px 20px 16px" }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", marginBottom: 2 }}>BOB SaaS</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>لوحة إدارة النظام</div>
        </div>
        <div style={{ flex: 1, padding: "8px 10px" }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 8, border: "none", cursor: "pointer", marginBottom: 2,
              background: tab === n.id ? "rgba(255,255,255,0.12)" : "transparent",
              color: tab === n.id ? "#fff" : "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: tab === n.id ? 700 : 400,
            }}>
              <span>{n.icon}</span> {n.label}
            </button>
          ))}
        </div>
        <div style={{ padding: "12px 10px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", padding: "4px 12px", marginBottom: 6 }}>
            {adminName}<br /><span style={{ fontSize: 10 }}>{adminEmail}</span>
          </div>
          <button onClick={logout} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "none", background: "rgba(220,38,38,0.15)", color: "#FCA5A5", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
            تسجيل الخروج
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ padding: "24px 28px 12px", borderBottom: `1px solid ${C.border}`, background: C.surface, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 900, fontSize: 20 }}>{TITLES[tab]}</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>{new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
        </div>
        <div style={{ padding: 24 }}>
          {tab === "overview"    && <OverviewTab />}
          {tab === "companies"   && <CompaniesTab onNew={() => setTab("new_company")} />}
          {tab === "new_company" && <NewCompanyTab onDone={() => setTab("companies")} />}
          {tab === "invoices"    && <InvoicesTab />}
          {tab === "activity"    && <ActivityTab />}
          {tab === "trash"       && <TrashTab />}
          {tab === "profile"     && <ProfileTab adminName={adminName} adminEmail={adminEmail} />}
          {tab === "reset_admin" && <ResetAdminTab />}
        </div>
      </div>
    </div>
  );
}
