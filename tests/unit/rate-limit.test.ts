import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '@/lib/contact/rate-limit';

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

  it('keeps memory bounded by pruning expired clients', () => {
    let time = 0;
    const limiter = createRateLimiter({ limit: 1, windowMs: 10, maxKeys: 5, now: () => time });
    for (let i = 0; i < 5; i++) limiter.check(`old-${i}`);
    time = 100;
    // Exceeding maxKeys triggers a prune of expired entries; behaviour stays correct.
    for (let i = 0; i < 10; i++) expect(limiter.check(`new-${i}`).allowed).toBe(true);
    expect(limiter.check('old-0').allowed).toBe(true);
  });
});
