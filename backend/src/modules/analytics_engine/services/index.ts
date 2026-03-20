/**
 * analytics_engine/services/index.ts
 */
export { fleetCostKPIService, FleetCostKPIService } from './fleet_cost_kpi.service';
export type { StandardKPIOutput } from './fleet_cost_kpi.service';

export { fuelKPIService, FuelKPIService } from './fuel_kpi.service';

export { maintenanceKPIService, MaintenanceKPIService } from './maintenance_kpi.service';

export { availabilityKPIService, AvailabilityKPIService } from './availability_kpi.service';
export type { AvailabilityKPIOptions } from './availability_kpi.service';

export { utilizationKPIService, UtilizationKPIService } from './utilization_kpi.service';
export type { UtilizationKPIOptions } from './utilization_kpi.service';
