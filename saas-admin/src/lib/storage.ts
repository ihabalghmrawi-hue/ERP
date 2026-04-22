import Redis from "ioredis";
import { Pool } from "pg";
import { SaaSDatabase, SuperAdmin, Company } from "./types";
import { hashPassword } from "./password";
import { v4 as uuidv4 } from "uuid";

// ── Redis ─────────────────────────────────────────────────────
let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.REDIS_URL || process.env.KV_URL;
  if (!url) return null;
  try {
    _redis = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 2 });
    return _redis;
  } catch { return null; }
}

// Must match the key used by nexus-erp (src/lib/server/redis.ts → SAAS_KEY)
const SAAS_KEY = "saas:data";

// ── PostgreSQL ────────────────────────────────────────────────
let _pool: Pool | null = null;

function getPool(): Pool | null {
  if (_pool) return _pool;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return null;
  try {
    _pool = new Pool({ connectionString: url, max: 5 });
    return _pool;
  } catch { return null; }
}

async function pgQuery(sql: string, params?: any[]): Promise<any[] | null> {
  const pool = getPool();
  if (!pool) return null;
  try {
    const res = await pool.query(sql, params);
    return res.rows;
  } catch { return null; }
}

// ── Default state ─────────────────────────────────────────────
function defaultSaaS(): SaaSDatabase {
  return { companies: [], superAdmins: [], globalCounters: { company: 1, subscription: 1 } };
}

// ── Load ──────────────────────────────────────────────────────
export async function loadSaaS(): Promise<SaaSDatabase> {
  // 1. PostgreSQL
  const rows = await pgQuery("SELECT data FROM erp_saas_state WHERE id = 1");
  if (rows && rows[0]?.data) return rows[0].data as SaaSDatabase;

  // 2. Redis
  const r = getRedis();
  if (r) {
    const raw = await r.get(SAAS_KEY).catch(() => null);
    if (raw) return JSON.parse(raw) as SaaSDatabase;
  }

  // 3. Fresh
  const fresh = defaultSaaS();
  await bootstrapSuperAdmin(fresh);
  await saveSaaS(fresh);
  return fresh;
}

// ── Save ──────────────────────────────────────────────────────
export async function saveSaaS(db: SaaSDatabase): Promise<void> {
  const json = JSON.stringify(db);

  // PostgreSQL
  await pgQuery(
    `INSERT INTO erp_saas_state (id, data, updated_at)
     VALUES (1, $1::jsonb, now())
     ON CONFLICT (id) DO UPDATE SET data = $1::jsonb, updated_at = now()`,
    [json]
  );

  // Redis
  const r = getRedis();
  if (r) await r.set(SAAS_KEY, json).catch(() => {});
}

// ── Bootstrap: create first super admin from env ───────────────
async function bootstrapSuperAdmin(db: SaaSDatabase): Promise<void> {
  const email = process.env.INITIAL_ADMIN_EMAIL;
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  const name = process.env.INITIAL_ADMIN_NAME || "Super Admin";
  if (!email || !password) return;
  if (db.superAdmins.some(a => a.email === email)) return;
  db.superAdmins.push({
    id: uuidv4(),
    name,
    email: email.toLowerCase(),
    password: hashPassword(password),
    createdAt: new Date().toISOString(),
  });
}

// ── Tenant data (read-only stats for admin panel) ──────────────
export async function loadTenantData(companyId: string): Promise<any> {
  // PostgreSQL
  const rows = await pgQuery(
    "SELECT data FROM erp_tenant_state WHERE company_id = $1",
    [companyId]
  );
  if (rows && rows[0]?.data) return rows[0].data;

  // Redis
  const r = getRedis();
  if (r) {
    const raw = await r.get(`tenant:${companyId}`).catch(() => null);
    if (raw) return JSON.parse(raw);
  }
  return null;
}

export async function saveTenantData(companyId: string, data: any): Promise<void> {
  const json = JSON.stringify(data);
  await pgQuery(
    `INSERT INTO erp_tenant_state (company_id, data, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (company_id) DO UPDATE SET data = $2::jsonb, updated_at = now()`,
    [companyId, json]
  );
  const r = getRedis();
  if (r) await r.set(`tenant:${companyId}`, json).catch(() => {});
}

// ── Helpers ────────────────────────────────────────────────────
export function nextId(db: SaaSDatabase, key: "company" | "subscription"): string {
  const n = db.globalCounters[key];
  db.globalCounters[key]++;
  return String(n).padStart(4, "0");
}

export function addDays(date: string | Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
