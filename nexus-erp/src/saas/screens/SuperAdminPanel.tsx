"use client";

import { useState } from "react";
import { SaaSDB } from "../saasDB";
import { Company, PLANS, PlanId, SuperAdmin } from "../types";
import { C, S } from "@/lib/engine/design";
import { User } from "@/lib/db/database";
import { TenantDB } from "../tenantDB";
import { uid, today } from "@/lib/engine/helpers";

interface Props {
  admin: SuperAdmin;
  onLogout: () => void;
  addToast: (msg: string, type?: "success" | "error" | "info") => void;
}

type AdminPage = "dashboard" | "companies" | "subscriptions" | "new_company";

export function SuperAdminPanel({ admin, onLogout, addToast }: Props) {
  const [page, setPage] = useState<AdminPage>("dashboard");
  const [, tick] = useState(0);
  const rerender = () => tick(x => x + 1);

  const stats = SaaSDB.getGlobalStats();
  const db = SaaSDB.get();

  const NAV = [
    { id: "dashboard"    as AdminPage, label: "لوحة التحكم",    icon: "🏠" },
    { id: "companies"    as AdminPage, label: "الشركات",         icon: "🏢" },
    { id: "subscriptions"as AdminPage, label: "الاشتراكات",      icon: "💳" },
    { id: "new_company"  as AdminPage, label: "شركة جديدة",      icon: "➕" },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", direction: "rtl", fontFamily: "'Tajawal', sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: "#0A1628", display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ padding: "20px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>🛡️ BOB ERP Admin</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>Super Admin Panel</div>
        </div>
        <nav style={{ flex: 1, padding: "12px 8px" }}>
          {NAV.map(n => (
            <div key={n.id} onClick={() => setPage(n.id)}
              style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", borderRadius: 7, cursor: "pointer", marginBottom: 2, fontSize: 13, fontWeight: page === n.id ? 700 : 400, color: page === n.id ? "#fff" : "rgba(200,214,229,0.8)", background: page === n.id ? "#1A2744" : "transparent", borderRight: page === n.id ? "3px solid #5DADE2" : "3px solid transparent" }}>
              <span>{n.icon}</span><span>{n.label}</span>
            </div>
          ))}
        </nav>
        <div style={{ padding: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize: 12, color: "rgba(200,214,229,0.7)", marginBottom: 8 }}>{admin.name}</div>
          <button style={{ ...S.btn("ghost"), fontSize: 11, color: "rgba(200,214,229,0.5)", border: "none", padding: "4px 0" }} onClick={onLogout}>🚪 خروج</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, background: C.bg, overflowY: "auto" }}>
        {/* Topbar */}
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 24px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{NAV.find(n => n.id === page)?.label}</div>
          <div style={{ fontSize: 11, color: C.textMuted }}>{new Date().toLocaleDateString("ar-SA")}</div>
        </div>

        <div style={{ padding: 24 }}>
          {page === "dashboard" && <AdminDashboard stats={stats} companies={db.companies} />}
          {page === "companies" && <CompaniesManager companies={db.companies} addToast={addToast} onRefresh={rerender} />}
          {page === "subscriptions" && <SubscriptionsManager companies={db.companies} addToast={addToast} onRefresh={rerender} />}
          {page === "new_company" && <NewCompanyForm addToast={addToast} onCreated={() => { setPage("companies"); rerender(); }} />}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────

