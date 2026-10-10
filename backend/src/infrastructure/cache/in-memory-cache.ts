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

// Global shared caches
export const defaultAppCache = new InMemoryCache({ maxEntries: 5000, defaultTtlMs: 60_000 });
export const inventoryCache = new InMemoryCache({ maxEntries: 2000, defaultTtlMs: 60_000 });
