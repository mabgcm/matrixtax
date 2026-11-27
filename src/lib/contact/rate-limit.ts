/**
 * Sliding-window rate limiter kept in memory.
 *
 * On Vercel, warm function instances are reused, so this blocks bursts from a
 * single client cheaply. It is a first line of defence, not a global
 * guarantee: for that, add a Vercel Firewall rate-limit rule on /api/contact.
 *
 * Memory is bounded: the map is kept in least-recently-seen order and, once it
 * grows past `maxKeys`, the oldest tenth is evicted in one batch (amortised
 * O(1) per request even under a flood of unique clients).
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
  const evictTo = Math.max(1, Math.floor(maxKeys * 0.9));

  const evictOldest = () => {
    for (const key of hits.keys()) {
      if (hits.size <= evictTo) break;
      hits.delete(key);
    }
  };

  return {
    check(key: string): RateLimitResult {
      const time = now();
      const stamps = (hits.get(key) ?? []).filter((stamp) => time - stamp < windowMs);
      // Re-insert so the map stays ordered from least to most recently seen.
      hits.delete(key);

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
      if (hits.size > maxKeys) evictOldest();
      return { allowed: true, retryAfter: 0 };
    },
    /** Number of tracked clients (for tests and diagnostics). */
    get size() {
      return hits.size;
    },
  };
}

/**
 * Normalises a client IP into a rate-limit key. IPv6 clients are grouped by
 * their /64 network, because a single connection typically controls a whole
 * /64 and could otherwise rotate addresses to dodge the limit.
 */
export function rateLimitKey(ip: string | undefined): string {
  if (!ip) return 'unknown';
  const value = ip.trim().toLowerCase().replace(/%.*$/, '');

  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(value);
  if (mapped?.[1]) return mapped[1];
  if (!value.includes(':')) return value;

  let groups: string[];
  if (value.includes('::')) {
    const [head = '', tail = ''] = value.split('::');
    const headParts = head ? head.split(':') : [];
    const tailParts = tail ? tail.split(':') : [];
    const zeros = Math.max(0, 8 - headParts.length - tailParts.length);
    groups = [...headParts, ...Array<string>(zeros).fill('0'), ...tailParts];
  } else {
    groups = value.split(':');
  }

  const network = groups
    .slice(0, 4)
    .map((group) => group.replace(/^0+(?=.)/, ''))
    .join(':');
  return `${network}::/64`;
}
