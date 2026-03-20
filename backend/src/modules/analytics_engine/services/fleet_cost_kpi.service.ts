/**
 * analytics_engine/services/fleet_cost_kpi.service.ts
 *
 * Fleet Cost KPI Service
 *
 * Computes the 5 fleet cost KPIs with trend (period-over-period), caching,
 * and zero duplicate queries per company/month:
 *
 *   1. total_fleet_cost     — Σ fuel + Σ maintenance
 *   2. cost_per_vehicle     — total cost / active vehicles with activity
 *   3. cost_per_km          — total cost / km derived from odometers
 *   4. maintenance_cost     — Σ maintenance.cost
 *   5. fuel_cost            — Σ fuel_loads.price_total
 *
 * Data flow (single round-trip per month per company):
 *
 *   fetchFleetKPIInput(companyId, range)   ← cached per company:month
 *        ↓
 *   calculateTotalFleetCost(input)
 *   calculateCostPerVehicle(input)
 *   calculateCostPerKm(input)
 *        ↓
 *   compare current vs previous month → trend
 *        ↓
 *   buildKPIOutput(...)  → StandardKPIOutput[]
 *        ↓
 *   cache full result per company:month
 */

import { fetchFleetKPIInput }     from '../data_adapters/prisma.adapter';
import {
  calculateTotalFleetCost,
  calculateCostPerVehicle,
  calculateCostPerKm,
} from '../kpi_calculators/fleet_cost_kpis';
import { kpiCache }               from '../utils/kpi_cache';
import {
  computeTrend,
  monthToDateRange,
  prevMonth,
  currentMonth,
  formatPeriodLabel,
} from '../utils/trend.helper';
import {
  buildKPIOutput,
  formatCLP,
  formatCLPKm,
  type StandardKPIOutput,
} from '../utils/standard_output';
import type { FleetKPIInput, KPIStatus } from '../types';

// ─── Cache TTL: 5 minutes ─────────────────────────────────────────────────────

const DATA_TTL    = 300_000;  // raw FleetKPIInput
const RESULT_TTL  = 300_000;  // compiled StandardKPIOutput[]

// ─── Internal: fetch and cache raw FleetKPIInput ──────────────────────────────

async function loadInput(companyId: string, month: string): Promise<FleetKPIInput> {
  const cacheKey = `fleet_kpi_input:${companyId}:${month}`;
  return kpiCache.getOrSet(
    cacheKey,
    () => fetchFleetKPIInput(companyId, monthToDateRange(month)),
    DATA_TTL,
  );
}

// ─── Scalar extractors (pull single number from calculator results) ───────────

function totalCostScalar(input: FleetKPIInput): number | null {
  const r = calculateTotalFleetCost({
    fuelLoads:    input.fuelLoads,
    maintenances: input.maintenances,
  });
  return (r.value as { totalCost: number }).totalCost;
}

function fuelCostScalar(input: FleetKPIInput): number | null {
  const r = calculateTotalFleetCost({
    fuelLoads:    input.fuelLoads,
    maintenances: input.maintenances,
  });
  return (r.value as { fuelCost: number }).fuelCost;
}

function maintCostScalar(input: FleetKPIInput): number | null {
  const r = calculateTotalFleetCost({
    fuelLoads:    input.fuelLoads,
    maintenances: input.maintenances,
  });
  return (r.value as { maintCost: number }).maintCost;
}

function costPerKmScalar(input: FleetKPIInput): number | null {
  const r = calculateCostPerKm({
    fuelLoads:    input.fuelLoads,
    maintenances: input.maintenances,
  });
  return r.value as number | null;
}

// ─── Main service ─────────────────────────────────────────────────────────────

class FleetCostKPIService {

  /**
   * Return all 5 fleet cost KPIs for the given month.
   *
   * Fetches current and previous month data in parallel (2 queries max),
   * then computes all KPIs from the cached bundles.
   *
   * @param companyId  Tenant ID
   * @param month      'YYYY-MM' — defaults to current month
   */
  async getAll(
    companyId: string,
    month = currentMonth(),
  ): Promise<StandardKPIOutput[]> {
    const resultKey = `fleet_cost_kpis:${companyId}:${month}`;

    return kpiCache.getOrSet(
      resultKey,
      async () => {
        const prev = prevMonth(month);

        // Fetch current + previous month in parallel (single DB round-trip each)
        const [cur, prv] = await Promise.all([
          loadInput(companyId, month),
          loadInput(companyId, prev),
        ]);

        return [
          this._buildTotalFleetCost(cur, prv, month),
          this._buildCostPerVehicle(cur, prv, month),
          this._buildCostPerKm(cur, prv, month),
          this._buildMaintenanceCost(cur, prv, month),
          this._buildFuelCost(cur, prv, month),
        ];
      },
      RESULT_TTL,
    );
  }

