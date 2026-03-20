/**
 * analytics_engine/kpi_calculators/availability_kpi_calculator.ts
 *
 * Advanced availability KPI calculators — all pure functions.
 *
 * Exported KPIs:
 *   calculateFleetAvailability  — vehículos operativos / total con soporte de filtros
 *   calculateVehicleDowntime    — tiempo fuera de servicio por vehículo en el período
 *
 * Filters supported by both functions:
 *   range       — DateRange (from / to)
 *   vehicleType — fleet filter ("camión", "auto", etc.)
 *   vehicleIds  — array of specific vehicleId strings
 *
 * Downtime algorithm:
 *   For each vehicle, pairs every "en taller" maintenance record (entry) with the
 *   first subsequent "completado" record for the same vehicle (exit).  If no exit exists
 *   the workshop stay is considered open until min(now, range.to).
 *   Each stay is then intersected with the requested DateRange to compute the
 *   overlap (downtime hours) within the period.
 */

import type {
  KPIDefinition,
  KPIResult,
  VehicleDTO,
  MaintenanceDTO,
  DateRange,
  KPIStatus,
} from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY  = 86_400_000;

function clampToRange(start: Date, end: Date, from: Date, to: Date): number {
  const s = Math.max(start.getTime(), from.getTime());
  const e = Math.min(end.getTime(), to.getTime());
  return s < e ? e - s : 0;
}

function periodHours(range: DateRange): number {
  return Math.max((range.to.getTime() - range.from.getTime()) / MS_PER_HOUR, 1);
}

// ─── Filter helpers ───────────────────────────────────────────────────────────

function applyVehicleFilters(
  vehicles: VehicleDTO[],
  vehicleType?: string,
  vehicleIds?: string[],
): VehicleDTO[] {
  let filtered = vehicles;
  if (vehicleType) {
    const t = vehicleType.toLowerCase();
    filtered = filtered.filter(v => (v.vehicleType ?? '').toLowerCase() === t);
  }
  if (vehicleIds && vehicleIds.length > 0) {
    const idSet = new Set(vehicleIds);
    filtered = filtered.filter(v => idSet.has(v.id));
  }
  return filtered;
}

function filterMaintenancesByPeriod(
  maintenances: MaintenanceDTO[],
  range: DateRange,
): MaintenanceDTO[] {
  return maintenances.filter(m => m.date >= range.from && m.date <= range.to);
}

// ─── Workshop stay extractor ──────────────────────────────────────────────────

export interface WorkshopStay {
  maintenanceId: string;
  entryDate:     Date;
  exitDate:      Date | null;   // null = still open at range.to
  workshopName:  string | null;
}

/**
 * Pair each "en taller" maintenance record with the next "completado" (or
 * any non-taller status) record for the same vehicle to form workshop stays.
 * Input maintenances must cover a wider window to capture open stays.
 */
function extractWorkshopStays(
  vehicleId:    string,
  allMaints:    MaintenanceDTO[],  // all records for this vehicle (not period-filtered)
  now:          Date,
): WorkshopStay[] {
  const sorted = allMaints
    .filter(m => m.vehicleId === vehicleId)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const stays: WorkshopStay[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i];
    const s = (m.status ?? '').toLowerCase();
    if (!s.includes('taller') && !s.includes('workshop')) continue;

    // Look for the first subsequent record that signals completion / exit
    let exitDate: Date | null = null;
    for (let j = i + 1; j < sorted.length; j++) {
      const next = sorted[j];
      const ns   = (next.status ?? '').toLowerCase();
      if (!ns.includes('taller') && !ns.includes('workshop')) {
        exitDate = next.date;
        break;
      }
    }

    // If still open, use now as the open-end marker (will be clamped later)
    stays.push({
      maintenanceId: m.id,
      entryDate:     m.date,
      exitDate:      exitDate,
      workshopName:  m.workshopName ?? null,
    });
  }

  return stays;
}

// ─── KPI: Fleet availability ──────────────────────────────────────────────────

