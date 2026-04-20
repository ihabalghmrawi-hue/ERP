import { Pool } from "pg";

let pool: Pool | null = null;

function getPool() {
  if (!pool) {
    const conn = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!conn) throw new Error("DATABASE_URL is not set");
    pool = new Pool({ connectionString: conn });
  }
  return pool;
}

export async function query(text: string, params?: any[]) {
  const p = getPool();
  return p.query(text, params);
}

export async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
