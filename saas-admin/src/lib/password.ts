import crypto from "crypto";

const HASH_PREFIX = "scrypt";

export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(plain, salt, 64).toString("hex");
  return `${HASH_PREFIX}$${salt}$${derived}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (!stored || typeof stored !== "string") return false;

  // scrypt hash (modern)
  if (stored.startsWith(`${HASH_PREFIX}$`)) {
    const parts = stored.split("$");
    if (parts.length !== 3) return false;
    const [, salt, hash] = parts;
    try {
      const derived = crypto.scryptSync(plain, salt, 64).toString("hex");
      return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
    } catch { return false; }
  }

  // bcrypt hash (legacy — if any old hashes exist)
  if (stored.startsWith("$2")) {
    try {
      const bcrypt = require("bcryptjs");
      return bcrypt.compareSync(plain, stored);
    } catch { return false; }
  }

  // plain text (legacy)
  return plain === stored;
}
