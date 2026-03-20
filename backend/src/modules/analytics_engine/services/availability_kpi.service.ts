/**
 * analytics_engine/services/availability_kpi.service.ts
 *
 * Availability KPI Service
 *
 * Wraps availability_kpi_calculator.ts with cache, trend, and StandardKPIOutput.
 *
 * Exposes 2 StandardKPIOutput objects:
 *
 *   1. fleet_availability  — vehículos operativos / total (%)
 *   2. vehicle_downtime    — downtime por vehículo en el período (horas / disponibilidad %)
 *
 * Filters (passed through to both calculators):
 *   vehicleType  — filtra por tipo de vehículo ("camión", "auto", etc.)
 *   vehicleIds   — lista de vehicleId específicos
 *
 * Caching:
 *   Filters are encoded in the cache key so filtered results are cached independently.
 *   Unfiltered monthly results share the standard `fleet_kpi_input` bundle.
 *
 * Trend:
 *   Fleet availability %: higher is better, invertPositive = false
 *   Vehicle downtime total hours: lower is better, invertPositive = true
 */

import { fetchFleetKPIInput }                   from '../data_adapters/prisma.adapter';
import {
  calculateFleetAvailabilityDetailed,
  calculateVehicleDowntime,
  type FleetAvailabilityResult,
  type VehicleDowntimeResult,
} from '../kpi_calculators/availability_kpi_calculator';
import { kpiCache }                             from '../utils/kpi_cache';
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

export interface AvailabilityKPIOptions {
  /** Filter by vehicleType string (case-insensitive exact match) */
  vehicleType?: string;
  /** Filter by specific vehicleId list */
  vehicleIds?: string[];
}

// ─── Cache TTL ────────────────────────────────────────────────────────────────

const DATA_TTL   = 300_000;   // 5 min for raw input bundle
const RESULT_TTL = 300_000;   // 5 min for compiled KPI output

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function loadInput(companyId: string, month: string): Promise<FleetKPIInput> {
  const key = `fleet_kpi_input:${companyId}:${month}`;
  return kpiCache.getOrSet(
    key,
    () => fetchFleetKPIInput(companyId, monthToDateRange(month)),
    DATA_TTL,
  );
}

function filterKey(opts?: AvailabilityKPIOptions): string {
  if (!opts) return '*';
  const t  = opts.vehicleType ?? '*';
  const vs = opts.vehicleIds?.length ? [...opts.vehicleIds].sort().join(',') : '*';
  return `${t}::${vs}`;
}

// ─── AvailabilityKPIService ───────────────────────────────────────────────────

class AvailabilityKPIService {

  // ── All KPIs for a calendar month ─────────────────────────────────────────

  async getAll(
    companyId: string,
    month     = currentMonth(),
    opts?:    AvailabilityKPIOptions,
  ): Promise<StandardKPIOutput[]> {
    const resultKey = `avail_kpis:${companyId}:${month}:${filterKey(opts)}`;

    return kpiCache.getOrSet(
      resultKey,
      async () => {
        const prv = prevMonth(month);
        const [cur, prev] = await Promise.all([
          loadInput(companyId, month),
          loadInput(companyId, prv),
        ]);

        return [
          this._buildFleetAvailability(cur, prev, month, undefined, undefined, opts),
          this._buildVehicleDowntime(cur, prev, month, undefined, undefined, opts),
        ];
      },
      RESULT_TTL,
    );
  }

  // ── Individual getters ────────────────────────────────────────────────────

  async getFleetAvailability(
    companyId: string,
    month     = currentMonth(),
    opts?:    AvailabilityKPIOptions,
  ): Promise<StandardKPIOutput> {
    return (await this.getAll(companyId, month, opts)).find(k => k.name === 'fleet_availability')!;
  }

  async getVehicleDowntime(
    companyId: string,
    month     = currentMonth(),
    opts?:    AvailabilityKPIOptions,
  ): Promise<StandardKPIOutput> {
    return (await this.getAll(companyId, month, opts)).find(k => k.name === 'vehicle_downtime')!;
  }

  // ── Arbitrary date range (not cached) ────────────────────────────────────

  async getAllForRange(
    companyId:    string,
    range:        DateRange,
    periodLabel?: string,
    opts?:        AvailabilityKPIOptions,
  ): Promise<StandardKPIOutput[]> {
    const input  = await fetchFleetKPIInput(companyId, range);
    const period = `${range.from.toISOString().slice(0, 10)} -> ${range.to.toISOString().slice(0, 10)}`;
    const label  = periodLabel ?? period;
    const none   = computeTrend(null, null);

    return [
      this._buildFleetAvailability(input, null, period, label, none, opts),
      this._buildVehicleDowntime(input, null, period, label, none, opts),
    ];
  }

  // ── Builders ─────────────────────────────────────────────────────────────

