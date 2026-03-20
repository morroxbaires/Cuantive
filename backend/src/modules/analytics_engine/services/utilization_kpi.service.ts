/**
 * analytics_engine/services/utilization_kpi.service.ts
 *
 * Utilization KPI Service
 *
 * Wraps utilization_kpi_calculator.ts with cache, trend, and StandardKPIOutput.
 *
 * Exposes 3 StandardKPIOutput objects:
 *
 *   1. km_per_vehicle        — km recorridos por vehículo en el período
 *   2. usage_hours           — horas de uso estimadas por vehículo
 *   3. fleet_utilization     — vehículos activos / total (+ operacionales en período)
 *
 * Filters (passed through to all calculators):
 *   vehicleType  — filtra por tipo de vehículo ("camión", "auto", etc.)
 *   vehicleIds   — lista de vehicleId específicos
 *
 * Caching:
 *   Filters encoded in the cache key so filtered and unfiltered results coexist.
 *
 * Trend direction:
 *   km_per_vehicle      → higher is better (invertPositive = false)
 *   usage_hours         → higher is better (invertPositive = false)
 *   fleet_utilization   → higher is better (invertPositive = false)
 */

import { fetchFleetKPIInput }              from '../data_adapters/prisma.adapter';
import {
  calculateKmPerVehicle,
  calculateUsageHours,
  calculateFleetUtilization,
  type KmPerVehicleResult,
  type UsageHoursResult,
  type FleetUtilizationResult,
} from '../kpi_calculators/utilization_kpi_calculator';
import { kpiCache }                       from '../utils/kpi_cache';
import {
  computeTrend,
  monthToDateRange,
  prevMonth,
  currentMonth,
  formatPeriodLabel,
} from '../utils/trend.helper';
import {
  buildKPIOutput,
  type StandardKPIOutput,
} from '../utils/standard_output';
import type { DateRange, FleetKPIInput, KPIStatus } from '../types';

// ─── Options ──────────────────────────────────────────────────────────────────

export interface UtilizationKPIOptions {
  /** Filter by vehicleType string (case-insensitive exact match) */
  vehicleType?: string;
  /** Filter by specific vehicleId list */
  vehicleIds?: string[];
  /** Hours per active day for usage hours estimate (default: 8) */
  hoursPerActiveDay?: number;
}

// ─── Cache TTL ────────────────────────────────────────────────────────────────

const DATA_TTL   = 300_000;
const RESULT_TTL = 300_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function loadInput(companyId: string, month: string): Promise<FleetKPIInput> {
  const key = `fleet_kpi_input:${companyId}:${month}`;
  return kpiCache.getOrSet(
    key,
    () => fetchFleetKPIInput(companyId, monthToDateRange(month)),
    DATA_TTL,
  );
}

function filterKey(opts?: UtilizationKPIOptions): string {
  if (!opts) return '*';
  const t  = opts.vehicleType ?? '*';
  const vs = opts.vehicleIds?.length ? [...opts.vehicleIds].sort().join(',') : '*';
  const h  = opts.hoursPerActiveDay ?? 8;
  return `${t}::${vs}::h${h}`;
}

// ─── UtilizationKPIService ────────────────────────────────────────────────────

class UtilizationKPIService {

  // ── All 3 KPIs for a calendar month ────────────────────────────────────────

  async getAll(
    companyId: string,
    month     = currentMonth(),
    opts?:    UtilizationKPIOptions,
  ): Promise<StandardKPIOutput[]> {
    const resultKey = `util_kpis:${companyId}:${month}:${filterKey(opts)}`;

    return kpiCache.getOrSet(
      resultKey,
      async () => {
        const prv = prevMonth(month);
        const [cur, prev] = await Promise.all([
          loadInput(companyId, month),
          loadInput(companyId, prv),
        ]);

        return [
          this._buildKmPerVehicle(cur, prev, month, undefined, undefined, opts),
          this._buildUsageHours(cur, prev, month, undefined, undefined, opts),
          this._buildFleetUtilization(cur, prev, month, undefined, undefined, opts),
        ];
      },
      RESULT_TTL,
    );
  }

  // ── Individual getters ────────────────────────────────────────────────────

  async getKmPerVehicle(
    companyId: string,
    month     = currentMonth(),
    opts?:    UtilizationKPIOptions,
  ): Promise<StandardKPIOutput> {
    return (await this.getAll(companyId, month, opts)).find(k => k.name === 'km_per_vehicle')!;
  }

