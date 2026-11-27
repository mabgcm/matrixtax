import { describe, expect, it } from 'vitest';
import { createRateLimiter, rateLimitKey } from '@/lib/contact/rate-limit';

describe('createRateLimiter', () => {
  it('allows up to the limit within the window, then blocks', () => {
    let time = 0;
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: () => time });

    expect(limiter.check('ip').allowed).toBe(true);
    expect(limiter.check('ip').allowed).toBe(true);
    expect(limiter.check('ip').allowed).toBe(true);

    const blocked = limiter.check('ip');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBe(60);

    time = 30_000;
    expect(limiter.check('ip').retryAfter).toBe(30);
  });

  it('frees capacity as old requests leave the window', () => {
    let time = 0;
    const limiter = createRateLimiter({ limit: 2, windowMs: 1_000, now: () => time });
    limiter.check('ip');
    time = 500;
    limiter.check('ip');
    expect(limiter.check('ip').allowed).toBe(false);
    time = 1_001;
    expect(limiter.check('ip').allowed).toBe(true);
  });

  it('tracks clients independently', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000, now: () => 0 });
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(false);
    expect(limiter.check('b').allowed).toBe(true);
  });

  // Regression: pruning only dropped expired keys, so a flood of unique
  // clients inside the window grew the map without bound and made every
  // request scan it.
  it('stays bounded under a flood of unique clients within the window', () => {
    const limiter = createRateLimiter({ limit: 5, windowMs: 60_000, maxKeys: 1_000, now: () => 0 });
    for (let i = 0; i < 50_000; i++) limiter.check(`client-${i}`);
    expect(limiter.size).toBeLessThanOrEqual(1_000);
  });

  it('evicts the least recently seen clients first', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 10, now: () => 0 });
    expect(limiter.check('repeat-offender').allowed).toBe(true);
    for (let i = 0; i < 9; i++) limiter.check(`client-${i}`);
    // Seen again: moves to the most-recent end, so it survives the eviction below.
    expect(limiter.check('repeat-offender').allowed).toBe(false);
    for (let i = 9; i < 12; i++) limiter.check(`client-${i}`);
    expect(limiter.check('repeat-offender').allowed).toBe(false);
  });
});

describe('rateLimitKey', () => {
  it.each([
    [undefined, 'unknown'],
    ['203.0.113.7', '203.0.113.7'],
    ['::ffff:192.0.2.1', '192.0.2.1'],
    ['2001:db8:abcd:12:1:2:3:4', '2001:db8:abcd:12::/64'],
    ['2001:0db8:abcd:0012:ffff:ffff:ffff:ffff', '2001:db8:abcd:12::/64'],
    ['2001:db8::1', '2001:db8:0:0::/64'],
    ['fe80::1%eth0', 'fe80:0:0:0::/64'],
    ['::1', '0:0:0:0::/64'],
  ])('maps %j to %j', (ip, key) => {
    expect(rateLimitKey(ip)).toBe(key);
  });

  it('groups every address in an IPv6 /64 together', () => {
    expect(rateLimitKey('2001:db8:1:2::a')).toBe(rateLimitKey('2001:db8:1:2:dead:beef:0:1'));
    expect(rateLimitKey('2001:db8:1:2::a')).not.toBe(rateLimitKey('2001:db8:1:3::a'));
  });
});
