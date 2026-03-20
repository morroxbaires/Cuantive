/**
 * analytics_engine/registry.ts
 *
 * KPI Registry — singleton that maintains all registered KPI definitions.
 *
 * Usage:
 *   // Register a KPI
 *   kpiRegistry.register(myKPIDefinition);
 *
 *   // Retrieve and execute
 *   const kpi = kpiRegistry.get('fleet.total_cost');
 *   const result = kpi.calculate(input);
 *
 *   // List all available KPIs
 *   const all = kpiRegistry.listAll();
 *   const costKpis = kpiRegistry.getByCategory('fleet_cost');
 *
 * Design notes:
 *  - IDs are namespaced: "<category>.<snake_case_name>"  (e.g. "fuel.avg_km_per_liter")
 *  - Registration is idempotent: re-registering the same id overwrites the previous definition
 *  - No database access here — this is purely a map of pure functions
 */

import type {
  KPICategory,
  KPIDefinition,
  KPIRegistryEntry,
  KPIResult,
} from './types';

class KPIRegistry {
  private readonly entries = new Map<string, KPIRegistryEntry>();

  // ── Registration ─────────────────────────────────────────────────────────

  /**
   * Register a KPI definition.
   * If a KPI with the same id already exists it will be replaced (hot-reload safe).
   */
  register<TInput, TOutput>(
    definition: KPIDefinition<TInput, TOutput>,
    tags?: string[],
  ): this {
    this.entries.set(definition.id, {
      definition: definition as KPIDefinition<unknown, unknown>,
      registeredAt: new Date(),
      tags,
    });
    return this;
  }

  /**
   * Register multiple KPI definitions at once.
   */
  registerAll(definitions: KPIDefinition<unknown, unknown>[], tags?: string[]): this {
    definitions.forEach(d => this.register(d, tags));
    return this;
  }

  // ── Retrieval ─────────────────────────────────────────────────────────────

  /**
   * Get a single KPI definition by id.
   * Throws if not found — fail-fast pattern.
   */
  get(id: string): KPIDefinition<unknown, unknown> {
    const entry = this.entries.get(id);
    if (!entry) {
      throw new Error(`KPI not found in registry: "${id}". Registered IDs: [${[...this.entries.keys()].join(', ')}]`);
    }
    return entry.definition;
  }

  /**
   * Get all KPIs in a category.
   */
  getByCategory(category: KPICategory): KPIDefinition<unknown, unknown>[] {
    return [...this.entries.values()]
      .filter(e => e.definition.category === category)
      .map(e => e.definition);
  }

  /**
   * Get all KPIs matching one or more tags.
   */
  getByTag(tag: string): KPIDefinition<unknown, unknown>[] {
    return [...this.entries.values()]
      .filter(e => e.tags?.includes(tag))
      .map(e => e.definition);
  }

  /**
   * Check if a KPI id is registered.
   */
  has(id: string): boolean {
    return this.entries.has(id);
  }

  /**
   * List all registered KPI definitions.
   */
  listAll(): KPIDefinition<unknown, unknown>[] {
    return [...this.entries.values()].map(e => e.definition);
  }

  /**
   * List all registered KPI ids.
   */
  listIds(): string[] {
    return [...this.entries.keys()];
  }

  /**
   * Get registry stats — useful for health checks / admin panels.
   */
  stats(): {
    total: number;
    byCategory: Record<string, number>;
    registeredAt: Record<string, Date>;
  } {
    const byCategory: Record<string, number> = {};
    const registeredAt: Record<string, Date> = {};

    for (const [id, entry] of this.entries) {
      const cat = entry.definition.category;
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
      registeredAt[id] = entry.registeredAt;
    }

    return { total: this.entries.size, byCategory, registeredAt };
  }

  // ── Execution helpers ─────────────────────────────────────────────────────

  /**
   * Execute a single registered KPI by id with the given input.
   */
  execute<TInput, TOutput>(id: string, input: TInput): KPIResult<TOutput> {
    const kpi = this.get(id) as KPIDefinition<TInput, TOutput>;
    return kpi.calculate(input);
  }

  /**
   * Execute all KPIs in a category with the same input.
   * Returns a map of id → KPIResult.
   */
  executeCategory<TInput>(
    category: KPICategory,
    input: TInput,
  ): Map<string, KPIResult<unknown>> {
    const results = new Map<string, KPIResult<unknown>>();
    const kpis = this.getByCategory(category);

    for (const kpi of kpis) {
      try {
        results.set(kpi.id, (kpi as KPIDefinition<TInput, unknown>).calculate(input));
      } catch (err) {
        // Isolate failures — one bad KPI should not break the others
        results.set(kpi.id, {
          id: kpi.id,
          label: kpi.name,
          value: null,
          status: 'no_data',
          meta: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }

    return results;
  }

  /**
   * Unregister a KPI by id (useful in testing).
   */
  unregister(id: string): boolean {
    return this.entries.delete(id);
  }

  /**
   * Clear all registrations (useful in testing).
   */
  clear(): void {
    this.entries.clear();
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────

/**
 * Global KPI registry — import this anywhere to register or retrieve KPIs.
 *
 * @example
 *   import { kpiRegistry } from '@/modules/analytics_engine/registry';
 *   kpiRegistry.register(myKPI);
 *   const result = kpiRegistry.execute('fuel.avg_km_per_liter', input);
 */
export const kpiRegistry = new KPIRegistry();

// Export the class for testing / subclassing
export { KPIRegistry };
