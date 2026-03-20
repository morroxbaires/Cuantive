/**
 * analytics_engine/bootstrap.ts
 *
 * Auto-registers all built-in KPI definitions into the global kpiRegistry.
 *
 * This file is imported by index.ts exactly once (module singleton pattern).
 * To register new KPIs, add their definitions here (or create a new register()
 * call in your feature module and import it in your app bootstrap).
 *
 * After this runs, kpiRegistry.listAll() will return all 20 built-in KPIs.
 *
 * Example of how to add a custom KPI from a feature module:
 *
 *   // my_feature/my_kpi.ts
 *   import { kpiRegistry } from '@/modules/analytics_engine';
 *   kpiRegistry.register({
 *     id: 'custom.my_kpi',
 *     name: 'Mi KPI especial',
 *     description: '...',
 *     category: 'custom',
 *     calculate: (input) => { ... },
 *   });
 */

import { kpiRegistry } from './registry';
import { ALL_KPI_DEFINITIONS } from './kpi_calculators';

// Register all built-in KPIs with their category as a tag for grouping
kpiRegistry.registerAll(ALL_KPI_DEFINITIONS);
