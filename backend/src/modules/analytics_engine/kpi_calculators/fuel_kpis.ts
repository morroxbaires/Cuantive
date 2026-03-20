/**
 * analytics_engine/kpi_calculators/fuel_kpis.ts
 *
 * Fuel KPI calculators — all pure functions.
 *
 * Exported KPIs:
 *   calculateFuelConsumption     — total liters, avg km/unit
 *   calculateFuelEfficiency      — deviation from reference per vehicle
 *   calculateFuelCostPerUnit     — avg CLP per liter/kWh
 *   calculateFuelTrend           — monthly liters + cost trend
 *   detectIrregularLoads         — Z-score anomaly detection
 *   calculateDriverFuelAnomaly   — driver deviation vs vehicle reference
 */

import type {
  KPIDefinition,
  KPIResult,
  FuelLoadDTO,
  VehicleDTO,
  DriverDTO,
  FuelEfficiencyBreakdown,
  IrregularLoad,
  KPIStatus,
} from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function weightedAvgKmPerUnit(loads: FuelLoadDTO[]): number | null {
  const withKm = loads.filter(f => f.kmPerUnit !== null && f.litersOrKwh > 0);
  if (withKm.length === 0) return null;
  const sumProduct = withKm.reduce((s, f) => s + (f.kmPerUnit! * f.litersOrKwh), 0);
  const sumLiters  = withKm.reduce((s, f) => s + f.litersOrKwh, 0);
  return sumLiters > 0 ? Math.round((sumProduct / sumLiters) * 100) / 100 : null;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function efficiencyStatus(deviationPct: number | null, threshold: number): KPIStatus {
  if (deviationPct === null) return 'no_data';
  if (deviationPct < -threshold * 1.5) return 'critical';
  if (deviationPct < -threshold)       return 'warning';
  return 'ok';
}

// ─── KPI: Total fuel consumption ─────────────────────────────────────────────

export interface FuelConsumptionInput {
  fuelLoads: FuelLoadDTO[];
  vehicles: VehicleDTO[];
}

export function calculateFuelConsumption(
  input: FuelConsumptionInput,
): KPIResult<{ totalLiters: number; totalCost: number; avgKmPerUnit: number | null; loadCount: number }> {
  const totalLiters = input.fuelLoads.reduce((s, f) => s + f.litersOrKwh, 0);
  const totalCost   = input.fuelLoads.reduce((s, f) => s + (f.priceTotal ?? 0), 0);
  const avgKmPerUnit = weightedAvgKmPerUnit(input.fuelLoads);

  return {
    id:        'fuel.consumption',
    label:     'Consumo total de combustible',
    value:     { totalLiters, totalCost, avgKmPerUnit, loadCount: input.fuelLoads.length },
    formatted: `${totalLiters.toLocaleString('es-CL', { maximumFractionDigits: 0 })} L`,
    unit:      'Litros',
    status:    totalLiters > 0 ? 'ok' : 'no_data',
    meta:      { loadCount: input.fuelLoads.length, avgKmPerUnit },
  };
}

// ─── KPI: Fuel efficiency per vehicle ─────────────────────────────────────────

export interface FuelEfficiencyInput {
  vehicles: VehicleDTO[];
  fuelLoads: FuelLoadDTO[];
  anomalyThresholdPct: number;  // from Settings.alertFuelExcessPct
}

export function calculateFuelEfficiency(
  input: FuelEfficiencyInput,
): KPIResult<FuelEfficiencyBreakdown[]> {
  const loadsByVehicle = new Map<string, FuelLoadDTO[]>();
  for (const f of input.fuelLoads) {
    if (!loadsByVehicle.has(f.vehicleId)) loadsByVehicle.set(f.vehicleId, []);
    loadsByVehicle.get(f.vehicleId)!.push(f);
  }

  const vehicleMap = new Map(input.vehicles.map(v => [v.id, v]));
  const results: FuelEfficiencyBreakdown[] = [];

  for (const [vid, loads] of loadsByVehicle) {
    const vehicle       = vehicleMap.get(vid);
    const avgKmPerUnit  = weightedAvgKmPerUnit(loads);
    const effRef        = vehicle?.efficiencyReference ?? null;
    const totalLiters   = loads.reduce((s, f) => s + f.litersOrKwh, 0);
    const totalCost     = loads.reduce((s, f) => s + (f.priceTotal ?? 0), 0);

    let deviationPct: number | null = null;
    let isAnomaly = false;

    if (avgKmPerUnit !== null && effRef !== null && effRef > 0) {
      deviationPct = Math.round(((avgKmPerUnit - effRef) / effRef) * 1000) / 10;
      isAnomaly    = deviationPct < -input.anomalyThresholdPct;
    }

    results.push({
      vehicleId:           vid,
      plate:               vehicle?.plate ?? vid,
      avgKmPerUnit,
      efficiencyReference: effRef,
      deviationPct,
      isAnomaly,
      totalLiters,
      totalCost,
      loadCount: loads.length,
    });
  }

  results.sort((a, b) => (a.deviationPct ?? 0) - (b.deviationPct ?? 0));
  const anomalyCount = results.filter(r => r.isAnomaly).length;

  return {
    id:     'fuel.efficiency_per_vehicle',
    label:  'Eficiencia por vehículo',
    value:  results,
    unit:   'km/L',
    status: anomalyCount > 0 ? (anomalyCount > 2 ? 'critical' : 'warning') : 'ok',
    meta:   { vehicleCount: results.length, anomalyCount },
  };
}

// ─── KPI: Fuel cost per unit (avg price per liter/kWh) ───────────────────────

export interface FuelCostPerUnitInput {
  fuelLoads: FuelLoadDTO[];
}

export function calculateFuelCostPerUnit(
  input: FuelCostPerUnitInput,
): KPIResult<number | null> {
  const withPrice = input.fuelLoads.filter(
    f => f.priceTotal !== null && f.priceTotal > 0 && f.litersOrKwh > 0,
  );

  if (withPrice.length === 0) {
    return {
      id: 'fuel.cost_per_unit', label: 'Precio promedio por litro/kWh', value: null,
      unit: 'CLP/L', status: 'no_data',
    };
  }

  const totalCost   = withPrice.reduce((s, f) => s + f.priceTotal!, 0);
  const totalLiters = withPrice.reduce((s, f) => s + f.litersOrKwh, 0);
  const avgPrice    = Math.round((totalCost / totalLiters) * 100) / 100;

  return {
    id:        'fuel.cost_per_unit',
    label:     'Precio promedio por litro/kWh',
    value:     avgPrice,
    formatted: `$${avgPrice.toFixed(0)}/L`,
    unit:      'CLP/L',
    status:    'info',
    meta:      { totalCost, totalLiters, sampleSize: withPrice.length },
  };
}

// ─── KPI: Fuel trend (monthly) ────────────────────────────────────────────────

export interface FuelTrendPoint {
  month: string;
  totalLiters: number;
  totalCost: number;
  loadCount: number;
  activeVehicles: number;
  avgCostPerLiter: number | null;
}

export interface FuelTrendInput {
  fuelLoads: FuelLoadDTO[];
}

export function calculateFuelTrend(
  input: FuelTrendInput,
): KPIResult<FuelTrendPoint[]> {
  const byMonth = new Map<string, { liters: number; cost: number; vehicles: Set<string>; count: number }>();

  for (const f of input.fuelLoads) {
    const m = f.date.toISOString().slice(0, 7);
    if (!byMonth.has(m)) byMonth.set(m, { liters: 0, cost: 0, vehicles: new Set(), count: 0 });
    const bucket = byMonth.get(m)!;
    bucket.liters += f.litersOrKwh;
    bucket.cost   += f.priceTotal ?? 0;
    bucket.vehicles.add(f.vehicleId);
    bucket.count++;
  }

  const points: FuelTrendPoint[] = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => ({
      month,
      totalLiters:     Math.round(d.liters * 100) / 100,
      totalCost:       Math.round(d.cost   * 100) / 100,
      loadCount:       d.count,
      activeVehicles:  d.vehicles.size,
      avgCostPerLiter: d.liters > 0 ? Math.round((d.cost / d.liters) * 100) / 100 : null,
    }));

  return {
    id:     'fuel.monthly_trend',
    label:  'Tendencia mensual de combustible',
    value:  points,
    unit:   'L',
    status: 'info',
    meta:   { months: points.length },
  };
}

