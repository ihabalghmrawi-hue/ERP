"use client";

import { useState } from "react";
import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { useAuth } from "@/hooks/useAuth";
import { DB, User } from "@/lib/db/database";
import { TenantDB } from "@/saas/tenantDB";
import { uid, today } from "@/lib/engine/helpers";
import { DataTable }   from "@/components/ui/DataTable";
import { Modal }       from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState }  from "@/components/ui/EmptyState";

interface Props { addToast: (msg: string, type?: "success" | "error" | "info") => void; }

const ROLE_COLOR: Record<string, "danger" | "info" | "success" | "gold"> = {
  admin: "danger", accountant: "info", sales: "success", viewer: "gold",
};

export function Users({ addToast }: Props) {
  const { t } = useLang();
  const { user: currentUser } = useAuth();
  const db = DB.get();

  const [users, setUsers] = useState<User[]>([...db.users]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "accountant" });

  const handleCreate = () => {
    if (!form.name || !form.email || !form.password) {
      addToast(t("fillRequired"), "error"); return;
    }
    if (db.users.find((u) => u.email === form.email)) {
      addToast("البريد الإلكتروني مستخدم بالفعل", "error"); return;
    }
    const u: User = {
      id: uid(), name: form.name, email: form.email,
      password: form.password, role: form.role as User["role"],
      status: "active", companyId: TenantDB.getCurrentCompanyId() || undefined,
      lastLogin: "—", createdAt: today(),
    };
    db.users.push(u);
    db.activityLog.unshift({
      id: uid(), timestamp: new Date().toLocaleString("ar-SA"),
      userId: currentUser?.id || "", user: currentUser?.name || "",
      action: "CREATE", module: "Users", description: `أضاف المستخدم ${u.name}`,
    });
    DB.save();
    setUsers([...db.users]);
    addToast(t("userCreated"), "success");
    setShowModal(false);
    setForm({ name: "", email: "", password: "", role: "accountant" });
  };

  /* Permissions matrix data */
  const PERMS = [
    { m: t("dashboard"),   admin: true,  accountant: true,  sales: true,  viewer: true  },
    { m: t("sales"),       admin: true,  accountant: true,  sales: true,  viewer: false },
    { m: t("purchases"),   admin: true,  accountant: true,  sales: false, viewer: false },
    { m: t("inventory"),   admin: true,  accountant: true,  sales: true,  viewer: true  },
    { m: t("accounting"),  admin: true,  accountant: true,  sales: false, viewer: false },
    { m: t("reports"),     admin: true,  accountant: true,  sales: false, viewer: true  },
    { m: t("treasury"),    admin: true,  accountant: true,  sales: false, viewer: false },
    { m: t("customers"),   admin: true,  accountant: true,  sales: true,  viewer: true  },
    { m: t("suppliers"),   admin: true,  accountant: true,  sales: false, viewer: false },
    { m: t("users"),       admin: true,  accountant: false, sales: false, viewer: false },
    { m: t("settings"),    admin: true,  accountant: false, sales: false, viewer: false },
  ];

  return (
    <div>
      <div style={S.pageTitle}>{t("usersTitle")}</div>
      <div style={S.pageSub}>{t("usersSubtitle")}</div>

      <div style={S.grid(2)}>
        {/* Users list */}
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <button
              style={{ ...S.btn("primary"), border: "none" }}
              onClick={() => setShowModal(true)}
            >
              {t("inviteUser")}
            </button>
            <div style={S.sectionTitle}>{t("systemUsers")} ({users.length})</div>
          </div>

          {users.length === 0 ? (
            <EmptyState icon="👤" title={t("noUsersYet")} />
          ) : (
            users.map((u) => (
              <div
                key={u.id}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 0", borderBottom: `1px solid ${C.border}`,
                }}
              >
                {/* Role + status */}
                <div style={{ textAlign: "left" }}>
                  <span style={S.badge(ROLE_COLOR[u.role] || "info")}>
                    {u.role === "admin" ? t("admin") : u.role === "accountant" ? t("accountant") : u.role === "sales" ? t("salesRole") : t("viewer")}
                  </span>
                  <div style={{ marginTop: 6 }}>
                    <StatusBadge status={u.status} />
                  </div>
                </div>

                {/* Avatar + info */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, color: C.text }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{u.email}</div>
                    <div style={{ fontSize: 10, color: C.textMuted }}>
                      {t("lastLogin")}: {
                        u.lastLogin && u.lastLogin !== "—"
                          ? new Date(u.lastLogin).toLocaleDateString("ar-SA")
                          : "—"
                      }
                    </div>
                  </div>
                  <div
                    style={{
                      width: 38, height: 38, borderRadius: "50%",
                      background: C.accentLight, border: `2px solid ${C.accentMid}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: 800, color: C.accent, flexShrink: 0,
                    }}
                  >
                    {u.name?.slice(0, 1)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Permissions matrix */}
        <div style={S.card}>
          <div style={{ ...S.sectionTitle, marginBottom: 16 }}>{t("rolesMatrix")}</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ ...S.table, fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={S.th}>{t("module")}</th>
                  {[t("admin"), t("accountant"), t("salesRole"), t("viewer")].map((r) => (
                    <th key={r} style={{ ...S.th, textAlign: "center" }}>{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMS.map((row) => (
                  <tr
                    key={row.m}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = C.surfaceAlt)}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
                  >
                    <td style={S.td}>{row.m}</td>
                    {(["admin", "accountant", "sales", "viewer"] as const).map((role) => (
                      <td key={role} style={{ ...S.td, textAlign: "center" }}>
                        <span style={{ color: row[role] ? C.success : C.borderDark, fontWeight: 700, fontSize: 16 }}>
                          {row[role] ? "✓" : "—"}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Audit trail */}
      <div style={S.card}>
        <div style={{ ...S.sectionTitle, marginBottom: 12 }}>{t("auditTrail")}</div>
        <DataTable
          headers={[
            { label: t("description") }, { label: t("module") },
            { label: t("action") }, { label: t("user") }, { label: t("time") },
          ]}
          rows={db.activityLog.slice(0, 50).map((l) => [
            l.description,
            <span key="mod" style={S.badge("info")}>{l.module}</span>,
            <span
              key="act"
              style={S.badge(l.action === "LOGIN" ? "info" : l.action === "CREATE" ? "success" : "warning")}
            >
              {l.action}
            </span>,
            l.user,
            <span key="ts" style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace" }}>
              {l.timestamp}
            </span>,
          ])}
          emptyMsg="لا توجد أنشطة مسجلة"
        />
      </div>

      {/* Modal: Invite User */}
      {showModal && (
        <Modal title={t("inviteNewUser")} onClose={() => setShowModal(false)}>
          {([
            ["name",     t("fullName"),  "text",     true],
            ["email",    t("email"),     "email",    true],
            ["password", t("password"),  "password", true],
          ] as [string, string, string, boolean][]).map(([k, lbl, type, req]) => (
            <div key={k} style={S.formGroup}>
              <label style={S.label}>{lbl}{req ? " *" : ""}</label>
              <input
                style={S.input}
                type={type}
                value={(form as any)[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                placeholder={lbl}
              />
            </div>
          ))}

          <div style={S.formGroup}>
            <label style={S.label}>{t("role")}</label>
            <select
              style={S.select}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="admin">{t("admin")}</option>
              <option value="accountant">{t("accountant")}</option>
              <option value="sales">{t("salesRole")}</option>
              <option value="viewer">{t("viewer")}</option>
            </select>
          </div>

          {/* Role description hint */}
          <div style={{ background: C.accentLight, borderRadius: 7, padding: 10, marginBottom: 16, fontSize: 12, color: C.accentMid }}>
            {form.role === "admin"      && "📌 مدير: وصول كامل لجميع الوحدات"}
            {form.role === "accountant" && "📌 محاسب: وصول للمحاسبة والتقارير والمبيعات والمشتريات"}
            {form.role === "sales"      && "📌 مبيعات: وصول للمبيعات والعملاء والمخزون فقط"}
            {form.role === "viewer"     && "📌 مشاهد: عرض فقط بدون تعديل"}
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-start" }}>
            <button style={{ ...S.btn("outline") }} onClick={() => setShowModal(false)}>{t("cancel")}</button>
            <button style={{ ...S.btn("primary"), border: "none" }} onClick={handleCreate}>{t("createAccount")}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
