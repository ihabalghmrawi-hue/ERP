import { NextRequest, NextResponse } from "next/server";
import { loadSaaSData, saveSaaSData } from "@/lib/server/storage";
import { redis, SAAS_KEY } from "@/lib/server/redis";

// POST /api/admin/reset
// Body: { secret: string }
// Deletes ALL SaaS data (companies, super admins, tenants) and starts fresh.
// Requires SETUP_SECRET env var to be set.

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const secret = process.env.SETUP_SECRET;

  // Guard: secret must be configured and match
  if (!secret) {
    return NextResponse.json(
      { error: "SETUP_SECRET غير مضبوط في متغيرات البيئة." },
      { status: 503 }
    );
  }
  if (body.secret !== secret) {
    return NextResponse.json(
      { error: "المفتاح السري غير صحيح." },
      { status: 403 }
    );
  }

  try {
    // 1. Load current SaaS data to get list of company IDs
    const saas = await loadSaaSData();
    const companyIds = saas.companies.map(c => c.id);

    // 2. Wipe SaaS state (companies + super admins)
    await saveSaaSData({
      companies: [],
      superAdmins: [],
      globalCounters: { company: 1, subscription: 1 },
    });

    // 3. Wipe all tenant data from Redis
    for (const id of companyIds) {
      try { await redis.del(`tenant:${id}`); } catch { /* best-effort */ }
    }

    // 4. Wipe SaaS key from Redis
    try { await redis.del(SAAS_KEY); } catch { /* best-effort */ }

    return NextResponse.json({
      ok: true,
      message: "تم حذف جميع البيانات. النظام جاهز للإعداد من البداية.",
      deletedCompanies: companyIds.length,
    });
  } catch (e: any) {
    console.error("[reset] error:", e);
    return NextResponse.json(
      { error: "حدث خطأ أثناء إعادة الضبط: " + (e?.message ?? "unknown") },
      { status: 500 }
    );
  }
}
