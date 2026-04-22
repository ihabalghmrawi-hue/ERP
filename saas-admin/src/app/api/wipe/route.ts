import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";

// POST /api/wipe
// Wipes all saas:data and tenant:* keys from Upstash.
// Requires login + SETUP_SECRET confirmation.
export async function POST(req: NextRequest) {
  if (!getAdminFromRequest(req))
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const secret = process.env.SETUP_SECRET;

  if (!secret)
    return NextResponse.json({ error: "SETUP_SECRET غير مضبوط في متغيرات البيئة" }, { status: 503 });
  if (body.setupKey !== secret)
    return NextResponse.json({ error: "مفتاح SETUP_SECRET غير صحيح" }, { status: 403 });

  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token)
    return NextResponse.json({ error: "KV_REST_API_URL أو KV_REST_API_TOKEN غير مضبوط" }, { status: 503 });

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const deleted: string[] = [];

  try {
    // Delete saas:data
    await fetch(`${url}/del/saas:data`, { method: "POST", headers });
    deleted.push("saas:data");

    // Find and delete all tenant:* keys
    const keysRes = await fetch(`${url}/keys/tenant:*`, { method: "GET", headers });
    if (keysRes.ok) {
      const keysData = await keysRes.json();
      const keys: string[] = keysData.result ?? [];
      for (const key of keys) {
        await fetch(`${url}/del/${encodeURIComponent(key)}`, { method: "POST", headers });
        deleted.push(key);
      }
    }

    return NextResponse.json({ ok: true, deleted });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unknown" }, { status: 500 });
  }
}
