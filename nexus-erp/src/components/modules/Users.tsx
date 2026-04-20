"use client";

import { useState } from "react";
import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { useAuth } from "@/hooks/useAuth";
import { DB, User } from "@/lib/db/database";
import { TenantDB } from "@/saas/tenantDB";
import { uid, today, logActivity } from "@/lib/engine/helpers";
import {
  PERMISSION_GROUPS, getDefaultPermissions,
  UserRole, Permission,
} from "@/lib/engine/permissions";
import { DataTable }   from "@/components/ui/DataTable";
import { Modal }       from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState }  from "@/components/ui/EmptyState";

interface Props { addToast: (msg: string, type?: "success" | "error" | "info") => void; }

const ROLE_COLOR: Record<string, "danger" | "info" | "success" | "gold" | "warning"> = {
  admin: "danger", accountant: "info", sales: "success", viewer: "gold", cashier: "warning",
};

const ROLE_LABEL: Record<string, string> = {
  admin: "مدير", accountant: "محاسب", sales: "مبيعات", viewer: "مشاهد", cashier: "كاشير",
};

const ROLE_HINT: Record<string, string> = {
  admin:      "📌 مدير: وصول كامل لجميع الوحدات",
  accountant: "📌 محاسب: وصول للمحاسبة والتقارير والمبيعات والمشتريات",
  sales:      "📌 مبيعات: وصول للمبيعات والعملاء والمخزون فقط",
  cashier:    "🖥️ كاشير: يتم توجيهه مباشرةً لشاشة POS — لا يمكنه الوصول للتقارير أو الإعدادات",
  viewer:     "📌 مشاهد: عرض فقط بدون تعديل",
};

type FormState = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  permissions: Permission[];
  showPerms: boolean;
};

