import { DatabaseState, User } from "@/lib/db/database";

export function sanitizeUser<T extends { password?: any }>(user: T | null | undefined): Omit<T, "password"> | null {
  if (!user) return null;
  // shallow copy without password
  // @ts-ignore
  const { password, ...rest } = user;
  return rest as Omit<T, "password">;
}

export function sanitizeTenantForClient(tenant: DatabaseState | null | undefined): DatabaseState | null {
  if (!tenant) return null;
  const copy: DatabaseState = { ...tenant, users: tenant.users.map((u: User) => sanitizeUser(u) as User) };
  return copy;
}
