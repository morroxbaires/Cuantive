/**
 * analytics_engine/services/fuel_kpi.service.ts
 *
 * Fuel KPI Service
 *
 * Exposes 5 StandardKPIOutput objects — one per required KPI:
 *
 *   1. avg_consumption     — km/L (per vehicle + fleet)
 *   2. fuel_deviation      — real vs expected (%)
 *   3. fuel_loaded         — litros totales cargados
 *   4. fuel_loss           — pérdida estimada / posible fraude
 *   5. (bonus) fuel_cost   — CLP total combustible (re-uses FleetCostKPIService scalar)
 *
 * Strategy:
 *   - Single fetchFleetKPIInput() per (companyId, month) — shared TTL cache
 *   - Pure calculators receive plain DTOs
 *   - Trend computed comparing current month vs previous month
 *   - Results cached separately at the compiled StandardKPIOutput level
 *
 * All methods can also be called with explicit DateRange for arbitrary periods
 * (not just calendar months) via the getRangeAll() overload.
 */

import { fetchFleetKPIInput }          from '../data_adapters/prisma.adapter';
import {
  calculateAverageConsumption,
  calculateFuelDeviation,
  calculateFuelLoaded,
  calculateFuelLoss,
  type AverageConsumptionResult,
  type FuelDeviationResult,
  type FuelLoadedResult,
  type FuelLossResult,
} from '../kpi_calculators/fuel_kpis';
import { kpiCache }                    from '../utils/kpi_cache';
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

// ─── Cache TTL ────────────────────────────────────────────────────────────────

const DATA_TTL   = 300_000;   // 5 min for raw input bundle
const RESULT_TTL = 300_000;   // 5 min for compiled KPI output

// ─── Shared data loader (de-duplicates DB calls) ─────────────────────────────

async function loadInput(companyId: string, month: string): Promise<FleetKPIInput> {
  const key = `fleet_kpi_input:${companyId}:${month}`;
  return kpiCache.getOrSet(
    key,
    () => fetchFleetKPIInput(companyId, monthToDateRange(month)),
    DATA_TTL,
  );
}

// ─── Service class ────────────────────────────────────────────────────────────

class FuelKPIService {

  /**
   * Return all 4 fuel KPIs for the given calendar month.
   * Fetches current + previous month in 2 parallel queries (cached).
   *
   * @param companyId  Tenant ID
   * @param month      'YYYY-MM' — defaults to current month
   */
  async getAll(
    companyId: string,
    month = currentMonth(),
  ): Promise<StandardKPIOutput[]> {
    const resultKey = `fuel_kpis:${companyId}:${month}`;

    return kpiCache.getOrSet(
      resultKey,
      async () => {
        const prev = prevMonth(month);
        const [cur, prv] = await Promise.all([
          loadInput(companyId, month),
          loadInput(companyId, prev),
        ]);

        return [
          this._buildAvgConsumption(cur, prv, month),
          this._buildFuelDeviation(cur, prv, month),
          this._buildFuelLoaded(cur, prv, month),
          this._buildFuelLoss(cur, prv, month),
        ];
      },
      RESULT_TTL,
    );
  }

  // ── Individual KPI getters ────────────────────────────────────────────────

  async getAvgConsumption(companyId: string, month = currentMonth()): Promise<StandardKPIOutput> {
    return (await this.getAll(companyId, month)).find(k => k.name === 'avg_consumption')!;
  }

  async getFuelDeviation(companyId: string, month = currentMonth()): Promise<StandardKPIOutput> {
    return (await this.getAll(companyId, month)).find(k => k.name === 'fuel_deviation')!;
  }

  async getFuelLoaded(companyId: string, month = currentMonth()): Promise<StandardKPIOutput> {
    return (await this.getAll(companyId, month)).find(k => k.name === 'fuel_loaded')!;
  }

  async getFuelLoss(companyId: string, month = currentMonth()): Promise<StandardKPIOutput> {
    return (await this.getAll(companyId, month)).find(k => k.name === 'fuel_loss')!;
  }

