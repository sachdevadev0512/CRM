import type { Request } from 'express';

type RateLimitStore = Map<string, { count: number; resetAt: number }>;

// Separate Map instances are used per route family so admin-invite actions and public
// form-verification attempts don't share (and prematurely exhaust) the same counter.
export const adminInviteLimiter: RateLimitStore = new Map();
export const turnstileLimiter: RateLimitStore = new Map();
export const authLimiter: RateLimitStore = new Map();

export function checkRateLimit(
  store: RateLimitStore,
  ip: string,
  limit: number,
  timeframeMs: number
): { allowed: boolean; resetAt?: number } {
  const now = Date.now();

  // Proactive eviction of expired entries to prevent memory growth
  for (const [key, val] of store.entries()) {
    if (now > val.resetAt) {
      store.delete(key);
    }
  }

  const record = store.get(ip);
  if (!record) {
    store.set(ip, { count: 1, resetAt: now + timeframeMs });
    return { allowed: true };
  }

  if (record.count >= limit) {
    return { allowed: false, resetAt: record.resetAt };
  }

  record.count += 1;
  return { allowed: true };
}

export function getClientIp(req: Request): string {
  const rawIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  return rawIp.split(',')[0].trim();
}
