import fs from "fs";
import path from "path";

let upstash: any = null;
let useUpstash = false;
try {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    // require at runtime to avoid dev dependency failures when not installed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Redis } = require("@upstash/redis");
    upstash = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
    useUpstash = true;
  }
} catch (e) {
  useUpstash = false;
}

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch { /* ignore */ }
}

async function fileGet(key: string) {
  try {
    if (key === "saas:data") {
      const p = path.join(DATA_DIR, "saas.json");
      if (!fs.existsSync(p)) return null;
      const raw = fs.readFileSync(p, "utf8");
      return JSON.parse(raw);
    }
    if (key.startsWith("tenant:")) {
      const id = key.split(":")[1];
      const p1 = path.join(DATA_DIR, `nexus_tenant_${id}.json`);
      const p2 = path.join(DATA_DIR, `tenant_${id}.json`);
      const p = fs.existsSync(p1) ? p1 : (fs.existsSync(p2) ? p2 : null);
      if (!p) return null;
      const raw = fs.readFileSync(p, "utf8");
      return JSON.parse(raw);
    }
    // generic key -> data/<key>.json
    const p = path.join(DATA_DIR, `${key}.json`);
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function fileSet(key: string, value: any) {
  try {
    if (key === "saas:data") {
      const p = path.join(DATA_DIR, "saas.json");
      fs.writeFileSync(p, JSON.stringify(value, null, 2), "utf8");
      return true;
    }
    if (key.startsWith("tenant:")) {
      const id = key.split(":")[1];
      const p = path.join(DATA_DIR, `nexus_tenant_${id}.json`);
      fs.writeFileSync(p, JSON.stringify(value, null, 2), "utf8");
      return true;
    }
    const p = path.join(DATA_DIR, `${key}.json`);
    fs.writeFileSync(p, JSON.stringify(value, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}

export const redis = {
  async get(key: string) {
    if (useUpstash && upstash) {
      try { return await upstash.get(key); } catch { /* fallback */ }
    }
    return await fileGet(key);
  },
  async set(key: string, value: any) {
    if (useUpstash && upstash) {
      try { return await upstash.set(key, value); } catch { /* fallback */ }
    }
    return await fileSet(key, value);
  },
  async del(key: string) {
    if (useUpstash && upstash) {
      try { return await upstash.del(key); } catch { /* fallback */ }
    }
    try {
      if (key === "saas:data") {
        const p = path.join(DATA_DIR, "saas.json"); if (fs.existsSync(p)) fs.unlinkSync(p);
        return true;
      }
      if (key.startsWith("tenant:")) {
        const id = key.split(":")[1];
        const p = path.join(DATA_DIR, `nexus_tenant_${id}.json`);
        if (fs.existsSync(p)) fs.unlinkSync(p);
        return true;
      }
      const p = path.join(DATA_DIR, `${key}.json`);
      if (fs.existsSync(p)) fs.unlinkSync(p);
      return true;
    } catch { return false; }
  }
};

export const SAAS_KEY = "saas:data";
export const tenantKey = (id: string) => `tenant:${id}`;
