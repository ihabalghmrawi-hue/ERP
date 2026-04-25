"use client";

import { useState, useMemo } from "react";
import { S, C } from "@/lib/engine/design";
import { DB, POSSession, Invoice } from "@/lib/db/database";
import { fmt, fmtDate } from "@/lib/engine/helpers";
import { KPI } from "@/components/ui/KPI";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DaySummary {
  date: string;
  sessions: POSSession[];
  invoiceCount: number;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  openingBalance: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
  hasDiff: boolean;
  cashiers: string[];
}

interface MonthlySummary {
  month: string; // "YYYY-MM"
  monthLabel: string;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  invoiceCount: number;
  sessionCount: number;
  daysWithDiff: number;
  topCashier: string;
  topCashierSales: number;
}

// ─── Bar chart (SVG inline) ───────────────────────────────────────────────────
function BarChart({ data, color = C.accent, label }: {
  data: { key: string; value: number }[];
  color?: string;
  label: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const H = 80;
  const barW = Math.max(14, Math.floor(340 / (data.length || 1)) - 4);

  return (
    <div style={{ background: C.surface, borderRadius: 12, padding: "16px 18px", border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, marginBottom: 10 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: H + 20, overflowX: "auto" }}>
        {data.map((d) => {
          const h = Math.round((d.value / max) * H);
          return (
            <div key={d.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0 }}>
              <div title={`${d.key}: ${fmt(d.value)}`} style={{
                width: barW, height: h || 2,
                background: color, borderRadius: "4px 4px 0 0",
                transition: "height 0.3s",
              }} />
              <div style={{ fontSize: 8, color: C.textMuted, transform: "rotate(-30deg)", whiteSpace: "nowrap" }}>
                {d.key.slice(5)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Donut (Cash vs Card) ─────────────────────────────────────────────────────
function DonutChart({ cash, card }: { cash: number; card: number }) {
  const total = cash + card || 1;
  const cashPct = (cash / total) * 100;
  const cardPct = 100 - cashPct;
  const r = 36; const cx = 50; const cy = 50;
  const circ = 2 * Math.PI * r;
  const cashDash = (cashPct / 100) * circ;

  return (
    <div style={{ background: C.surface, borderRadius: 12, padding: "16px 18px", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 20 }}>
      <svg width={100} height={100} viewBox="0 0 100 100">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={16} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.success} strokeWidth={16}
          strokeDasharray={`${cashDash} ${circ - cashDash}`}
          strokeDashoffset={circ / 4} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.accent} strokeWidth={16}
          strokeDasharray={`${circ - cashDash} ${cashDash}`}
          strokeDashoffset={circ / 4 - cashDash} strokeLinecap="round" />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={C.text}>
          {Math.round(cashPct)}%
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 12 }}>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: C.success, marginLeft: 6 }} />
          <span style={{ color: C.textSec }}>نقدي: </span>
          <span style={{ fontWeight: 700 }}>{fmt(cash)}</span>
        </div>
        <div style={{ fontSize: 12 }}>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: C.accent, marginLeft: 6 }} />
          <span style={{ color: C.textSec }}>آجل/بطاقة: </span>
          <span style={{ fontWeight: 700 }}>{fmt(card)}</span>
        </div>
        <div style={{ fontSize: 11, color: C.textMuted }}>
          إجمالي: {fmt(cash + card)}
        </div>
      </div>
    </div>
  );
}

