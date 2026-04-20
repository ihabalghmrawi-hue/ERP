const { Pool } = require('pg');

const retentionDays = process.env.AUDIT_RETENTION_DAYS ? parseInt(process.env.AUDIT_RETENTION_DAYS, 10) : 90;
const conn = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!conn) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: conn });

async function run() {
  try {
    console.log(`Archiving audit logs older than ${retentionDays} days...`);
    const res = await pool.query('SELECT archive_old_audit_logs($1)', [retentionDays]);
    console.log('Archive operation completed.');
  } catch (err) {
    console.error('Archive failed:', err.message || err);
    process.exit(2);
  } finally {
    await pool.end();
  }
}

run();
