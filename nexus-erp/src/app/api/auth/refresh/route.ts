import { NextRequest, NextResponse } from "next/server";
import { verifyRefreshToken, signToken, signRefreshToken, revokeToken, isTokenRevoked, tokenExpiryDate } from "@/lib/server/jwt";
import { query } from "@/lib/server/postgres";
import { loadSaaSData, findTenantUserByEmail } from "@/lib/server/storage";
import { randomUUID } from "crypto";

function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get("refresh_token")?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  let rp: ReturnType<typeof verifyRefreshToken>;
  try {
    rp = verifyRefreshToken(refreshToken);
  } catch {
    return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
  }

  // Check if refresh token has been revoked
  if (rp.jti && await isTokenRevoked(rp.jti)) {
    return NextResponse.json({ error: "Token revoked" }, { status: 401 });
  }

  // Rotate: revoke old refresh token, issue new one (prevents refresh token replay)
  if (rp.jti) {
    await revokeToken(rp.jti, tokenExpiryDate(rp as any));
    try {
      await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE jti = $1`, [rp.jti]);
    } catch { /* DB unavailable */ }
  }

  // Re-fetch user to get latest permissions/role (may have changed since last login)
  let permissions: string[] | undefined;
  let role = rp.role;
  if (rp.type === "company" && rp.companyId) {
    try {
      const record = await findTenantUserByEmail(rp.email);
      if (record) {
        permissions = record.user.permissions;
        role = record.user.role as typeof role;
      }
    } catch { /* use token values as fallback */ }
  }

  // Issue new access token
  const newAccessToken = signToken({
    sub:         rp.sub,
    email:       rp.email,
    type:        rp.type,
    role,
    companyId:   rp.companyId,
    permissions,
  });

  // Issue new refresh token
  const newRefreshToken = signRefreshToken({
    sub:       rp.sub,
    email:     rp.email,
    type:      rp.type,
    role,
    companyId: rp.companyId,
  });

  // Persist new refresh token metadata
  const ip = getClientIp(req);
  const ua = req.headers.get("user-agent") ?? "";
  const newRp = verifyRefreshToken(newRefreshToken);
  try {
    await query(
      `INSERT INTO refresh_tokens (jti, user_id, email, company_id, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [newRp.jti, rp.sub, rp.email, rp.companyId ?? null,
       tokenExpiryDate(newRp as any).toISOString(), ua, ip]
    );
  } catch { /* best-effort */ }

  // Get companyName for the response (if applicable)
  let companyName: string | undefined;
  if (rp.companyId) {
    try {
      const saas = await loadSaaSData();
      companyName = saas.companies.find((c) => c.id === rp.companyId)?.name;
    } catch { /* ignore */ }
  }

  const res = NextResponse.json({
    token:       newAccessToken,
    role,
    companyId:   rp.companyId,
    companyName,
  });

  const isProduction = process.env.NODE_ENV === "production";
  res.cookies.set("refresh_token", newRefreshToken, {
    httpOnly: true,
    secure:   isProduction,
    sameSite: "strict",
    path:     "/api/auth/refresh",
    maxAge:   7 * 24 * 60 * 60, // 7 days
  });

  return res;
}
