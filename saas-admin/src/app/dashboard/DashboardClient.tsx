"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Company, PLANS, PlanId } from "@/lib/types";

type Tab = "overview" | "companies" | "new_company" | "profile";

const C = {
  sidebar: "#0F172A", sidebarBorder: "rgba(255,255,255,0.07)",
  accent: "#1D4ED8", accentLight: "#DBEAFE", accentMid: "#2563EB",
  success: "#059669", successLight: "#D1FAE5",
  warning: "#D97706", warningLight: "#FEF3C7",
  danger: "#DC2626", dangerLight: "#FEF2F2",
  purple: "#7C3AED", purpleLight: "#EDE9FE",
  surface: "#FFFFFF", bg: "#F1F5F9", border: "#E2E8F0",
  text: "#0F172A", textSec: "#475569", textMuted: "#94A3B8",
};

// ── Utility ────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function daysLeft(endDate: string) {
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, color, background: bg }}>
      {label}
    </span>
  );
}

function planBadge(planId: PlanId) {
  const map: Record<PlanId, { color: string; bg: string }> = {
    trial:      { color: C.warning,    bg: C.warningLight },
    starter:    { color: C.accentMid,  bg: C.accentLight },
    pro:        { color: C.purple,     bg: C.purpleLight },
    enterprise: { color: C.success,    bg: C.successLight },
  };
  return <Badge label={PLANS[planId].nameAr} {...map[planId]} />;
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    active:    { label: "نشط",     color: C.success,  bg: C.successLight },
    trial:     { label: "تجريبي",  color: C.warning,  bg: C.warningLight },
    expired:   { label: "منتهي",   color: C.danger,   bg: C.dangerLight },
    suspended: { label: "موقوف",   color: C.danger,   bg: C.dangerLight },
    cancelled: { label: "ملغي",    color: C.textMuted, bg: C.bg },
  };
  const s = map[status] ?? map["active"];
  return <Badge label={s.label} color={s.color} bg={s.bg} />;
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{ background: C.dangerLight, border: `1px solid #FECACA`, borderRadius: 8, padding: "10px 14px", color: C.danger, fontSize: 12.5, marginBottom: 16 }}>
      {msg}
    </div>
  );
}

function SuccessBox({ msg }: { msg: string }) {
  return (
    <div style={{ background: C.successLight, border: `1px solid #A7F3D0`, borderRadius: 8, padding: "10px 14px", color: C.success, fontSize: 12.5, marginBottom: 16 }}>
      ✓ {msg}
    </div>
  );
}

// ── Input / Select helpers ────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 8,
  border: `1.5px solid ${C.border}`, fontSize: 13.5, color: C.text,
  outline: "none", background: "#F8FAFC",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.textSec, marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", disabled, full, small }: {
  children: React.ReactNode; onClick?: () => void;
  variant?: "primary" | "danger" | "ghost" | "outline" | "success" | "warning";
  disabled?: boolean; full?: boolean; small?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary:  { background: C.accentMid, color: "#fff" },
    danger:   { background: C.danger,    color: "#fff" },
    success:  { background: C.success,   color: "#fff" },
    warning:  { background: C.warning,   color: "#fff" },
    ghost:    { background: "transparent", color: C.textSec, border: `1px solid ${C.border}` },
    outline:  { background: "transparent", color: C.accentMid, border: `1px solid ${C.accentMid}` },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...styles[variant],
      padding: small ? "5px 12px" : "9px 18px",
      borderRadius: 8, border: "none", fontSize: small ? 12 : 13.5,
      fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.6 : 1,
      width: full ? "100%" : undefined,
      fontFamily: "'Tajawal', sans-serif",
    }}>{children}</button>
  );
}

// ── Main component ────────────────────────────────────────────

