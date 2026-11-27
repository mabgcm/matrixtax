/**
 * Sliding-window rate limiter kept in memory.
 *
 * On Vercel, warm function instances are reused, so this blocks bursts from a
 * single client cheaply. It is a first line of defence, not a global
 * guarantee: for that, add a Vercel Firewall rate-limit rule on /api/contact.
 */
export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the client may try again (0 when allowed). */
  retryAfter: number;
}

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  maxKeys?: number;
  now?: () => number;
}

export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = 10_000,
  now = Date.now,
}: RateLimiterOptions) {
  const hits = new Map<string, number[]>();

  const prune = (time: number) => {
    for (const [key, stamps] of hits) {
      const fresh = stamps.filter((stamp) => time - stamp < windowMs);
      if (fresh.length === 0) hits.delete(key);
      else hits.set(key, fresh);
    }
  };

  return {
    check(key: string): RateLimitResult {
      const time = now();
      const stamps = (hits.get(key) ?? []).filter((stamp) => time - stamp < windowMs);

      if (stamps.length >= limit) {
        hits.set(key, stamps);
        const oldest = stamps[0] ?? time;
        return {
          allowed: false,
          retryAfter: Math.max(1, Math.ceil((oldest + windowMs - time) / 1000)),
        };
      }

      stamps.push(time);
      hits.set(key, stamps);
      if (hits.size > maxKeys) prune(time);
      return { allowed: true, retryAfter: 0 };
    },
  };
}