  async getUsageHours(
    companyId: string,
    month     = currentMonth(),
    opts?:    UtilizationKPIOptions,
  ): Promise<StandardKPIOutput> {
    return (await this.getAll(companyId, month, opts)).find(k => k.name === 'usage_hours')!;
  }

  async getFleetUtilization(
    companyId: string,
    month     = currentMonth(),
    opts?:    UtilizationKPIOptions,
  ): Promise<StandardKPIOutput> {
    return (await this.getAll(companyId, month, opts)).find(k => k.name === 'fleet_utilization')!;
  }

  // ── Arbitrary date range (not cached) ────────────────────────────────────

  async getAllForRange(
    companyId:    string,
    range:        DateRange,
    periodLabel?: string,
    opts?:        UtilizationKPIOptions,
  ): Promise<StandardKPIOutput[]> {
    const input  = await fetchFleetKPIInput(companyId, range);
    const period = `${range.from.toISOString().slice(0, 10)} -> ${range.to.toISOString().slice(0, 10)}`;
    const label  = periodLabel ?? period;
    const none   = computeTrend(null, null);

    return [
      this._buildKmPerVehicle(input, null, period, label, none, opts),
      this._buildUsageHours(input, null, period, label, none, opts),
      this._buildFleetUtilization(input, null, period, label, none, opts),
    ];
  }

  // ── Builders ─────────────────────────────────────────────────────────────

  private _buildKmPerVehicle(
    cur:            FleetKPIInput,
    prv:            FleetKPIInput | null,
    period:         string,
    periodLabel?:   string,
    trendOverride?: ReturnType<typeof computeTrend>,
    opts?:          UtilizationKPIOptions,
  ): StandardKPIOutput {
    const calcInput = {
      vehicles:    cur.vehicles,
      fuelLoads:   cur.fuelLoads,
      range:       cur.range,
      vehicleType: opts?.vehicleType,
      vehicleIds:  opts?.vehicleIds,
    };

    const result = calculateKmPerVehicle(calcInput).value as KmPerVehicleResult;
    const curVal = result.fleetTotalKm;

    let trend = trendOverride ?? computeTrend(null, null);
    if (!trendOverride && prv) {
      const p = calculateKmPerVehicle({
        vehicles:    prv.vehicles,
        fuelLoads:   prv.fuelLoads,
        range:       prv.range,
        vehicleType: opts?.vehicleType,
        vehicleIds:  opts?.vehicleIds,
      }).value as KmPerVehicleResult;
      trend = computeTrend(curVal, p.fleetTotalKm, false);
    }

    const noData = result.perVehicle.every(r => r.method === 'no_data');
    const status: KPIStatus = noData ? 'no_data' : curVal === 0 ? 'no_data' : 'ok';

    return buildKPIOutput({
      name:          'km_per_vehicle',
      label:         'Km recorridos por vehículo',
      description:   'Kilómetros recorridos por cada vehículo derivados de la diferencia de odómetro o estimados por consumo',
      formula:       'MAX(odómetro) - MIN(odómetro) en período, o Σ(kmPerUnit × litros)',
      value:         curVal,
      formatted:     `${curVal.toLocaleString('es-CL')} km`,
      unit:          'km',
      trend,
      period,
      periodLabel:   periodLabel ?? formatPeriodLabel(period),
      previousValue: prv
        ? (calculateKmPerVehicle({
            vehicles:    prv.vehicles,
            fuelLoads:   prv.fuelLoads,
            range:       prv.range,
            vehicleType: opts?.vehicleType,
            vehicleIds:  opts?.vehicleIds,
          }).value as KmPerVehicleResult).fleetTotalKm
        : null,
      status,
      detail: {
        avgKmPerVehicle: result.avgKmPerVehicle,
        perVehicle:      result.perVehicle,
      },
    });
  }

