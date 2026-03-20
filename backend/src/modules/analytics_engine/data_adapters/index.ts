/**
 * analytics_engine/data_adapters/index.ts
 * Barrel export for all data adapters.
 */

export {
  fetchVehicles,
  fetchFuelLoads,
  fetchMaintenances,
  fetchDrivers,
  fetchVehicleDocuments,
  fetchSettings,
  fetchFleetKPIInput,
} from './prisma.adapter';
