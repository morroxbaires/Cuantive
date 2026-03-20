/**
 * analytics_engine/kpi_calculators/fleet_cost_kpis.ts
 *
 * Fleet cost KPI calculators — all pure functions.
 *
 * Exported KPIs:
 *   calculateTotalFleetCost       — total fuel + maintenance cost
 *   calculateCostPerVehicle       — cost breakdown per vehicle
 *   calculateCostPerKm            — fleet avg cost per km
 *   calculateFuelCostShare        — fuel % of total cost
 *   calculateMaintCostShare       — maintenance % of total cost
 *   calculateCostTrend            — monthly cost trend (MoM)
 *
 * All functions take plain DTOs — no Prisma, no DB, no side effects.
 */

import type {
  KPIDefinition,
  KPIResult,
  FuelLoadDTO,
  MaintenanceDTO,
  VehicleDTO,
  FleetKPIInput,
  CostBreakdown,
  KPIStatus,
} from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function costStatus(value: number, warnThreshold: number, criticalThreshold: number): KPIStatus {
  if (value >= criticalThreshold) return 'critical';
  if (value >= warnThreshold)     return 'warning';
  return 'ok';
}

function sumFuelCost(fuels: FuelLoadDTO[]): number {
  return fuels.reduce((acc, f) => acc + (f.priceTotal ?? 0), 0);
}

function sumMaintCost(maints: MaintenanceDTO[]): number {
  return maints.reduce((acc, m) => acc + (m.cost ?? 0), 0);
}

function formatCLP(n: number): string {
  return `$${n.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`;
}

// ─── KPI: Total fleet cost ────────────────────────────────────────────────────

export interface TotalFleetCostInput {
  fuelLoads: FuelLoadDTO[];
  maintenances: MaintenanceDTO[];
}

export function calculateTotalFleetCost(
  input: TotalFleetCostInput,
): KPIResult<{ totalCost: number; fuelCost: number; maintCost: number }> {
  const fuelCost  = sumFuelCost(input.fuelLoads);
  const maintCost = sumMaintCost(input.maintenances);
  const totalCost = fuelCost + maintCost;

  return {
    id:        'fleet_cost.total',
    label:     'Costo total de flota',
    value:     { totalCost, fuelCost, maintCost },
    formatted: formatCLP(totalCost),
    unit:      'CLP',
    status:    'info',
    meta: {
      fuelCost:  fuelCost,
      maintCost: maintCost,
      fuelPct:   totalCost > 0 ? Math.round((fuelCost / totalCost) * 100) : 0,
      maintPct:  totalCost > 0 ? Math.round((maintCost / totalCost) * 100) : 0,
    },
  };
}

// ─── KPI: Cost per vehicle ────────────────────────────────────────────────────

export interface CostPerVehicleInput {
  vehicles: VehicleDTO[];
  fuelLoads: FuelLoadDTO[];
  maintenances: MaintenanceDTO[];
}

