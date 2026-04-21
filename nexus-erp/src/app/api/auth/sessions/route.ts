import { NextRequest, NextResponse } from "next/server";
import { getAuthPayload } from "@/lib/server/auth";
import { revokeToken } from "@/lib/server/jwt";
import { query } from "@/lib/server/postgres";

// GET /api/auth/sessions — list active sessions
// Admin/superadmin gets all sessions; regular user gets their own
export async function GET(req: NextRequest) {
  const auth = await getAuthPayload(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isPrivileged = auth.role === "superadmin" || auth.role === "admin";
  const url = new URL(req.url);
  const targetUserId = url.searchParams.get("userId");

  try {
    let sql: string;
    let params: any[];

    if (isPrivileged && !targetUserId) {
      // Admin: return all non-revoked sessions for this company or all (superadmin)
      if (auth.type === "superadmin") {
        sql = `SELECT jti, user_id, email, company_id, issued_at, expires_at, user_agent, ip_address
               FROM refresh_tokens
               WHERE revoked = FALSE AND expires_at > NOW()
               ORDER BY issued_at DESC LIMIT 200`;
        params = [];
      } else {
        sql = `SELECT jti, user_id, email, company_id, issued_at, expires_at, user_agent, ip_address
               FROM refresh_tokens
               WHERE revoked = FALSE AND expires_at > NOW() AND company_id = $1
               ORDER BY issued_at DESC LIMIT 200`;
        params = [auth.companyId];
      }
    } else {
      // Regular user: own sessions only
      const uid = targetUserId && isPrivileged ? targetUserId : auth.sub;
      sql = `SELECT jti, user_id, email, company_id, issued_at, expires_at, user_agent, ip_address
             FROM refresh_tokens
             WHERE revoked = FALSE AND expires_at > NOW() AND user_id = $1
             ORDER BY issued_at DESC`;
      params = [uid];
    }

    const res = await query(sql, params);
    return NextResponse.json({ sessions: res.rows });
  } catch (e: any) {
    // refresh_tokens table may not exist yet (migration pending)
    console.error("/api/auth/sessions GET:", e.message);
    return NextResponse.json({ sessions: [] });
  }
}

// DELETE /api/auth/sessions — revoke a session by jti
// Body: { jti: string }
// Users can only revoke their own sessions; admins can revoke any within their company
export async function DELETE(req: NextRequest) {
  const auth = await getAuthPayload(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jti } = await req.json().catch(() => ({}));
  if (!jti) return NextResponse.json({ error: "jti is required" }, { status: 400 });

  try {
    // Verify ownership before revoking
    const res = await query(
      `SELECT user_id, company_id, expires_at FROM refresh_tokens WHERE jti = $1 AND revoked = FALSE`,
      [jti]
    );
    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const row = res.rows[0];
    const isOwner = row.user_id === auth.sub;
    const isAdmin = auth.role === "superadmin" || (auth.role === "admin" && row.company_id === auth.companyId);
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await revokeToken(jti, new Date(row.expires_at));
    await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE jti = $1`, [jti]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("/api/auth/sessions DELETE:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