  private _buildUsageHours(
    cur:            FleetKPIInput,
    prv:            FleetKPIInput | null,
    period:         string,
    periodLabel?:   string,
    trendOverride?: ReturnType<typeof computeTrend>,
    opts?:          UtilizationKPIOptions,
  ): StandardKPIOutput {
    const calcInput = {
      vehicles:          cur.vehicles,
      fuelLoads:         cur.fuelLoads,
      maintenances:      cur.maintenances,
      range:             cur.range,
      hoursPerActiveDay: opts?.hoursPerActiveDay,
      vehicleType:       opts?.vehicleType,
      vehicleIds:        opts?.vehicleIds,
    };

    const result = calculateUsageHours(calcInput).value as UsageHoursResult;
    const curVal = result.totalEstimatedHours;

    let trend = trendOverride ?? computeTrend(null, null);
    if (!trendOverride && prv) {
      const p = calculateUsageHours({
        vehicles:          prv.vehicles,
        fuelLoads:         prv.fuelLoads,
        maintenances:      prv.maintenances,
        range:             prv.range,
        hoursPerActiveDay: opts?.hoursPerActiveDay,
        vehicleType:       opts?.vehicleType,
        vehicleIds:        opts?.vehicleIds,
      }).value as UsageHoursResult;
      trend = computeTrend(curVal, p.totalEstimatedHours, false);
    }

    const status: KPIStatus = curVal === 0 ? 'no_data' : 'ok';
    const formatted = `${Math.round(curVal).toLocaleString('es-CL')} hrs (est.)`;

    return buildKPIOutput({
      name:          'usage_hours',
      label:         'Horas de uso por vehículo',
      description:   `Horas estimadas de operación por vehículo (días con actividad × ${result.hoursPerActiveDay} h/día)`,
      formula:       'días_con_actividad × horasConfiguradas',
      value:         curVal,
      formatted,
      unit:          'horas',
      trend,
      period,
      periodLabel:   periodLabel ?? formatPeriodLabel(period),
      previousValue: prv
        ? (calculateUsageHours({
            vehicles:          prv.vehicles,
            fuelLoads:         prv.fuelLoads,
            maintenances:      prv.maintenances,
            range:             prv.range,
            hoursPerActiveDay: opts?.hoursPerActiveDay,
            vehicleType:       opts?.vehicleType,
            vehicleIds:        opts?.vehicleIds,
          }).value as UsageHoursResult).totalEstimatedHours
        : null,
      status,
      detail: {
        periodDays:        result.periodDays,
        hoursPerActiveDay: result.hoursPerActiveDay,
        avgHoursPerVehicle: result.avgHoursPerVehicle,
        perVehicle:        result.perVehicle,
      },
    });
  }

  private _buildFleetUtilization(
    cur:            FleetKPIInput,
    prv:            FleetKPIInput | null,
    period:         string,
    periodLabel?:   string,
    trendOverride?: ReturnType<typeof computeTrend>,
    opts?:          UtilizationKPIOptions,
  ): StandardKPIOutput {
    const calcInput = {
      vehicles:     cur.vehicles,
      fuelLoads:    cur.fuelLoads,
      maintenances: cur.maintenances,
      range:        cur.range,
      vehicleType:  opts?.vehicleType,
      vehicleIds:   opts?.vehicleIds,
    };

    const result = calculateFleetUtilization(calcInput).value as FleetUtilizationResult;
    const curVal = result.utilizationPct;

    let trend = trendOverride ?? computeTrend(null, null);
    if (!trendOverride && prv) {
      const p = calculateFleetUtilization({
        vehicles:     prv.vehicles,
        fuelLoads:    prv.fuelLoads,
        maintenances: prv.maintenances,
        range:        prv.range,
        vehicleType:  opts?.vehicleType,
        vehicleIds:   opts?.vehicleIds,
      }).value as FleetUtilizationResult;
      trend = computeTrend(curVal, p.utilizationPct, false);
    }

    const status: KPIStatus =
      result.total === 0       ? 'no_data'  :
      curVal < 50              ? 'critical' :
      result.operationalPct < 60 ? 'warning' : 'ok';

    return buildKPIOutput({
      name:          'fleet_utilization',
      label:         'Utilización de flota',
      description:   'Vehículos activos / total (estructural) y vehículos con actividad en período / activos (operacional)',
      formula:       'activos / total × 100  |  operacionales / activos × 100',
      value:         curVal,
      formatted:     `${curVal.toFixed(1)}% activos · ${result.operationalPct.toFixed(1)}% operacionales`,
      unit:          '%',
      trend,
      period,
      periodLabel:   periodLabel ?? formatPeriodLabel(period),
      previousValue: prv
        ? (calculateFleetUtilization({
            vehicles:     prv.vehicles,
            fuelLoads:    prv.fuelLoads,
            maintenances: prv.maintenances,
            range:        prv.range,
            vehicleType:  opts?.vehicleType,
            vehicleIds:   opts?.vehicleIds,
          }).value as FleetUtilizationResult).utilizationPct
        : null,
      status,
      detail: {
        total:          result.total,
        active:         result.active,
        inactive:       result.inactive,
        operational:    result.operational,
        operationalPct: result.operationalPct,
        perVehicle:     result.perVehicle,
      },
    });
  }
}

export const utilizationKPIService = new UtilizationKPIService();
export { UtilizationKPIService };
