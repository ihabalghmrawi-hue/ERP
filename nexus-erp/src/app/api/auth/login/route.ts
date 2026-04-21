import { NextRequest, NextResponse } from "next/server";
import { loadSaaSData, findTenantUserByEmail, loadTenantData, saveTenantData, saveSaaSData } from "@/lib/server/storage";
import { signToken } from "@/lib/server/jwt";
import { verifyPassword, hashPassword } from "@/lib/server/password";
import { checkRateLimit, resetRateLimit } from "@/lib/server/rateLimit";

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  const ip    = getClientIp(req);
  const body  = await req.json().catch(() => ({}));
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "البريد الإلكتروني وكلمة المرور مطلوبان." },
      { status: 400 }
    );
  }

  // ── Rate limit by IP ────────────────────────────────────
  const ipLimit = checkRateLimit(`login:ip:${ip}`, 20, 15 * 60 * 1000);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "محاولات تسجيل دخول كثيرة. حاول مرة أخرى لاحقاً." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } }
    );
  }

  // ── Rate limit by email ─────────────────────────────────
  const emailLimit = checkRateLimit(`login:email:${email}`, 5, 15 * 60 * 1000);
  if (!emailLimit.allowed) {
    return NextResponse.json(
      { error: "تم تجاوز عدد المحاولات لهذا الحساب. حاول بعد 15 دقيقة." },
      { status: 429, headers: { "Retry-After": String(emailLimit.retryAfterSeconds) } }
    );
  }

  // ── Super Admin check ───────────────────────────────────
  const saas = await loadSaaSData();
  const superAdmin = saas.superAdmins.find((a) => a.email === email);

  if (superAdmin) {
    const { valid, needsRehash } = verifyPassword(password, superAdmin.password);
    if (!valid) {
      return NextResponse.json({ error: "بيانات الدخول غير صحيحة." }, { status: 401 });
    }

    // Auto-rehash legacy plaintext password
    if (needsRehash) {
      superAdmin.password = hashPassword(password);
      await saveSaaSData(saas);
    }

    resetRateLimit(`login:ip:${ip}`);
    resetRateLimit(`login:email:${email}`);

    const token = signToken({
      sub:   superAdmin.id,
      email: superAdmin.email,
      type:  "superadmin",
      role:  "superadmin",
    });
    return NextResponse.json({ token, role: "superadmin" });
  }

  // ── Tenant User check ───────────────────────────────────
  const tenantRecord = await findTenantUserByEmail(email);
  if (!tenantRecord) {
    // Deliberate vague message to prevent user enumeration
    return NextResponse.json({ error: "بيانات الدخول غير صحيحة." }, { status: 401 });
  }

  const { companyId, user } = tenantRecord;
  const { valid, needsRehash } = verifyPassword(password, user.password);

  if (!valid) {
    return NextResponse.json({ error: "بيانات الدخول غير صحيحة." }, { status: 401 });
  }

  if (user.status !== "active") {
    return NextResponse.json({ error: "الحساب غير نشط. تواصل مع مدير النظام." }, { status: 403 });
  }

  // Auto-rehash legacy plaintext password
  if (needsRehash) {
    const tenant = await loadTenantData(companyId);
    const u = tenant.users.find((u) => u.id === user.id);
    if (u) {
      u.password = hashPassword(password);
      await saveTenantData(companyId, tenant);
    }
  }

  const company = saas.companies.find((c) => c.id === companyId);
  if (!company) {
    return NextResponse.json({ error: "الشركة غير موجودة." }, { status: 401 });
  }

  resetRateLimit(`login:ip:${ip}`);
  resetRateLimit(`login:email:${email}`);

  const token = signToken({
    sub:         user.id,
    email:       user.email,
    type:        "company",
    role:        user.role,
    companyId,
    permissions: user.permissions,
  });

  return NextResponse.json({
    token,
    role:        user.role,
    companyId,
    companyName: company.name,
  });
}