export interface VehicleAvailabilityRow {
  vehicleId:        string;
  plate:            string;
  name:             string;
  vehicleType:      string | null;
  active:           boolean;
  operative:        boolean;    // active AND not in workshop during period
  inWorkshopDuring: boolean;   // had at least one workshop stay overlapping range
  downtimeHours:    number;    // workshop overlap hours within range
  downtimeDays:     number;
}

export interface FleetAvailabilityResult {
  total:           number;
  operative:       number;   // active AND not in workshop
  inWorkshop:      number;   // active but has workshop overlap in period
  inactive:        number;   // vehicle.active === false
  availabilityPct: number;   // operative / total * 100
  perVehicle:      VehicleAvailabilityRow[];
}

export interface FleetAvailabilityCalculatorInput {
  vehicles:     VehicleDTO[];
  maintenances: MaintenanceDTO[];
  range:        DateRange;
  vehicleType?: string;     // fleet filter
  vehicleIds?:  string[];   // vehicle filter
}

export function calculateFleetAvailabilityDetailed(
  input: FleetAvailabilityCalculatorInput,
): KPIResult<FleetAvailabilityResult> {
  const now      = new Date();
  const filtered = applyVehicleFilters(input.vehicles, input.vehicleType, input.vehicleIds);

  const perVehicle: VehicleAvailabilityRow[] = filtered.map(v => {
    const stays = extractWorkshopStays(v.id, input.maintenances, now);

    let downtimeMs = 0;
    for (const stay of stays) {
      const exitDate = stay.exitDate ?? now;
      downtimeMs += clampToRange(stay.entryDate, exitDate, input.range.from, input.range.to);
    }

    const inWorkshopDuring = downtimeMs > 0;
    const operative        = v.active && !inWorkshopDuring;

    return {
      vehicleId:        v.id,
      plate:            v.plate,
      name:             v.name,
      vehicleType:      v.vehicleType ?? null,
      active:           v.active,
      operative,
      inWorkshopDuring,
      downtimeHours:    Math.round((downtimeMs / MS_PER_HOUR) * 10) / 10,
      downtimeDays:     Math.round((downtimeMs / MS_PER_DAY)  * 10) / 10,
    };
  });

  const total     = perVehicle.length;
  const operative = perVehicle.filter(v => v.operative).length;
  const inWorkshop = perVehicle.filter(v => v.active && v.inWorkshopDuring).length;
  const inactive  = perVehicle.filter(v => !v.active).length;
  const pct       = total > 0 ? Math.round((operative / total) * 1000) / 10 : 0;

  const status: KPIStatus =
    pct < 50 ? 'critical' :
    pct < 80 ? 'warning'  : 'ok';

  return {
    id:        'availability.fleet_detailed',
    label:     'Disponibilidad de flota',
    value:     { total, operative, inWorkshop, inactive, availabilityPct: pct, perVehicle },
    formatted: `${pct.toFixed(1)}%`,
    unit:      '%',
    status,
  };
}

// ─── KPI: Vehicle downtime ────────────────────────────────────────────────────

export interface DowntimeEntry {
  maintenanceId: string;
  entryDate:     Date;
  exitDate:      Date | null;
  durationHours: number;
  durationDays:  number;
  workshopName:  string | null;
  isOpen:        boolean;   // true if exit was not yet recorded
}

export interface VehicleDowntimeRow {
  vehicleId:        string;
  plate:            string;
  name:             string;
  vehicleType:      string | null;
  active:           boolean;
  downtimeHours:    number;
  downtimeDays:     number;
  availabilityPct:  number;   // (periodHours - downtimeHours) / periodHours * 100
  workshopEntries:  DowntimeEntry[];
}

export interface VehicleDowntimeResult {
  totalPeriodHours:        number;
  fleetAvgAvailabilityPct: number;
  totalDowntimeHours:      number;
  perVehicle:              VehicleDowntimeRow[];
}

export interface VehicleDowntimeInput {
  vehicles:     VehicleDTO[];
  maintenances: MaintenanceDTO[];
  range:        DateRange;
  vehicleType?: string;    // fleet filter
  vehicleIds?:  string[];  // vehicle filter
}

