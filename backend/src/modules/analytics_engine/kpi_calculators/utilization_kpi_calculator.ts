/**
 * analytics_engine/kpi_calculators/utilization_kpi_calculator.ts
 *
 * Fleet utilization KPI calculators — all pure functions.
 *
 * Exported KPIs:
 *   calculateKmPerVehicle      — km recorridos por vehículo en el período
 *   calculateUsageHours        — horas de uso estimadas por vehículo en el período
 *   calculateFleetUtilization  — vehículos activos / total (+ operacionales en período)
 *
 * Filters supported by all three functions:
 *   range        — DateRange (from / to)  — período de análisis
 *   vehicleType  — fleet filter: tipo de vehículo (e.g. "camión", "auto")
 *   vehicleIds   — vehicle filter: lista de vehicleId específicos
 *
 * Km algorithm:
 *   For each vehicle, sort fuel loads by odometer reading within the range.
 *   km = max(odometer) - min(odometer) across loads in period.
 *   If no odometer data, falls back to Σ(kmPerUnit × litersOrKwh) from each load.
 *
 * Usage hours algorithm:
 *   Count distinct calendar days with at least one fuel load OR completed maintenance.
 *   Multiply by hoursPerActiveDay (configurable, default 8h/day).
 *   This is explicitly an estimate — label conveys this.
 *
 * Fleet utilization:
 *   utilizationPct    = active vehicles / total vehicles × 100   (structural)
 *   operationalPct    = vehicles with activity in period / active vehicles × 100
 */

import type {
  KPIDefinition,
  KPIResult,
  VehicleDTO,
  FuelLoadDTO,
  MaintenanceDTO,
  DateRange,
  KPIStatus,
} from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);       // 'YYYY-MM-DD'
}

function periodDays(range: DateRange): number {
  return Math.max(1, Math.ceil((range.to.getTime() - range.from.getTime()) / MS_PER_DAY));
}

// ─── Filter helpers ───────────────────────────────────────────────────────────

function applyVehicleFilters(
  vehicles:    VehicleDTO[],
  vehicleType?: string,
  vehicleIds?:  string[],
): VehicleDTO[] {
  let out = vehicles;
  if (vehicleType) {
    const t = vehicleType.toLowerCase();
    out = out.filter(v => (v.vehicleType ?? '').toLowerCase() === t);
  }
  if (vehicleIds && vehicleIds.length > 0) {
    const s = new Set(vehicleIds);
    out = out.filter(v => s.has(v.id));
  }
  return out;
}

function loadsInRange(loads: FuelLoadDTO[], range: DateRange): FuelLoadDTO[] {
  return loads.filter(f => f.date >= range.from && f.date <= range.to);
}

function maintsInRange(maints: MaintenanceDTO[], range: DateRange): MaintenanceDTO[] {
  return maints.filter(m => m.date >= range.from && m.date <= range.to);
}

// ─── KPI 1: Km per vehicle ────────────────────────────────────────────────────

export interface KmPerVehicleRow {
  vehicleId:     string;
  plate:         string;
  name:          string;
  vehicleType:   string | null;
  kmTraveled:    number;
  method:        'odometer' | 'estimated' | 'no_data';
  loadCount:     number;
  kmShare:       number;   // % of fleet total
}

export interface KmPerVehicleResult {
  fleetTotalKm:  number;
  avgKmPerVehicle: number | null;
  perVehicle:    KmPerVehicleRow[];
}

export interface KmPerVehicleInput {
  vehicles:     VehicleDTO[];
  fuelLoads:    FuelLoadDTO[];
  range:        DateRange;
  vehicleType?: string;
  vehicleIds?:  string[];
}

