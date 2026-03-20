/**
 * analytics_engine/utils/kpi_cache.ts
 *
 * Simple in-memory TTL cache for KPI results.
 *
 * Design:
 *  - Generic: stores any value keyed by string
 *  - Per-entry TTL with automatic expiry on read
 *  - Singleton KPICache created at module level — shared across all services
 *  - No external dependencies
 *
 * Usage:
 *   import { kpiCache } from './kpi_cache';
 *
 *   const cached = kpiCache.get<MyType>('company:2026-03');
 *   if (!cached) {
 *     const data = await expensiveComputation();
 *     kpiCache.set('company:2026-03', data, 300_000); // 5 min TTL
 *   }
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;  // epoch ms
}

export class KPICache {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTTL: number;

  /**
   * @param defaultTTL  Default time-to-live in milliseconds. Default: 5 minutes.
   */
  constructor(defaultTTL = 300_000) {
    this.defaultTTL = defaultTTL;
  }

  /**
   * Retrieve a cached value. Returns undefined if missing or expired.
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  /**
   * Store a value with an optional custom TTL.
   */
  set<T>(key: string, value: T, ttlMs?: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTTL),
    });
  }

  /**
   * Get from cache or compute and store.
   *
   * @example
   *   const data = await kpiCache.getOrSet('key', () => fetchExpensive(), 60_000);
   */
  async getOrSet<T>(
    key: string,
    compute: () => Promise<T>,
    ttlMs?: number,
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;

    const fresh = await compute();
    this.set(key, fresh, ttlMs);
    return fresh;
  }

  /**
   * Invalidate a specific key or all keys matching a prefix.
   */
  invalidate(keyOrPrefix: string): void {
    if (this.store.has(keyOrPrefix)) {
      this.store.delete(keyOrPrefix);
      return;
    }
    // Prefix match
    for (const key of this.store.keys()) {
      if (key.startsWith(keyOrPrefix)) this.store.delete(key);
    }
  }

  /**
   * Invalidate all entries for a company (useful after data mutations).
   */
  invalidateCompany(companyId: string): void {
    this.invalidate(`${companyId}:`);
  }

  /** Remove all expired entries (manual GC — call periodically if desired). */
  purgeExpired(): number {
    const now  = Date.now();
    let count  = 0;
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  /** Current number of (non-expired) entries. */
  get size(): number {
    this.purgeExpired();
    return this.store.size;
  }

  /** Clear all cache entries. Useful in tests. */
  clear(): void {
    this.store.clear();
  }

  /** Dump all active keys with remaining TTL (for debugging). */
  debug(): Array<{ key: string; ttlRemainingMs: number }> {
    const now = Date.now();
    return [...this.store.entries()]
      .filter(([, e]) => now <= e.expiresAt)
      .map(([key, e]) => ({ key, ttlRemainingMs: e.expiresAt - now }));
  }
}

/**
 * Shared global KPI cache instance.
 * Default TTL: 5 minutes.
 * Override per-call: kpiCache.set(key, val, customTTLms)
 */
export const kpiCache = new KPICache(300_000);
