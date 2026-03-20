/**
 * analytics_engine/kpi_calculators/efficiency_kpis.ts
 *
 * Efficiency KPI calculators — all pure functions.
 *
 * Exported KPIs:
 *   calculateDriversRanking       — weighted volume ranking with A/B/C/D grade
 *   calculateFleetEfficiencyScore — weighted avg fleet efficiency score 0-100
 *   calculateVehicleEfficiency    — per-vehicle efficiency score vs reference
 */

import type {
  KPIDefinition,
  KPIResult,
  FuelLoadDTO,
  VehicleDTO,
  DriverDTO,
  DriverRanking,
  KPIStatus,
} from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function weightedKmPerUnit(
  loads: Array<{ kpu: number; liters: number }>,
): number | null {
  const valid = loads.filter(l => l.kpu > 0 && l.liters > 0);
  if (valid.length === 0) return null;
  const sumProd   = valid.reduce((s, l) => s + l.kpu * l.liters, 0);
  const sumLiters = valid.reduce((s, l) => s + l.liters, 0);
  return sumLiters > 0 ? Math.round((sumProd / sumLiters) * 100) / 100 : null;
}

// ─── KPI: Driver ranking ──────────────────────────────────────────────────────

export interface DriversRankingInput {
  drivers: DriverDTO[];
  vehicles: VehicleDTO[];
  fuelLoads: FuelLoadDTO[];
  minLoads?: number;    // default: 3
}

export function calculateDriversRanking(
  input: DriversRankingInput,
): KPIResult<DriverRanking[]> {
  const { minLoads = 3 } = input;
  const vehicleMap = new Map(input.vehicles.map(v => [v.id, v]));
  const driverMap  = new Map(input.drivers.map(d => [d.id, d]));

  // Build per-driver aggregation
  const byDriver = new Map<string, {
    kpuLoads:  Array<{ kpu: number; liters: number; ref: number | null }>;
    allLoads:  FuelLoadDTO[];
    vehicles:  Set<string>;
  }>();

  for (const f of input.fuelLoads) {
    if (!f.driverId) continue;
    if (!byDriver.has(f.driverId)) {
      byDriver.set(f.driverId, { kpuLoads: [], allLoads: [], vehicles: new Set() });
    }
    const b = byDriver.get(f.driverId)!;
    b.allLoads.push(f);
    b.vehicles.add(f.vehicleId);

    if (f.kmPerUnit !== null && f.kmPerUnit > 0) {
      const vehicle = vehicleMap.get(f.vehicleId);
      b.kpuLoads.push({
        kpu:    f.kmPerUnit,
        liters: f.litersOrKwh,
        ref:    vehicle?.efficiencyReference ?? null,
      });
    }
  }

  const rows: DriverRanking[] = [];

  for (const [driverId, data] of byDriver) {
    if (data.allLoads.length < minLoads) continue;

    const driver       = driverMap.get(driverId);
    const efficiency   = weightedKmPerUnit(data.kpuLoads);
    const refLoads     = data.kpuLoads.filter(l => l.ref !== null);
    const efficiencyRef = weightedKmPerUnit(
      refLoads.map(l => ({ kpu: l.ref!, liters: l.liters })),
    );

    let rankingScore: number | null = null;
    let deviationPct: number | null = null;
    let grade: DriverRanking['grade'] = 'N/A';

    if (efficiency !== null && efficiencyRef !== null && efficiencyRef > 0) {
      rankingScore = Math.round((efficiency / efficiencyRef) * 1000) / 10;
      deviationPct = Math.round((rankingScore - 100) * 10) / 10;
      grade =
        rankingScore >= 105 ? 'A' :
        rankingScore >= 95  ? 'B' :
        rankingScore >= 80  ? 'C' : 'D';
    }

    // Estimated total km = Σ(km_per_unit × liters)
    const totalKm = data.kpuLoads.reduce((s, l) => s + l.kpu * l.liters, 0);

    rows.push({
      position:       0,  // assigned after sort
      driverId,
      driverName:     driver ? `${driver.name} ${driver.lastname}`.trim() : driverId,
      grade,
      rankingScore,
      efficiencyReal: efficiency,
      efficiencyRef,
      deviationPct,
      totalKm:   Math.round(totalKm),
      fuelUsed:  Math.round(data.allLoads.reduce((s, f) => s + f.litersOrKwh, 0) * 100) / 100,
      totalCost: Math.round(data.allLoads.reduce((s, f) => s + (f.priceTotal ?? 0), 0) * 100) / 100,
      loadCount: data.allLoads.length,
    });
  }

  // Sort: ranked drivers (with score) first, rest by km
  const withScore    = rows.filter(r => r.rankingScore !== null)
    .sort((a, b) => (b.rankingScore ?? 0) - (a.rankingScore ?? 0));
  const withoutScore = rows.filter(r => r.rankingScore === null)
    .sort((a, b) => b.totalKm - a.totalKm);

  const sorted = [...withScore, ...withoutScore];
  sorted.forEach((r, i) => { r.position = i + 1; });

  const gradeCount = { A: 0, B: 0, C: 0, D: 0, 'N/A': 0 };
  sorted.forEach(r => { gradeCount[r.grade]++; });

  const status: KPIStatus =
    gradeCount['D'] > sorted.length * 0.3 ? 'warning' :
    gradeCount['D'] > sorted.length * 0.5 ? 'critical' : 'ok';

  return {
    id:     'efficiency.drivers_ranking',
    label:  'Ranking de eficiencia de conductores',
    value:  sorted,
    unit:   'score',
    status,
    meta:   { driverCount: sorted.length, gradeCount },
  };
}

