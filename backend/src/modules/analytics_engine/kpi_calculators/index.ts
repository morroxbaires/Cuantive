/**
 * analytics_engine/kpi_calculators/index.ts
 *
 * Barrel export — exposes all KPI calculator functions and
 * the combined KPI definition arrays for registry bulk-registration.
 */

// ── Calculator functions ──────────────────────────────────────────────────────
export * from './fleet_cost_kpis';
export * from './fuel_kpis';
export * from './maintenance_kpis';
export * from './availability_kpis';
export * from './availability_kpi_calculator';
export * from './utilization_kpis';
export * from './utilization_kpi_calculator';
export * from './efficiency_kpis';

// ── Combined KPI definition arrays (for registry.registerAll) ────────────────
import { fleetCostKPIs }  from './fleet_cost_kpis';
import { fuelKPIs }       from './fuel_kpis';
import { maintenanceKPIs} from './maintenance_kpis';
import { availabilityKPIs}         from './availability_kpis';
import { availabilityCalculatorKPIs } from './availability_kpi_calculator';
import { utilizationKPIs }            from './utilization_kpis';
import { utilizationCalculatorKPIs }  from './utilization_kpi_calculator';
import { efficiencyKPIs } from './efficiency_kpis';

export const ALL_KPI_DEFINITIONS = [
  ...fleetCostKPIs,
  ...fuelKPIs,
  ...maintenanceKPIs,
  ...availabilityKPIs,
  ...availabilityCalculatorKPIs,
  ...utilizationKPIs,
  ...utilizationCalculatorKPIs,
  ...efficiencyKPIs,
];

export {
  fleetCostKPIs,
  fuelKPIs,
  maintenanceKPIs,
  availabilityKPIs,
  availabilityCalculatorKPIs,
  utilizationKPIs,
  utilizationCalculatorKPIs,
  efficiencyKPIs,
};
