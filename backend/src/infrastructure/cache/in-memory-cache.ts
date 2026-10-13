import { Redis } from 'ioredis';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface InMemoryCacheOptions {
  maxEntries?: number;
  defaultTtlMs?: number;
}

export class InMemoryCache<T = any> {
  private readonly cache = new Map<string, CacheEntry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;

  constructor(options: InMemoryCacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? 2000;
    this.defaultTtlMs = options.defaultTtlMs ?? 60_000; // 60 seconds
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Refresh Map insertion order for LRU-like behavior
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    const duration = ttlMs ?? this.defaultTtlMs;

    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict oldest entry (first key in Map iterator)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + duration,
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clearPrefix(prefix: string): number {
    let deletedCount = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  clear(): void {
    this.cache.clear();
    this.inFlight.clear();
  }

  size(): number {
    return this.cache.size;
  }

  /**
   * Single-Flight Cache Resolver:
   * 1. Checks cache for active entry.
   * 2. If missing and a fetch is already in-flight for this key, reuses the existing Promise.
   * 3. Otherwise executes fetcher(), caches result upon resolution, and cleans in-flight map.
   */
  async fetchOrCompute(key: string, fetcher: () => Promise<T>, ttlMs?: number): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const existingPromise = this.inFlight.get(key);
    if (existingPromise) {
      return existingPromise;
    }

    const promise = (async () => {
      try {
        const result = await fetcher();
        this.set(key, result, ttlMs);
        return result;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }
}

/**
 * Hybrid Distributed Cache:
 * - Uses in-memory cache as Level-1 (L1) for microsecond reads and single-flight coalescing.
 * - Uses Redis as Level-2 (L2) for multi-pod cache sharing and distributed invalidation.
 * - If REDIS_URL is not set or Redis is unreachable, operates purely in L1 memory mode with zero failure.
 */
export class DistributedCache<T = any> {
  private readonly l1: InMemoryCache<T>;
  private redis: Redis | null = null;
  private isRedisReady = false;
  private readonly defaultTtlMs: number;

  constructor(options: InMemoryCacheOptions = {}) {
    this.l1 = new InMemoryCache<T>(options);
    this.defaultTtlMs = options.defaultTtlMs ?? 60_000;

    const redisUrl =
      process.env.REDIS_URL ||
      (process.env.REDIS_HOST
        ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`
        : null);

    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableReadyCheck: true,
          retryStrategy: (times: number) => {
            if (times > 3) return null; // Stop reconnecting after 3 tries
            return Math.min(times * 100, 2000);
          },
        });

        this.redis.on('ready', () => {
          this.isRedisReady = true;
        });
        this.redis.on('error', () => {
          this.isRedisReady = false;
        });

        this.redis.connect().catch(() => {
          this.isRedisReady = false;
        });
      } catch {
        this.redis = null;
        this.isRedisReady = false;
      }
    }
  }

  get(key: string): T | null {
    return this.l1.get(key);
  }

  set(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTtlMs;
    this.l1.set(key, value, ttl);

    if (this.isRedisReady && this.redis) {
      const seconds = Math.max(1, Math.ceil(ttl / 1000));
      this.redis.set(key, JSON.stringify(value), 'EX', seconds).catch(() => {});
    }
  }

  delete(key: string): boolean {
    const res = this.l1.delete(key);
    if (this.isRedisReady && this.redis) {
      this.redis.del(key).catch(() => {});
    }
    return res;
  }

  clearPrefix(prefix: string): number {
    const count = this.l1.clearPrefix(prefix);
    if (this.isRedisReady && this.redis) {
      this.clearRedisPrefix(prefix).catch(() => {});
    }
    return count;
  }

  private async clearRedisPrefix(prefix: string): Promise<void> {
    if (!this.redis) return;
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.redis.unlink(...keys);
        }
      } while (cursor !== '0');
    } catch {
      // Ignore Redis communication errors
    }
  }

  clear(): void {
    this.l1.clear();
  }

  async fetchOrCompute(key: string, fetcher: () => Promise<T>, ttlMs?: number): Promise<T> {
    // 1. Check L1 memory cache
    const l1Cached = this.l1.get(key);
    if (l1Cached !== null) {
      return l1Cached;
    }

    // 2. Check L2 Redis if available
    const ttl = ttlMs ?? this.defaultTtlMs;
    if (this.isRedisReady && this.redis) {
      try {
        const raw = await this.redis.get(key);
        if (raw) {
          const parsed = JSON.parse(raw) as T;
          this.l1.set(key, parsed, ttl);
          return parsed;
        }
      } catch {
        // Fallback to fetcher on Redis error
      }
    }

    // 3. Fallback to L1 fetchOrCompute with single-flight deduplication
    return await this.l1.fetchOrCompute(
      key,
      async () => {
        const result = await fetcher();
        if (this.isRedisReady && this.redis) {
          const seconds = Math.max(1, Math.ceil(ttl / 1000));
          this.redis.set(key, JSON.stringify(result), 'EX', seconds).catch(() => {});
        }
        return result;
      },
      ttl
    );
  }
}

// Global shared caches (Distributed with automatic in-memory fallback)
export const defaultAppCache = new DistributedCache({ maxEntries: 5000, defaultTtlMs: 60_000 });
export const inventoryCache = new DistributedCache({ maxEntries: 2000, defaultTtlMs: 60_000 });
