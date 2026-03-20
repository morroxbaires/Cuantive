/**
 * analytics_engine/kpi_calculators/utilization_kpis.ts
 *
 * Utilization KPI calculators — all pure functions.
 *
 * Exported KPIs:
 *   calculateVehicleUtilization   — fuel load frequency as proxy for vehicle usage
 *   calculateDriverUtilization    — fuel load frequency per driver
 *   calculateFleetFuelCoverage    — % fleet vehicles that had at least one fuel load
 *   calculateAvgLoadInterval      — avg days between fuel loads per vehicle
 */

import type {
  KPIDefinition,
  KPIResult,
  FuelLoadDTO,
  VehicleDTO,
  DriverDTO,
  DateRange,
  KPIStatus,
} from '../types';

const MS_PER_DAY = 86_400_000;

// ─── KPI: Vehicle utilization (fuel load frequency) ──────────────────────────

export interface VehicleUtilizationRow {
  vehicleId: string;
  plate: string;
  vehicleName: string;
  loadCount: number;
  firstLoad: string | null;
  lastLoad: string | null;
  avgDaysBetweenLoads: number | null;
  activeDays: number;
  utilizationPct: number | null;
}

export interface VehicleUtilizationInput {
  vehicles: VehicleDTO[];
  fuelLoads: FuelLoadDTO[];
  range: DateRange;
}

export function calculateVehicleUtilization(
  input: VehicleUtilizationInput,
): KPIResult<VehicleUtilizationRow[]> {
  const periodDays = Math.max(
    1,
    Math.ceil((input.range.to.getTime() - input.range.from.getTime()) / MS_PER_DAY),
  );

  const loadsByVehicle = new Map<string, FuelLoadDTO[]>();
  for (const f of input.fuelLoads) {
    if (!loadsByVehicle.has(f.vehicleId)) loadsByVehicle.set(f.vehicleId, []);
    loadsByVehicle.get(f.vehicleId)!.push(f);
  }

  const vehicleMap = new Map(input.vehicles.map(v => [v.id, v]));
  const results: VehicleUtilizationRow[] = [];

  for (const v of input.vehicles) {
    const loads = loadsByVehicle.get(v.id) ?? [];
    loads.sort((a, b) => a.date.getTime() - b.date.getTime());

    const loadCount = loads.length;
    const firstLoad = loads[0]?.date.toISOString().slice(0, 10) ?? null;
    const lastLoad  = loads[loads.length - 1]?.date.toISOString().slice(0, 10) ?? null;

    let avgDaysBetweenLoads: number | null = null;
    if (loads.length >= 2) {
      const totalGap = loads.slice(1).reduce(
        (acc, cur, i) => acc + (cur.date.getTime() - loads[i].date.getTime()),
        0,
      );
      avgDaysBetweenLoads = Math.round((totalGap / (loads.length - 1) / MS_PER_DAY) * 10) / 10;
    }

    // Days with at least one fuel load = rough proxy for active days in period
    const activeDaySet = new Set(loads.map(f => f.date.toISOString().slice(0, 10)));
    const activeDays   = activeDaySet.size;
    const utilizationPct = periodDays > 0
      ? Math.round((activeDays / periodDays) * 1000) / 10
      : null;

    results.push({
      vehicleId: v.id,
      plate:     v.plate,
      vehicleName: v.name,
      loadCount,
      firstLoad,
      lastLoad,
      avgDaysBetweenLoads,
      activeDays,
      utilizationPct,
    });
  }

  results.sort((a, b) => b.loadCount - a.loadCount);

  const noActivity  = results.filter(r => r.loadCount === 0).length;
  const status: KPIStatus =
    noActivity > results.length * 0.5 ? 'warning' : 'ok';

  return {
    id:     'utilization.vehicle',
    label:  'Utilización de vehículos',
    value:  results,
    unit:   'cargas',
    status,
    meta:   { periodDays, vehicleCount: results.length, withActivity: results.length - noActivity, noActivity },
  };
}