// ─── Diff Badge ───────────────────────────────────────────────────────────────
function DiffBadge({ diff }: { diff: number }) {
  if (Math.abs(diff) < 0.005) return <span style={S.badge("success")}>✓ متوازن</span>;
  if (diff < 0) return <span style={S.badge("warning")}>عجز {fmt(Math.abs(diff))}</span>;
  return <span style={S.badge("info")}>زيادة {fmt(diff)}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function CashierReports() {
  const db = DB.get();

  // ── Filters ────────────────────────────────────────────────────────────────
  const [view, setView]         = useState<"daily" | "monthly">("daily");
  const [userId, setUserId]     = useState("all");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate]   = useState(new Date().toISOString().slice(0, 10));
  const [page, setPage]       = useState(1);
  const PER_PAGE = 15;

  // ── Drill-down state ────────────────────────────────────────────────────────
  const [drillDay, setDrillDay]         = useState<DaySummary | null>(null);
  const [drillSession, setDrillSession] = useState<POSSession | null>(null);

  // ── Cashier list ────────────────────────────────────────────────────────────
  const cashierOptions = useMemo(() => {
    const seen = new Map<string, string>();
    db.posSessions.forEach((s) => seen.set(s.userId, s.userName));
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [db.posSessions]);

  // ── Closed sessions in range ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return db.posSessions.filter((s) => {
      if (s.status !== "closed") return false;
      const d = (s.closedAt || s.openedAt).slice(0, 10);
      if (d < fromDate || d > toDate) return false;
      if (userId !== "all" && s.userId !== userId) return false;
      return true;
    });
  }, [db.posSessions, fromDate, toDate, userId]);

  // ── Invoices lookup by session ──────────────────────────────────────────────
  const invoicesBySession = useMemo(() => {
    const map = new Map<string, Invoice[]>();
    db.invoices.forEach((inv) => {
      const session = db.posSessions.find((s) =>
        s.status === "closed" &&
        inv.date >= s.openedAt.slice(0, 10) &&
        inv.date <= (s.closedAt || s.openedAt).slice(0, 10) &&
        inv.id.startsWith("INV-")
      );
      if (session) {
        const arr = map.get(session.id) || [];
        arr.push(inv);
        map.set(session.id, arr);
      }
    });
    return map;
  }, [db.invoices, db.posSessions]);

  // ── Daily aggregation ───────────────────────────────────────────────────────
  const dailySummaries = useMemo((): DaySummary[] => {
    const byDate = new Map<string, POSSession[]>();
    filtered.forEach((s) => {
      const d = (s.closedAt || s.openedAt).slice(0, 10);
      const arr = byDate.get(d) || [];
      arr.push(s);
      byDate.set(d, arr);
    });
    return Array.from(byDate.entries())
      .map(([date, sessions]) => {
        const totalSales   = sessions.reduce((a, s) => a + s.totalSales, 0);
        const totalCash    = sessions.reduce((a, s) => a + s.totalCash, 0);
        const totalCard    = sessions.reduce((a, s) => a + s.totalCard, 0);
        const opening      = sessions.reduce((a, s) => a + s.openingBalance, 0);
        const expected     = sessions.reduce((a, s) => a + s.expectedCash, 0);
        const actual       = sessions.reduce((a, s) => a + (s.actualCash ?? s.expectedCash), 0);
        const diff         = actual - expected;
        const invoiceCount = sessions.reduce((a, s) => a + s.invoiceCount, 0);
        const cashierSet   = new Set(sessions.map((s) => s.userName));
        const cashiers     = Array.from(cashierSet);
        return {
          date, sessions,
          invoiceCount, totalSales, totalCash, totalCard,
          openingBalance: opening, expectedCash: expected, actualCash: actual,
          difference: diff, hasDiff: Math.abs(diff) > 0.005,
          cashiers,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [filtered]);

  // ── Monthly aggregation ─────────────────────────────────────────────────────
  const monthlySummaries = useMemo((): MonthlySummary[] => {
    const byMonth = new Map<string, POSSession[]>();
    filtered.forEach((s) => {
      const m = (s.closedAt || s.openedAt).slice(0, 7);
      const arr = byMonth.get(m) || [];
      arr.push(s);
      byMonth.set(m, arr);
    });

    return Array.from(byMonth.entries())
      .map(([month, sessions]) => {
        // top cashier
        const cashierSales = new Map<string, number>();
        sessions.forEach((s) => {
          cashierSales.set(s.userName, (cashierSales.get(s.userName) || 0) + s.totalSales);
        });
        let topCashier = "—"; let topCashierSales = 0;
        cashierSales.forEach((v, k) => { if (v > topCashierSales) { topCashierSales = v; topCashier = k; } });

        // days with diffs
        const dayMap = new Map<string, number>();
        sessions.forEach((s) => {
          const d = (s.closedAt || s.openedAt).slice(0, 10);
          const diff = (s.actualCash ?? s.expectedCash) - s.expectedCash;
          dayMap.set(d, (dayMap.get(d) || 0) + diff);
        });
        const daysWithDiff = Array.from(dayMap.values()).filter((v) => Math.abs(v) > 0.005).length;

        const [y, m] = month.split("-");
        const monthLabel = new Date(parseInt(y), parseInt(m) - 1, 1)
          .toLocaleDateString("ar-SA", { year: "numeric", month: "long" });

        return {
          month, monthLabel,
          totalSales:   sessions.reduce((a, s) => a + s.totalSales, 0),
          totalCash:    sessions.reduce((a, s) => a + s.totalCash, 0),
          totalCard:    sessions.reduce((a, s) => a + s.totalCard, 0),
          invoiceCount: sessions.reduce((a, s) => a + s.invoiceCount, 0),
          sessionCount: sessions.length,
          daysWithDiff, topCashier, topCashierSales,
        };
      })
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [filtered]);

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const totalSales   = filtered.reduce((a, s) => a + s.totalSales, 0);
  const totalCash    = filtered.reduce((a, s) => a + s.totalCash, 0);
  const totalCard    = filtered.reduce((a, s) => a + s.totalCard, 0);
  const totalInvs    = filtered.reduce((a, s) => a + s.invoiceCount, 0);
  const daysWithDiff = dailySummaries.filter((d) => d.hasDiff).length;

  // ── Chart data ──────────────────────────────────────────────────────────────
  const chartData = useMemo(() =>
    dailySummaries.slice().reverse().slice(-20).map((d) => ({ key: d.date, value: d.totalSales })),
    [dailySummaries]
  );

  // ── Pagination ──────────────────────────────────────────────────────────────
  const rows = view === "daily" ? dailySummaries : monthlySummaries;
  const totalPages = Math.ceil(rows.length / PER_PAGE);
  const pageRows = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: "7px 20px", borderRadius: 8, border: "none", cursor: "pointer",
    fontWeight: active ? 700 : 500,
    background: active ? C.accent : "transparent",
    color: active ? "#fff" : C.textMuted, transition: "all 0.2s",
  });

  // ── Session invoices for drill-down ─────────────────────────────────────────
  const sessionInvoices = useMemo(() => {
    if (!drillSession) return [];
    return db.invoices.filter((inv) => {
      const sessOpen  = drillSession.openedAt.slice(0, 10);
      const sessClose = (drillSession.closedAt || drillSession.openedAt).slice(0, 10);
      return inv.date >= sessOpen && inv.date <= sessClose;
    });
  }, [drillSession, db.invoices]);

  return (
    <div>
      <div style={S.pageTitle}>تقارير الكاشير</div>
      <div style={S.pageSub}>تحليل أداء الورديات اليومية والشهرية</div>

      {/* ── KPIs ── */}
      <div style={S.grid(5)}>
        <KPI label="إجمالي المبيعات" value={fmt(totalSales)} color={C.accent}    icon="💰" />
        <KPI label="إجمالي النقدي"   value={fmt(totalCash)}  color={C.success}   icon="💵" />
        <KPI label="آجل / بطاقة"     value={fmt(totalCard)}  color={C.purple}    icon="💳" />
        <KPI label="عدد الفواتير"    value={String(totalInvs)} color={C.accentMid} icon="🧾" />
        <KPI label="أيام بفروقات"   value={String(daysWithDiff)} color={daysWithDiff > 0 ? C.warning : C.success} icon="⚠️" />
      </div>

      {/* ── Charts ── */}
      <div style={S.grid(2)}>
        <BarChart data={chartData} label="المبيعات اليومية" color={C.accent} />
        <DonutChart cash={totalCash} card={totalCard} />
      </div>

      {/* ── Filters + Tabs ── */}
      <div style={{ ...S.card, padding: "14px 18px", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={tabBtn(view === "daily")}   onClick={() => { setView("daily");   setPage(1); }}>يومي</button>
            <button style={tabBtn(view === "monthly")} onClick={() => { setView("monthly"); setPage(1); }}>شهري</button>
          </div>
          <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            style={{ ...S.input, width: 150, fontSize: 13 }} />
          <span style={{ color: C.textMuted, fontSize: 13 }}>إلى</span>
          <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }}
            style={{ ...S.input, width: 150, fontSize: 13 }} />
          <select value={userId} onChange={(e) => { setUserId(e.target.value); setPage(1); }}
            style={{ ...S.input, width: 160, fontSize: 13 }}>
            <option value="all">كل الكاشيرين</option>
            {cashierOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: C.textMuted, marginInlineStart: "auto" }}>
            {filtered.length} وردية مغلقة
          </span>
        </div>
      </div>

      {/* ── Daily Table ── */}
      {view === "daily" && (
        <div style={S.card}>
          <DataTable
            headers={[
              { label: "التاريخ" }, { label: "الكاشير" }, { label: "ورديات" },
              { label: "فواتير" }, { label: "المبيعات" },
              { label: "نقدي" }, { label: "آجل/بطاقة" },
              { label: "رصيد افتتاحي" }, { label: "متوقع" }, { label: "فعلي" },
              { label: "الفرق" }, { label: "" },
            ]}
            rows={(pageRows as DaySummary[]).map((d) => [
              <span key="dt" style={{ fontWeight: 700 }}>{fmtDate(d.date)}</span>,
              <span key="cs" style={{ fontSize: 12 }}>{d.cashiers.join("، ")}</span>,
              <span key="ss">{d.sessions.length}</span>,
              <span key="inv">{d.invoiceCount}</span>,
              <span key="ts" style={{ fontWeight: 700, color: C.accent }}>{fmt(d.totalSales)}</span>,
              <span key="tc" style={{ color: C.success }}>{fmt(d.totalCash)}</span>,
              <span key="tk" style={{ color: C.purple }}>{fmt(d.totalCard)}</span>,
              fmt(d.openingBalance),
              fmt(d.expectedCash),
              fmt(d.actualCash),
              <DiffBadge key="diff" diff={d.difference} />,
              <button key="drill"
                style={{ ...S.btn("outline"), fontSize: 11, padding: "3px 10px" }}
                onClick={() => setDrillDay(d)}
              >تفاصيل ↓</button>,
            ])}
            emptyMsg="لا توجد ورديات مغلقة في هذه الفترة"
          />
        </div>
      )}

      {/* ── Monthly Table ── */}
      {view === "monthly" && (
        <div style={S.card}>
          <DataTable
            headers={[
              { label: "الشهر" }, { label: "ورديات" }, { label: "فواتير" },
              { label: "إجمالي المبيعات" }, { label: "نقدي" }, { label: "آجل/بطاقة" },
              { label: "أيام بفروقات" }, { label: "أفضل كاشير" },
            ]}
            rows={(pageRows as MonthlySummary[]).map((m) => [
              <span key="ml" style={{ fontWeight: 700 }}>{m.monthLabel}</span>,
              m.sessionCount,
              m.invoiceCount,
              <span key="ts" style={{ fontWeight: 800, color: C.accent }}>{fmt(m.totalSales)}</span>,
              <span key="tc" style={{ color: C.success }}>{fmt(m.totalCash)}</span>,
              <span key="tk" style={{ color: C.purple }}>{fmt(m.totalCard)}</span>,
              m.daysWithDiff > 0
                ? <span key="dwd" style={S.badge("warning")}>{m.daysWithDiff} يوم</span>
                : <span key="dwd" style={S.badge("success")}>لا فروقات</span>,
              <span key="tc2" style={{ fontSize: 12 }}>{m.topCashier} ({fmt(m.topCashierSales)})</span>,
            ])}
            emptyMsg="لا توجد بيانات"
          />
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 14 }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)} style={{
              width: 32, height: 32, borderRadius: 8, border: `1.5px solid ${p === page ? C.accent : C.border}`,
              background: p === page ? C.accentLight : C.surface,
              color: p === page ? C.accent : C.text, fontWeight: 700, cursor: "pointer", fontSize: 13,
            }}>{p}</button>
          ))}
        </div>
      )}

      {/* ── Drill-down: Day → Sessions ── */}
      {drillDay && (
        <Modal title={`ورديات يوم ${fmtDate(drillDay.date)}`} onClose={() => setDrillDay(null)} wide>
          {/* Day totals */}
          <div style={{ background: C.surfaceAlt, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13 }}>
              <span>مبيعات: <strong style={{ color: C.accent }}>{fmt(drillDay.totalSales)}</strong></span>
              <span>نقدي: <strong style={{ color: C.success }}>{fmt(drillDay.totalCash)}</strong></span>
              <span>آجل: <strong>{fmt(drillDay.totalCard)}</strong></span>
              <span>فواتير: <strong>{drillDay.invoiceCount}</strong></span>
              <span>فرق: <strong style={{ color: drillDay.hasDiff ? C.warning : C.success }}>
                {drillDay.hasDiff ? fmt(drillDay.difference) : "لا فروقات"}
              </strong></span>
            </div>
          </div>

          {/* Sessions list */}
          {drillDay.sessions.map((s) => {
            const diff = (s.actualCash ?? s.expectedCash) - s.expectedCash;
            return (
              <div key={s.id} style={{
                border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px",
                marginBottom: 10, cursor: "pointer", transition: "background 0.15s",
              }}
                onClick={() => setDrillSession(s)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{s.id}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>
                      كاشير: {s.userName} · {s.invoiceCount} فاتورة
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>
                      {s.openedAt.slice(11, 16)} → {s.closedAt?.slice(11, 16) || "—"}
                    </div>
                  </div>
                  <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontWeight: 800, color: C.accent }}>{fmt(s.totalSales)}</span>
                    <DiffBadge diff={diff} />
                    <span style={{ fontSize: 11, color: C.textMuted }}>انقر لرؤية الفواتير ↓</span>
                  </div>
                </div>
              </div>
            );
          })}
        </Modal>
      )}

      {/* ── Drill-down: Session → Invoices ── */}
      {drillSession && (
        <Modal title={`فواتير الوردية — ${drillSession.id}`} onClose={() => setDrillSession(null)} wide>
          <div style={{ background: C.surfaceAlt, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12 }}>
            <strong>{drillSession.userName}</strong> —
            إجمالي: <strong style={{ color: C.accent }}>{fmt(drillSession.totalSales)}</strong> ·
            نقدي: <strong>{fmt(drillSession.totalCash)}</strong> ·
            بطاقة: <strong>{fmt(drillSession.totalCard)}</strong>
          </div>

          <DataTable
            headers={[
              { label: "رقم الفاتورة" }, { label: "التاريخ" }, { label: "العميل" },
              { label: "عدد الأصناف" }, { label: "الإجمالي" }, { label: "طريقة الدفع" }, { label: "الحالة" },
            ]}
            rows={sessionInvoices.map((inv) => [
              <span key="id" style={{ fontWeight: 700, color: C.accent }}>{inv.id}</span>,
              fmtDate(inv.date),
              inv.customerName,
              inv.lines.length,
              <span key="t" style={{ fontWeight: 700 }}>{fmt(inv.total)}</span>,
              inv.paymentType === "cash"
                ? <span key="pm" style={S.badge("success")}>نقدي</span>
                : <span key="pm" style={S.badge("info")}>آجل</span>,
              inv.status === "paid"
                ? <span key="st" style={S.badge("success")}>مدفوع</span>
                : <span key="st" style={S.badge("warning")}>{inv.status}</span>,
            ])}
            emptyMsg="لا توجد فواتير مرتبطة بهذه الوردية"
          />
        </Modal>
      )}
    </div>
  );
}
