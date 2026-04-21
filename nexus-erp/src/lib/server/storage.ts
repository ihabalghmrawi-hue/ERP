import { Pool } from "pg";
import { SaaSDatabase } from "@/saas/types";
import { DatabaseState, User, createInitialDatabaseState } from "@/lib/db/database";
import { redis, SAAS_KEY, tenantKey } from "./redis";
import { runMigrations } from "./migrate";

// ─── PostgreSQL pool (lazy, only when DATABASE_URL is set) ────
let _pool: Pool | null = null;
let _pgReady = false;
let _migrationsRan = false;

function getPool(): Pool | null {
  if (_pgReady) return _pool;
  const conn = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!conn) { _pgReady = true; return null; }
  try {
    _pool = new Pool({ connectionString: conn, max: 10 });
    _pgReady = true;
  } catch {
    _pool = null;
    _pgReady = true;
  }
  return _pool;
}

async function ensureMigrated(): Promise<void> {
  if (_migrationsRan) return;
  if (!getPool()) return; // no DB configured
  _migrationsRan = true;
  await runMigrations();
}

async function pgQuery(sql: string, params?: any[]): Promise<any[] | null> {
  try {
    const p = getPool();
    if (!p) return null;
    const res = await p.query(sql, params);
    return res.rows;
  } catch (e) {
    console.error("[storage] pgQuery error:", e);
    return null;
  }
}

// ─── Default state ────────────────────────────────────────────
const DEFAULT_SAAS: SaaSDatabase = {
  companies: [],
  superAdmins: [],
  globalCounters: { company: 1, subscription: 1 },
};

// ─── SaaS global state ────────────────────────────────────────

export async function loadSaaSData(): Promise<SaaSDatabase> {
  await ensureMigrated();
  // 1. Try PostgreSQL
  const rows = await pgQuery(`SELECT data FROM erp_saas_state WHERE id = 1`);
  if (rows && rows.length > 0 && rows[0].data) return rows[0].data as SaaSDatabase;

  // 2. Fall back to Redis / file
  try {
    const data = (await redis.get(SAAS_KEY)) as SaaSDatabase | null;
    return data ?? { ...DEFAULT_SAAS };
  } catch {
    return { ...DEFAULT_SAAS };
  }
}

export async function saveSaaSData(state: SaaSDatabase) {
  // 1. PostgreSQL (primary)
  await pgQuery(
    `INSERT INTO erp_saas_state (id, data, updated_at) VALUES (1, $1, NOW())
     ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = NOW()`,
    [JSON.stringify(state)]
  );

  // 2. Redis / file (secondary cache — best-effort)
  try { await redis.set(SAAS_KEY, state); } catch { /* non-fatal */ }
}

// ─── Per-tenant state ─────────────────────────────────────────

export async function loadTenantData(companyId: string): Promise<DatabaseState> {
  // 1. Try PostgreSQL
  const rows = await pgQuery(
    `SELECT data FROM erp_tenant_state WHERE company_id = $1`,
    [companyId]
  );
  if (rows && rows.length > 0 && rows[0].data) {
    const data = rows[0].data as DatabaseState;
    // Ensure emailLog exists for older records
    if (!data.emailLog) data.emailLog = [];
    return data;
  }

  // 2. Fall back to Redis / file
  try {
    const data = (await redis.get(tenantKey(companyId))) as DatabaseState | null;
    if (data) {
      if (!data.emailLog) data.emailLog = [];
      return data;
    }
    return createInitialDatabaseState();
  } catch {
    return createInitialDatabaseState();
  }
}

export async function saveTenantData(companyId: string, state: DatabaseState) {
  // Ensure emailLog field always present
  if (!state.emailLog) state.emailLog = [];

  // 1. PostgreSQL (primary)
  await pgQuery(
    `INSERT INTO erp_tenant_state (company_id, data, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (company_id) DO UPDATE SET data = $2, updated_at = NOW()`,
    [companyId, JSON.stringify(state)]
  );

  // 2. Redis / file (secondary cache — best-effort)
  try { await redis.set(tenantKey(companyId), state); } catch { /* non-fatal */ }
}

// ─── Cross-tenant lookup ──────────────────────────────────────

export async function findTenantUserByEmail(
  email: string
): Promise<{ companyId: string; user: User } | null> {
  // Fast path: query PostgreSQL directly with JSONB operators
  const rows = await pgQuery(`
    SELECT company_id, user_obj
    FROM erp_tenant_state,
         jsonb_array_elements(data->'users') AS user_obj
    WHERE user_obj->>'email' = $1
    LIMIT 1
  `, [email]);

  if (rows && rows.length > 0) {
    return { companyId: rows[0].company_id, user: rows[0].user_obj as User };
  }

  // Fall back: scan all tenants via Redis/file
  try {
    const saas = await loadSaaSData();
    for (const company of saas.companies) {
      const tenant = await loadTenantData(company.id);
      const user = tenant.users.find((u) => u.email === email);
      if (user) return { companyId: company.id, user };
    }
  } catch {}
  return null;
}