export function calculateCostPerVehicle(
  input: CostPerVehicleInput,
): KPIResult<CostBreakdown[]> {
  const fuelByVehicle  = new Map<string, number>();
  const maintByVehicle = new Map<string, number>();

  for (const f of input.fuelLoads) {
    fuelByVehicle.set(f.vehicleId, (fuelByVehicle.get(f.vehicleId) ?? 0) + (f.priceTotal ?? 0));
  }
  for (const m of input.maintenances) {
    maintByVehicle.set(m.vehicleId, (maintByVehicle.get(m.vehicleId) ?? 0) + (m.cost ?? 0));
  }

  // For km: derive from odometer delta per vehicle
  const odoByVehicle = new Map<string, { min: number; max: number }>();
  for (const f of input.fuelLoads) {
    if (f.odometer == null) continue;
    const cur = odoByVehicle.get(f.vehicleId);
    if (!cur) {
      odoByVehicle.set(f.vehicleId, { min: f.odometer, max: f.odometer });
    } else {
      cur.min = Math.min(cur.min, f.odometer);
      cur.max = Math.max(cur.max, f.odometer);
    }
  }

  const vehicleIds = new Set([
    ...fuelByVehicle.keys(),
    ...maintByVehicle.keys(),
  ]);

  const vehicleMap = new Map(input.vehicles.map(v => [v.id, v]));
  const fleetTotal = [...vehicleIds].reduce((acc, id) => {
    return acc + (fuelByVehicle.get(id) ?? 0) + (maintByVehicle.get(id) ?? 0);
  }, 0);

  const breakdowns: CostBreakdown[] = [];

  for (const vid of vehicleIds) {
    const v        = vehicleMap.get(vid);
    const fuel     = fuelByVehicle.get(vid)  ?? 0;
    const maint    = maintByVehicle.get(vid) ?? 0;
    const total    = fuel + maint;
    const odo      = odoByVehicle.get(vid);
    const totalKm  = odo && odo.max > odo.min ? odo.max - odo.min : null;
    const cpk      = totalKm && total > 0 ? Math.round((total / totalKm) * 100) / 100 : null;

    breakdowns.push({
      vehicleId:    vid,
      plate:        v?.plate        ?? vid,
      vehicleName:  v?.name         ?? vid,
      fuelCost:     fuel,
      maintCost:    maint,
      totalCost:    total,
      costPerKm:    cpk,
      totalKm,
      costSharePct: fleetTotal > 0
        ? Math.round((total / fleetTotal) * 1000) / 10
        : 0,
    });
  }

  breakdowns.sort((a, b) => b.totalCost - a.totalCost);

  return {
    id:        'fleet_cost.per_vehicle',
    label:     'Costo por vehículo',
    value:     breakdowns,
    unit:      'CLP',
    status:    'info',
    meta:      { vehicleCount: breakdowns.length, fleetTotal },
  };
}

// ─── KPI: Fleet avg cost per km ───────────────────────────────────────────────

export interface CostPerKmInput {
  fuelLoads: FuelLoadDTO[];
  maintenances: MaintenanceDTO[];
}

export function calculateCostPerKm(
  input: CostPerKmInput,
): KPIResult<number | null> {
  const totalCost = sumFuelCost(input.fuelLoads) + sumMaintCost(input.maintenances);

  // Group odometers by vehicle to get total km delta
  const odoByVehicle = new Map<string, { min: number; max: number }>();
  for (const f of input.fuelLoads) {
    if (f.odometer == null) continue;
    const cur = odoByVehicle.get(f.vehicleId);
    if (!cur) {
      odoByVehicle.set(f.vehicleId, { min: f.odometer, max: f.odometer });
    } else {
      cur.min = Math.min(cur.min, f.odometer);
      cur.max = Math.max(cur.max, f.odometer);
    }
  }

  const totalKm = [...odoByVehicle.values()].reduce(
    (acc, o) => acc + Math.max(0, o.max - o.min),
    0,
  );

  if (totalKm === 0 || totalCost === 0) {
    return {
      id: 'fleet_cost.cost_per_km', label: 'Costo por km (flota)', value: null,
      unit: 'CLP/km', status: 'no_data',
    };
  }

  const costPerKm = Math.round((totalCost / totalKm) * 100) / 100;

  return {
    id:        'fleet_cost.cost_per_km',
    label:     'Costo por km (flota)',
    value:     costPerKm,
    formatted: `$${costPerKm.toFixed(2)}/km`,
    unit:      'CLP/km',
    status:    costStatus(costPerKm, 150, 300),
    meta:      { totalCost, totalKm },
  };
}

// ─── KPI: Fuel cost share (%) ─────────────────────────────────────────────────

export function calculateFuelCostShare(
  input: TotalFleetCostInput,
): KPIResult<number | null> {
  const fuelCost  = sumFuelCost(input.fuelLoads);
  const maintCost = sumMaintCost(input.maintenances);
  const total     = fuelCost + maintCost;

  if (total === 0) {
    return {
      id: 'fleet_cost.fuel_share', label: 'Participación combustible', value: null,
      unit: '%', status: 'no_data',
    };
  }

  const pct = Math.round((fuelCost / total) * 1000) / 10;

  return {
    id:        'fleet_cost.fuel_share',
    label:     'Participación combustible',
    value:     pct,
    formatted: `${pct.toFixed(1)}%`,
    unit:      '%',
    status:    pct > 85 ? 'warning' : 'ok',
    meta:      { fuelCost, maintCost, total },
  };
}