export function calculateVehicleDowntime(
  input: VehicleDowntimeInput,
): KPIResult<VehicleDowntimeResult> {
  const now      = new Date();
  const period   = periodHours(input.range);
  const filtered = applyVehicleFilters(input.vehicles, input.vehicleType, input.vehicleIds);

  let totalDowntimeHours = 0;

  const perVehicle: VehicleDowntimeRow[] = filtered.map(v => {
    const stays = extractWorkshopStays(v.id, input.maintenances, now);

    const entries: DowntimeEntry[] = [];
    let vehicleDowntimeMs = 0;

    for (const stay of stays) {
      const effectiveExit = stay.exitDate ?? now;
      const overlapMs     = clampToRange(stay.entryDate, effectiveExit, input.range.from, input.range.to);
      if (overlapMs <= 0) continue;

      const durationHours = Math.round((overlapMs / MS_PER_HOUR) * 10) / 10;
      const durationDays  = Math.round((overlapMs / MS_PER_DAY)  * 10) / 10;

      vehicleDowntimeMs += overlapMs;

      entries.push({
        maintenanceId: stay.maintenanceId,
        entryDate:     stay.entryDate,
        exitDate:      stay.exitDate,
        durationHours,
        durationDays,
        workshopName:  stay.workshopName,
        isOpen:        stay.exitDate === null,
      });
    }

    const downtimeHours   = Math.round((vehicleDowntimeMs / MS_PER_HOUR) * 10) / 10;
    const downtimeDays    = Math.round((vehicleDowntimeMs / MS_PER_DAY)  * 10) / 10;
    const availabilityPct = Math.round(Math.max(0, ((period - downtimeHours) / period) * 1000)) / 10;

    totalDowntimeHours += downtimeHours;

    return {
      vehicleId:       v.id,
      plate:           v.plate,
      name:            v.name,
      vehicleType:     v.vehicleType ?? null,
      active:          v.active,
      downtimeHours,
      downtimeDays,
      availabilityPct,
      workshopEntries: entries.sort((a, b) => b.entryDate.getTime() - a.entryDate.getTime()),
    };
  });

  // Sort descent by downtime (most impacted first)
  perVehicle.sort((a, b) => b.downtimeHours - a.downtimeHours);

  const fleetAvgAvailabilityPct = filtered.length > 0
    ? Math.round((perVehicle.reduce((s, v) => s + v.availabilityPct, 0) / filtered.length) * 10) / 10
    : 100;

  const status: KPIStatus =
    fleetAvgAvailabilityPct < 50 ? 'critical' :
    fleetAvgAvailabilityPct < 80 ? 'warning'  :
    totalDowntimeHours > 0       ? 'warning'  : 'ok';

  return {
    id:        'availability.vehicle_downtime',
    label:     'Downtime de vehículos',
    value:     {
      totalPeriodHours:        Math.round(period * 10) / 10,
      fleetAvgAvailabilityPct,
      totalDowntimeHours:      Math.round(totalDowntimeHours * 10) / 10,
      perVehicle,
    },
    formatted: `${fleetAvgAvailabilityPct.toFixed(1)}% disponibilidad`,
    unit:      'horas',
    status,
  };
}

// ─── KPI Definitions for registry registration ────────────────────────────────

export const availabilityCalculatorKPIs: KPIDefinition<unknown, unknown>[] = [
  {
    id:          'availability.fleet_detailed',
    name:        'Disponibilidad de flota',
    description: 'Vehículos operativos / total con detalle de taller y filtros por período, flota y vehículo',
    category:    'availability',
    unit:        '%',
    thresholds:  { warningMin: 80, criticalMin: 50 },
    calculate:   (i) => calculateFleetAvailabilityDetailed(i as FleetAvailabilityCalculatorInput),
  },
  {
    id:          'availability.vehicle_downtime',
    name:        'Downtime de vehículos',
    description: 'Tiempo fuera de servicio (en taller) de cada vehículo en el período, con disponibilidad %',
    category:    'availability',
    unit:        'horas',
    calculate:   (i) => calculateVehicleDowntime(i as VehicleDowntimeInput),
  },
];
