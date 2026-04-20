"use client";

import { useState } from "react";
import { S, C } from "@/lib/engine/design";
import { useLang } from "@/hooks/useLang";
import { useAuth } from "@/hooks/useAuth";
import { DB, User } from "@/lib/db/database";
import { TenantDB } from "@/saas/tenantDB";
import { uid, today } from "@/lib/engine/helpers";
import {
  Permission, UserRole, PERMISSION_GROUPS, ROLE_PERMISSIONS,
  getDefaultPermissions,
} from "@/lib/engine/permissions";
import { DataTable }   from "@/components/ui/DataTable";
import { Modal }       from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState }  from "@/components/ui/EmptyState";

interface Props { addToast: (msg: string, type?: "success" | "error" | "info") => void; }

const ROLE_COLOR: Record<string, "danger" | "info" | "success" | "gold" | "warning"> = {
  admin: "danger", accountant: "info", sales: "success", cashier: "warning", viewer: "gold",
};
const ROLE_LABEL: Record<string, string> = {
  admin: "مدير النظام", accountant: "محاسب", sales: "مبيعات", cashier: "كاشير", viewer: "مشاهد",
};
const ROLE_DESC: Record<string, string> = {
  admin:      "📌 وصول كامل لجميع الوحدات والإعدادات",
  accountant: "📌 المحاسبة · التقارير · المبيعات · المشتريات · الخزينة",
  sales:      "📌 المبيعات · العملاء · المخزون فقط",
  cashier:    "📌 نقطة البيع (POS) فقط — لا يمكنه الوصول للتقارير أو الإعدادات",
  viewer:     "📌 عرض للقراءة فقط — بدون أي تعديلات",
};

const PERM_LABEL: Record<Permission, string> = {
  view_dashboard:    "عرض لوحة التحكم",
  view_sales:        "عرض المبيعات",
  create_sales:      "إنشاء فواتير مبيعات",
  view_purchases:    "عرض المشتريات",
  create_purchases:  "إنشاء أوامر شراء",
  view_inventory:    "عرض المخزون",
  manage_inventory:  "إدارة المخزون",
  view_accounting:   "عرض المحاسبة",
  view_reports:      "عرض التقارير",
  view_treasury:     "عرض الخزينة",
  manage_treasury:   "إدارة الخزينة",
  view_customers:    "عرض العملاء",
  manage_customers:  "إدارة العملاء",
  view_suppliers:    "عرض الموردين",
  manage_suppliers:  "إدارة الموردين",
  manage_users:      "إدارة المستخدمين",
  manage_settings:   "إدارة الإعدادات",
  access_pos:        "الوصول لنقطة البيع",
};

type FormState = {
  name: string; email: string; password: string;
  role: UserRole; permissions: Permission[];
};

const emptyForm = (): FormState => ({
  name: "", email: "", password: "",
  role: "accountant",
  permissions: getDefaultPermissions("accountant"),
});