// ─── KPI: Monthly cost trend ──────────────────────────────────────────────────

export interface MonthlyTrendPoint {
  month: string;       // YYYY-MM
  fuelCost: number;
  maintCost: number;
  totalCost: number;
  momChangePct: number | null;
}

export interface CostTrendInput {
  fuelLoads: FuelLoadDTO[];
  maintenances: MaintenanceDTO[];
}

export function calculateCostTrend(
  input: CostTrendInput,
): KPIResult<MonthlyTrendPoint[]> {
  const fuelByMonth  = new Map<string, number>();
  const maintByMonth = new Map<string, number>();

  for (const f of input.fuelLoads) {
    const m = f.date.toISOString().slice(0, 7);
    fuelByMonth.set(m, (fuelByMonth.get(m) ?? 0) + (f.priceTotal ?? 0));
  }
  for (const m of input.maintenances) {
    const key = m.date.toISOString().slice(0, 7);
    maintByMonth.set(key, (maintByMonth.get(key) ?? 0) + (m.cost ?? 0));
  }

  const months = [...new Set([...fuelByMonth.keys(), ...maintByMonth.keys()])].sort();

  const points: MonthlyTrendPoint[] = months.map((month, idx) => {
    const fuelCost  = fuelByMonth.get(month)  ?? 0;
    const maintCost = maintByMonth.get(month) ?? 0;
    const totalCost = fuelCost + maintCost;

    let momChangePct: number | null = null;
    if (idx > 0) {
      const prevMonth    = months[idx - 1];
      const prevFuel     = fuelByMonth.get(prevMonth)  ?? 0;
      const prevMaint    = maintByMonth.get(prevMonth) ?? 0;
      const prevTotal    = prevFuel + prevMaint;
      momChangePct = prevTotal > 0
        ? Math.round(((totalCost - prevTotal) / prevTotal) * 1000) / 10
        : null;
    }

    return { month, fuelCost, maintCost, totalCost, momChangePct };
  });

  return {
    id:     'fleet_cost.monthly_trend',
    label:  'Tendencia de costos mensual',
    value:  points,
    unit:   'CLP',
    status: 'info',
    meta:   { monthCount: points.length },
  };
}

// ─── KPI Definitions for registry registration ────────────────────────────────

export const fleetCostKPIs: KPIDefinition<unknown, unknown>[] = [
  {
    id:          'fleet_cost.total',
    name:        'Costo total de flota',
    description: 'Suma de combustible + mantenimiento en el período',
    category:    'fleet_cost',
    unit:        'CLP',
    calculate:   (input) => calculateTotalFleetCost(input as TotalFleetCostInput),
  },
  {
    id:          'fleet_cost.per_vehicle',
    name:        'Costo por vehículo',
    description: 'Desglose de costos (combustible + mantenimiento) por vehículo',
    category:    'fleet_cost',
    unit:        'CLP',
    calculate:   (input) => calculateCostPerVehicle(input as CostPerVehicleInput),
  },
  {
    id:          'fleet_cost.cost_per_km',
    name:        'Costo por km',
    description: 'Costo promedio de la flota por kilómetro recorrido',
    category:    'fleet_cost',
    unit:        'CLP/km',
    thresholds:  { warningMin: 150, criticalMin: 300 },
    calculate:   (input) => calculateCostPerKm(input as CostPerKmInput),
  },
  {
    id:          'fleet_cost.fuel_share',
    name:        'Participación combustible',
    description: 'Porcentaje del combustible sobre el costo total',
    category:    'fleet_cost',
    unit:        '%',
    thresholds:  { warningMax: 85 },
    calculate:   (input) => calculateFuelCostShare(input as TotalFleetCostInput),
  },
  {
    id:          'fleet_cost.monthly_trend',
    name:        'Tendencia mensual',
    description: 'Evolución de costos mes a mes con variación MoM',
    category:    'fleet_cost',
    unit:        'CLP',
    calculate:   (input) => calculateCostTrend(input as CostTrendInput),
  },
];
