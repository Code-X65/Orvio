import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryCache } from '../../src/infrastructure/cache/in-memory-cache.js';

describe('InMemoryCache', () => {
  let cache: InMemoryCache<any>;

  beforeEach(() => {
    cache = new InMemoryCache({ maxEntries: 3, defaultTtlMs: 50 });
  });

  it('stores and retrieves cached entries', () => {
    cache.set('key1', { data: 'test' });
    expect(cache.get('key1')).toEqual({ data: 'test' });
  });

  it('expires entries after TTL', async () => {
    cache.set('key1', 'temporary', 10);
    expect(cache.get('key1')).toBe('temporary');

    await new Promise((r) => setTimeout(r, 20));
    expect(cache.get('key1')).toBeNull();
  });

  it('evicts oldest entries when maxEntries is exceeded', () => {
    cache.set('k1', 'v1');
    cache.set('k2', 'v2');
    cache.set('k3', 'v3');
    expect(cache.size()).toBe(3);

    // Adding 4th entry evicts k1
    cache.set('k4', 'v4');
    expect(cache.size()).toBe(3);
    expect(cache.get('k1')).toBeNull();
    expect(cache.get('k2')).toBe('v2');
    expect(cache.get('k4')).toBe('v4');
  });

  it('clears keys by prefix', () => {
    cache.set('org:123:status', 'active');
    cache.set('org:123:branches', ['b1', 'b2']);
    cache.set('org:456:status', 'pending');

    const deleted = cache.clearPrefix('org:123:');
    expect(deleted).toBe(2);
    expect(cache.get('org:123:status')).toBeNull();
    expect(cache.get('org:123:branches')).toBeNull();
    expect(cache.get('org:456:status')).toBe('pending');
  });

  it('single-flight deduplicates concurrent fetchOrCompute requests', async () => {
    const fetcher = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 15));
      return { loaded: true };
    });

    // 10 concurrent requests for the exact same key
    const promises = Array.from({ length: 10 }).map(() =>
      cache.fetchOrCompute('hot_key', fetcher, 500)
    );

    const results = await Promise.all(promises);

    // All 10 received the exact same result
    expect(results).toHaveLength(10);
    results.forEach((res) => expect(res).toEqual({ loaded: true }));

    // The fetcher was only called ONCE!
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
