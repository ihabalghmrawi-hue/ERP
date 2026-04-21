#!/usr/bin/env node
/**
 * ERP Data Backup Script
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/backup.js
 *   DATABASE_URL=postgres://... node scripts/backup.js --output ./backups
 *   DATABASE_URL=postgres://... node scripts/backup.js --company company_00001
 *
 * Creates a timestamped JSON file containing all tenant and SaaS data.
 * Sensitive fields (passwords) are stripped from the backup.
 */

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!DB_URL) {
  console.error("ERROR: DATABASE_URL environment variable is required.");
  process.exit(1);
}

// Parse CLI args
const args = process.argv.slice(2);
const outputDir = args.includes("--output") ? args[args.indexOf("--output") + 1] : "./backups";
const specificCompany = args.includes("--company") ? args[args.indexOf("--company") + 1] : null;

const pool = new Pool({ connectionString: DB_URL });

function stripPasswords(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(stripPasswords);
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key === "password") {
      result[key] = "[REDACTED]";
    } else if (key === "superAdmins" && Array.isArray(val)) {
      result[key] = val.map(a => ({ ...a, password: "[REDACTED]" }));
    } else if (key === "users" && Array.isArray(val)) {
      result[key] = val.map(u => ({ ...u, password: "[REDACTED]" }));
    } else {
      result[key] = val;
    }
  }
  return result;
}

async function backup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = specificCompany
    ? `backup_${specificCompany}_${timestamp}.json`
    : `backup_full_${timestamp}.json`;

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outPath = path.join(outputDir, filename);

  const result = {
    createdAt: new Date().toISOString(),
    version: 1,
    saas: null,
    tenants: [],
  };

  // ── SaaS state ──────────────────────────────────────────────────────
  if (!specificCompany) {
    try {
      const res = await pool.query("SELECT data FROM erp_saas_state WHERE id = 1");
      if (res.rows.length > 0) {
        result.saas = stripPasswords(res.rows[0].data);
        console.log("✓ SaaS state backed up");
      } else {
        console.log("  SaaS state: no data found");
      }
    } catch (e) {
      console.warn("  SaaS state: table not found or error —", e.message);
    }
  }

  // ── Tenant state ─────────────────────────────────────────────────────
  try {
    const whereClause = specificCompany ? "WHERE company_id = $1" : "";
    const params      = specificCompany ? [specificCompany] : [];
    const res = await pool.query(
      `SELECT company_id, data, updated_at FROM erp_tenant_state ${whereClause} ORDER BY company_id`,
      params
    );

    for (const row of res.rows) {
      result.tenants.push({
        companyId:  row.company_id,
        updatedAt:  row.updated_at,
        data:       stripPasswords(row.data),
      });
    }

    if (res.rows.length > 0) {
      console.log(`✓ ${res.rows.length} tenant(s) backed up`);
    } else {
      console.log("  Tenants: no data found");
    }
  } catch (e) {
    console.warn("  Tenants: table not found or error —", e.message);
  }

  // ── Audit log (last 10 000 entries) ──────────────────────────────────
  if (!specificCompany) {
    try {
      const res = await pool.query(
        `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10000`
      );
      result.auditLog = res.rows;
      console.log(`✓ ${res.rows.length} audit log entries backed up`);
    } catch (e) {
      console.warn("  Audit log: table not found or error —", e.message);
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");
  const sizeKb = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`\nBackup saved: ${outPath} (${sizeKb} KB)`);
  await pool.end();
}

backup().catch(e => {
  console.error("Backup failed:", e.message);
  pool.end();
  process.exit(1);
});