export function calculateKmPerVehicle(
  input: KmPerVehicleInput,
): KPIResult<KmPerVehicleResult> {
  const filtered = applyVehicleFilters(input.vehicles, input.vehicleType, input.vehicleIds);

  // Group loads by vehicle, restrict to range
  const loadsByVehicle = new Map<string, FuelLoadDTO[]>();
  for (const f of loadsInRange(input.fuelLoads, input.range)) {
    if (!loadsByVehicle.has(f.vehicleId)) loadsByVehicle.set(f.vehicleId, []);
    loadsByVehicle.get(f.vehicleId)!.push(f);
  }

  // First pass: compute raw km per vehicle
  const rawRows: { vehicleId: string; plate: string; name: string; vehicleType: string | null; kmTraveled: number; method: KmPerVehicleRow['method']; loadCount: number }[] = filtered.map(v => {
    const loads = (loadsByVehicle.get(v.id) ?? []).sort((a, b) =>
      (a.odometer ?? 0) - (b.odometer ?? 0),
    );
    const loadCount = loads.length;

    // Odometer span method (preferred)
    const odoLoads = loads.filter(f => f.odometer !== null && f.odometer! > 0);
    if (odoLoads.length >= 2) {
      const minOdo = odoLoads[0].odometer!;
      const maxOdo = odoLoads[odoLoads.length - 1].odometer!;
      const km     = Math.max(0, maxOdo - minOdo);
      return { vehicleId: v.id, plate: v.plate, name: v.name, vehicleType: v.vehicleType ?? null, kmTraveled: Math.round(km * 10) / 10, method: 'odometer', loadCount };
    }

    // Estimation method: Σ kmPerUnit × litersOrKwh
    const estimated = loads.reduce((s, f) => {
      if (f.kmPerUnit !== null && f.kmPerUnit > 0) {
        return s + f.kmPerUnit * f.litersOrKwh;
      }
      if (v.efficiencyReference !== null && v.efficiencyReference > 0) {
        return s + v.efficiencyReference * f.litersOrKwh;
      }
      return s;
    }, 0);

    if (estimated > 0) {
      return { vehicleId: v.id, plate: v.plate, name: v.name, vehicleType: v.vehicleType ?? null, kmTraveled: Math.round(estimated * 10) / 10, method: 'estimated', loadCount };
    }

    return { vehicleId: v.id, plate: v.plate, name: v.name, vehicleType: v.vehicleType ?? null, kmTraveled: 0, method: 'no_data', loadCount };
  });

  const fleetTotalKm = Math.round(rawRows.reduce((s, r) => s + r.kmTraveled, 0) * 10) / 10;
  const activeRows   = rawRows.filter(r => r.kmTraveled > 0);
  const avgKmPerVehicle = activeRows.length > 0
    ? Math.round((fleetTotalKm / activeRows.length) * 10) / 10
    : null;

  const perVehicle: KmPerVehicleRow[] = rawRows
    .map(r => ({
      ...r,
      kmShare: fleetTotalKm > 0 ? Math.round((r.kmTraveled / fleetTotalKm) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.kmTraveled - a.kmTraveled);

  const noDataCount = perVehicle.filter(r => r.method === 'no_data').length;
  const status: KPIStatus =
    filtered.length === 0           ? 'no_data' :
    noDataCount === filtered.length  ? 'no_data' :
    noDataCount > filtered.length / 2 ? 'warning' : 'ok';

  return {
    id:        'utilization.km_per_vehicle',
    label:     'Km recorridos por vehículo',
    value:     { fleetTotalKm, avgKmPerVehicle, perVehicle },
    formatted: `${fleetTotalKm.toLocaleString('es-CL')} km`,
    unit:      'km',
    status,
  };
}

// ─── KPI 2: Usage hours ───────────────────────────────────────────────────────

export interface UsageHoursRow {
  vehicleId:        string;
  plate:            string;
  name:             string;
  vehicleType:      string | null;
  activeDays:       number;
  estimatedHours:   number;
  utilizationPct:   number;  // activeDays / periodDays × 100
  hoursPerActiveDay: number; // the factor used
}

export interface UsageHoursResult {
  totalEstimatedHours: number;
  avgHoursPerVehicle:  number | null;
  periodDays:          number;
  hoursPerActiveDay:   number;
  perVehicle:          UsageHoursRow[];
}

export interface UsageHoursInput {
  vehicles:          VehicleDTO[];
  fuelLoads:         FuelLoadDTO[];
  maintenances:      MaintenanceDTO[];
  range:             DateRange;
  hoursPerActiveDay?: number;  // default: 8
  vehicleType?:      string;
  vehicleIds?:       string[];
}

export function calculateUsageHours(
  input: UsageHoursInput,
): KPIResult<UsageHoursResult> {
  const hoursPerDay = input.hoursPerActiveDay ?? 8;
  const days        = periodDays(input.range);
  const filtered    = applyVehicleFilters(input.vehicles, input.vehicleType, input.vehicleIds);

  // Build active-day sets per vehicle from fuel loads (in range)
  const activeDaysByVehicle = new Map<string, Set<string>>();
  for (const f of loadsInRange(input.fuelLoads, input.range)) {
    if (!activeDaysByVehicle.has(f.vehicleId)) activeDaysByVehicle.set(f.vehicleId, new Set());
    activeDaysByVehicle.get(f.vehicleId)!.add(toDateKey(f.date));
  }
  // Add days with completed maintenance (proxy for vehicle being operated)
  for (const m of maintsInRange(input.maintenances, input.range)) {
    const s = (m.status ?? '').toLowerCase();
    if (!s.includes('complet')) continue;
    if (!activeDaysByVehicle.has(m.vehicleId)) activeDaysByVehicle.set(m.vehicleId, new Set());
    activeDaysByVehicle.get(m.vehicleId)!.add(toDateKey(m.date));
  }

  let totalHours = 0;

  const perVehicle: UsageHoursRow[] = filtered.map(v => {
    const activeDaySet  = activeDaysByVehicle.get(v.id) ?? new Set<string>();
    const activeDays    = activeDaySet.size;
    const estimatedHours = Math.round(activeDays * hoursPerDay * 10) / 10;
    const utilizationPct = Math.round((activeDays / days) * 1000) / 10;
    totalHours += estimatedHours;

    return {
      vehicleId:         v.id,
      plate:             v.plate,
      name:              v.name,
      vehicleType:       v.vehicleType ?? null,
      activeDays,
      estimatedHours,
      utilizationPct,
      hoursPerActiveDay: hoursPerDay,
    };
  });

  perVehicle.sort((a, b) => b.estimatedHours - a.estimatedHours);

  const withActivity   = perVehicle.filter(r => r.activeDays > 0).length;
  const avgHoursPerVehicle = withActivity > 0
    ? Math.round((totalHours / withActivity) * 10) / 10
    : null;

  const status: KPIStatus =
    filtered.length === 0  ? 'no_data' :
    withActivity === 0     ? 'no_data' :
    withActivity < filtered.length * 0.5 ? 'warning' : 'ok';

  return {
    id:        'utilization.usage_hours',
    label:     'Horas de uso por vehículo',
    value:     {
      totalEstimatedHours: Math.round(totalHours * 10) / 10,
      avgHoursPerVehicle,
      periodDays:          days,
      hoursPerActiveDay:   hoursPerDay,
      perVehicle,
    },
    formatted: `${Math.round(totalHours).toLocaleString('es-CL')} hrs estimadas`,
    unit:      'horas',
    status,
  };
}

// ─── KPI 3: Fleet utilization ─────────────────────────────────────────────────

export interface FleetUtilizationResult {
  total:            number;   // all vehicles in filter scope
  active:           number;   // vehicle.active === true
  inactive:         number;
  operational:      number;   // active + had activity in period
  utilizationPct:   number;   // active / total × 100
  operationalPct:   number;   // operational / active × 100  (or 0 if no active)
  perVehicle:       FleetUtilizationRow[];
}

export interface FleetUtilizationRow {
  vehicleId:    string;
  plate:        string;
  name:         string;
  vehicleType:  string | null;
  active:       boolean;
  operational:  boolean;  // had fuel load or maintenance in period
  activeDays:   number;
}

export interface FleetUtilizationInput {
  vehicles:     VehicleDTO[];
  fuelLoads:    FuelLoadDTO[];
  maintenances: MaintenanceDTO[];
  range:        DateRange;
  vehicleType?: string;
  vehicleIds?:  string[];
}

export function calculateFleetUtilization(
  input: FleetUtilizationInput,
): KPIResult<FleetUtilizationResult> {
  const filtered = applyVehicleFilters(input.vehicles, input.vehicleType, input.vehicleIds);

  // Build activity sets per vehicle within range
  const activityByVehicle = new Map<string, Set<string>>();
  for (const f of loadsInRange(input.fuelLoads, input.range)) {
    if (!activityByVehicle.has(f.vehicleId)) activityByVehicle.set(f.vehicleId, new Set());
    activityByVehicle.get(f.vehicleId)!.add(toDateKey(f.date));
  }
  for (const m of maintsInRange(input.maintenances, input.range)) {
    if (!activityByVehicle.has(m.vehicleId)) activityByVehicle.set(m.vehicleId, new Set());
    activityByVehicle.get(m.vehicleId)!.add(toDateKey(m.date));
  }

  const perVehicle: FleetUtilizationRow[] = filtered.map(v => {
    const days       = activityByVehicle.get(v.id)?.size ?? 0;
    const operational = v.active && days > 0;
    return {
      vehicleId:   v.id,
      plate:       v.plate,
      name:        v.name,
      vehicleType: v.vehicleType ?? null,
      active:      v.active,
      operational,
      activeDays:  days,
    };
  });

  const total       = perVehicle.length;
  const active      = perVehicle.filter(v => v.active).length;
  const inactive    = total - active;
  const operational = perVehicle.filter(v => v.operational).length;

  const utilizationPct = total > 0
    ? Math.round((active / total) * 1000) / 10
    : 0;
  const operationalPct = active > 0
    ? Math.round((operational / active) * 1000) / 10
    : 0;

  const status: KPIStatus =
    total === 0             ? 'no_data'  :
    utilizationPct < 50     ? 'critical' :
    operationalPct < 60     ? 'warning'  : 'ok';

  return {
    id:        'utilization.fleet',
    label:     'Utilización de flota',
    value:     { total, active, inactive, operational, utilizationPct, operationalPct, perVehicle },
    formatted: `${utilizationPct.toFixed(1)}% activos · ${operationalPct.toFixed(1)}% operacionales`,
    unit:      '%',
    status,
  };
}

// ─── KPI Definitions for registry registration ────────────────────────────────

export const utilizationCalculatorKPIs: KPIDefinition<unknown, unknown>[] = [
  {
    id:          'utilization.km_per_vehicle',
    name:        'Km recorridos por vehículo',
    description: 'Kilómetros recorridos por cada vehículo en el período, derivados de odómetro o estimados por consumo',
    category:    'utilization',
    unit:        'km',
    calculate:   (i) => calculateKmPerVehicle(i as KmPerVehicleInput),
  },
  {
    id:          'utilization.usage_hours',
    name:        'Horas de uso por vehículo',
    description: 'Horas estimadas de operación por vehículo (días con actividad × horas configuradas)',
    category:    'utilization',
    unit:        'horas',
    calculate:   (i) => calculateUsageHours(i as UsageHoursInput),
  },
  {
    id:          'utilization.fleet',
    name:        'Utilización de flota',
    description: 'Vehículos activos / total y vehículos operacionales (con actividad en período) / activos',
    category:    'utilization',
    unit:        '%',
    thresholds:  { warningMin: 60, criticalMin: 50 },
    calculate:   (i) => calculateFleetUtilization(i as FleetUtilizationInput),
  },
];