export function Users({ addToast }: Props) {
  const { t } = useLang();
  const { user: currentUser } = useAuth();
  const db = DB.get();

  const [users, setUsers]         = useState<User[]>([...db.users]);
  const [showModal, setShowModal] = useState(false);
  const [editUser,  setEditUser]  = useState<User | null>(null);
  const [form,      setForm]      = useState<FormState>(emptyForm());

  const openCreate = () => { setEditUser(null); setForm(emptyForm()); setShowModal(true); };
  const openEdit   = (u: User) => {
    setEditUser(u);
    setForm({
      name: u.name, email: u.email, password: "",
      role: u.role as UserRole,
      permissions: (u.permissions || getDefaultPermissions(u.role as UserRole)) as Permission[],
    });
    setShowModal(true);
  };

  const handleRoleChange = (role: UserRole) => {
    setForm((f) => ({ ...f, role, permissions: getDefaultPermissions(role) }));
  };

  const togglePerm = (perm: Permission) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter((p) => p !== perm)
        : [...f.permissions, perm],
    }));
  };

  const handleSave = () => {
    if (!form.name || !form.email) { addToast(t("fillRequired"), "error"); return; }

    if (editUser) {
      // Update existing user
      const idx = db.users.findIndex((u) => u.id === editUser.id);
      if (idx !== -1) {
        db.users[idx] = {
          ...db.users[idx],
          name: form.name,
          email: form.email,
          role: form.role,
          permissions: form.permissions,
          ...(form.password ? { password: form.password } : {}),
        };
        db.activityLog.unshift({
          id: uid(), timestamp: new Date().toLocaleString("ar-SA"),
          userId: currentUser?.id || "", user: currentUser?.name || "",
          action: "UPDATE", module: "Users",
          description: `عدّل مستخدم ${form.name} — دور: ${ROLE_LABEL[form.role]}`,
        });
        DB.save();
        setUsers([...db.users]);
        addToast("تم تحديث المستخدم بنجاح", "success");
      }
    } else {
      // Create new user
      if (!form.password) { addToast(t("fillRequired"), "error"); return; }
      if (db.users.find((u) => u.email === form.email)) {
        addToast("البريد الإلكتروني مستخدم بالفعل", "error"); return;
      }
      const u: User = {
        id: uid(), name: form.name, email: form.email,
        password: form.password, role: form.role,
        permissions: form.permissions,
        status: "active",
        companyId: TenantDB.getCurrentCompanyId() || undefined,
        lastLogin: "—", createdAt: today(),
      };
      db.users.push(u);
      db.activityLog.unshift({
        id: uid(), timestamp: new Date().toLocaleString("ar-SA"),
        userId: currentUser?.id || "", user: currentUser?.name || "",
        action: "CREATE", module: "Users",
        description: `أضاف المستخدم ${u.name} — دور: ${ROLE_LABEL[u.role]}`,
      });
      DB.save();
      setUsers([...db.users]);
      addToast(t("userCreated"), "success");
    }

    setShowModal(false);
    setForm(emptyForm());
    setEditUser(null);
  };

  const toggleStatus = (u: User) => {
    const idx = db.users.findIndex((x) => x.id === u.id);
    if (idx !== -1) {
      db.users[idx].status = db.users[idx].status === "active" ? "inactive" : "active";
      DB.save();
      setUsers([...db.users]);
    }
  };

  return (
    <div>
      <div style={S.pageTitle}>{t("usersTitle")}</div>
      <div style={S.pageSub}>{t("usersSubtitle")}</div>

      {/* KPIs */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {(["admin", "accountant", "sales", "cashier", "viewer"] as UserRole[]).map((role) => {
          const count = users.filter((u) => u.role === role).length;
          if (!count) return null;
          return (
            <div key={role} style={{
              background: C.surface, borderRadius: 10, padding: "10px 18px",
              border: `1px solid ${C.border}`, display: "flex", gap: 8, alignItems: "center",
            }}>
              <span style={{ ...S.badge(ROLE_COLOR[role] || "info"), fontSize: 11 }}>{ROLE_LABEL[role]}</span>
              <span style={{ fontWeight: 800, color: C.text }}>{count}</span>
            </div>
          );
        })}
      </div>

      <div style={S.grid(2)}>
        {/* Users list */}
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <button style={{ ...S.btn("primary"), border: "none" }} onClick={openCreate}>
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
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={S.badge(ROLE_COLOR[u.role] || "info")}>{ROLE_LABEL[u.role] || u.role}</span>
                  <StatusBadge status={u.status} />
                  <button
                    style={{ ...S.btn("outline"), padding: "2px 8px", fontSize: 11, border: `1px solid ${C.border}` }}
                    onClick={() => openEdit(u)}
                  >
                    تعديل
                  </button>
                  {u.id !== currentUser?.id && (
                    <button
                      style={{ ...S.btn(u.status === "active" ? "danger" : "success"), padding: "2px 8px", fontSize: 11, border: "none" }}
                      onClick={() => toggleStatus(u)}
                    >
                      {u.status === "active" ? "إيقاف" : "تفعيل"}
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, color: C.text }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{u.email}</div>
                    <div style={{ fontSize: 10, color: C.textMuted }}>
                      {t("lastLogin")}: {u.lastLogin && u.lastLogin !== "—" ? new Date(u.lastLogin).toLocaleDateString("ar-SA") : "—"}
                    </div>
                    <div style={{ fontSize: 10, color: C.purple, marginTop: 2 }}>
                      {(u.permissions || getDefaultPermissions(u.role as UserRole)).length} صلاحية
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

        {/* Roles reference card */}
        <div style={S.card}>
          <div style={{ ...S.sectionTitle, marginBottom: 16 }}>أدوار النظام</div>
          {(["admin", "accountant", "sales", "cashier", "viewer"] as UserRole[]).map((role) => (
            <div key={role} style={{
              background: C.surfaceAlt, borderRadius: 8, padding: "10px 14px",
              marginBottom: 8, border: `1px solid ${C.border}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: C.textMuted }}>
                  {ROLE_PERMISSIONS[role].length} صلاحية
                </span>
                <span style={S.badge(ROLE_COLOR[role] || "info")}>{ROLE_LABEL[role]}</span>
              </div>
              <div style={{ fontSize: 12, color: C.textSec }}>{ROLE_DESC[role]}</div>
            </div>
          ))}
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
            <span key="act" style={S.badge(l.action === "LOGIN" ? "info" : l.action === "CREATE" ? "success" : "warning")}>{l.action}</span>,
            l.user,
            <span key="ts" style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace" }}>{l.timestamp}</span>,
          ])}
          emptyMsg="لا توجد أنشطة مسجلة"
        />
      </div>

      {/* Modal: Create / Edit User */}
      {showModal && (
        <Modal
          title={editUser ? `تعديل: ${editUser.name}` : t("inviteNewUser")}
          onClose={() => { setShowModal(false); setEditUser(null); }}
          wide
        >
          {/* Basic info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
            <div style={S.formGroup}>
              <label style={S.label}>{t("fullName")} *</label>
              <input style={S.input} type="text" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("fullName")} />
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>{t("email")} *</label>
              <input style={S.input} type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={t("email")} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
            <div style={S.formGroup}>
              <label style={S.label}>{t("password")}{!editUser ? " *" : " (اتركه فارغاً للإبقاء)"}</label>
              <input style={S.input} type="password" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>{t("role")}</label>
              <select style={S.select} value={form.role} onChange={(e) => handleRoleChange(e.target.value as UserRole)}>
                <option value="admin">مدير النظام (Admin)</option>
                <option value="accountant">محاسب (Accountant)</option>
                <option value="sales">مبيعات (Sales)</option>
                <option value="cashier">كاشير (Cashier)</option>
                <option value="viewer">مشاهد (Viewer)</option>
              </select>
            </div>
          </div>

          {/* Role description */}
          <div style={{ background: C.accentLight, borderRadius: 7, padding: "8px 12px", marginBottom: 16, fontSize: 12, color: C.accentMid }}>
            {ROLE_DESC[form.role]}
          </div>

          <div style={S.divider} />

          {/* Permissions */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  style={{ ...S.btn("outline"), padding: "4px 10px", fontSize: 11 }}
                  onClick={() => setForm((f) => ({ ...f, permissions: getDefaultPermissions(f.role) }))}
                >
                  إعادة للافتراضي
                </button>
                <button
                  style={{ ...S.btn("outline"), padding: "4px 10px", fontSize: 11 }}
                  onClick={() => setForm((f) => ({ ...f, permissions: [] }))}
                >
                  مسح الكل
                </button>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>
                🔐 الصلاحيات ({form.permissions.length})
              </div>
            </div>

            {PERMISSION_GROUPS.map((group) => (
              <div key={group.label} style={{ marginBottom: 10, background: C.surfaceAlt, borderRadius: 8, padding: "10px 14px", border: `1px solid ${C.border}` }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: C.text, marginBottom: 8, textAlign: "right" }}>
                  {group.label}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {group.permissions.map(({ key, label }) => {
                    const checked = form.permissions.includes(key);
                    return (
                      <label
                        key={key}
                        style={{
                          display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                          background: checked ? C.accentLight : C.surface,
                          border: `1px solid ${checked ? C.accent : C.border}`,
                          borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: checked ? 700 : 400,
                          color: checked ? C.accent : C.textSec, transition: "all 0.12s", userSelect: "none",
                        }}
                      >
                        <input
                          type="checkbox" checked={checked}
                          onChange={() => togglePerm(key)}
                          style={{ display: "none" }}
                        />
                        <span style={{ fontSize: 12 }}>{checked ? "✓" : "○"}</span>
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-start" }}>
            <button style={{ ...S.btn("outline") }} onClick={() => { setShowModal(false); setEditUser(null); }}>{t("cancel")}</button>
            <button style={{ ...S.btn("primary"), border: "none" }} onClick={handleSave}>
              {editUser ? "حفظ التعديلات" : t("createAccount")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
