/**
 * POST /api/auth/reset-password
 * Body: { token, newPassword }
 *
 * Validates the reset token and updates the user's password.
 * Token is single-use and expires after 1 hour.
 */
import { NextRequest, NextResponse } from "next/server";
import { loadSaaSData, saveSaaSData, loadTenantData, saveTenantData } from "@/lib/server/storage";
import { hashPassword } from "@/lib/server/password";
import { query } from "@/lib/server/postgres";
import { runMigrations } from "@/lib/server/migrate";

// In-memory fallback for environments without PostgreSQL
const _memTokens = new Map<string, { email: string; companyId: string | null; expiresAt: number; used: boolean }>();

async function validateToken(token: string) {
  try {
    await runMigrations();
    const result = await query(
      `SELECT email, company_id, expires_at, used FROM password_reset_tokens WHERE token = $1`,
      [token]
    );
    if (!result || result.rows.length === 0) return null;
    const row = result.rows[0];
    if (row.used) return null;
    if (new Date(row.expires_at) < new Date()) return null;
    return { email: row.email as string, companyId: row.company_id as string | null };
  } catch {
    // Fallback to memory store
    const mem = _memTokens.get(token);
    if (!mem || mem.used || mem.expiresAt < Date.now()) return null;
    return { email: mem.email, companyId: mem.companyId };
  }
}

async function markTokenUsed(token: string) {
  try {
    await query(`UPDATE password_reset_tokens SET used = TRUE WHERE token = $1`, [token]);
  } catch {
    const mem = _memTokens.get(token);
    if (mem) mem.used = true;
  }
}

export async function POST(req: NextRequest) {
  const { token, newPassword } = await req.json().catch(() => ({}));

  if (!token || !newPassword) {
    return NextResponse.json({ error: "الرمز وكلمة المرور الجديدة مطلوبان" }, { status: 400 });
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return NextResponse.json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }, { status: 400 });
  }

  const record = await validateToken(token);
  if (!record) {
    return NextResponse.json({ error: "الرمز غير صالح أو منتهي الصلاحية" }, { status: 400 });
  }

  const hashed = hashPassword(newPassword);
  const { email, companyId } = record;

  // Update super admin password
  const saas = await loadSaaSData();
  const adminIdx = saas.superAdmins.findIndex(
    (a) => a.email.toLowerCase() === email.toLowerCase()
  );
  if (adminIdx !== -1) {
    (saas.superAdmins[adminIdx] as any).password = hashed;
    await saveSaaSData(saas);
    await markTokenUsed(token);
    return NextResponse.json({ ok: true, message: "تم تغيير كلمة المرور بنجاح" });
  }

  // Update tenant user password
  if (companyId) {
    const tenant = await loadTenantData(companyId);
    const userIdx = tenant.users.findIndex(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );
    if (userIdx !== -1) {
      tenant.users[userIdx].password = hashed;
      await saveTenantData(companyId, tenant);
      await markTokenUsed(token);
      return NextResponse.json({ ok: true, message: "تم تغيير كلمة المرور بنجاح" });
    }
  }

  return NextResponse.json({ error: "لم يتم العثور على المستخدم" }, { status: 404 });
}

// GET — validate token only (to check before showing reset form)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ valid: false });
  const record = await validateToken(token);
  return NextResponse.json({ valid: !!record, email: record?.email });
}