// ─── KPI: Irregular loads (Z-score anomaly detection) ────────────────────────

export interface IrregularLoadsInput {
  fuelLoads: FuelLoadDTO[];
  vehicles: VehicleDTO[];
  zThreshold: number;    // default 1.5
  limit?: number;
}

export function detectIrregularLoads(
  input: IrregularLoadsInput,
): KPIResult<IrregularLoad[]> {
  const { zThreshold = 1.5, limit = 50 } = input;

  // Group km_per_unit values by vehicle
  const statsByVehicle = new Map<string, { values: number[] }>();
  for (const f of input.fuelLoads) {
    if (f.kmPerUnit === null || f.kmPerUnit <= 0) continue;
    if (!statsByVehicle.has(f.vehicleId)) statsByVehicle.set(f.vehicleId, { values: [] });
    statsByVehicle.get(f.vehicleId)!.values.push(f.kmPerUnit);
  }

  const vehicleMap = new Map(input.vehicles.map(v => [v.id, v]));
  const irregular: IrregularLoad[] = [];

  for (const f of input.fuelLoads) {
    if (f.kmPerUnit === null || f.kmPerUnit <= 0) continue;
    const stats = statsByVehicle.get(f.vehicleId);
    if (!stats || stats.values.length < 3) continue;   // need min 3 samples

    const mean  = stats.values.reduce((s, v) => s + v, 0) / stats.values.length;
    const sd    = stddev(stats.values);
    if (sd === 0) continue;

    const z = Math.abs(f.kmPerUnit - mean) / sd;
    if (z < zThreshold) continue;

    const vehicle = vehicleMap.get(f.vehicleId);
    irregular.push({
      loadId:      f.id,
      vehicleId:   f.vehicleId,
      plate:       vehicle?.plate ?? f.vehicleId,
      driverId:    f.driverId,
      date:        f.date,
      kmPerUnit:   f.kmPerUnit,
      vehicleAvg:  Math.round(mean * 100) / 100,
      zScore:      Math.round(z * 100) / 100,
      liters:      f.litersOrKwh,
      priceTotal:  f.priceTotal,
      anomalyType: f.kmPerUnit < mean ? 'under' : 'over',
    });
  }

  irregular.sort((a, b) => b.zScore - a.zScore);
  const limited = irregular.slice(0, limit);

  return {
    id:     'fuel.irregular_loads',
    label:  'Cargas irregulares (Z-score)',
    value:  limited,
    unit:   'cargas',
    status: limited.length > 5 ? 'warning' : limited.length > 0 ? 'info' : 'ok',
    meta:   { total: irregular.length, returned: limited.length, zThreshold },
  };
}

