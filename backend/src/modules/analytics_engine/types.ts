/**
 * analytics_engine/types.ts
 *
 * Core type system for the modular KPI analytics engine.
 *
 * Design principles:
 *  - All DTOs are plain objects (no Prisma models leaked here)
 *  - All calculators receive DTOs and return KPIResult objects
 *  - No I/O in calculator functions — data adapters handle that
 */

// ─── KPI Categories ──────────────────────────────────────────────────────────

export type KPICategory =
  | 'fleet_cost'
  | 'fuel'
  | 'maintenance'
  | 'availability'
  | 'utilization'
  | 'efficiency'
  | 'alerts'
  | 'custom';

// ─── KPI Severity / Status ───────────────────────────────────────────────────

export type KPIStatus = 'ok' | 'warning' | 'critical' | 'info' | 'no_data';

export interface KPIThreshold {
  warningMin?: number;
  warningMax?: number;
  criticalMin?: number;
  criticalMax?: number;
}

// ─── Core KPI result returned by every calculator ────────────────────────────

export interface KPIResult<T = number | string | null> {
  /** Unique identifier matching KPIDefinition.id */
  id: string;
  /** Human-readable label */
  label: string;
  /** The computed value */
  value: T;
  /** Optional formatted string for display (e.g. "$1,234" or "12.3 km/L") */
  formatted?: string;
  /** Unit descriptor (e.g. "CLP", "km/L", "%", "days") */
  unit?: string;
  /** Computed health status based on thresholds */
  status: KPIStatus;
  /** Optional supporting detail */
  meta?: Record<string, unknown>;
}

// ─── KPI Definition (what gets registered in the registry) ───────────────────

export interface KPIDefinition<TInput = unknown, TOutput = unknown> {
  id: string;
  name: string;
  description: string;
  category: KPICategory;
  unit?: string;
  thresholds?: KPIThreshold;
  /** The pure calculation function — no DB access inside */
  calculate: (input: TInput) => KPIResult<TOutput>;
}

// ─── Input DTOs (plain objects — adapters convert Prisma models to these) ─────

export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Minimal vehicle data needed for KPI calculations.
 * Adapters populate this from Prisma Vehicle model.
 */
export interface VehicleDTO {
  id: string;
  plate: string;
  name: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  currentOdometer: number;
  efficiencyReference: number | null;
  fuelType: string | null;
  vehicleType: string | null;
  active: boolean;
}

/**
 * Minimal fuel load data for KPI calculations.
 */
export interface FuelLoadDTO {
  id: string;
  vehicleId: string;
  driverId: string | null;
  date: Date;
  litersOrKwh: number;
  unitPrice: number | null;
  priceTotal: number | null;
  odometer: number | null;
  kmPerUnit: number | null;
  station: string | null;
}

/**
 * Minimal maintenance record data.
 */
export interface MaintenanceDTO {
  id: string;
  vehicleId: string;
  date: Date;
  type: string;
  status: string;
  description: string | null;
  cost: number | null;
  odometer: number | null;
  nextOdometer: number | null;
  nextDate: Date | null;
  workshopName: string | null;
}

/**
 * Minimal driver data.
 */
export interface DriverDTO {
  id: string;
  name: string;
  lastname: string;
  document: string | null;
  licenseCategory: string | null;
  licenseExpiry: Date | null;
  active: boolean;
}

/**
 * Vehicle document data.
 */
export interface VehicleDocumentDTO {
  id: string;
  vehicleId: string;
  plate: string;
  documentType: string;
  documentNumber: string | null;
  expirationDate: Date | null;
}

/**
 * Global fleet settings relevant to KPI thresholds.
 */
export interface SettingsDTO {
  fuelPrice: number | null;
  electricityPrice: number | null;
  alertFuelExcessPct: number;
  alertDaysBeforeLicense: number;
  alertDaysBeforeMaint: number;
  alertKmBeforeMaint: number;
  alertNoLoadDays: number;
}

// ─── Per-vehicle aggregated input (used by multi-vehicle calculators) ─────────

export interface VehicleKPIBundle {
  vehicle: VehicleDTO;
  fuelLoads: FuelLoadDTO[];
  maintenances: MaintenanceDTO[];
  documents: VehicleDocumentDTO[];
}

/**
 * Input bundle for fleet-level KPI calculators.
 */
export interface FleetKPIInput {
  vehicles: VehicleDTO[];
  fuelLoads: FuelLoadDTO[];
  maintenances: MaintenanceDTO[];
  drivers: DriverDTO[];
  documents: VehicleDocumentDTO[];
  settings: SettingsDTO;
  range: DateRange;
}

// ─── Computed sub-types used in KPI results ───────────────────────────────────

export interface CostBreakdown {
  vehicleId: string;
  plate: string;
  vehicleName: string;
  fuelCost: number;
  maintCost: number;
  totalCost: number;
  costPerKm: number | null;
  totalKm: number | null;
  costSharePct: number;
}

export interface FuelEfficiencyBreakdown {
  vehicleId: string;
  plate: string;
  avgKmPerUnit: number | null;
  efficiencyReference: number | null;
  deviationPct: number | null;
  isAnomaly: boolean;
  totalLiters: number;
  totalCost: number;
  loadCount: number;
}

export interface DriverRanking {
  position: number;
  driverId: string;
  driverName: string;
  grade: 'A' | 'B' | 'C' | 'D' | 'N/A';
  rankingScore: number | null;
  efficiencyReal: number | null;
  efficiencyRef: number | null;
  deviationPct: number | null;
  totalKm: number;
  fuelUsed: number;
  totalCost: number;
  loadCount: number;
}

export interface MaintenanceUrgency {
  vehicleId: string;
  plate: string;
  urgencyScore: number;
  urgencyLevel: 'critical' | 'warning' | 'ok';
  kmRemaining: number | null;
  daysRemaining: number | null;
  nextServiceDate: string | null;
  nextServiceKm: number | null;
  lastMaintenanceDate: string | null;
}

export interface IrregularLoad {
  loadId: string;
  vehicleId: string;
  plate: string;
  driverId: string | null;
  date: Date;
  kmPerUnit: number;
  vehicleAvg: number;
  zScore: number;
  liters: number;
  priceTotal: number | null;
  anomalyType: 'under' | 'over';
}

export interface FleetHealthScore {
  score: number;                    // 0–100
  grade: 'A' | 'B' | 'C' | 'D';
  components: {
    efficiencyScore: number;        // 0–30 points
    availabilityScore: number;      // 0–20 points
    maintenanceScore: number;       // 0–25 points
    alertResolutionScore: number;   // 0–15 points
    documentScore: number;          // 0–10 points
  };
  status: KPIStatus;
}

// ─── Registry entry (wraps KPIDefinition with runtime metadata) ───────────────

export interface KPIRegistryEntry {
  definition: KPIDefinition<unknown, unknown>;
  registeredAt: Date;
  tags?: string[];
}
