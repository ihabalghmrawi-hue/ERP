/**
 * Run: node scripts/migrate-db.js
 * Requires: DATABASE_URL environment variable
 *
 * Applies all SQL migration files in db/migrations/ in order.
 */

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const conn = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!conn) {
  console.error("ERROR: DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString: conn });

async function run() {
  const migrationsDir = path.join(__dirname, "..", "db", "migrations");
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith(".sql"))
    .sort();

  console.log(`Found ${files.length} migration file(s).\n`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf8");
    console.log(`Applying: ${file}`);
    try {
      await pool.query(sql);
      console.log(`  ✓ Done\n`);
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}\n`);
      process.exit(1);
    }
  }

  console.log("All migrations applied successfully.");
  await pool.end();
}

run().catch(err => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
