import { HttpError } from './errors.js';
import { getRedis } from '../services/queue.js';

/** Window tracker keyed by a string. Prunes itself on access. */
class MemoryWindow {
  private hits = new Map<string, number[]>();

  async count(key: string, windowMs: number): Promise<number> {
    const now = Date.now();
    const cutoff = now - windowMs;
    const existing = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    this.hits.set(key, existing);
    if (this.hits.size > 10_000) this.hits.clear();
    return existing.length;
  }

  async record(key: string, windowMs: number): Promise<number> {
    const list = this.hits.get(key) ?? [];
    list.push(Date.now());
    this.hits.set(key, list.filter((t) => t > Date.now() - windowMs));
    return list.length;
  }
}

class RedisWindow {
  async count(key: string, _windowMs: number): Promise<number> {
    const redis = getRedis();
    if (!redis) return 0;
    const val = await redis.get(key);
    return val ? Number(val) : 0;
  }

  async record(key: string, windowMs: number): Promise<number> {
    const redis = getRedis();
    if (!redis) return 0;
    const val = await redis.incr(key);
    if (val === 1) await redis.pexpire(key, windowMs);
    return val;
  }
}

/**
 * Fixed-window rate limiter. Redis-backed when REDIS_URL is configured,
 * in-memory otherwise (per-process, fine for dev).
 */
export class RateLimiter {
  private backend: MemoryWindow | RedisWindow;

  constructor(
    private readonly windowMs: number,
    private readonly max: number,
    private readonly scope: string,
  ) {
    this.backend = envHasRedis() ? new RedisWindow() : new MemoryWindow();
  }

  /** Record a hit; throw 429 if the window is already exhausted. */
  async check(key: string): Promise<void> {
    const fullKey = `${this.scope}:${key}`;
    const current = await this.backend.count(fullKey, this.windowMs);
    if (current >= this.max) {
      throw HttpError.tooManyRequests('Too many requests, try again later');
    }
    await this.backend.record(fullKey, this.windowMs);
  }

  async count(key: string): Promise<number> {
    return this.backend.count(`${this.scope}:${key}`, this.windowMs);
  }
}

function envHasRedis(): boolean {
  return Boolean(process.env.REDIS_URL);
}