function AdminDashboard({ stats, companies }: { stats: ReturnType<typeof SaaSDB.getGlobalStats>; companies: Company[] }) {
  const KPIS = [
    { label: "إجمالي الشركات",   value: stats.totalCompanies,  color: C.accentMid, icon: "🏢" },
    { label: "شركات نشطة",        value: stats.activeCompanies, color: C.success,   icon: "✅" },
    { label: "فترات تجريبية",    value: stats.trialCompanies,  color: C.warning,   icon: "⏳" },
    { label: "اشتراكات منتهية",  value: stats.expiredCompanies,color: C.danger,    icon: "❌" },
    { label: "الإيراد الشهري (MRR)", value: `${stats.mrr.toLocaleString("ar-SA")} ﷼`, color: C.purple, icon: "💰" },
    { label: "الإيراد السنوي (ARR)", value: `${stats.arr.toLocaleString("ar-SA")} ﷼`, color: C.gold,   icon: "📈" },
  ];

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 20 }}>لوحة تحكم المدير العام</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        {KPIS.map(k => (
          <div key={k.label} style={{ background: C.surface, borderRadius: 10, padding: 20, borderTop: `3px solid ${k.color}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{k.value}</div>
            <div style={{ fontSize: 22, opacity: 0.15, position: "absolute" }}>{k.icon}</div>
          </div>
        ))}
      </div>

      {/* Plan distribution */}
      <div style={{ background: C.surface, borderRadius: 10, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>توزيع الخطط</div>
        {(["trial", "starter", "pro", "enterprise"] as PlanId[]).map(planId => {
          const count = companies.filter(c => c.subscription.planId === planId).length;
          const pct   = companies.length > 0 ? Math.round((count / companies.length) * 100) : 0;
          return (
            <div key={planId} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 13 }}>
                <span style={{ fontWeight: 700, color: C.text }}>{PLANS[planId].nameAr}</span>
                <span style={{ color: C.textMuted }}>{count} شركة · {pct}%</span>
              </div>
              <div style={{ background: C.border, borderRadius: 4, height: 6, overflow: "hidden" }}>
                <div style={{ background: C.accentMid, width: `${pct}%`, height: "100%", borderRadius: 4 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent companies */}
      <div style={{ background: C.surface, borderRadius: 10, padding: 20, marginTop: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>آخر الشركات المسجلة</div>
        {companies.slice(-5).reverse().map(co => (
          <div key={co.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
            <div>
              <span style={{ background: PLANS[co.subscription.planId].id === "trial" ? C.warningLight : C.accentLight, color: PLANS[co.subscription.planId].id === "trial" ? C.warning : C.accentMid, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                {PLANS[co.subscription.planId].nameAr}
              </span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700 }}>{co.name}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{co.email}</div>
            </div>
          </div>
        ))}
        {companies.length === 0 && <div style={{ color: C.textMuted, textAlign: "center", padding: 24 }}>لا توجد شركات بعد</div>}
      </div>
    </div>
  );
}

function CompaniesManager({ companies, addToast, onRefresh }: { companies: Company[]; addToast: any; onRefresh: () => void }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Company | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "trial" | "expired" | "suspended">("all");

  const filtered = companies.filter(c => {
    const matchSearch = c.name.includes(search) || c.email.includes(search);
    const matchFilter =
      filter === "all" ? true :
      filter === "active" ? c.status === "active" && c.subscription.status === "active" :
      filter === "trial" ? c.subscription.status === "trial" :
      filter === "expired" ? c.subscription.status === "expired" :
      filter === "suspended" ? c.status === "suspended" : true;
    return matchSearch && matchFilter;
  });

  const handleSuspend = (id: string) => {
    SaaSDB.suspendCompany(id, "تعليق يدوي من المدير");
    addToast("تم تعليق الشركة", "info"); onRefresh();
  };
  const handleActivate = (id: string) => {
    SaaSDB.activateCompany(id);
    addToast("تم تفعيل الشركة", "success"); onRefresh();
  };
  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف شركة "${name}" وجميع بياناتها؟`)) return;
    SaaSDB.deleteCompany(id);
    addToast("تم حذف الشركة نهائياً", "error"); onRefresh(); setSelected(null);
  };

  const statusColor = (s: string) => ({ active: C.success, trial: C.warning, expired: C.danger, suspended: C.danger, cancelled: C.textMuted }[s] || C.textMuted);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <input style={{ ...S.input, flex: 1, minWidth: 220 }} placeholder="بحث بالاسم أو البريد..." value={search} onChange={e => setSearch(e.target.value)} />
        {(["all", "active", "trial", "expired", "suspended"] as const).map(f => (
          <button key={f} style={{ ...S.btn(filter === f ? "primary" : "outline"), padding: "8px 14px", fontSize: 12, border: filter === f ? "none" : undefined }}
            onClick={() => setFilter(f)}>
            {{ all: "الكل", active: "نشط", trial: "تجريبي", expired: "منتهي", suspended: "موقوف" }[f]}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 360px" : "1fr", gap: 20 }}>
        {/* List */}
        <div style={{ background: C.surface, borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <table style={S.table}>
            <thead>
              <tr>
                {["الشركة", "البريد", "الخطة", "الحالة", "الانتهاء", "الأيام المتبقية", "إجراءات"].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ ...S.td, textAlign: "center", padding: 40, color: C.textMuted }}>لا توجد شركات</td></tr>
              ) : filtered.map(co => {
                const daysLeft = Math.max(0, Math.ceil((new Date(co.subscription.endDate).getTime() - Date.now()) / 86400000));
                return (
                  <tr key={co.id} style={{ cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.surfaceAlt)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={S.td}><span style={{ fontWeight: 700, cursor: "pointer", color: C.accent }} onClick={() => setSelected(co)}>{co.name}</span></td>
                    <td style={{ ...S.td, fontSize: 12 }}>{co.email}</td>
                    <td style={S.td}><span style={{ background: C.accentLight, color: C.accentMid, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{PLANS[co.subscription.planId].nameAr}</span></td>
                    <td style={S.td}><span style={{ color: statusColor(co.subscription.status), fontWeight: 700, fontSize: 12 }}>⬤ {co.subscription.status}</span></td>
                    <td style={{ ...S.td, fontSize: 12 }}>{new Date(co.subscription.endDate).toLocaleDateString("ar-SA")}</td>
                    <td style={S.td}><span style={{ color: daysLeft <= 7 ? C.danger : daysLeft <= 30 ? C.warning : C.success, fontWeight: 700 }}>{daysLeft} يوم</span></td>
                    <td style={S.td}>
                      {co.status === "active"
                        ? <button style={{ ...S.btn("outline"), fontSize: 11, padding: "4px 10px", color: C.warning, borderColor: C.warning }} onClick={() => handleSuspend(co.id)}>تعليق</button>
                        : <button style={{ ...S.btn("outline"), fontSize: 11, padding: "4px 10px", color: C.success, borderColor: C.success }} onClick={() => handleActivate(co.id)}>تفعيل</button>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ background: C.surface, borderRadius: 10, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", height: "fit-content" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <button style={{ ...S.btn("ghost"), fontSize: 18, border: "none", padding: "0 4px" }} onClick={() => setSelected(null)}>×</button>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{selected.name}</div>
            </div>
            {[
              ["الكود", selected.id],
              ["البريد", selected.email],
              ["الهاتف", selected.phone || "—"],
              ["الدولة", selected.country],
              ["الخطة", PLANS[selected.subscription.planId].nameAr],
              ["الحالة", selected.subscription.status],
              ["بداية الاشتراك", new Date(selected.subscription.startDate).toLocaleDateString("ar-SA")],
              ["نهاية الاشتراك", new Date(selected.subscription.endDate).toLocaleDateString("ar-SA")],
              ["الفواتير", selected.usageStats.totalInvoices],
              ["المنتجات", selected.usageStats.totalProducts],
              ["المستخدمون", selected.usageStats.totalUsers],
              ["آخر نشاط", new Date(selected.usageStats.lastActivity).toLocaleDateString("ar-SA")],
            ].map(([k, v]) => (
              <div key={k as string} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                <span style={{ color: C.text, fontWeight: 600 }}>{v as string}</span>
                <span style={{ color: C.textMuted }}>{k as string}</span>
              </div>
            ))}
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {selected.status === "active"
                ? <button style={{ ...S.btn("outline"), color: C.warning, borderColor: C.warning, fontSize: 12 }} onClick={() => { handleSuspend(selected.id); setSelected(null); }}>⏸ تعليق الشركة</button>
                : <button style={{ ...S.btn("outline"), color: C.success, borderColor: C.success, fontSize: 12 }} onClick={() => { handleActivate(selected.id); setSelected(null); }}>▶ تفعيل الشركة</button>
              }
              <button style={{ ...S.btn("danger"), fontSize: 12, border: "none" }} onClick={() => handleDelete(selected.id, selected.name)}>🗑 حذف نهائي</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SubscriptionsManager({ companies, addToast, onRefresh }: { companies: Company[]; addToast: any; onRefresh: () => void }) {
  const [companyId, setCompanyId] = useState("");
  const [planId, setPlanId]       = useState<PlanId>("pro");
  const [cycle, setCycle]         = useState<"monthly" | "yearly">("monthly");
  const [amount, setAmount]       = useState("");
  const [extraDays, setExtraDays] = useState("7");

  const handleRenew = () => {
    if (!companyId) { addToast("اختر شركة أولاً", "error"); return; }
    SaaSDB.renewSubscription(companyId, planId, cycle, +amount || 0);
    addToast("تم تجديد الاشتراك بنجاح ✅", "success"); onRefresh();
  };
  const handleExtendTrial = () => {
    if (!companyId) { addToast("اختر شركة أولاً", "error"); return; }
    SaaSDB.extendTrial(companyId, +extraDays || 7);
    addToast(`تم تمديد التجربة ${extraDays} أيام إضافية`, "success"); onRefresh();
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      {/* Renew / Upgrade */}
      <div style={{ background: C.surface, borderRadius: 10, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 20 }}>تجديد أو ترقية اشتراك</div>
        {[
          { l: "اختر الشركة", node: <select style={S.select} value={companyId} onChange={e => setCompanyId(e.target.value)}><option value="">اختر...</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select> },
          { l: "الخطة الجديدة", node: <select style={S.select} value={planId} onChange={e => setPlanId(e.target.value as PlanId)}>{(["starter","pro","enterprise"] as PlanId[]).map(p => <option key={p} value={p}>{PLANS[p].nameAr} — {PLANS[p].priceMonthly} ريال/شهر</option>)}</select> },
          { l: "دورة الفوترة", node: <select style={S.select} value={cycle} onChange={e => setCycle(e.target.value as any)}><option value="monthly">شهري</option><option value="yearly">سنوي</option></select> },
          { l: "المبلغ المدفوع (ريال)", node: <input style={S.input} type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /> },
        ].map(({ l, node }) => (
          <div key={l} style={S.formGroup}><label style={S.label}>{l}</label>{node}</div>
        ))}
        <button style={{ ...S.btn("primary"), width: "100%", border: "none" }} onClick={handleRenew}>✅ تجديد الاشتراك</button>
      </div>

      {/* Extend Trial */}
      <div style={{ background: C.surface, borderRadius: 10, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 20 }}>تمديد فترة التجربة</div>
        <div style={S.formGroup}>
          <label style={S.label}>اختر الشركة</label>
          <select style={S.select} value={companyId} onChange={e => setCompanyId(e.target.value)}>
            <option value="">اختر...</option>
            {companies.filter(c => c.subscription.status === "trial").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={S.formGroup}>
          <label style={S.label}>عدد الأيام الإضافية</label>
          <input style={S.input} type="number" value={extraDays} onChange={e => setExtraDays(e.target.value)} />
        </div>
        <button style={{ ...S.btn("primary"), width: "100%", border: "none", background: C.warning }} onClick={handleExtendTrial}>⏳ تمديد التجربة</button>

        {/* All subscriptions list */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>جميع الاشتراكات</div>
          {companies.slice(0, 8).map(co => {
            const daysLeft = Math.max(0, Math.ceil((new Date(co.subscription.endDate).getTime() - Date.now()) / 86400000));
            return (
              <div key={co.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                <span style={{ color: daysLeft <= 7 ? C.danger : C.success, fontWeight: 700 }}>{daysLeft} يوم</span>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontWeight: 700 }}>{co.name}</span>
                  <span style={{ color: C.textMuted, marginRight: 8 }}>{PLANS[co.subscription.planId].nameAr}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NewCompanyForm({ addToast, onCreated }: { addToast: any; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    country: "SA",
    planId: "trial" as PlanId,
    trialDays: "14",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
  });
  const [error, setError] = useState("");

  const handle = () => {
    if (!form.name || !form.email || !form.adminName || !form.adminEmail || !form.adminPassword) {
      setError("الرجاء تعبئة بيانات الشركة ومعلومات المسؤول بالكامل");
      return;
    }
    if (form.adminPassword.length < 6) {
      setError("كلمة مرور المسؤول يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    try {
      const company = SaaSDB.createCompany({ ...form, trialDays: +form.trialDays });
      const db = TenantDB.load(company.id);
      db.settings.companyName = form.name;
      const user: User = {
        id: uid(),
        name: form.adminName,
        email: form.adminEmail,
        password: form.adminPassword,
        role: "admin",
        status: "active",
        companyId: company.id,
        lastLogin: new Date().toISOString(),
        createdAt: today(),
      };
      db.users.push(user);
      db.activityLog.unshift({ id: uid(), timestamp: new Date().toLocaleString("ar-SA"), userId: user.id, user: user.name, action: "CREATE", module: "Auth", description: "Created initial tenant admin" });
      TenantDB.save();
      addToast(`تم إنشاء شركة "${form.name}" والمشرف الأول بنجاح ✅`, "success");
      onCreated();
    } catch (e: any) { setError(e.message); }
  };

  return (
    <div style={{ background: C.surface, borderRadius: 10, padding: 28, maxWidth: 520, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 22 }}>إضافة شركة جديدة يدوياً</div>
      {[
        { k: "name", l: "اسم الشركة *", t: "text" },
        { k: "email", l: "البريد الإلكتروني *", t: "email" },
        { k: "phone", l: "الهاتف", t: "tel" },
        { k: "country", l: "الدولة", t: "text" },
      ].map(({ k, l, t }) => (
        <div key={k} style={S.formGroup}>
          <label style={S.label}>{l}</label>
          <input style={S.input} type={t} value={(form as any)[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} placeholder={l.replace(" *", "")} />
        </div>
      ))}

      <div style={{ marginTop: 20, padding: 16, background: C.surfaceAlt, borderRadius: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>بيانات مسؤول الشركة الأول</div>
        {[
          { k: "adminName", l: "اسم المسؤول *", t: "text" },
          { k: "adminEmail", l: "البريد الإلكتروني للمسؤول *", t: "email" },
          { k: "adminPassword", l: "كلمة مرور المسؤول *", t: "password" },
        ].map(({ k, l, t }) => (
          <div key={k} style={S.formGroup}>
            <label style={S.label}>{l}</label>
            <input style={S.input} type={t} value={(form as any)[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} placeholder={l.replace(" *", "")} />
          </div>
        ))}
      </div>
      <div style={S.formGroup}>
        <label style={S.label}>الخطة</label>
        <select style={S.select} value={form.planId} onChange={e => setForm({ ...form, planId: e.target.value as PlanId })}>
          {(["trial","starter","pro","enterprise"] as PlanId[]).map(p => <option key={p} value={p}>{PLANS[p].nameAr}</option>)}
        </select>
      </div>
      <div style={S.formGroup}>
        <label style={S.label}>أيام التجربة (للخطة التجريبية)</label>
        <input style={S.input} type="number" value={form.trialDays} onChange={e => setForm({ ...form, trialDays: e.target.value })} />
      </div>
      {error && <div style={{ color: C.danger, fontSize: 12, marginBottom: 12 }}>{error}</div>}
      <button style={{ ...S.btn("primary"), border: "none", padding: "10px 28px" }} onClick={handle}>إنشاء الشركة</button>
    </div>
  );
}