  // ── Individual KPI accessors ───────────────────────────────────────────────
  // Each delegates to getAll() so we never fetch data twice.

  async getTotalFleetCost(companyId: string, month = currentMonth()): Promise<StandardKPIOutput> {
    const all = await this.getAll(companyId, month);
    return all.find(k => k.name === 'total_fleet_cost')!;
  }

  async getCostPerVehicle(companyId: string, month = currentMonth()): Promise<StandardKPIOutput> {
    const all = await this.getAll(companyId, month);
    return all.find(k => k.name === 'cost_per_vehicle')!;
  }

  async getCostPerKm(companyId: string, month = currentMonth()): Promise<StandardKPIOutput> {
    const all = await this.getAll(companyId, month);
    return all.find(k => k.name === 'cost_per_km')!;
  }

  async getMaintenanceCost(companyId: string, month = currentMonth()): Promise<StandardKPIOutput> {
    const all = await this.getAll(companyId, month);
    return all.find(k => k.name === 'maintenance_cost')!;
  }

  async getFuelCost(companyId: string, month = currentMonth()): Promise<StandardKPIOutput> {
    const all = await this.getAll(companyId, month);
    return all.find(k => k.name === 'fuel_cost')!;
  }

  // ── Builders (pure — no I/O) ───────────────────────────────────────────────

  private _buildTotalFleetCost(
    cur: FleetKPIInput,
    prv: FleetKPIInput,
    month: string,
  ): StandardKPIOutput {
    const curVal = totalCostScalar(cur);
    const prvVal = totalCostScalar(prv);
    const trend  = computeTrend(curVal, prvVal, true /* cost up = bad */);

    // Fetch full breakdown for the detail field
    const breakdown = calculateCostPerVehicle({
      vehicles:     cur.vehicles,
      fuelLoads:    cur.fuelLoads,
      maintenances: cur.maintenances,
    }).value;

    const status: KPIStatus = curVal === 0 ? 'no_data' : 'info';

    return buildKPIOutput({
      name:         'total_fleet_cost',
      label:        'Costo total de flota',
      description:  'Suma de todos los gastos de combustible y mantenimiento de la flota en el período',
      formula:      'Σ fuel_loads.price_total + Σ maintenance.cost',
      value:        curVal,
      formatted:    formatCLP(curVal),
      unit:         'CLP',
      trend,
      period:       month,
      periodLabel:  formatPeriodLabel(month),
      previousValue: prvVal,
      status,
      detail: {
        fuelCost:  fuelCostScalar(cur),
        maintCost: maintCostScalar(cur),
        vehiclesBreakdown: breakdown,
      },
    });
  }

  private _buildCostPerVehicle(
    cur: FleetKPIInput,
    prv: FleetKPIInput,
    month: string,
  ): StandardKPIOutput {
    // Active vehicles with at least one fuel load or maintenance in the period
    const activityVehicleIds = new Set([
      ...cur.fuelLoads.map(f => f.vehicleId),
      ...cur.maintenances.map(m => m.vehicleId),
    ]);
    const vehicleCount = activityVehicleIds.size;

    const total  = totalCostScalar(cur);
    const curVal = total !== null && vehicleCount > 0
      ? Math.round((total / vehicleCount) * 100) / 100
      : null;

    // Previous month
    const prevActivity = new Set([
      ...prv.fuelLoads.map(f => f.vehicleId),
      ...prv.maintenances.map(m => m.vehicleId),
    ]);
    const prevTotal    = totalCostScalar(prv);
    const prvVal = prevTotal !== null && prevActivity.size > 0
      ? Math.round((prevTotal / prevActivity.size) * 100) / 100
      : null;

    const trend  = computeTrend(curVal, prvVal, true);
    const status: KPIStatus = curVal === null ? 'no_data' : 'info';

    return buildKPIOutput({
      name:         'cost_per_vehicle',
      label:        'Costo por vehículo',
      description:  'Costo total de la flota dividido por la cantidad de vehículos con actividad en el período',
      formula:      '(Σ combustible + Σ mantenimiento) / vehículos activos en período',
      value:        curVal,
      formatted:    formatCLP(curVal),
      unit:         'CLP/vehículo',
      trend,
      period:       month,
      periodLabel:  formatPeriodLabel(month),
      previousValue: prvVal,
      status,
      detail: {
        totalCost:    total,
        vehicleCount,
      },
    });
  }