// ─── KPI: Driver fuel anomalies ───────────────────────────────────────────────

export interface DriverAnomalyRow {
  driverId: string;
  driverName: string;
  loadCount: number;
  avgKmPerUnit: number | null;
  totalLiters: number;
  totalCost: number;
  avgVehicleReference: number | null;
  deviationPct: number | null;
  isAnomaly: boolean;
}

export interface DriverFuelAnomalyInput {
  fuelLoads: FuelLoadDTO[];
  vehicles: VehicleDTO[];
  drivers: DriverDTO[];
  anomalyThresholdPct: number;
}

export function calculateDriverFuelAnomalies(
  input: DriverFuelAnomalyInput,
): KPIResult<DriverAnomalyRow[]> {
  const vehicleMap = new Map(input.vehicles.map(v => [v.id, v]));
  const driverMap  = new Map(input.drivers.map(d => [d.id, d]));

  // Aggregate per-driver metrics
  const byDriver = new Map<string, {
    loads: Array<{ kpu: number; liters: number; ref: number | null; cost: number }>;
    totalLiters: number;
    totalCost: number;
  }>();

  for (const f of input.fuelLoads) {
    if (!f.driverId) continue;
    if (!byDriver.has(f.driverId)) {
      byDriver.set(f.driverId, { loads: [], totalLiters: 0, totalCost: 0 });
    }
    const bucket = byDriver.get(f.driverId)!;
    bucket.totalLiters += f.litersOrKwh;
    bucket.totalCost   += f.priceTotal ?? 0;
    if (f.kmPerUnit !== null) {
      const ref = vehicleMap.get(f.vehicleId)?.efficiencyReference ?? null;
      bucket.loads.push({ kpu: f.kmPerUnit, liters: f.litersOrKwh, ref, cost: f.priceTotal ?? 0 });
    }
  }

  const results: DriverAnomalyRow[] = [];

  for (const [driverId, data] of byDriver) {
    const driver     = driverMap.get(driverId);
    const withKm     = data.loads.filter(l => l.kpu > 0);
    const sumProduct = withKm.reduce((s, l) => s + l.kpu * l.liters, 0);
    const sumLiters  = withKm.reduce((s, l) => s + l.liters, 0);
    const avgKpu     = sumLiters > 0 ? Math.round((sumProduct / sumLiters) * 100) / 100 : null;

    const withRef     = withKm.filter(l => l.ref !== null);
    const refProd     = withRef.reduce((s, l) => s + l.ref! * l.liters, 0);
    const refLiters   = withRef.reduce((s, l) => s + l.liters, 0);
    const avgRef      = refLiters > 0 ? Math.round((refProd / refLiters) * 100) / 100 : null;

    let deviationPct: number | null = null;
    let isAnomaly = false;
    if (avgKpu !== null && avgRef !== null && avgRef > 0) {
      deviationPct = Math.round(((avgKpu - avgRef) / avgRef) * 1000) / 10;
      isAnomaly    = deviationPct < -input.anomalyThresholdPct;
    }

    results.push({
      driverId,
      driverName:          driver ? `${driver.name} ${driver.lastname}`.trim() : driverId,
      loadCount:           data.loads.length,
      avgKmPerUnit:        avgKpu,
      totalLiters:         Math.round(data.totalLiters * 100) / 100,
      totalCost:           Math.round(data.totalCost   * 100) / 100,
      avgVehicleReference: avgRef,
      deviationPct,
      isAnomaly,
    });
  }

  results.sort((a, b) => (a.deviationPct ?? 0) - (b.deviationPct ?? 0));
  const anomalyCount = results.filter(r => r.isAnomaly).length;

  return {
    id:     'fuel.driver_anomalies',
    label:  'Anomalías de consumo por conductor',
    value:  results,
    unit:   'conductores',
    status: anomalyCount > 0 ? 'warning' : 'ok',
    meta:   { driverCount: results.length, anomalyCount },
  };
}

