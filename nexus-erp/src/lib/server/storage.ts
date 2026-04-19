import { SaaSDatabase, SuperAdmin } from "@/saas/types";
import { DatabaseState, User, createInitialDatabaseState } from "@/lib/db/database";
import { redis, SAAS_KEY, tenantKey } from "./redis";

const DEFAULT_SAAS: SaaSDatabase = {
  companies: [],
  superAdmins: [],
  globalCounters: { company: 1, subscription: 1 },
};

export async function loadSaaSData(): Promise<SaaSDatabase> {
  try {
    const data = await redis.get<SaaSDatabase>(SAAS_KEY);
    return data ?? { ...DEFAULT_SAAS };
  } catch {
    return { ...DEFAULT_SAAS };
  }
}

export async function saveSaaSData(state: SaaSDatabase) {
  await redis.set(SAAS_KEY, state);
}

export async function loadTenantData(companyId: string): Promise<DatabaseState> {
  try {
    const data = await redis.get<DatabaseState>(tenantKey(companyId));
    return data ?? createInitialDatabaseState();
  } catch {
    return createInitialDatabaseState();
  }
}

export async function saveTenantData(companyId: string, state: DatabaseState) {
  await redis.set(tenantKey(companyId), state);
}

export async function findTenantUserByEmail(email: string): Promise<{ companyId: string; user: User } | null> {
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
