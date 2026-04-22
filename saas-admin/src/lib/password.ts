import bcrypt from "bcryptjs";

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 12);
}

export function verifyPassword(plain: string, hash: string): boolean {
  // support legacy plain-text passwords
  if (!hash.startsWith("$2")) return plain === hash;
  return bcrypt.compareSync(plain, hash);
}