// ─── KPI: Average consumption (km/L and L/100km) ─────────────────────────────

export interface VehicleConsumptionRow {
  vehicleId:           string;
  plate:               string;
  /** Weighted avg km per liter/kWh for this vehicle */
  kmPerLiter:          number | null;
  /** Litros por 100 km (only meaningful for liquid fuels) */
  litersPer100km:      number | null;
  efficiencyReference: number | null;
  loadCount:           number;
  totalLiters:         number;
}

export interface AverageConsumptionResult {
  /** Per-vehicle breakdown */
  perVehicle:       VehicleConsumptionRow[];
  /** Fleet-level weighted average */
  fleetKmPerLiter:  number | null;
  /** Fleet-level L/100km */
  fleetL100km:      number | null;
}

export interface AverageConsumptionInput {
  vehicles:  VehicleDTO[];
  fuelLoads: FuelLoadDTO[];
}

export function calculateAverageConsumption(
  input: AverageConsumptionInput,
): KPIResult<AverageConsumptionResult> {
  const loadsByVehicle = new Map<string, FuelLoadDTO[]>();
  for (const f of input.fuelLoads) {
    if (!loadsByVehicle.has(f.vehicleId)) loadsByVehicle.set(f.vehicleId, []);
    loadsByVehicle.get(f.vehicleId)!.push(f);
  }

  const vehicleMap = new Map(input.vehicles.map(v => [v.id, v]));
  const perVehicle: VehicleConsumptionRow[] = [];

  // For fleet aggregate
  let fleetSumProduct = 0;
  let fleetSumLiters  = 0;

  for (const [vid, loads] of loadsByVehicle) {
    const vehicle = vehicleMap.get(vid);
    const withKm  = loads.filter(f => f.kmPerUnit !== null && f.kmPerUnit > 0 && f.litersOrKwh > 0);

    const totalLiters = loads.reduce((s, f) => s + f.litersOrKwh, 0);
    let kmPerLiter: number | null = null;
    let litersPer100km: number | null = null;

    if (withKm.length > 0) {
      const sumProd   = withKm.reduce((s, f) => s + f.kmPerUnit! * f.litersOrKwh, 0);
      const sumLiters = withKm.reduce((s, f) => s + f.litersOrKwh, 0);
      if (sumLiters > 0) {
        kmPerLiter     = Math.round((sumProd / sumLiters) * 100) / 100;
        litersPer100km = Math.round((100 / kmPerLiter) * 100) / 100;
        // Contribute to fleet average
        fleetSumProduct += sumProd;
        fleetSumLiters  += sumLiters;
      }
    }

    perVehicle.push({
      vehicleId:           vid,
      plate:               vehicle?.plate ?? vid,
      kmPerLiter,
      litersPer100km,
      efficiencyReference: vehicle?.efficiencyReference ?? null,
      loadCount:           loads.length,
      totalLiters:         Math.round(totalLiters * 100) / 100,
    });
  }

  perVehicle.sort((a, b) => (b.kmPerLiter ?? 0) - (a.kmPerLiter ?? 0));

  const fleetKmPerLiter = fleetSumLiters > 0
    ? Math.round((fleetSumProduct / fleetSumLiters) * 100) / 100
    : null;
  const fleetL100km = fleetKmPerLiter && fleetKmPerLiter > 0
    ? Math.round((100 / fleetKmPerLiter) * 100) / 100
    : null;

  const result: AverageConsumptionResult = { perVehicle, fleetKmPerLiter, fleetL100km };
  const status: KPIStatus = fleetKmPerLiter !== null ? 'ok' : 'no_data';

  return {
    id:        'fuel.avg_consumption',
    label:     'Consumo promedio',
    value:     result,
    formatted: fleetKmPerLiter !== null ? `${fleetKmPerLiter.toFixed(2)} km/L` : undefined,
    unit:      'km/L',
    status,
    meta: {
      fleetKmPerLiter,
      fleetL100km,
      vehicleCount: perVehicle.length,
    },
  };
}

// ─── KPI: Fuel deviation — real vs expected ────────────────────────────────────