export function DashboardClient({ adminName, adminEmail }: { adminName: string; adminEmail: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const NAV: { id: Tab; label: string; icon: string }[] = [
    { id: "overview",     label: "لوحة التحكم",  icon: "📊" },
    { id: "companies",    label: "الشركات",       icon: "🏢" },
    { id: "new_company",  label: "شركة جديدة",    icon: "➕" },
    { id: "profile",      label: "إعدادات حسابي", icon: "⚙️" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", direction: "rtl" }}>
      {/* Sidebar */}
      <div style={{
        width: 220, background: C.sidebar, display: "flex", flexDirection: "column",
        flexShrink: 0, position: "sticky", top: 0, height: "100vh",
      }}>
        <div style={{ padding: "22px 18px", borderBottom: `1px solid ${C.sidebarBorder}` }}>
          <div style={{ fontSize: 14.5, fontWeight: 900, color: "#fff", letterSpacing: "-0.01em" }}>🛡️ BOB Admin</div>
          <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>SaaS Control Panel</div>
        </div>

        <nav style={{ flex: 1, padding: "10px 8px" }}>
          {NAV.map(n => (
            <div key={n.id} onClick={() => setTab(n.id)} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 2,
              fontSize: 13, fontWeight: tab === n.id ? 700 : 400,
              color: tab === n.id ? "#fff" : "rgba(203,213,225,0.75)",
              background: tab === n.id ? "rgba(255,255,255,0.08)" : "transparent",
              borderRight: `3px solid ${tab === n.id ? "#60A5FA" : "transparent"}`,
              transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 15 }}>{n.icon}</span>
              <span>{n.label}</span>
            </div>
          ))}
        </nav>

        <div style={{ padding: "14px 16px", borderTop: `1px solid ${C.sidebarBorder}` }}>
          <div style={{ fontSize: 12.5, color: "rgba(203,213,225,0.8)", fontWeight: 700, marginBottom: 2 }}>{adminName}</div>
          <div style={{ fontSize: 10.5, color: "rgba(203,213,225,0.4)", marginBottom: 10, wordBreak: "break-all" }}>{adminEmail}</div>
          <button onClick={logout} style={{
            background: "none", border: "none", color: "rgba(203,213,225,0.45)",
            fontSize: 12, cursor: "pointer", fontFamily: "'Tajawal', sans-serif", padding: 0,
          }}>← خروج</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, background: C.bg, overflowY: "auto" }}>
        {/* Topbar */}
        <div style={{
          background: C.surface, borderBottom: `1px solid ${C.border}`,
          padding: "0 28px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, zIndex: 10,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>
            {NAV.find(n => n.id === tab)?.label}
          </div>
          <div style={{ fontSize: 11.5, color: C.textMuted }}>
            {new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>

        <div className="fade-in" style={{ padding: 28 }} key={tab}>
          {tab === "overview"    && <OverviewTab />}
          {tab === "companies"   && <CompaniesTab />}
          {tab === "new_company" && <NewCompanyTab onCreated={() => setTab("companies")} />}
          {tab === "profile"     && <ProfileTab currentEmail={adminEmail} />}
        </div>
      </div>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────

function OverviewTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats").then(r => r.json()).then(d => { setStats(d); setLoading(false); });
  }, []);

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: C.textMuted }}>جارٍ التحميل...</div>;
  if (!stats)  return <ErrorBox msg="فشل تحميل البيانات" />;

  const KPIS = [
    { label: "إجمالي الشركات",    value: fmt(stats.total),    color: C.accentMid, icon: "🏢" },
    { label: "شركات نشطة",        value: fmt(stats.active),   color: C.success,   icon: "✅" },
    { label: "فترات تجريبية",     value: fmt(stats.trial),    color: C.warning,   icon: "⏳" },
    { label: "اشتراكات منتهية",   value: fmt(stats.expired),  color: C.danger,    icon: "❌" },
    { label: "إيراد شهري (MRR)",  value: `${fmt(stats.mrr)} ريال`, color: C.purple, icon: "💰" },
    { label: "إيراد سنوي (ARR)",  value: `${fmt(stats.arr)} ريال`, color: "#059669", icon: "📈" },
  ];

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        {KPIS.map(k => (
          <div key={k.label} style={{
            background: C.surface, borderRadius: 12, padding: "20px 22px",
            borderTop: `3px solid ${k.color}`,
            boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          }}>
            <div style={{ fontSize: 11.5, color: C.textMuted, marginBottom: 8, fontWeight: 600 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: C.text }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Plan distribution */}
        <div style={{ background: C.surface, borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 18, color: C.text }}>توزيع الخطط</div>
          {stats.planDist.map((p: any) => {
            const pct = stats.total > 0 ? Math.round((p.count / stats.total) * 100) : 0;
            return (
              <div key={p.plan} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12.5 }}>
                  <span style={{ color: C.textSec }}>{p.count} شركة · {pct}%</span>
                  <span style={{ fontWeight: 700, color: C.text }}>{(PLANS as any)[p.plan]?.nameAr ?? p.plan}</span>
                </div>
                <div style={{ background: C.border, borderRadius: 4, height: 6 }}>
                  <div style={{ background: C.accentMid, width: `${pct}%`, height: "100%", borderRadius: 4, transition: "width 0.5s ease" }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Expiring soon */}
        <div style={{ background: C.surface, borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 18, color: C.text }}>
            تنتهي خلال 7 أيام
            {stats.expiringSoon.length > 0 && (
              <span style={{ marginRight: 8, background: C.dangerLight, color: C.danger, fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>
                {stats.expiringSoon.length}
              </span>
            )}
          </div>
          {stats.expiringSoon.length === 0 ? (
            <div style={{ color: C.textMuted, fontSize: 13, textAlign: "center", padding: "20px 0" }}>لا توجد اشتراكات على وشك الانتهاء</div>
          ) : stats.expiringSoon.map((c: any) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12.5 }}>
              <span style={{ color: c.daysLeft <= 3 ? C.danger : C.warning, fontWeight: 800 }}>{c.daysLeft} أيام</span>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{c.email}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent */}
      <div style={{ background: C.surface, borderRadius: 12, padding: 22, marginTop: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 18, color: C.text }}>آخر الشركات المسجلة</div>
        {stats.recent.map((c: any) => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {planBadge(c.plan)}
              {statusBadge(c.status)}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{c.email}</div>
            </div>
          </div>
        ))}
        {stats.recent.length === 0 && <div style={{ color: C.textMuted, textAlign: "center", padding: 20 }}>لا توجد شركات بعد</div>}
      </div>
    </div>
  );
}

// ── Companies ─────────────────────────────────────────────────

function CompaniesTab() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [filter, setFilter]       = useState("all");
  const [selected, setSelected]   = useState<Company | null>(null);
  const [msg, setMsg]             = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Renew form state
  const [renewPlan, setRenewPlan]   = useState<PlanId>("pro");
  const [renewCycle, setRenewCycle] = useState<"monthly" | "yearly">("monthly");
  const [renewAmt, setRenewAmt]     = useState("");
  const [extDays, setExtDays]       = useState("7");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/companies?q=${encodeURIComponent(search)}&status=${filter}`);
    const data = await res.json();
    setCompanies(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [search, filter]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (id: string, body: object) => {
    setActionLoading(true); setMsg(null);
    try {
      const res = await fetch(`/api/companies/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: "error", text: data.error }); return; }
      setMsg({ type: "success", text: "تم تحديث بيانات الشركة بنجاح" });
      await load();
      if (selected?.id === id) setSelected(data.company);
    } catch { setMsg({ type: "error", text: "خطأ في الاتصال" }); }
    finally { setActionLoading(false); }
  };

  const doDelete = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف شركة "${name}" وجميع بياناتها نهائياً؟`)) return;
    setActionLoading(true); setMsg(null);
    try {
      const res = await fetch(`/api/companies/${id}`, { method: "DELETE" });
      if (!res.ok) { setMsg({ type: "error", text: "فشل الحذف" }); return; }
      setMsg({ type: "success", text: `تم حذف شركة "${name}" نهائياً` });
      setSelected(null); await load();
    } catch { setMsg({ type: "error", text: "خطأ في الاتصال" }); }
    finally { setActionLoading(false); }
  };

  const FILTERS = [
    { id: "all", label: "الكل" }, { id: "active", label: "نشط" },
    { id: "trial", label: "تجريبي" }, { id: "expired", label: "منتهي" },
    { id: "suspended", label: "موقوف" },
  ];

  return (
    <div>
      {msg && (msg.type === "success" ? <SuccessBox msg={msg.text} /> : <ErrorBox msg={msg.text} />)}

      {/* Search & filter */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <input style={{ ...inputStyle, flex: 1, minWidth: 220 }}
          placeholder="بحث بالاسم أو البريد..." value={search}
          onChange={e => setSearch(e.target.value)} />
        <div style={{ display: "flex", gap: 6 }}>
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${filter === f.id ? C.accentMid : C.border}`,
              background: filter === f.id ? C.accentMid : C.surface,
              color: filter === f.id ? "#fff" : C.textSec,
              fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Tajawal', sans-serif",
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 360px" : "1fr", gap: 20 }}>
        {/* Table */}
        <div style={{ background: C.surface, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 48, color: C.textMuted }}>جارٍ التحميل...</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.border}`, background: C.bg }}>
                    {["الشركة", "البريد", "الخطة", "الحالة", "الأيام المتبقية", "إجراءات"].map(h => (
                      <th key={h} style={{ padding: "11px 14px", textAlign: "right", fontWeight: 700, fontSize: 12, color: C.textSec }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {companies.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: C.textMuted }}>لا توجد شركات</td></tr>
                  ) : companies.map((co, i) => {
                    const dl = daysLeft(co.subscription.endDate);
                    return (
                      <tr key={co.id} style={{ borderBottom: `1px solid ${C.border}`, background: selected?.id === co.id ? C.accentLight : i % 2 === 0 ? "#fff" : C.bg }}>
                        <td style={{ padding: "11px 14px" }}>
                          <button onClick={() => setSelected(selected?.id === co.id ? null : co)} style={{
                            background: "none", border: "none", fontWeight: 700, color: C.accentMid,
                            cursor: "pointer", fontSize: 13, fontFamily: "'Tajawal', sans-serif",
                          }}>{co.name}</button>
                        </td>
                        <td style={{ padding: "11px 14px", color: C.textSec, fontSize: 12 }}>{co.email}</td>
                        <td style={{ padding: "11px 14px" }}>{planBadge(co.subscription.planId)}</td>
                        <td style={{ padding: "11px 14px" }}>{statusBadge(co.subscription.status)}</td>
                        <td style={{ padding: "11px 14px" }}>
                          <span style={{ fontWeight: 700, color: dl <= 3 ? C.danger : dl <= 14 ? C.warning : C.success }}>
                            {dl > 0 ? `${dl} يوم` : "منتهي"}
                          </span>
                        </td>
                        <td style={{ padding: "11px 14px" }}>
                          {co.status === "active"
                            ? <Btn small variant="ghost" onClick={() => doAction(co.id, { action: "suspend" })}>تعليق</Btn>
                            : <Btn small variant="success" onClick={() => doAction(co.id, { action: "activate" })}>تفعيل</Btn>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ background: C.surface, borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", height: "fit-content" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: C.textMuted }}>×</button>
              <div style={{ fontWeight: 800, fontSize: 14.5, color: C.text }}>{selected.name}</div>
            </div>

            {[
              ["البريد الإلكتروني", selected.email],
              ["الهاتف", selected.phone || "—"],
              ["الدولة", selected.country],
              ["الخطة", PLANS[selected.subscription.planId].nameAr],
              ["حالة الاشتراك", selected.subscription.status],
              ["بداية الاشتراك", new Date(selected.subscription.startDate).toLocaleDateString("ar-SA")],
              ["نهاية الاشتراك", new Date(selected.subscription.endDate).toLocaleDateString("ar-SA")],
              ["الأيام المتبقية", `${Math.max(0, daysLeft(selected.subscription.endDate))} يوم`],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12.5 }}>
                <span style={{ fontWeight: 600, color: C.text }}>{v}</span>
                <span style={{ color: C.textMuted }}>{k}</span>
              </div>
            ))}

            {/* Renew */}
            <div style={{ marginTop: 18, padding: 14, background: C.bg, borderRadius: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 12, color: C.text }}>تجديد الاشتراك</div>
              <Field label="الخطة">
                <select style={{ ...inputStyle, padding: "8px 12px" }} value={renewPlan} onChange={e => setRenewPlan(e.target.value as PlanId)}>
                  {(["starter", "pro", "enterprise"] as PlanId[]).map(p => (
                    <option key={p} value={p}>{PLANS[p].nameAr} — {PLANS[p].priceMonthly} ريال/شهر</option>
                  ))}
                </select>
              </Field>
              <Field label="دورة الفوترة">
                <select style={{ ...inputStyle, padding: "8px 12px" }} value={renewCycle} onChange={e => setRenewCycle(e.target.value as any)}>
                  <option value="monthly">شهري</option>
                  <option value="yearly">سنوي</option>
                </select>
              </Field>
              <Field label="المبلغ المدفوع (ريال)">
                <input style={inputStyle} type="number" value={renewAmt} onChange={e => setRenewAmt(e.target.value)} placeholder="0" />
              </Field>
              <Btn full disabled={actionLoading} onClick={() => doAction(selected.id, { action: "renew", planId: renewPlan, billingCycle: renewCycle, amount: +renewAmt || 0 })}>
                ✅ تجديد الاشتراك
              </Btn>
            </div>

            {/* Extend trial */}
            {(selected.subscription.status === "trial" || selected.subscription.status === "expired") && (
              <div style={{ marginTop: 12, padding: 14, background: C.warningLight, borderRadius: 10 }}>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10, color: C.text }}>تمديد الفترة التجريبية</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input style={{ ...inputStyle, width: 80 }} type="number" value={extDays} onChange={e => setExtDays(e.target.value)} />
                  <Btn variant="warning" disabled={actionLoading} onClick={() => doAction(selected.id, { action: "extend_trial", days: +extDays || 7 })}>
                    ⏳ تمديد {extDays} أيام
                  </Btn>
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              {selected.status === "active"
                ? <Btn full variant="ghost" disabled={actionLoading} onClick={() => doAction(selected.id, { action: "suspend" })}>⏸ تعليق الشركة</Btn>
                : <Btn full variant="success" disabled={actionLoading} onClick={() => doAction(selected.id, { action: "activate" })}>▶ تفعيل الشركة</Btn>
              }
              <Btn full variant="danger" disabled={actionLoading} onClick={() => doDelete(selected.id, selected.name)}>
                🗑 حذف نهائي
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── New Company ────────────────────────────────────────────────

function NewCompanyTab({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", country: "SA",
    planId: "trial" as PlanId, trialDays: "14",
    adminName: "", adminEmail: "", adminPassword: "",
  });
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handle = async () => {
    setError(""); setSuccess("");
    if (!form.name || !form.email || !form.adminName || !form.adminEmail || !form.adminPassword) {
      setError("الرجاء تعبئة جميع الحقول الإلزامية"); return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/companies", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, trialDays: +form.trialDays }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "حدث خطأ"); return; }
      setSuccess(`تم إنشاء شركة "${form.name}" بنجاح ✅`);
      setTimeout(onCreated, 1500);
    } catch { setError("تعذّر الاتصال بالخادم"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ background: C.surface, borderRadius: 12, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 20, color: C.text }}>بيانات الشركة</div>
        <Field label="اسم الشركة *"><input style={inputStyle} value={form.name} onChange={set("name")} placeholder="اسم الشركة" /></Field>
        <Field label="البريد الإلكتروني للشركة *"><input style={inputStyle} type="email" value={form.email} onChange={set("email")} placeholder="company@domain.com" /></Field>
        <Field label="رقم الهاتف"><input style={inputStyle} type="tel" value={form.phone} onChange={set("phone")} placeholder="+966 5x xxx xxxx" /></Field>
        <Field label="الدولة">
          <select style={{ ...inputStyle, padding: "9px 12px" }} value={form.country} onChange={set("country")}>
            <option value="SA">المملكة العربية السعودية</option>
            <option value="AE">الإمارات</option>
            <option value="KW">الكويت</option>
            <option value="QA">قطر</option>
            <option value="BH">البحرين</option>
            <option value="OM">عُمان</option>
            <option value="EG">مصر</option>
            <option value="JO">الأردن</option>
          </select>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="الخطة">
            <select style={{ ...inputStyle, padding: "9px 12px" }} value={form.planId} onChange={set("planId")}>
              {(["trial", "starter", "pro", "enterprise"] as PlanId[]).map(p => (
                <option key={p} value={p}>{PLANS[p].nameAr}</option>
              ))}
            </select>
          </Field>
          {form.planId === "trial" && (
            <Field label="أيام التجربة">
              <input style={inputStyle} type="number" value={form.trialDays} onChange={set("trialDays")} />
            </Field>
          )}
        </div>
      </div>

      <div style={{ background: C.surface, borderRadius: 12, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 20, color: C.text }}>بيانات مسؤول الشركة الأول</div>
        <Field label="الاسم الكامل *"><input style={inputStyle} value={form.adminName} onChange={set("adminName")} placeholder="اسم المسؤول" /></Field>
        <Field label="البريد الإلكتروني للمسؤول *"><input style={inputStyle} type="email" value={form.adminEmail} onChange={set("adminEmail")} placeholder="admin@company.com" /></Field>
        <Field label="كلمة المرور *"><input style={inputStyle} type="password" value={form.adminPassword} onChange={set("adminPassword")} placeholder="6 أحرف على الأقل" /></Field>
        <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: -8, marginBottom: 8 }}>
          ⚠️ هذا الإيميل وكلمة المرور منفصلان تماماً عن إيميل المدير العام لهذه الأداة
        </div>
      </div>

      {error   && <ErrorBox msg={error} />}
      {success && <SuccessBox msg={success} />}

      <Btn full disabled={loading} onClick={handle}>
        {loading ? "جارٍ الإنشاء..." : "➕ إنشاء الشركة"}
      </Btn>
    </div>
  );
}

// ── Profile ────────────────────────────────────────────────────

function ProfileTab({ currentEmail }: { currentEmail: string }) {
  const [email, setEmail]         = useState(currentEmail);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw]         = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");
  const [loading, setLoading]     = useState(false);

  const handle = async () => {
    setError(""); setSuccess("");
    if (!currentPw) { setError("أدخل كلمة المرور الحالية"); return; }
    if (newPw && newPw.length < 8) { setError("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل"); return; }
    if (newPw && newPw !== confirmPw) { setError("كلمتا المرور غير متطابقتان"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, currentPassword: currentPw, newPassword: newPw || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "حدث خطأ"); return; }
      setSuccess("تم تحديث البيانات بنجاح");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch { setError("تعذّر الاتصال بالخادم"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 460 }}>
      <div style={{ background: C.surface, borderRadius: 12, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 20, color: C.text }}>البريد الإلكتروني</div>
        <Field label="الإيميل الجديد">
          <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </Field>
      </div>

      <div style={{ background: C.surface, borderRadius: 12, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 20, color: C.text }}>كلمة المرور</div>
        <Field label="كلمة المرور الحالية *">
          <input style={inputStyle} type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="••••••••" />
        </Field>
        <Field label="كلمة المرور الجديدة (اختياري)">
          <input style={inputStyle} type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="8 أحرف على الأقل" />
        </Field>
        {newPw && (
          <Field label="تأكيد كلمة المرور الجديدة">
            <input style={inputStyle} type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="أعد كتابة كلمة المرور" />
          </Field>
        )}
      </div>

      {error   && <ErrorBox msg={error} />}
      {success && <SuccessBox msg={success} />}

      <Btn full disabled={loading} onClick={handle}>
        {loading ? "جارٍ الحفظ..." : "حفظ التغييرات"}
      </Btn>
    </div>
  );
}
