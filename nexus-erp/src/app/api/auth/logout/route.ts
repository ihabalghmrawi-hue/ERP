import { NextRequest, NextResponse } from "next/server";
import { verifyToken, verifyRefreshToken, revokeToken, tokenExpiryDate } from "@/lib/server/jwt";
import { query } from "@/lib/server/postgres";

export async function POST(req: NextRequest) {
  // Revoke the access token
  const authorization = req.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.replace("Bearer ", "");
    try {
      const payload = verifyToken(token);
      if (payload.jti) {
        await revokeToken(payload.jti, tokenExpiryDate(payload as any));
      }
    } catch {
      // Token already expired or invalid — ignore
    }
  }

  // Revoke the refresh token from HttpOnly cookie
  const refreshToken = req.cookies.get("refresh_token")?.value;
  if (refreshToken) {
    try {
      const rp = verifyRefreshToken(refreshToken);
      if (rp.jti) {
        await revokeToken(rp.jti, tokenExpiryDate(rp as any));
        // Mark in refresh_tokens table
        try {
          await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE jti = $1`, [rp.jti]);
        } catch { /* DB unavailable */ }
      }
    } catch {
      // Invalid/expired refresh token — ignore
    }
  }

  const res = NextResponse.json({ ok: true });
  // Clear the HttpOnly refresh cookie
  res.cookies.set("refresh_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth/refresh",
    maxAge: 0,
  });
  return res;
}
