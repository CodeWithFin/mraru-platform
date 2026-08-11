import { describe, expect, it } from 'vitest';

import { RateLimiter } from './rateLimit.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('RateLimiter', () => {
  it('allows hits up to the max, then blocks', async () => {
    const limiter = new RateLimiter(60_000, 3, 'test');
    await limiter.check('a');
    await limiter.check('a');
    await limiter.check('a');
    await expect(limiter.check('a')).rejects.toThrow('Too many requests');
  });

  it('tracks keys independently', async () => {
    const limiter = new RateLimiter(60_000, 1, 'test');
    await limiter.check('x');
    await limiter.check('y'); // different key — allowed
    await expect(limiter.check('x')).rejects.toThrow('Too many requests');
  });

  it('resets after the window elapses', async () => {
    const limiter = new RateLimiter(200, 1, 'test');
    await limiter.check('z');
    await expect(limiter.check('z')).rejects.toThrow('Too many requests');
    await sleep(300);
    await limiter.check('z'); // window passed
  });
});