export interface FuelDeviationRow {
  vehicleId:           string;
  plate:               string;
  /** Actual weighted km/L for this vehicle in the period */
  actualKmPerLiter:    number | null;
  /** Reference km/L from vehicle config */
  expectedKmPerLiter:  number | null;
  /** (actual - expected) / expected × 100 — negative = worse than expected */
  deviationPct:        number | null;
  /** Actual liters consumed */
  actualLiters:        number;
  /** Expected liters based on km driven and reference efficiency */
  expectedLiters:      number | null;
  /** Absolute liters more/less than expected */
  litersDifference:    number | null;
  isAnomaly:           boolean;
  status:              KPIStatus;
}

export interface FuelDeviationResult {
  perVehicle:         FuelDeviationRow[];
  /** Fleet-level deviation % (weighted by volume) */
  fleetDeviationPct:  number | null;
  anomalyCount:       number;
  totalLitersDiff:    number | null;
}

export interface FuelDeviationInput {
  vehicles:            VehicleDTO[];
  fuelLoads:           FuelLoadDTO[];
  /** % threshold for anomaly flag — default: 20 */
  anomalyThresholdPct: number;
}

export function calculateFuelDeviation(
  input: FuelDeviationInput,
): KPIResult<FuelDeviationResult> {
  const loadsByVehicle = new Map<string, FuelLoadDTO[]>();
  for (const f of input.fuelLoads) {
    if (!loadsByVehicle.has(f.vehicleId)) loadsByVehicle.set(f.vehicleId, []);
    loadsByVehicle.get(f.vehicleId)!.push(f);
  }

  const vehicleMap = new Map(input.vehicles.map(v => [v.id, v]));
  const perVehicle: FuelDeviationRow[] = [];

  let fleetSumDeviationWeighted = 0;
  let fleetSumLiters            = 0;
  let totalLitersDiff           = 0;
  let hasLitersDiff             = false;

  for (const [vid, loads] of loadsByVehicle) {
    const vehicle    = vehicleMap.get(vid);
    const effRef     = vehicle?.efficiencyReference ?? null;
    const withKm     = loads.filter(f => f.kmPerUnit !== null && f.kmPerUnit > 0 && f.litersOrKwh > 0);
    const totalLiters = loads.reduce((s, f) => s + f.litersOrKwh, 0);

    const actualKmPerLiter: number | null = (() => {
      if (withKm.length === 0) return null;
      const sumProd   = withKm.reduce((s, f) => s + f.kmPerUnit! * f.litersOrKwh, 0);
      const sumLiters = withKm.reduce((s, f) => s + f.litersOrKwh, 0);
      return sumLiters > 0 ? Math.round((sumProd / sumLiters) * 100) / 100 : null;
    })();

    let deviationPct: number | null    = null;
    let expectedLiters: number | null  = null;
    let litersDifference: number | null = null;

    if (actualKmPerLiter !== null && effRef !== null && effRef > 0) {
      deviationPct = Math.round(((actualKmPerLiter - effRef) / effRef) * 1000) / 10;

      // Derive km driven from odometer delta for this vehicle
      const odos = loads.map(f => f.odometer).filter((o): o is number => o !== null);
      if (odos.length >= 2) {
        const kmDriven = Math.max(...odos) - Math.min(...odos);
        if (kmDriven > 0) {
          expectedLiters   = Math.round((kmDriven / effRef) * 100) / 100;
          litersDifference = Math.round((totalLiters - expectedLiters) * 100) / 100;
          totalLitersDiff += litersDifference;
          hasLitersDiff    = true;
        }
      }

      // Fleet aggregate
      fleetSumDeviationWeighted += deviationPct * totalLiters;
      fleetSumLiters            += totalLiters;
    }

    const isAnomaly = deviationPct !== null && deviationPct < -input.anomalyThresholdPct;
    const rowStatus: KPIStatus =
      deviationPct === null                          ? 'no_data'  :
      deviationPct < -(input.anomalyThresholdPct * 1.5) ? 'critical' :
      isAnomaly                                      ? 'warning'  : 'ok';

    perVehicle.push({
      vehicleId:          vid,
      plate:              vehicle?.plate ?? vid,
      actualKmPerLiter,
      expectedKmPerLiter: effRef,
      deviationPct,
      actualLiters:       Math.round(totalLiters * 100) / 100,
      expectedLiters,
      litersDifference,
      isAnomaly,
      status:             rowStatus,
    });
  }

  perVehicle.sort((a, b) => (a.deviationPct ?? 0) - (b.deviationPct ?? 0));

  const fleetDeviationPct = fleetSumLiters > 0
    ? Math.round((fleetSumDeviationWeighted / fleetSumLiters) * 10) / 10
    : null;

  const anomalyCount = perVehicle.filter(r => r.isAnomaly).length;

  const result: FuelDeviationResult = {
    perVehicle,
    fleetDeviationPct,
    anomalyCount,
    totalLitersDiff: hasLitersDiff ? Math.round(totalLitersDiff * 100) / 100 : null,
  };

  const overallStatus: KPIStatus =
    anomalyCount > 3            ? 'critical' :
    anomalyCount > 0            ? 'warning'  :
    fleetDeviationPct === null  ? 'no_data'  : 'ok';

  return {
    id:        'fuel.deviation',
    label:     'Desviación de consumo',
    value:     result,
    formatted: fleetDeviationPct !== null
      ? `${fleetDeviationPct > 0 ? '+' : ''}${fleetDeviationPct.toFixed(1)}%`
      : undefined,
    unit:      '%',
    status:    overallStatus,
    meta:      { fleetDeviationPct, anomalyCount, vehicleCount: perVehicle.length },
  };
}

