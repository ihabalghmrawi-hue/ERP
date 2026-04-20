"use client";

import { useState, useMemo, useEffect } from "react";
import { S, C } from "@/lib/engine/design";
import { DB, ActivityLog } from "@/lib/db/database";
import { KPI } from "@/components/ui/KPI";
import { Modal } from "@/components/ui/Modal";

const PAGE_SIZE = 25;

const ACTION_COLOR: Record<string, "success" | "warning" | "danger" | "info"> = {
  CREATE: "success",
  UPDATE: "warning",
  DELETE: "danger",
  LOGIN:  "info",
  CANCEL: "warning",
  PAYMENT: "success",
  PERMISSION_CHANGE: "danger",
  ERROR: "danger",
};

const ACTION_LABEL: Record<string, string> = {
  CREATE: "إنشاء",
  UPDATE: "تعديل",
  DELETE: "حذف",
  LOGIN:  "دخول",
  CANCEL: "إلغاء",
  PAYMENT: "دفع",
  PERMISSION_CHANGE: "تغيير صلاحيات",
  ERROR: "خطأ",
};

function exportCSV(logs: ActivityLog[]) {
  const header = ["التوقيت", "المستخدم", "معرف المستخدم", "الإجراء", "الموديول", "الوصف", "عنوان IP", "المتصفح", "القيم القديمة", "القيم الجديدة", "الخطأ"];
  const rows = logs.map(l => [
    l.timestamp, l.user || "", l.userId || "", l.action, l.module, l.description,
    l.ipAddress || "", l.userAgent || "", JSON.stringify(l.oldValues || {}), JSON.stringify(l.newValues || {}), l.error || "",
  ]);
  const csv = [header, ...rows]
    .map(r => r.map(cell => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AuditLog() {
  const db   = DB.get();
  const logs = db.activityLog;

  const [search, setSearch]             = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterModule, setFilterModule] = useState("");
  const [filterUser, setFilterUser]     = useState("");
  const [page, setPage]                 = useState(1);
  const [selectedLog, setSelectedLog]   = useState<ActivityLog | null>(null);
  const [serverLogs, setServerLogs]     = useState<ActivityLog[] | null>(null);
  const [serverTotal, setServerTotal]   = useState<number>(0);
  const [loading, setLoading]           = useState(false);

  const modules = useMemo(() => Array.from(new Set(logs.map(l => l.module))).sort(), [logs]);
  const users   = useMemo(() => Array.from(new Set(logs.map(l => l.user).filter(Boolean))).sort(), [logs]);

  // Fetch paginated logs from server; fall back to local DB when server unavailable
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set("page", String(page));
    qs.set("perPage", String(PAGE_SIZE));
    if (filterAction) qs.set("action", filterAction);
    if (filterModule) qs.set("module", filterModule);
    // filterUser is a display name; use search to match user_name as well
    if (filterUser) qs.set("search", filterUser);
    if (search) qs.set("search", search);

    void fetch(`/api/audit?${qs.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        if (data && Array.isArray(data.rows)) {
          setServerLogs(data.rows);
          setServerTotal(Number(data.total) || 0);
        } else {
          setServerLogs(null);
          setServerTotal(0);
        }
      })
      .catch(() => { setServerLogs(null); setServerTotal(0); })
      .finally(() => { if (mounted) setLoading(false); });

    return () => { mounted = false; };  
  }, [page, filterAction, filterModule, filterUser, search]);

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (filterAction && l.action !== filterAction) return false;
      if (filterModule && l.module !== filterModule) return false;
      if (filterUser   && l.user   !== filterUser)   return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !l.description?.toLowerCase().includes(q) &&
          !l.user?.toLowerCase().includes(q) &&
          !l.module?.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [logs, filterAction, filterModule, filterUser, search]);

  // If server-side data is available use it (server handles pagination); otherwise use local filter
  const totalPages = serverLogs ? Math.max(1, Math.ceil(serverTotal / PAGE_SIZE)) : Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = serverLogs ? serverLogs : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => ({
    total:   serverLogs ? serverTotal : logs.length,
    creates: logs.filter(l => l.action === "CREATE").length,
    updates: logs.filter(l => l.action === "UPDATE").length,
    deletes: logs.filter(l => l.action === "DELETE").length,
    cancels: logs.filter(l => l.action === "CANCEL").length,
    payments: logs.filter(l => l.action === "PAYMENT").length,
    permissions: logs.filter(l => l.action === "PERMISSION_CHANGE").length,
    errors: logs.filter(l => l.action === "ERROR").length,
    logins:  logs.filter(l => l.action === "LOGIN").length,
  }), [logs, serverLogs, serverTotal]);

  const hasFilter = !!(filterAction || filterModule || filterUser || search);
  const resetPage = () => setPage(1);

  return (
    <div>
      <div style={S.pageTitle}>سجل التدقيق</div>
      <div style={S.pageSub}>تتبع كامل لجميع العمليات التي تمت في النظام</div>

      {/* Stats */}
      <div style={S.grid(5)}>
        <KPI label="إجمالي الأحداث" value={stats.total}   color={C.accentMid} icon="📋" />
        <KPI label="إنشاء"          value={stats.creates} color={C.success}   icon="✅" />
        <KPI label="تعديل"          value={stats.updates} color={C.warning}   icon="✏️" />
        <KPI label="حذف"            value={stats.deletes} color={C.danger}    icon="🗑️" />
        <KPI label="إلغاء"          value={stats.cancels} color={C.warning}   icon="🚫" />
        <KPI label="دفع"            value={stats.payments} color={C.success}  icon="💰" />
        <KPI label="تغيير صلاحيات" value={stats.permissions} color={C.danger} icon="🔒" />
        <KPI label="أخطاء"          value={stats.errors} color={C.danger}    icon="❌" />
        <KPI label="دخول"           value={stats.logins}  color={C.accentMid} icon="🔑" />
      </div>

      {/* Filters */}
      <div style={{ ...S.card, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <input
            style={{ ...S.input, width: 240, marginBottom: 0 }}
            placeholder="🔍 بحث في الوصف أو المستخدم..."
            value={search}
            onChange={e => { setSearch(e.target.value); resetPage(); }}
          />
          <select
            style={{ ...S.input, width: 150, marginBottom: 0 }}
            value={filterAction}
            onChange={e => { setFilterAction(e.target.value); resetPage(); }}
          >
            <option value="">كل الإجراءات</option>
            {["CREATE", "UPDATE", "DELETE", "LOGIN", "CANCEL", "PAYMENT", "PERMISSION_CHANGE", "ERROR"].map(a => (
              <option key={a} value={a}>{ACTION_LABEL[a]}</option>
            ))}
          </select>
          <select
            style={{ ...S.input, width: 150, marginBottom: 0 }}
            value={filterModule}
            onChange={e => { setFilterModule(e.target.value); resetPage(); }}
          >
            <option value="">كل الموديولات</option>
            {modules.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select
            style={{ ...S.input, width: 160, marginBottom: 0 }}
            value={filterUser}
            onChange={e => { setFilterUser(e.target.value); resetPage(); }}
          >
            <option value="">كل المستخدمين</option>
            {users.map(u => <option key={u} value={u}>{u}</option>)}
          </select>

          <div style={{ marginRight: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            {hasFilter && (
              <button
                style={{ ...S.btn("ghost"), border: `1px solid ${C.border}`, fontSize: 12, padding: "6px 12px" }}
                onClick={() => { setFilterAction(""); setFilterModule(""); setFilterUser(""); setSearch(""); resetPage(); }}
              >
                ✕ مسح الفلاتر
              </button>
            )}
            <button
              style={{ ...S.btn("primary"), border: "none", fontSize: 12, padding: "6px 14px" }}
              onClick={() => exportCSV(serverLogs ?? filtered)}
            >
              ⬇️ تصدير CSV ({serverLogs ? serverTotal : filtered.length})
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={S.card}>
        <div style={{ ...S.sectionHeader, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: C.textMuted }}>
            {filtered.length === 0
              ? "لا توجد نتائج"
              : `عرض ${Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–${Math.min(page * PAGE_SIZE, filtered.length)} من ${filtered.length}`}
          </div>
          <div style={S.sectionTitle}>السجلات</div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: C.textMuted, fontSize: 14 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            لا توجد نتائج تطابق المعايير المحددة
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ ...S.table, fontSize: 12 }}>
                <thead>
                  <tr>
                    {["التوقيت", "المستخدم", "الإجراء", "الموديول", "الوصف", "تفاصيل"].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(l => (
                    <tr
                      key={l.id}
                      onMouseEnter={e => ((e.currentTarget as HTMLTableRowElement).style.background = C.surfaceAlt)}
                      onMouseLeave={e => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
                    >
                      <td style={{ ...S.td, fontFamily: "monospace", fontSize: 11, color: C.textMuted, whiteSpace: "nowrap" }}>
                        {l.timestamp}
                      </td>
                      <td style={{ ...S.td, fontWeight: 600 }}>{l.user || "—"}</td>
                      <td style={S.td}>
                        <span style={S.badge(ACTION_COLOR[l.action] || "info")}>
                          {ACTION_LABEL[l.action] || l.action}
                        </span>
                      </td>
                      <td style={S.td}>
                        <span style={S.badge("info")}>{l.module}</span>
                      </td>
                      <td style={{ ...S.td, maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {l.description}
                      </td>
                      <td style={S.td}>
                        <button
                          style={{ ...S.btn("ghost"), fontSize: 11, padding: "4px 8px" }}
                          onClick={() => setSelectedLog(l)}
                        >
                          👁️ عرض
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "16px 0", alignItems: "center" }}>
                <button
                  style={{ ...S.btn("ghost"), border: `1px solid ${C.border}`, padding: "4px 14px", fontSize: 13 }}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  ‹
                </button>
                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                  const pg =
                    totalPages <= 7    ? i + 1
                    : page <= 4        ? i + 1
                    : page >= totalPages - 3 ? totalPages - 6 + i
                    : page - 3 + i;
                  return (
                    <button
                      key={pg}
                      onClick={() => setPage(pg)}
                      style={{
                        ...S.btn(pg === page ? "primary" : "ghost"),
                        border: pg === page ? "none" : `1px solid ${C.border}`,
                        padding: "4px 10px", minWidth: 32, fontSize: 13,
                      }}
                    >
                      {pg}
                    </button>
                  );
                })}
                <button
                  style={{ ...S.btn("ghost"), border: `1px solid ${C.border}`, padding: "4px 14px", fontSize: 13 }}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  ›
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <Modal title="تفاصيل السجل" onClose={() => setSelectedLog(null)}>
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>
            <div style={{ marginBottom: 16 }}>
              <strong>التوقيت:</strong> {selectedLog.timestamp}
            </div>
            <div style={{ marginBottom: 16 }}>
              <strong>المستخدم:</strong> {selectedLog.user} (ID: {selectedLog.userId})
            </div>
            <div style={{ marginBottom: 16 }}>
              <strong>الإجراء:</strong> <span style={S.badge(ACTION_COLOR[selectedLog.action] || "info")}>{ACTION_LABEL[selectedLog.action] || selectedLog.action}</span>
            </div>
            <div style={{ marginBottom: 16 }}>
              <strong>الموديول:</strong> {selectedLog.module}
            </div>
            <div style={{ marginBottom: 16 }}>
              <strong>الوصف:</strong> {selectedLog.description}
            </div>
            {selectedLog.ipAddress && (
              <div style={{ marginBottom: 16 }}>
                <strong>عنوان IP:</strong> {selectedLog.ipAddress}
              </div>
            )}
            {selectedLog.userAgent && (
              <div style={{ marginBottom: 16 }}>
                <strong>المتصفح/الجهاز:</strong> {selectedLog.userAgent}
              </div>
            )}
            {selectedLog.error && (
              <div style={{ marginBottom: 16 }}>
                <strong>الخطأ:</strong> <span style={{ color: C.danger }}>{selectedLog.error}</span>
              </div>
            )}
            {selectedLog.oldValues && (
              <div style={{ marginBottom: 16 }}>
                <strong>القيم القديمة:</strong>
                <pre style={{ background: C.surfaceAlt, padding: 8, borderRadius: 4, fontSize: 12, overflow: "auto" }}>
                  {JSON.stringify(selectedLog.oldValues, null, 2)}
                </pre>
              </div>
            )}
            {selectedLog.newValues && (
              <div style={{ marginBottom: 16 }}>
                <strong>القيم الجديدة:</strong>
                <pre style={{ background: C.surfaceAlt, padding: 8, borderRadius: 4, fontSize: 12, overflow: "auto" }}>
                  {JSON.stringify(selectedLog.newValues, null, 2)}
                </pre>
              </div>
            )}
            {selectedLog.oldValues && selectedLog.newValues && (
              <div style={{ marginBottom: 16 }}>
                <strong>الفرق:</strong>
                <div style={{ background: C.surfaceAlt, padding: 8, borderRadius: 4, fontSize: 12 }}>
                  {Object.keys(selectedLog.newValues).map(key => {
                    const oldVal = selectedLog.oldValues![key];
                    const newVal = selectedLog.newValues![key];
                    if (oldVal !== newVal) {
                      return (
                        <div key={key} style={{ marginBottom: 4 }}>
                          <strong>{key}:</strong>{" "}
                          <span style={{ color: C.danger, textDecoration: "line-through" }}>{JSON.stringify(oldVal)}</span>{" "}
                          →{" "}
                          <span style={{ color: C.success }}>{JSON.stringify(newVal)}</span>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
export default AuditLog;
