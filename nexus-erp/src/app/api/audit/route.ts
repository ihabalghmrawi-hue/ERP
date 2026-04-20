import { NextRequest, NextResponse } from "next/server";
import { query as pgQuery } from "@/lib/server/postgres";
import crypto from "crypto";

function computeHash(payload: any) {
  try {
    return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      userName,
      action,
      module,
      description,
      oldValues,
      newValues,
      ipAddress,
      userAgent,
      error,
    } = body;

    const xff = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
    const ip = ipAddress || (xff ? xff.split(",")[0].trim() : "");
    const ua = userAgent || req.headers.get("user-agent") || "";

    const createdAt = new Date().toISOString();
    const hash = computeHash({ userId, action, module, description, oldValues, newValues, createdAt });

    const sql = `INSERT INTO audit_log (user_id, user_name, action, module, description, old_values, new_values, ip_address, user_agent, error, hash, created_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                 RETURNING id, created_at`;
    const params = [
      userId || null,
      userName || null,
      action || null,
      module || null,
      description || null,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ip || null,
      ua || null,
      error || null,
      hash || null,
    ];

    const res = await pgQuery(sql, params);
    const inserted = res?.rows?.[0] ?? null;
    return NextResponse.json({ ok: true, id: inserted?.id ?? null, created_at: inserted?.created_at ?? createdAt }, { status: 201 });
  } catch (e: any) {
    console.error("/api/audit POST error:", e?.message || e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const perPage = Math.min(200, Math.max(1, parseInt(url.searchParams.get("perPage") || "25", 10)));
    const userId = url.searchParams.get("userId");
    const action = url.searchParams.get("action");
    const moduleFilter = url.searchParams.get("module");
    const search = url.searchParams.get("search");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (userId) { params.push(userId); whereClauses.push(`user_id = $${params.length}`); }
    if (action) { params.push(action); whereClauses.push(`action = $${params.length}`); }
    if (moduleFilter) { params.push(moduleFilter); whereClauses.push(`module = $${params.length}`); }
    if (from) { params.push(from); whereClauses.push(`created_at >= $${params.length}`); }
    if (to) { params.push(to); whereClauses.push(`created_at <= $${params.length}`); }
    if (search) { params.push(`%${search}%`); whereClauses.push(`(description ILIKE $${params.length} OR user_name ILIKE $${params.length} OR module ILIKE $${params.length})`); }

    const where = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // total count
    const countSql = `SELECT COUNT(*)::int AS total FROM audit_log ${where}`;
    const countRes = await pgQuery(countSql, params);
    const total = countRes?.rows?.[0]?.total ?? 0;

    // fetch rows
    const offset = (page - 1) * perPage;
    const dataSql = `SELECT id, user_id, user_name, action, module, description, old_values, new_values, ip_address, user_agent, error, created_at
                     FROM audit_log ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const dataParams = [...params, perPage, offset];
    const dataRes = await pgQuery(dataSql, dataParams);

    // map to client-friendly shape
    const rows = (dataRes?.rows || []).map((r: any) => ({
      id: r.id,
      timestamp: r.created_at?.toISOString?.() || r.created_at,
      userId: r.user_id,
      user: r.user_name,
      action: r.action,
      module: r.module,
      description: r.description,
      oldValues: r.old_values,
      newValues: r.new_values,
      ipAddress: r.ip_address,
      userAgent: r.user_agent,
      error: r.error,
      readonly: true,
    }));

    return NextResponse.json({ rows, total, page, perPage });
  } catch (e: any) {
    console.error("/api/audit GET error:", e?.message || e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
