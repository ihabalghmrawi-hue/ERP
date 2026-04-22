import { NextRequest, NextResponse } from "next/server";

// POST /api/admin/wipe
// Wipes ALL data from Upstash (saas:data + all tenant:* keys).
// Requires SETUP_SECRET.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const secret = process.env.SETUP_SECRET;

    if (!secret)
      return NextResponse.json({ error: "SETUP_SECRET غير مضبوط" }, { status: 503 });
    if (body.secret !== secret)
      return NextResponse.json({ error: "المفتاح السري غير صحيح" }, { status: 403 });

    const url   = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    if (!url || !token)
      return NextResponse.json({ error: "KV_REST_API_URL أو KV_REST_API_TOKEN غير مضبوط" }, { status: 503 });

    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const deleted: string[] = [];

    // 1. Delete saas:data
    await fetch(`${url}/del/saas:data`, { method: "POST", headers });
    deleted.push("saas:data");

    // 2. Find all tenant:* keys via KEYS command
    const keysRes = await fetch(`${url}/keys/tenant:*`, { method: "GET", headers });
    if (keysRes.ok) {
      const keysData = await keysRes.json();
      const keys: string[] = keysData.result ?? [];
      for (const key of keys) {
        await fetch(`${url}/del/${encodeURIComponent(key)}`, { method: "POST", headers });
        deleted.push(key);
      }
    }

    return NextResponse.json({
      ok: true,
      message: "تم مسح جميع البيانات. النظام جاهز للإعداد من البداية.",
      deleted,
    });
  } catch (e: any) {
    console.error("[wipe] error:", e);
    return NextResponse.json({ error: e?.message ?? "unknown" }, { status: 500 });
  }
}