  private _buildCostPerKm(
    cur: FleetKPIInput,
    prv: FleetKPIInput,
    month: string,
  ): StandardKPIOutput {
    const curVal = costPerKmScalar(cur);
    const prvVal = costPerKmScalar(prv);
    const trend  = computeTrend(curVal, prvVal, true);

    // Derive total km for meta
    const odoByVehicle = new Map<string, { min: number; max: number }>();
    for (const f of cur.fuelLoads) {
      if (f.odometer == null) continue;
      const o = odoByVehicle.get(f.vehicleId);
      if (!o) odoByVehicle.set(f.vehicleId, { min: f.odometer, max: f.odometer });
      else { o.min = Math.min(o.min, f.odometer); o.max = Math.max(o.max, f.odometer); }
    }
    const totalKm = [...odoByVehicle.values()].reduce(
      (s, o) => s + Math.max(0, o.max - o.min), 0,
    );

    const status: KPIStatus =
      curVal === null                   ? 'no_data'  :
      curVal > 300                      ? 'critical' :
      curVal > 150                      ? 'warning'  : 'ok';

    return buildKPIOutput({
      name:         'cost_per_km',
      label:        'Costo por km',
      description:  'Costo total de la flota dividido por los kilómetros recorridos derivados del odómetro',
      formula:      '(Σ combustible + Σ mantenimiento) / (MAX(odómetro) − MIN(odómetro)) por vehículo',
      value:        curVal,
      formatted:    formatCLPKm(curVal),
      unit:         'CLP/km',
      trend,
      period:       month,
      periodLabel:  formatPeriodLabel(month),
      previousValue: prvVal,
      status,
      detail: {
        totalCost:  totalCostScalar(cur),
        totalKm:    totalKm > 0 ? totalKm : null,
      },
    });
  }

  private _buildMaintenanceCost(
    cur: FleetKPIInput,
    prv: FleetKPIInput,
    month: string,
  ): StandardKPIOutput {
    const curVal = maintCostScalar(cur);
    const prvVal = maintCostScalar(prv);
    const trend  = computeTrend(curVal, prvVal, true);

    const status: KPIStatus = curVal === 0 ? 'no_data' : 'info';

    // Breakdown by type
    const byType: Record<string, { count: number; cost: number }> = {};
    for (const m of cur.maintenances) {
      const t = m.type || 'sin tipo';
      if (!byType[t]) byType[t] = { count: 0, cost: 0 };
      byType[t].count++;
      byType[t].cost += m.cost ?? 0;
    }

    return buildKPIOutput({
      name:         'maintenance_cost',
      label:        'Costo de mantenimiento',
      description:  'Suma de todos los gastos de mantenimiento (preventivo, correctivo y otros) en el período',
      formula:      'Σ maintenance.cost',
      value:        curVal,
      formatted:    formatCLP(curVal),
      unit:         'CLP',
      trend,
      period:       month,
      periodLabel:  formatPeriodLabel(month),
      previousValue: prvVal,
      status,
      detail: {
        count:  cur.maintenances.length,
        byType,
      },
    });
  }

  private _buildFuelCost(
    cur: FleetKPIInput,
    prv: FleetKPIInput,
    month: string,
  ): StandardKPIOutput {
    const curVal = fuelCostScalar(cur);
    const prvVal = fuelCostScalar(prv);
    const trend  = computeTrend(curVal, prvVal, true);

    const status: KPIStatus = curVal === 0 ? 'no_data' : 'info';

    const totalLiters = cur.fuelLoads.reduce((s, f) => s + f.litersOrKwh, 0);
    const avgPricePerL = totalLiters > 0 && curVal !== null
      ? Math.round((curVal / totalLiters) * 100) / 100
      : null;

    return buildKPIOutput({
      name:         'fuel_cost',
      label:        'Costo de combustible',
      description:  'Suma de todos los gastos de combustible registrados en el período',
      formula:      'Σ fuel_loads.price_total',
      value:        curVal,
      formatted:    formatCLP(curVal),
      unit:         'CLP',
      trend,
      period:       month,
      periodLabel:  formatPeriodLabel(month),
      previousValue: prvVal,
      status,
      detail: {
        loadCount:        cur.fuelLoads.length,
        totalLiters:      Math.round(totalLiters * 100) / 100,
        avgPricePerLiter: avgPricePerL,
      },
    });
  }

  // ── Cache management ───────────────────────────────────────────────────────

  /**
   * Manually invalidate all cached results for a company.
   * Call this after any fuel load or maintenance mutation.
   */
  invalidateCache(companyId: string): void {
    kpiCache.invalidateCompany(companyId);
  }

  /** List active cache keys (for debugging). */
  cacheDebug(): ReturnType<typeof kpiCache.debug> {
    return kpiCache.debug();
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const fleetCostKPIService = new FleetCostKPIService();
export { FleetCostKPIService };
export type { StandardKPIOutput };