export function Users({ addToast }: Props) {
  const { t } = useLang();
  const { user: currentUser } = useAuth();
  const db = DB.get();

  const [users, setUsers] = useState<User[]>([...db.users]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormState>({
    name: "", email: "", password: "",
    role: "accountant",
    permissions: getDefaultPermissions("accountant"),
    showPerms: false,
  });

  const setRole = (role: UserRole) => {
    setForm((f) => ({ ...f, role, permissions: getDefaultPermissions(role) }));
  };

  const togglePerm = (perm: Permission) => {
    setForm((f) => {
      const has = f.permissions.includes(perm);
      return {
        ...f,
        permissions: has
          ? f.permissions.filter((p) => p !== perm)
          : [...f.permissions, perm],
      };
    });
  };

  const resetForm = () => setForm({
    name: "", email: "", password: "",
    role: "accountant",
    permissions: getDefaultPermissions("accountant"),
    showPerms: false,
  });

  const handleCreate = () => {
    if (!form.name || !form.email || !form.password) {
      addToast(t("fillRequired"), "error"); return;
    }
    if (db.users.find((u) => u.email === form.email)) {
      addToast("البريد الإلكتروني مستخدم بالفعل", "error"); return;
    }
    const u: User = {
      id: uid(),
      name: form.name,
      email: form.email,
      password: form.password,
      role: form.role,
      permissions: [...form.permissions],
      status: "active",
      companyId: TenantDB.getCurrentCompanyId() || undefined,
      lastLogin: "—",
      createdAt: today(),
    };
    db.users.push(u);
    logActivity(currentUser?.id || "", currentUser?.name || "", "CREATE", "Users", `أضاف المستخدم ${u.name} (${ROLE_LABEL[u.role]})`, undefined, undefined, undefined, navigator.userAgent);
    DB.save();
    setUsers([...db.users]);
    addToast(t("userCreated"), "success");
    setShowModal(false);
    resetForm();
  };

  /* Permissions matrix */
  const PERMS = [
    { m: t("dashboard"),  admin: true,  accountant: true,  sales: true,  viewer: true,  cashier: true  },
    { m: "POS / كاشير",  admin: true,  accountant: false, sales: false, viewer: false, cashier: true  },
    { m: t("sales"),      admin: true,  accountant: true,  sales: true,  viewer: false, cashier: false },
    { m: t("purchases"),  admin: true,  accountant: true,  sales: false, viewer: false, cashier: false },
    { m: t("inventory"),  admin: true,  accountant: true,  sales: true,  viewer: true,  cashier: true  },
    { m: t("accounting"), admin: true,  accountant: true,  sales: false, viewer: false, cashier: false },
    { m: t("reports"),    admin: true,  accountant: true,  sales: false, viewer: true,  cashier: false },
    { m: t("treasury"),   admin: true,  accountant: true,  sales: false, viewer: false, cashier: false },
    { m: t("customers"),  admin: true,  accountant: true,  sales: true,  viewer: true,  cashier: false },
    { m: t("suppliers"),  admin: true,  accountant: true,  sales: false, viewer: false, cashier: false },
    { m: t("users"),      admin: true,  accountant: false, sales: false, viewer: false, cashier: false },
    { m: t("settings"),   admin: true,  accountant: false, sales: false, viewer: false, cashier: false },
  ];

  return (
    <div>
      <div style={S.pageTitle}>{t("usersTitle")}</div>
      <div style={S.pageSub}>{t("usersSubtitle")}</div>

      <div style={S.grid(2)}>
        {/* Users list */}
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <button style={{ ...S.btn("primary"), border: "none" }} onClick={() => setShowModal(true)}>
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
                <div style={{ textAlign: "left" }}>
                  <span style={S.badge(ROLE_COLOR[u.role] || "info")}>{ROLE_LABEL[u.role] || u.role}</span>
                  <div style={{ marginTop: 6 }}><StatusBadge status={u.status} /></div>
                  <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>
                    {u.permissions?.length ?? 0} صلاحية
                  </div>
                </div>
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
                  <div style={{
                    width: 38, height: 38, borderRadius: "50%",
                    background: C.accentLight, border: `2px solid ${C.accentMid}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 800, color: C.accent, flexShrink: 0,
                  }}>
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
                  {(["admin", "accountant", "sales", "cashier", "viewer"] as const).map((r) => (
                    <th key={r} style={{ ...S.th, textAlign: "center" }}>
                      <span style={S.badge(ROLE_COLOR[r])}>{ROLE_LABEL[r]}</span>
                    </th>
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
                    {(["admin", "accountant", "sales", "cashier", "viewer"] as const).map((role) => (
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
            <span key="act" style={S.badge(l.action === "LOGIN" ? "info" : l.action === "CREATE" ? "success" : "warning")}>
              {l.action}
            </span>,
            l.user,
            <span key="ts" style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace" }}>{l.timestamp}</span>,
          ])}
          emptyMsg="لا توجد أنشطة مسجلة"
        />
      </div>

      {/* Modal: Invite User */}
      {showModal && (
        <Modal title={t("inviteNewUser")} onClose={() => { setShowModal(false); resetForm(); }}>
          {/* Basic fields */}
          {([
            ["name",     t("fullName"),  "text",     true],
            ["email",    t("email"),     "email",    true],
            ["password", t("password"),  "password", true],
          ] as [keyof FormState, string, string, boolean][]).map(([k, lbl, type, req]) => (
            <div key={k} style={S.formGroup}>
              <label style={S.label}>{lbl}{req ? " *" : ""}</label>
              <input
                style={S.input}
                type={type}
                value={form[k] as string}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                placeholder={lbl}
              />
            </div>
          ))}

          {/* Role selector */}
          <div style={S.formGroup}>
            <label style={S.label}>{t("role")}</label>
            <select style={S.select} value={form.role} onChange={(e) => setRole(e.target.value as UserRole)}>
              <option value="admin">مدير (Admin)</option>
              <option value="accountant">محاسب (Accountant)</option>
              <option value="sales">مبيعات (Sales)</option>
              <option value="cashier">كاشير (Cashier) — POS فقط</option>
              <option value="viewer">مشاهد (Viewer)</option>
            </select>
          </div>

          {/* Role hint */}
          <div style={{ background: C.accentLight, borderRadius: 7, padding: 10, marginBottom: 12, fontSize: 12, color: C.accentMid }}>
            {ROLE_HINT[form.role]}
          </div>

          {/* Permissions accordion */}
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 16, overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, showPerms: !f.showPerms }))}
              style={{
                width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 14px", background: C.surfaceAlt, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 700, color: C.text,
              }}
            >
              <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 400 }}>
                {form.permissions.length} صلاحية محددة
              </span>
              <span>🔐 تخصيص الصلاحيات {form.showPerms ? "▲" : "▼"}</span>
            </button>

            {form.showPerms && (
              <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button
                    type="button"
                    style={{ ...S.btn("outline"), padding: "4px 10px", fontSize: 11 }}
                    onClick={() => setForm((f) => ({ ...f, permissions: getDefaultPermissions(f.role) }))}
                  >
                    ↺ إعادة تعيين لصلاحيات الدور
                  </button>
                  <span style={{ fontSize: 11, color: C.textMuted }}>تخصيص مستقل عن الدور</span>
                </div>

                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.label}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 6, letterSpacing: 0.5 }}>
                      {group.label}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      {group.permissions.map(({ key, label }) => {
                        const checked = form.permissions.includes(key);
                        return (
                          <label
                            key={key}
                            style={{
                              display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                              padding: "6px 10px", borderRadius: 6, fontSize: 12,
                              background: checked ? C.accentLight : C.surfaceAlt,
                              border: `1px solid ${checked ? C.accentMid : C.border}`,
                              color: checked ? C.accent : C.text,
                              transition: "all 0.12s",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePerm(key)}
                              style={{ accentColor: C.accent, width: 14, height: 14 }}
                            />
                            {label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-start" }}>
            <button style={{ ...S.btn("outline") }} onClick={() => { setShowModal(false); resetForm(); }}>{t("cancel")}</button>
            <button style={{ ...S.btn("primary"), border: "none" }} onClick={handleCreate}>{t("createAccount")}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
