import crypto from "crypto";

const HASH_PREFIX = "scrypt";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${HASH_PREFIX}$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored || typeof stored !== "string") return false;
  if (!stored.startsWith(`${HASH_PREFIX}$`)) {
    return password === stored;
  }
  const parts = stored.split("$");
  if (parts.length !== 3) return false;
  const [, salt, hash] = parts;
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
  } catch {
    return false;
  }
}
