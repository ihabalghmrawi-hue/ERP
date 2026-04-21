import crypto from "crypto";

interface Bucket {
  count: number;
  resetAt: number;
  lockedUntil?: number; // progressive lockout after max failures
}

const store = new Map<string, Bucket>();

// Clean up expired entries every 10 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  store.forEach((bucket, key) => {
    if (now > bucket.resetAt && (!bucket.lockedUntil || now > bucket.lockedUntil)) {
      store.delete(key);
    }
  });
}, 10 * 60 * 1000);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Token-bucket rate limiter.
 * @param key       Unique identifier (e.g. "login:1.2.3.4" or "login:user@email.com")
 * @param max       Max attempts per window
 * @param windowMs  Window duration in milliseconds
 */
export function checkRateLimit(
  key: string,
  max = 5,
  windowMs = 15 * 60 * 1000
): RateLimitResult {
  const now = Date.now();
  const hashed = crypto.createHash("sha256").update(key).digest("hex").slice(0, 16);
  let bucket = store.get(hashed);

  // Locked out?
  if (bucket?.lockedUntil && now < bucket.lockedUntil) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.lockedUntil - now) / 1000),
    };
  }

  // Expired window — reset
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 1, resetAt: now + windowMs };
    store.set(hashed, bucket);
    return { allowed: true, remaining: max - 1, retryAfterSeconds: 0 };
  }

  bucket.count++;

  if (bucket.count > max) {
    // Progressive lockout: 15 min → 1 hr → 24 hr
    const lockMs =
      bucket.count > max + 10 ? 24 * 60 * 60 * 1000
      : bucket.count > max + 5  ? 60 * 60 * 1000
      : windowMs;
    bucket.lockedUntil = now + lockMs;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(lockMs / 1000),
    };
  }

  return {
    allowed: true,
    remaining: max - bucket.count,
    retryAfterSeconds: 0,
  };
}

/**
 * Reset rate limit for a key (call on successful login to unblock legit users).
 */
export function resetRateLimit(key: string): void {
  const hashed = crypto.createHash("sha256").update(key).digest("hex").slice(0, 16);
  store.delete(hashed);
}