// ─── KPI: Fleet efficiency score (0-100) ─────────────────────────────────────

export interface FleetEfficiencyInput {
  vehicles: VehicleDTO[];
  fuelLoads: FuelLoadDTO[];
}

export function calculateFleetEfficiencyScore(
  input: FleetEfficiencyInput,
): KPIResult<number | null> {
  const vehicleMap = new Map(input.vehicles.map(v => [v.id, v]));

  let sumScore  = 0;
  let sumWeight = 0;

  const loadsByVehicle = new Map<string, FuelLoadDTO[]>();
  for (const f of input.fuelLoads) {
    if (!loadsByVehicle.has(f.vehicleId)) loadsByVehicle.set(f.vehicleId, []);
    loadsByVehicle.get(f.vehicleId)!.push(f);
  }

  for (const [vid, loads] of loadsByVehicle) {
    const vehicle = vehicleMap.get(vid);
    const effRef  = vehicle?.efficiencyReference;
    if (!effRef || effRef <= 0) continue;

    const weighted = weightedKmPerUnit(
      loads.filter(f => f.kmPerUnit !== null).map(f => ({ kpu: f.kmPerUnit!, liters: f.litersOrKwh })),
    );
    if (weighted === null) continue;

    const score  = (weighted / effRef) * 100;
    const weight = loads.reduce((s, f) => s + f.litersOrKwh, 0);

    sumScore  += score * weight;
    sumWeight += weight;
  }

  if (sumWeight === 0) {
    return {
      id: 'efficiency.fleet_score', label: 'Score de eficiencia (flota)', value: null,
      unit: 'score', status: 'no_data',
    };
  }

  const fleetScore = Math.round((sumScore / sumWeight) * 10) / 10;

  const status: KPIStatus =
    fleetScore < 80  ? 'critical' :
    fleetScore < 95  ? 'warning'  : 'ok';

  return {
    id:        'efficiency.fleet_score',
    label:     'Score de eficiencia (flota)',
    value:     fleetScore,
    formatted: `${fleetScore.toFixed(1)} / 100`,
    unit:      'score',
    status,
    meta:      {
      grade: fleetScore >= 105 ? 'A' : fleetScore >= 95 ? 'B' : fleetScore >= 80 ? 'C' : 'D',
    },
  };
}

// ─── KPI: Per-vehicle efficiency score ──────────────────────────────────────