  /**
   * Execute all fuel KPIs over an arbitrary date range (not tied to a calendar month).
   * Results are NOT cached when using a custom range.
   *
   * @param companyId  Tenant ID
   * @param range      { from: Date, to: Date }
   * @param periodLabel  Human-readable description (e.g. 'Q1 2026')
   */
  async getAllForRange(
    companyId: string,
    range: DateRange,
    periodLabel?: string,
  ): Promise<StandardKPIOutput[]> {
    const input  = await fetchFleetKPIInput(companyId, range);
    const period = `${range.from.toISOString().slice(0, 10)} → ${range.to.toISOString().slice(0, 10)}`;
    const label  = periodLabel ?? period;

    const none = computeTrend(null, null);

    return [
      this._buildAvgConsumption(input, null, period, label, none),
      this._buildFuelDeviation(input, null, period, label, none),
      this._buildFuelLoaded(input, null, period, label, none),
      this._buildFuelLoss(input, null, period, label, none),
    ];
  }

  // ── Builders (pure after receiving DTOs) ──────────────────────────────────

  private _buildAvgConsumption(
    cur: FleetKPIInput,
    prv: FleetKPIInput | null,
    period: string,
    periodLabel?: string,
    trendOverride?: ReturnType<typeof computeTrend>,
  ): StandardKPIOutput {
    const settings = cur.settings;
    const result = calculateAverageConsumption({
      vehicles:  cur.vehicles,
      fuelLoads: cur.fuelLoads,
    }).value as AverageConsumptionResult;

    const curVal = result.fleetKmPerLiter;

    let trend = trendOverride ?? computeTrend(null, null);
    if (!trendOverride && prv) {
      const prvResult = calculateAverageConsumption({
        vehicles:  prv.vehicles,
        fuelLoads: prv.fuelLoads,
      }).value as AverageConsumptionResult;
      // Higher km/L is BETTER → positive trend is good (invertPositive = false)
      trend = computeTrend(curVal, prvResult.fleetKmPerLiter, false);
    }

    const status: KPIStatus = curVal === null ? 'no_data' : 'ok';

    return buildKPIOutput({
      name:         'avg_consumption',
      label:        'Consumo promedio',
      description:  'Rendimiento promedio ponderado por volumen en km/L y litros/100km',
      formula:      'Σ(km_per_unit × litros) / Σ(litros) — por vehículo y flota',
      value:        curVal,
      formatted:    curVal !== null ? `${curVal.toFixed(2)} km/L` : null,
      unit:         'km/L',
      trend,
      period,
      periodLabel:  periodLabel ?? formatPeriodLabel(period),
      status,
      detail: {
        fleetKmPerLiter:  result.fleetKmPerLiter,
        fleetL100km:      result.fleetL100km,
        perVehicle:       result.perVehicle,
        anomalyThresholdPct: settings.alertFuelExcessPct,
      },
    });
  }

  private _buildFuelDeviation(
    cur: FleetKPIInput,
    prv: FleetKPIInput | null,
    period: string,
    periodLabel?: string,
    trendOverride?: ReturnType<typeof computeTrend>,
  ): StandardKPIOutput {
    const settings = cur.settings;
    const result = calculateFuelDeviation({
      vehicles:            cur.vehicles,
      fuelLoads:           cur.fuelLoads,
      anomalyThresholdPct: settings.alertFuelExcessPct,
    }).value as FuelDeviationResult;

    const curVal = result.fleetDeviationPct;

    let trend = trendOverride ?? computeTrend(null, null);
    if (!trendOverride && prv) {
      const prvResult = calculateFuelDeviation({
        vehicles:            prv.vehicles,
        fuelLoads:           prv.fuelLoads,
        anomalyThresholdPct: settings.alertFuelExcessPct,
      }).value as FuelDeviationResult;
      // Less negative deviation is BETTER
      trend = computeTrend(curVal, prvResult.fleetDeviationPct, false);
    }

    const status: KPIStatus =
      curVal === null                              ? 'no_data'  :
      curVal < -(settings.alertFuelExcessPct * 1.5) ? 'critical' :
      curVal < -settings.alertFuelExcessPct        ? 'warning'  : 'ok';

    return buildKPIOutput({
      name:         'fuel_deviation',
      label:        'Desviación de consumo',
      description:  'Diferencia porcentual entre consumo real y la referencia configurada por vehículo',
      formula:      '(km/L_real − km/L_referencia) / km/L_referencia × 100',
      value:        curVal,
      formatted:    curVal !== null
        ? `${curVal > 0 ? '+' : ''}${curVal.toFixed(1)}%`
        : null,
      unit:         '%',
      trend,
      period,
      periodLabel:  periodLabel ?? formatPeriodLabel(period),
      status,
      detail: {
        anomalyCount:        result.anomalyCount,
        totalLitersDiff:     result.totalLitersDiff,
        anomalyThresholdPct: settings.alertFuelExcessPct,
        perVehicle:          result.perVehicle,
      },
    });
  }

