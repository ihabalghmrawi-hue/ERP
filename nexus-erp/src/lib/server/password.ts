import crypto from "crypto";

const HASH_PREFIX = "scrypt";
const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${HASH_PREFIX}$${salt}$${derived}`;
}

/**
 * Verifies a password against its stored hash.
 * Returns { valid, needsRehash } where needsRehash=true means the caller
 * should upgrade the stored hash to scrypt (legacy plaintext detected).
 */
export function verifyPassword(
  password: string,
  stored: string
): { valid: boolean; needsRehash: boolean } {
  if (!stored || typeof stored !== "string") {
    return { valid: false, needsRehash: false };
  }

  // Modern scrypt hash
  if (stored.startsWith(`${HASH_PREFIX}$`)) {
    const parts = stored.split("$");
    if (parts.length !== 3) return { valid: false, needsRehash: false };
    const [, salt, hash] = parts;
    try {
      const derived = crypto.scryptSync(password, salt, 64).toString("hex");
      const valid = crypto.timingSafeEqual(
        Buffer.from(hash, "hex"),
        Buffer.from(derived, "hex")
      );
      return { valid, needsRehash: false };
    } catch {
      return { valid: false, needsRehash: false };
    }
  }

  // Legacy plaintext — timing-safe comparison to prevent timing attacks
  const storedBuf = Buffer.from(stored, "utf8");
  const inputBuf  = Buffer.from(password, "utf8");
  let valid = false;
  try {
    // buffers must be same length for timingSafeEqual
    const padded = Buffer.alloc(storedBuf.length);
    inputBuf.copy(padded);
    valid = crypto.timingSafeEqual(storedBuf, padded) && password === stored;
  } catch {
    valid = false;
  }
  return { valid, needsRehash: valid }; // if valid, trigger immediate rehash
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل`;
  }
  if (!/[A-Z]/.test(password) && !/[a-z]/.test(password)) {
    return "كلمة المرور يجب أن تحتوي على أحرف";
  }
  if (!/\d/.test(password)) {
    return "كلمة المرور يجب أن تحتوي على رقم واحد على الأقل";
  }
  return null; // valid
}
