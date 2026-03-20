/**
 * analytics_engine/index.ts
 *
 * Main public API for the analytics engine module.
 *
 * Usage:
 *
 *   import {
 *     kpiRegistry,
 *     fetchFleetKPIInput,
 *     aggregateFleetHealth,
 *     runKPIAlertEngine,
 *     calculateTotalFleetCost,
 *     // …
 *   } from '@/modules/analytics_engine';
 *
 *   // 1. Load data via adapter
 *   const input = await fetchFleetKPIInput(companyId, { from, to });
 *
 *   // 2. Calculate individual KPI directly
 *   const cost = calculateTotalFleetCost({ fuelLoads: input.fuelLoads, maintenances: input.maintenances });
 *
 *   // 3. Or use the registry (dynamic)
 *   const result = kpiRegistry.execute('fleet_cost.total', input);
 *
 *   // 4. Run full fleet health aggregator
 *   const health = aggregateFleetHealth(input);
 *
 *   // 5. Generate KPI-based alert signals
 *   const alerts = runKPIAlertEngine(input);
 */

// ── Core ──────────────────────────────────────────────────────────────────────
export * from './types';
export { kpiRegistry, KPIRegistry } from './registry';

// ── Data adapters ─────────────────────────────────────────────────────────────
export * from './data_adapters';

// ── KPI calculators ───────────────────────────────────────────────────────────
export * from './kpi_calculators';

// ── Aggregators ───────────────────────────────────────────────────────────────
export * from './aggregators';

// ── Alert engine ──────────────────────────────────────────────────────────────
export * from './alert_engine';

// ── Utils ──────────────────────────────────────────────────────────────────────
export * from './utils';

// ── High-level services ───────────────────────────────────────────────────────
export * from './services';

// ── Bootstrap (auto-registers all built-in KPIs on import) ────────────────────
import './bootstrap';