  private _buildFuelLoaded(
    cur: FleetKPIInput,
    prv: FleetKPIInput | null,
    period: string,
    periodLabel?: string,
    trendOverride?: ReturnType<typeof computeTrend>,
  ): StandardKPIOutput {
    const result = calculateFuelLoaded({
      vehicles:  cur.vehicles,
      fuelLoads: cur.fuelLoads,
    }).value as FuelLoadedResult;

    const curVal = result.totalLiters;

    let trend = trendOverride ?? computeTrend(null, null);
    if (!trendOverride && prv) {
      const prvResult = calculateFuelLoaded({
        vehicles:  prv.vehicles,
        fuelLoads: prv.fuelLoads,
      }).value as FuelLoadedResult;
      // More liters = more cost → treat increase as warning-neutral (invertPositive=false)
      trend = computeTrend(curVal, prvResult.totalLiters, false);
    }

    const status: KPIStatus = curVal > 0 ? 'ok' : 'no_data';

    return buildKPIOutput({
      name:         'fuel_loaded',
      label:        'Combustible cargado',
      description:  'Total de litros/kWh registrados en cargas de combustible en el período',
      formula:      'Σ fuel_loads.liters_or_kwh',
      value:        curVal,
      formatted:    `${curVal.toLocaleString('es-CL', { maximumFractionDigits: 0 })} L`,
      unit:         'Litros',
      trend,
      period,
      periodLabel:  periodLabel ?? formatPeriodLabel(period),
      status,
      detail: {
        totalCost:   result.totalCost,
        loadCount:   result.loadCount,
        perVehicle:  result.perVehicle,
        byMonth:     result.byMonth,
      },
    });
  }

  private _buildFuelLoss(
    cur: FleetKPIInput,
    prv: FleetKPIInput | null,
    period: string,
    periodLabel?: string,
    trendOverride?: ReturnType<typeof computeTrend>,
  ): StandardKPIOutput {
    // Default threshold: use Settings.alertFuelExcessPct as proxy
    const lossThresholdPct = cur.settings.alertFuelExcessPct;

    const result = calculateFuelLoss({
      vehicles:          cur.vehicles,
      fuelLoads:         cur.fuelLoads,
      lossThresholdPct,
    }).value as FuelLossResult;

    const curVal = result.fleetLossPct;

    let trend = trendOverride ?? computeTrend(null, null);
    if (!trendOverride && prv) {
      const prvResult = calculateFuelLoss({
        vehicles:          prv.vehicles,
        fuelLoads:         prv.fuelLoads,
        lossThresholdPct,
      }).value as FuelLossResult;
      // Higher loss% is WORSE → increasing trend is bad (invertPositive = true)
      trend = computeTrend(curVal, prvResult.fleetLossPct, true);
    }

    const suspicious = result.suspiciousVehicles;
    const status: KPIStatus =
      suspicious.some(r => r.fraudRisk === 'high' || r.fraudRisk === 'medium') ? 'critical' :
      suspicious.length > 0                                                     ? 'warning'  :
      curVal === null                                                            ? 'no_data'  : 'ok';

    return buildKPIOutput({
      name:         'fuel_loss',
      label:        'Pérdida estimada de combustible',
      description:  'Diferencia entre litros cargados y litros esperados según km recorridos. Valores altos pueden indicar fraude.',
      formula:      '(litros_cargados − km_recorridos / referencia_km_L) / litros_esperados × 100',
      value:        curVal,
      formatted:    curVal !== null
        ? `${curVal > 0 ? '+' : ''}${curVal.toFixed(1)}%`
        : null,
      unit:         '%',
      trend,
      period,
      periodLabel:  periodLabel ?? formatPeriodLabel(period),
      status,
      detail: {
        totalExcessLiters:  result.totalExcessLiters,
        suspiciousCount:    suspicious.length,
        suspiciousVehicles: suspicious,
        perVehicle:         result.perVehicle,
        lossThresholdPct,
      },
    });
  }

  // ── Cache management ───────────────────────────────────────────────────────

  /** Invalidate all cached fuel KPIs for a company (call after fuel_loads mutation). */
  invalidateCache(companyId: string): void {
    kpiCache.invalidateCompany(companyId);
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const fuelKPIService = new FuelKPIService();
export { FuelKPIService };