// ─── KPI: Fuel loaded — what went into tanks ──────────────────────────────────

export interface FuelLoadedByVehicle {
  vehicleId:   string;
  plate:       string;
  totalLiters: number;
  totalCost:   number;
  loadCount:   number;
  sharePct:    number;
}

export interface FuelLoadedByMonth {
  month:       string;
  totalLiters: number;
  totalCost:   number;
  loadCount:   number;
}

export interface FuelLoadedResult {
  totalLiters:  number;
  totalCost:    number;
  loadCount:    number;
  perVehicle:   FuelLoadedByVehicle[];
  byMonth:      FuelLoadedByMonth[];
}

export interface FuelLoadedInput {
  vehicles:  VehicleDTO[];
  fuelLoads: FuelLoadDTO[];
}

export function calculateFuelLoaded(
  input: FuelLoadedInput,
): KPIResult<FuelLoadedResult> {
  const vehicleMap    = new Map(input.vehicles.map(v => [v.id, v]));
  const byVehicle     = new Map<string, { liters: number; cost: number; count: number }>();
  const byMonth       = new Map<string, { liters: number; cost: number; count: number }>();

  let totalLiters = 0;
  let totalCost   = 0;

  for (const f of input.fuelLoads) {
    // Vehicle bucket
    if (!byVehicle.has(f.vehicleId)) byVehicle.set(f.vehicleId, { liters: 0, cost: 0, count: 0 });
    const vb = byVehicle.get(f.vehicleId)!;
    vb.liters += f.litersOrKwh;
    vb.cost   += f.priceTotal ?? 0;
    vb.count  += 1;

    // Month bucket
    const m = f.date.toISOString().slice(0, 7);
    if (!byMonth.has(m)) byMonth.set(m, { liters: 0, cost: 0, count: 0 });
    const mb = byMonth.get(m)!;
    mb.liters += f.litersOrKwh;
    mb.cost   += f.priceTotal ?? 0;
    mb.count  += 1;

    totalLiters += f.litersOrKwh;
    totalCost   += f.priceTotal ?? 0;
  }

  const perVehicle: FuelLoadedByVehicle[] = [...byVehicle.entries()]
    .map(([vid, d]) => ({
      vehicleId:   vid,
      plate:       vehicleMap.get(vid)?.plate ?? vid,
      totalLiters: Math.round(d.liters * 100) / 100,
      totalCost:   Math.round(d.cost   * 100) / 100,
      loadCount:   d.count,
      sharePct:    totalLiters > 0 ? Math.round((d.liters / totalLiters) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.totalLiters - a.totalLiters);

  const byMonthSorted: FuelLoadedByMonth[] = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => ({
      month,
      totalLiters: Math.round(d.liters * 100) / 100,
      totalCost:   Math.round(d.cost   * 100) / 100,
      loadCount:   d.count,
    }));

  const result: FuelLoadedResult = {
    totalLiters: Math.round(totalLiters * 100) / 100,
    totalCost:   Math.round(totalCost   * 100) / 100,
    loadCount:   input.fuelLoads.length,
    perVehicle,
    byMonth:     byMonthSorted,
  };

  return {
    id:        'fuel.loaded',
    label:     'Combustible cargado',
    value:     result,
    formatted: `${result.totalLiters.toLocaleString('es-CL', { maximumFractionDigits: 0 })} L`,
    unit:      'Litros',
    status:    totalLiters > 0 ? 'ok' : 'no_data',
    meta:      { totalLiters: result.totalLiters, loadCount: result.loadCount },
  };
}

// ─── KPI: Fuel loss — actual loaded vs expected by km ─────────────────────────
//
// Formula per vehicle:
//   km_traveled      = MAX(odometer) − MIN(odometer) across loads in period
//   expected_liters  = km_traveled / efficiencyReference
//   loss_liters      = actual_liters_loaded − expected_liters
//   loss_pct         = loss_liters / expected_liters × 100
//
// A positive loss means MORE fuel was loaded than expected given the km driven.
// When loss_pct exceeds lossThresholdPct, a fraud/anomaly flag is raised.
//
// NOTE: This is an estimation — it cannot distinguish between:
//   a) Legitimate extra loads (detoured routes, engine issues)
//   b) Fraudulent loads (fuel not going to the vehicle)
// Hence the output label: "Pérdida estimada / posible fraude".

export type FraudRiskLevel = 'none' | 'low' | 'medium' | 'high';

export interface FuelLossRow {
  vehicleId:           string;
  plate:               string;
  /** Actual liters loaded in the period */
  actualLiters:        number;
  /** Expected liters based on km driven ÷ efficiencyReference */
  expectedLiters:      number | null;
  /** actualLiters − expectedLiters (positive = more than expected) */
  lossLiters:          number | null;
  /** loss_liters / expected_liters × 100 */
  lossPct:             number | null;
  /** km driven derived from odometer delta */
  kmDriven:            number | null;
  efficiencyReference: number | null;
  fraudRisk:           FraudRiskLevel;
  fraudFlag:           boolean;
}

export interface FuelLossResult {
  perVehicle:            FuelLossRow[];
  /** Total fleet excess liters (sum of positive losses only) */
  totalExcessLiters:     number;
  /** Vehicles flagged for potential fraud */
  suspiciousVehicles:    FuelLossRow[];
  /** Fleet-level avg loss % (weighted by expected liters) */
  fleetLossPct:          number | null;
}

export interface FuelLossInput {
  vehicles:              VehicleDTO[];
  fuelLoads:             FuelLoadDTO[];
  /**
   * % above which a vehicle is flagged as suspicious.
   * Default: 20 (vehicle loaded 20% more than km-based expectation).
   */
  lossThresholdPct?:     number;
}

export function calculateFuelLoss(
  input: FuelLossInput,
): KPIResult<FuelLossResult> {
  const { lossThresholdPct = 20 } = input;

  const vehicleMap = new Map(input.vehicles.map(v => [v.id, v]));

  // Group loads by vehicle and derive odometer range + total liters
  const byVehicle = new Map<string, {
    totalLiters:  number;
    odoMin:       number | null;
    odoMax:       number | null;
    loadCount:    number;
  }>();

  for (const f of input.fuelLoads) {
    if (!byVehicle.has(f.vehicleId)) {
      byVehicle.set(f.vehicleId, { totalLiters: 0, odoMin: null, odoMax: null, loadCount: 0 });
    }
    const b = byVehicle.get(f.vehicleId)!;
    b.totalLiters += f.litersOrKwh;
    b.loadCount   += 1;

    if (f.odometer !== null) {
      b.odoMin = b.odoMin === null ? f.odometer : Math.min(b.odoMin, f.odometer);
      b.odoMax = b.odoMax === null ? f.odometer : Math.max(b.odoMax, f.odometer);
    }
  }

  const perVehicle: FuelLossRow[] = [];
  let totalExcessLiters          = 0;
  let weightedLossSum            = 0;
  let weightedExpected           = 0;

  for (const [vid, data] of byVehicle) {
    const vehicle   = vehicleMap.get(vid);
    const effRef    = vehicle?.efficiencyReference ?? null;

    const kmDriven: number | null =
      (data.odoMin !== null && data.odoMax !== null && data.odoMax > data.odoMin)
        ? data.odoMax - data.odoMin
        : null;

    let expectedLiters: number | null  = null;
    let lossLiters: number | null      = null;
    let lossPct: number | null         = null;
    let fraudRisk: FraudRiskLevel      = 'none';
    let fraudFlag                      = false;

    if (kmDriven !== null && effRef !== null && effRef > 0) {
      expectedLiters = Math.round((kmDriven / effRef) * 100) / 100;
      lossLiters     = Math.round((data.totalLiters - expectedLiters) * 100) / 100;
      lossPct        = Math.round((lossLiters / expectedLiters) * 1000) / 10;

      // Fraud risk levels
      if (lossPct > lossThresholdPct * 2) {
        fraudRisk = 'high';
        fraudFlag = true;
      } else if (lossPct > lossThresholdPct * 1.5) {
        fraudRisk = 'medium';
        fraudFlag = true;
      } else if (lossPct > lossThresholdPct) {
        fraudRisk = 'low';
        fraudFlag = true;
      }

      if (lossLiters > 0) totalExcessLiters += lossLiters;

      // Weighted fleet average
      weightedLossSum  += lossPct  * expectedLiters;
      weightedExpected += expectedLiters;
    }

    perVehicle.push({
      vehicleId:           vid,
      plate:               vehicle?.plate ?? vid,
      actualLiters:        Math.round(data.totalLiters * 100) / 100,
      expectedLiters,
      lossLiters,
      lossPct,
      kmDriven,
      efficiencyReference: effRef,
      fraudRisk,
      fraudFlag,
    });
  }

  // Sort by lossPct descending (worst first)
  perVehicle.sort((a, b) => (b.lossPct ?? -Infinity) - (a.lossPct ?? -Infinity));

  const fleetLossPct   = weightedExpected > 0
    ? Math.round((weightedLossSum / weightedExpected) * 10) / 10
    : null;
  const suspicious     = perVehicle.filter(r => r.fraudFlag);

  const result: FuelLossResult = {
    perVehicle,
    totalExcessLiters: Math.round(totalExcessLiters * 100) / 100,
    suspiciousVehicles: suspicious,
    fleetLossPct,
  };

  const overallStatus: KPIStatus =
    suspicious.some(r => r.fraudRisk === 'high')   ? 'critical' :
    suspicious.some(r => r.fraudRisk === 'medium') ? 'critical' :
    suspicious.length > 0                          ? 'warning'  :
    fleetLossPct === null                           ? 'no_data'  : 'ok';

  return {
    id:        'fuel.loss',
    label:     'Pérdida estimada de combustible',
    value:     result,
    formatted: fleetLossPct !== null
      ? `${fleetLossPct > 0 ? '+' : ''}${fleetLossPct.toFixed(1)}%`
      : undefined,
    unit:      '%',
    status:    overallStatus,
    meta: {
      suspicious:        suspicious.length,
      totalExcessLiters: result.totalExcessLiters,
      fleetLossPct,
      lossThresholdPct,
    },
  };
}

// ─── KPI Definitions for registry registration ────────────────────────────────

export const fuelKPIs: KPIDefinition<unknown, unknown>[] = [
  {
    id:          'fuel.consumption',
    name:        'Consumo total de combustible',
    description: 'Suma de litros/kWh consumidos y costo total en el período',
    category:    'fuel',
    unit:        'Litros',
    calculate:   (i) => calculateFuelConsumption(i as FuelConsumptionInput),
  },
  {
    id:          'fuel.efficiency_per_vehicle',
    name:        'Eficiencia por vehículo',
    description: 'Rendimiento real km/L por vehículo comparado con referencia configurada',
    category:    'fuel',
    unit:        'km/L',
    calculate:   (i) => calculateFuelEfficiency(i as FuelEfficiencyInput),
  },
  {
    id:          'fuel.cost_per_unit',
    name:        'Precio promedio por litro/kWh',
    description: 'Precio promedio CLP por litro o kWh pagado en el período',
    category:    'fuel',
    unit:        'CLP/L',
    calculate:   (i) => calculateFuelCostPerUnit(i as FuelCostPerUnitInput),
  },
  {
    id:          'fuel.monthly_trend',
    name:        'Tendencia mensual de combustible',
    description: 'Evolución mensual de consumo y costo de combustible',
    category:    'fuel',
    unit:        'L',
    calculate:   (i) => calculateFuelTrend(i as FuelTrendInput),
  },
  {
    id:          'fuel.irregular_loads',
    name:        'Cargas irregulares detectadas',
    description: 'Cargas donde el km/L se desvía > Z-threshold del promedio histórico del vehículo',
    category:    'fuel',
    thresholds:  { warningMin: 1, criticalMin: 5 },
    calculate:   (i) => detectIrregularLoads(i as IrregularLoadsInput),
  },
  {
    id:          'fuel.driver_anomalies',
    name:        'Anomalías de consumo por conductor',
    description: 'Conductores cuyo rendimiento km/L promedio se desvía del vehículo que utilizaron',
    category:    'fuel',
    calculate:   (i) => calculateDriverFuelAnomalies(i as DriverFuelAnomalyInput),
  },
  {
    id:          'fuel.avg_consumption',
    name:        'Consumo promedio',
    description: 'Rendimiento promedio en km/L y litros/100km por vehículo y flota',
    category:    'fuel',
    unit:        'km/L',
    calculate:   (i) => calculateAverageConsumption(i as AverageConsumptionInput),
  },
  {
    id:          'fuel.deviation',
    name:        'Desviación de consumo',
    description: 'Diferencia entre consumo real y consumo esperado (según efficiencyReference)',
    category:    'fuel',
    unit:        '%',
    thresholds:  { warningMin: -20, criticalMin: -30 },
    calculate:   (i) => calculateFuelDeviation(i as FuelDeviationInput),
  },
  {
    id:          'fuel.loaded',
    name:        'Combustible cargado',
    description: 'Total de litros/kWh cargados con desglose por vehículo y mes',
    category:    'fuel',
    unit:        'Litros',
    calculate:   (i) => calculateFuelLoaded(i as FuelLoadedInput),
  },
  {
    id:          'fuel.loss',
    name:        'Pérdida estimada de combustible',
    description: 'Diferencia entre litros cargados y litros esperados según km recorridos. Valores altos sugieren posible fraude.',
    category:    'fuel',
    unit:        '%',
    thresholds:  { warningMin: 20, criticalMin: 30 },
    calculate:   (i) => calculateFuelLoss(i as FuelLossInput),
  },
];
