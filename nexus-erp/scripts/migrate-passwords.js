#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HASH_PREFIX = 'scrypt';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${HASH_PREFIX}$${salt}$${derived}`;
}

function isHashed(p) {
  return typeof p === 'string' && p.startsWith(`${HASH_PREFIX}$`);
}

function updateUsersArray(users) {
  let changed = 0;
  if (!Array.isArray(users)) return 0;
  for (const u of users) {
    if (u && typeof u.password === 'string' && !isHashed(u.password)) {
      u.password = hashPassword(u.password);
      changed++;
    }
  }
  return changed;
}

async function migrateLocalFiles() {
  const dataDir = path.join(__dirname, '..', 'data');
  const saasFile = path.join(dataDir, 'saas.json');
  let total = 0;
  if (fs.existsSync(saasFile)) {
    try {
      const raw = fs.readFileSync(saasFile, 'utf8');
      const obj = JSON.parse(raw);
      let changed = 0;
      changed += updateUsersArray(obj.superAdmins);
      if (changed > 0) {
        fs.writeFileSync(saasFile, JSON.stringify(obj, null, 2), 'utf8');
        console.log(`Updated ${changed} passwords in data/saas.json`);
        total += changed;
      }
    } catch (e) {
      console.error('Failed processing data/saas.json', e.message || e);
    }
  } else {
    console.log('No data/saas.json found; skipping local saas.json migration.');
  }

  if (fs.existsSync(dataDir)) {
    const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json') && f !== 'saas.json');
    for (const file of files) {
      const full = path.join(dataDir, file);
      try {
        const raw = fs.readFileSync(full, 'utf8');
        const obj = JSON.parse(raw);
        const changed = updateUsersArray(obj.users);
        if (changed > 0) {
          fs.writeFileSync(full, JSON.stringify(obj, null, 2), 'utf8');
          console.log(`Updated ${changed} passwords in ${file}`);
          total += changed;
        }
      } catch (e) {
        // ignore invalid json files
      }
    }
  }
  return total;
}

async function migrateUpstash() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    console.log('Upstash KV not configured; skipping remote migration.');
    return 0;
  }
  let Redis;
  try {
    ({ Redis } = require('@upstash/redis'));
  } catch (e) {
    console.log('@upstash/redis not installed; skipping remote migration.');
    return 0;
  }
  const redis = new Redis({ url, token });
  let total = 0;
  try {
    let saasRaw = await redis.get('saas:data');
    let saas = saasRaw;
    if (typeof saasRaw === 'string') {
      try { saas = JSON.parse(saasRaw); } catch { saas = saasRaw; }
    }
    if (saas && Array.isArray(saas.superAdmins)) {
      const changed = updateUsersArray(saas.superAdmins);
      if (changed > 0) {
        await redis.set('saas:data', saas);
        console.log(`Updated ${changed} superAdmin passwords in Upstash key 'saas:data'`);
        total += changed;
      }
    }
    const companies = saas && Array.isArray(saas.companies) ? saas.companies : [];
    for (const c of companies) {
      const key = `tenant:${c.id}`;
      let tRaw = await redis.get(key);
      let t = tRaw;
      if (typeof tRaw === 'string') {
        try { t = JSON.parse(tRaw); } catch { t = tRaw; }
      }
      if (t && Array.isArray(t.users)) {
        const changed = updateUsersArray(t.users);
        if (changed > 0) {
          await redis.set(key, t);
          console.log(`Updated ${changed} user passwords in Upstash key '${key}'`);
          total += changed;
        }
      }
    }
  } catch (e) {
    console.error('Remote migration error:', e.message || e);
  }
  return total;
}

async function main() {
  console.log('Starting password migration...');
  const local = await migrateLocalFiles();
  const remote = await migrateUpstash();
  console.log('Migration complete. Local changes:', local, 'Remote changes:', remote);
}

main().catch((e) => { console.error(e); process.exit(1); });