  private _buildFleetAvailability(
    cur:            FleetKPIInput,
    prv:            FleetKPIInput | null,
    period:         string,
    periodLabel?:   string,
    trendOverride?: ReturnType<typeof computeTrend>,
    opts?:          AvailabilityKPIOptions,
  ): StandardKPIOutput {
    const calcInput = {
      vehicles:     cur.vehicles,
      maintenances: cur.maintenances,
      range:        cur.range,
      vehicleType:  opts?.vehicleType,
      vehicleIds:   opts?.vehicleIds,
    };

    const result = calculateFleetAvailabilityDetailed(calcInput).value as FleetAvailabilityResult;
    const curVal = result.availabilityPct;

    let trend = trendOverride ?? computeTrend(null, null);
    if (!trendOverride && prv) {
      const p = calculateFleetAvailabilityDetailed({
        vehicles:     prv.vehicles,
        maintenances: prv.maintenances,
        range:        prv.range,
        vehicleType:  opts?.vehicleType,
        vehicleIds:   opts?.vehicleIds,
      }).value as FleetAvailabilityResult;
      // Higher availability is BETTER
      trend = computeTrend(curVal, p.availabilityPct, false);
    }

    const status: KPIStatus =
      curVal < 50 ? 'critical' :
      curVal < 80 ? 'warning'  : 'ok';

    return buildKPIOutput({
      name:          'fleet_availability',
      label:         'Disponibilidad de flota',
      description:   'Porcentaje de vehículos operativos sobre el total (excluye inactivos y en taller)',
      formula:       'operativos / total × 100',
      value:         curVal,
      formatted:     `${curVal.toFixed(1)}%`,
      unit:          '%',
      trend,
      period,
      periodLabel:   periodLabel ?? formatPeriodLabel(period),
      previousValue: prv
        ? (calculateFleetAvailabilityDetailed({
            vehicles:     prv.vehicles,
            maintenances: prv.maintenances,
            range:        prv.range,
            vehicleType:  opts?.vehicleType,
            vehicleIds:   opts?.vehicleIds,
          }).value as FleetAvailabilityResult).availabilityPct
        : null,
      status,
      detail: {
        total:      result.total,
        operative:  result.operative,
        inWorkshop: result.inWorkshop,
        inactive:   result.inactive,
        perVehicle: result.perVehicle,
      },
    });
  }

  private _buildVehicleDowntime(
    cur:            FleetKPIInput,
    prv:            FleetKPIInput | null,
    period:         string,
    periodLabel?:   string,
    trendOverride?: ReturnType<typeof computeTrend>,
    opts?:          AvailabilityKPIOptions,
  ): StandardKPIOutput {
    const calcInput = {
      vehicles:     cur.vehicles,
      maintenances: cur.maintenances,
      range:        cur.range,
      vehicleType:  opts?.vehicleType,
      vehicleIds:   opts?.vehicleIds,
    };

    const result = calculateVehicleDowntime(calcInput).value as VehicleDowntimeResult;
    const curVal = result.totalDowntimeHours;

    let trend = trendOverride ?? computeTrend(null, null);
    if (!trendOverride && prv) {
      const p = calculateVehicleDowntime({
        vehicles:     prv.vehicles,
        maintenances: prv.maintenances,
        range:        prv.range,
        vehicleType:  opts?.vehicleType,
        vehicleIds:   opts?.vehicleIds,
      }).value as VehicleDowntimeResult;
      // More downtime is WORSE → invertPositive = true
      trend = computeTrend(curVal, p.totalDowntimeHours, true);
    }

    const status: KPIStatus =
      result.fleetAvgAvailabilityPct < 50 ? 'critical' :
      result.fleetAvgAvailabilityPct < 80 ? 'warning'  :
      curVal > 0                           ? 'warning'  : 'ok';

    const formattedHours = curVal === 0
      ? '0 hrs fuera de servicio'
      : `${curVal.toFixed(1)} hrs fuera de servicio`;

    return buildKPIOutput({
      name:          'vehicle_downtime',
      label:         'Downtime de vehículos',
      description:   'Horas fuera de servicio por vehículo en el período, derivadas de estancias en taller',
      formula:       'Σ overlap(entryDate..exitDate, range) por vehículo',
      value:         curVal,
      formatted:     formattedHours,
      unit:          'horas',
      trend,
      period,
      periodLabel:   periodLabel ?? formatPeriodLabel(period),
      previousValue: prv
        ? (calculateVehicleDowntime({
            vehicles:     prv.vehicles,
            maintenances: prv.maintenances,
            range:        prv.range,
            vehicleType:  opts?.vehicleType,
            vehicleIds:   opts?.vehicleIds,
          }).value as VehicleDowntimeResult).totalDowntimeHours
        : null,
      status,
      detail: {
        totalPeriodHours:        result.totalPeriodHours,
        fleetAvgAvailabilityPct: result.fleetAvgAvailabilityPct,
        perVehicle:              result.perVehicle,
      },
    });
  }
}

export const availabilityKPIService = new AvailabilityKPIService();
export { AvailabilityKPIService };