// ─── KPI: Driver utilization ──────────────────────────────────────────────────

export interface DriverUtilizationRow {
  driverId: string;
  driverName: string;
  loadCount: number;
  vehiclesUsed: number;
  totalLiters: number;
  totalCost: number;
  firstActivity: string | null;
  lastActivity: string | null;
}

export interface DriverUtilizationInput {
  drivers: DriverDTO[];
  fuelLoads: FuelLoadDTO[];
}

export function calculateDriverUtilization(
  input: DriverUtilizationInput,
): KPIResult<DriverUtilizationRow[]> {
  const driverMap = new Map(input.drivers.map(d => [d.id, d]));

  const byDriver = new Map<string, {
    loads: FuelLoadDTO[];
    vehicles: Set<string>;
  }>();

  for (const f of input.fuelLoads) {
    if (!f.driverId) continue;
    if (!byDriver.has(f.driverId)) byDriver.set(f.driverId, { loads: [], vehicles: new Set() });
    const b = byDriver.get(f.driverId)!;
    b.loads.push(f);
    b.vehicles.add(f.vehicleId);
  }

  const results: DriverUtilizationRow[] = [];

  for (const [driverId, data] of byDriver) {
    const driver = driverMap.get(driverId);
    data.loads.sort((a, b) => a.date.getTime() - b.date.getTime());

    results.push({
      driverId,
      driverName:    driver ? `${driver.name} ${driver.lastname}`.trim() : driverId,
      loadCount:     data.loads.length,
      vehiclesUsed:  data.vehicles.size,
      totalLiters:   Math.round(data.loads.reduce((s, f) => s + f.litersOrKwh, 0) * 100) / 100,
      totalCost:     Math.round(data.loads.reduce((s, f) => s + (f.priceTotal ?? 0), 0) * 100) / 100,
      firstActivity: data.loads[0]?.date.toISOString().slice(0, 10) ?? null,
      lastActivity:  data.loads[data.loads.length - 1]?.date.toISOString().slice(0, 10) ?? null,
    });
  }

  results.sort((a, b) => b.loadCount - a.loadCount);

  return {
    id:     'utilization.driver',
    label:  'Utilización de conductores',
    value:  results,
    unit:   'cargas',
    status: results.length > 0 ? 'ok' : 'no_data',
    meta:   { driverCount: results.length },
  };
}

// ─── KPI: Fleet fuel coverage ─────────────────────────────────────────────────

export interface FleetFuelCoverageInput {
  vehicles: VehicleDTO[];
  fuelLoads: FuelLoadDTO[];
}

export function calculateFleetFuelCoverage(
  input: FleetFuelCoverageInput,
): KPIResult<number | null> {
  const activeVehicles = input.vehicles.filter(v => v.active);
  if (activeVehicles.length === 0) {
    return {
      id: 'utilization.fuel_coverage', label: 'Cobertura de cargas (flota)', value: null,
      unit: '%', status: 'no_data',
    };
  }

  const vehiclesWithLoad = new Set(input.fuelLoads.map(f => f.vehicleId));
  const covered = activeVehicles.filter(v => vehiclesWithLoad.has(v.id)).length;
  const pct = Math.round((covered / activeVehicles.length) * 1000) / 10;

  const status: KPIStatus =
    pct < 50 ? 'critical' :
    pct < 80 ? 'warning'  : 'ok';

  return {
    id:        'utilization.fuel_coverage',
    label:     'Cobertura de cargas (flota)',
    value:     pct,
    formatted: `${pct.toFixed(1)}%`,
    unit:      '%',
    status,
    meta:      { covered, total: activeVehicles.length, withoutLoad: activeVehicles.length - covered },
  };
}

// ─── KPI: Avg interval between fuel loads per vehicle ────────────────────────

