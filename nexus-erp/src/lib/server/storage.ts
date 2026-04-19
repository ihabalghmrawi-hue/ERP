import fs from "fs/promises";
import path from "path";
import { SaaSDatabase, SuperAdmin } from "@/saas/types";
import { DatabaseState, User, createInitialDatabaseState } from "@/lib/db/database";

const DATA_DIR = path.join(process.cwd(), "data");
const SAAS_FILE = path.join(DATA_DIR, "saas.json");
const TENANTS_DIR = path.join(DATA_DIR, "tenants");

const DEFAULT_SAAS: SaaSDatabase = {
  companies: [],
  superAdmins: [],
  globalCounters: { company: 1, subscription: 1 },
};

function uid(): string {
  return Math.random().toString(36).slice(2, 12);
}

function createInitialTenantState(): DatabaseState {
  return createInitialDatabaseState();
}

async function ensureDirectories() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(TENANTS_DIR, { recursive: true });
}

function getTenantPath(companyId: string) {
  return path.join(TENANTS_DIR, `${companyId}.json`);
}

function getSuperAdminSeed(): { name: string; email: string; password: string } | null {
  const email = process.env.SUPER_ADMIN_EMAIL || process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD || process.env.NEXT_PUBLIC_SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME || process.env.NEXT_PUBLIC_SUPER_ADMIN_NAME || "BOB ERP Super Admin";
  if (!email || !password) return null;
  return { name, email, password };
}

async function ensureSuperAdminSeeded(state: SaaSDatabase): Promise<boolean> {
  if (state.superAdmins.length > 0) return false;
  const seed = getSuperAdminSeed();
  if (!seed) return false;
  state.superAdmins.push({
    id: uid(),
    name: seed.name,
    email: seed.email,
    password: seed.password,
    role: "superadmin",
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  });
  return true;
}

export async function loadSaaSData(): Promise<SaaSDatabase> {
  await ensureDirectories();
  try {
    const raw = await fs.readFile(SAAS_FILE, "utf-8");
    const state = JSON.parse(raw) as SaaSDatabase;
    const seeded = await ensureSuperAdminSeeded(state);
    if (seeded) {
      await saveSaaSData(state);
    }
    return state;
  } catch {
    const state = { ...DEFAULT_SAAS };
    await ensureSuperAdminSeeded(state);
    await saveSaaSData(state);
    return state;
  }
}

export async function saveSaaSData(state: SaaSDatabase) {
  await ensureDirectories();
  await fs.writeFile(SAAS_FILE, JSON.stringify(state, null, 2), "utf-8");
}

export async function loadTenantData(companyId: string): Promise<DatabaseState> {
  await ensureDirectories();
  const filePath = getTenantPath(companyId);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as DatabaseState;
  } catch {
    const state = createInitialTenantState();
    await saveTenantData(companyId, state);
    return state;
  }
}

export async function saveTenantData(companyId: string, state: DatabaseState) {
  await ensureDirectories();
  const filePath = getTenantPath(companyId);
  await fs.writeFile(filePath, JSON.stringify(state, null, 2), "utf-8");
}

export async function findTenantUserByEmail(email: string): Promise<{ companyId: string; user: User } | null> {
  await ensureDirectories();
  const files = await fs.readdir(TENANTS_DIR);
  for (const filename of files) {
    if (!filename.endsWith(".json")) continue;
    const companyId = filename.replace(/\.json$/, "");
    const raw = await fs.readFile(path.join(TENANTS_DIR, filename), "utf-8");
    const tenant = JSON.parse(raw) as DatabaseState;
    const user = tenant.users.find((u) => u.email === email);
    if (user) return { companyId, user };
  }
  return null;
}