export interface VehicleEfficiencyRow {
  vehicleId: string;
  plate: string;
  efficiencyScore: number | null;    // (actual / reference) × 100
  deviationPct: number | null;
  avgKmPerUnit: number | null;
  efficiencyReference: number | null;
  grade: 'A' | 'B' | 'C' | 'D' | 'N/A';
}

export interface VehicleEfficiencyInput {
  vehicles: VehicleDTO[];
  fuelLoads: FuelLoadDTO[];
}

export function calculateVehicleEfficiency(
  input: VehicleEfficiencyInput,
): KPIResult<VehicleEfficiencyRow[]> {
  const loadsByVehicle = new Map<string, FuelLoadDTO[]>();
  for (const f of input.fuelLoads) {
    if (!loadsByVehicle.has(f.vehicleId)) loadsByVehicle.set(f.vehicleId, []);
    loadsByVehicle.get(f.vehicleId)!.push(f);
  }

  const results: VehicleEfficiencyRow[] = [];

  for (const v of input.vehicles) {
    const loads  = loadsByVehicle.get(v.id) ?? [];
    const withKm = loads.filter(f => f.kmPerUnit !== null && f.kmPerUnit > 0);

    const avgKmPerUnit = weightedKmPerUnit(withKm.map(f => ({ kpu: f.kmPerUnit!, liters: f.litersOrKwh })));
    const effRef       = v.efficiencyReference;

    let efficiencyScore: number | null = null;
    let deviationPct: number | null    = null;
    let grade: VehicleEfficiencyRow['grade'] = 'N/A';

    if (avgKmPerUnit !== null && effRef !== null && effRef > 0) {
      efficiencyScore = Math.round((avgKmPerUnit / effRef) * 1000) / 10;
      deviationPct    = Math.round((efficiencyScore - 100) * 10) / 10;
      grade =
        efficiencyScore >= 105 ? 'A' :
        efficiencyScore >= 95  ? 'B' :
        efficiencyScore >= 80  ? 'C' : 'D';
    }

    results.push({
      vehicleId:           v.id,
      plate:               v.plate,
      efficiencyScore,
      deviationPct,
      avgKmPerUnit,
      efficiencyReference: effRef,
      grade,
    });
  }

  results.sort((a, b) => (b.efficiencyScore ?? 0) - (a.efficiencyScore ?? 0));

  const gradeCount = { A: 0, B: 0, C: 0, D: 0, 'N/A': 0 };
  results.forEach(r => { gradeCount[r.grade]++; });

  return {
    id:     'efficiency.per_vehicle',
    label:  'Eficiencia por vehículo',
    value:  results,
    unit:   'score',
    status: gradeCount['D'] > 0 ? 'warning' : 'ok',
    meta:   { vehicleCount: results.length, gradeCount },
  };
}

// ─── KPI Definitions for registry registration ────────────────────────────────

export const efficiencyKPIs: KPIDefinition<unknown, unknown>[] = [
  {
    id:          'efficiency.drivers_ranking',
    name:        'Ranking de conductores',
    description: 'Ranking por eficiencia real vs referencia del vehículo utilizado, con grado A-D',
    category:    'efficiency',
    unit:        'score',
    calculate:   (i) => calculateDriversRanking(i as DriversRankingInput),
  },
  {
    id:          'efficiency.fleet_score',
    name:        'Score eficiencia de flota',
    description: 'Score 0-100 del promedio ponderado de eficiencia de toda la flota vs referencias',
    category:    'efficiency',
    unit:        'score',
    thresholds:  { criticalMin: 80, warningMin: 95 },
    calculate:   (i) => calculateFleetEfficiencyScore(i as FleetEfficiencyInput),
  },
  {
    id:          'efficiency.per_vehicle',
    name:        'Eficiencia por vehículo',
    description: 'Score de eficiencia individual por vehículo con grado A-D',
    category:    'efficiency',
    unit:        'score',
    calculate:   (i) => calculateVehicleEfficiency(i as VehicleEfficiencyInput),
  },
];