export interface AvgLoadIntervalRow {
  vehicleId: string;
  plate: string;
  avgIntervalDays: number | null;
  lastLoadDaysAgo: number | null;
  noLoadAlert: boolean;
}

export interface AvgLoadIntervalInput {
  vehicles: VehicleDTO[];
  fuelLoads: FuelLoadDTO[];
  alertNoLoadDays: number;
}

export function calculateAvgLoadInterval(
  input: AvgLoadIntervalInput,
): KPIResult<AvgLoadIntervalRow[]> {
  const now = Date.now();
  const loadsByVehicle = new Map<string, FuelLoadDTO[]>();

  for (const f of input.fuelLoads) {
    if (!loadsByVehicle.has(f.vehicleId)) loadsByVehicle.set(f.vehicleId, []);
    loadsByVehicle.get(f.vehicleId)!.push(f);
  }

  const results: AvgLoadIntervalRow[] = [];

  for (const v of input.vehicles) {
    if (!v.active) continue;
    const loads = (loadsByVehicle.get(v.id) ?? []).sort((a, b) => a.date.getTime() - b.date.getTime());

    let avgIntervalDays: number | null = null;
    if (loads.length >= 2) {
      const total = loads.slice(1).reduce((acc, f, i) => acc + (f.date.getTime() - loads[i].date.getTime()), 0);
      avgIntervalDays = Math.round((total / (loads.length - 1) / MS_PER_DAY) * 10) / 10;
    }

    const lastLoad = loads[loads.length - 1];
    const lastLoadDaysAgo = lastLoad
      ? Math.floor((now - lastLoad.date.getTime()) / MS_PER_DAY)
      : null;

    const noLoadAlert =
      lastLoadDaysAgo === null || lastLoadDaysAgo > input.alertNoLoadDays;

    results.push({
      vehicleId: v.id,
      plate: v.plate,
      avgIntervalDays,
      lastLoadDaysAgo,
      noLoadAlert,
    });
  }

  const alertCount = results.filter(r => r.noLoadAlert).length;
  results.sort((a, b) => (b.lastLoadDaysAgo ?? 999) - (a.lastLoadDaysAgo ?? 999));

  return {
    id:     'utilization.load_interval',
    label:  'Intervalo entre cargas de combustible',
    value:  results,
    unit:   'días',
    status: alertCount > 0 ? 'warning' : 'ok',
    meta:   { vehicleCount: results.length, alertCount },
  };
}

// ─── KPI Definitions for registry registration ────────────────────────────────

export const utilizationKPIs: KPIDefinition<unknown, unknown>[] = [
  {
    id:          'utilization.vehicle',
    name:        'Utilización de vehículos',
    description: 'Frecuencia de cargas de combustible por vehículo en el período (proxy de uso)',
    category:    'utilization',
    calculate:   (i) => calculateVehicleUtilization(i as VehicleUtilizationInput),
  },
  {
    id:          'utilization.driver',
    name:        'Utilización de conductores',
    description: 'Frecuencia de actividad por conductor (cargas de combustible registradas)',
    category:    'utilization',
    calculate:   (i) => calculateDriverUtilization(i as DriverUtilizationInput),
  },
  {
    id:          'utilization.fuel_coverage',
    name:        'Cobertura de cargas',
    description: '% de vehículos activos con al menos una carga de combustible en el período',
    category:    'utilization',
    unit:        '%',
    thresholds:  { warningMin: 80, criticalMin: 50 },
    calculate:   (i) => calculateFleetFuelCoverage(i as FleetFuelCoverageInput),
  },
  {
    id:          'utilization.load_interval',
    name:        'Intervalo entre cargas',
    description: 'Promedio de días entre cargas sucesivas + alerta de vehículos sin carga reciente',
    category:    'utilization',
    unit:        'días',
    calculate:   (i) => calculateAvgLoadInterval(i as AvgLoadIntervalInput),
  },
];
