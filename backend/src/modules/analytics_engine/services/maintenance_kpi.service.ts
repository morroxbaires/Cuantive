/**
 * analytics_engine/services/maintenance_kpi.service.ts
 *
 * Maintenance KPI Service
 *
 * Exposes 5 StandardKPIOutput objects:
 *
 *   1. services_done           mantenimientos completados en el período
 *   2. pending_maintenance     mantenimientos pendientes / vencidos
 *   3. mtbf                    tiempo medio entre fallas (días)
 *   4. cost_per_vehicle        costo de mantenimiento por vehículo
 *   5. vehicles_in_workshop    vehículos actualmente en taller
 *
 * Strategy:
 *   - Single fetchFleetKPIInput() per (companyId, month)  shared TTL cache key
 *   - Pure calculators receive plain DTOs; value is the rich result object
 *   - Trend: current month vs previous month
 *   - Results cached at StandardKPIOutput[] level
 */

import { fetchFleetKPIInput }                 from '../data_adapters/prisma.adapter';
import {
  calculateServicesDone,
  calculatePendingMaintenance,
  calculateMTBF,
  calculateMaintenanceCostPerVehicle,
  calculateVehiclesInWorkshop,
  type ServicesDoneResult,
  type PendingMaintenanceResult,
  type MTBFResult,
  type CostPerVehicleResult,
  type VehiclesInWorkshopResult,
} from '../kpi_calculators/maintenance_kpis';
import { kpiCache }                           from '../utils/kpi_cache';
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

//  Cache TTL 

const DATA_TTL   = 300_000;   // 5 min for raw input bundle
const RESULT_TTL = 300_000;   // 5 min for compiled KPI output

//  Shared data loader 

async function loadInput(companyId: string, month: string): Promise<FleetKPIInput> {
  const key = `fleet_kpi_input:${companyId}:${month}`;
  return kpiCache.getOrSet(
    key,
    () => fetchFleetKPIInput(companyId, monthToDateRange(month)),
    DATA_TTL,
  );
}

//  MaintenanceKPIService 

class MaintenanceKPIService {

  //  All 5 KPIs for a calendar month 

  async getAll(companyId: string, month = currentMonth()): Promise<StandardKPIOutput[]> {
    const resultKey = `maint_kpis:${companyId}:${month}`;

    return kpiCache.getOrSet(
      resultKey,
      async () => {
        const prv = prevMonth(month);
        const [cur, prev] = await Promise.all([
          loadInput(companyId, month),
          loadInput(companyId, prv),
        ]);

        return [
          this._buildServicesDone(cur, prev, month),
          this._buildPendingMaintenance(cur, prev, month),
          this._buildMTBF(cur, prev, month),
          this._buildCostPerVehicle(cur, prev, month),
          this._buildVehiclesInWorkshop(cur, prev, month),
        ];
      },
      RESULT_TTL,
    );
  }

  //  Individual KPI getters 

  async getServicesDone(companyId: string, month = currentMonth()): Promise<StandardKPIOutput> {
    return (await this.getAll(companyId, month)).find(k => k.name === 'services_done')!;
  }

  async getPendingMaintenance(companyId: string, month = currentMonth()): Promise<StandardKPIOutput> {
    return (await this.getAll(companyId, month)).find(k => k.name === 'pending_maintenance')!;
  }

  async getMTBF(companyId: string, month = currentMonth()): Promise<StandardKPIOutput> {
    return (await this.getAll(companyId, month)).find(k => k.name === 'mtbf')!;
  }

  async getCostPerVehicle(companyId: string, month = currentMonth()): Promise<StandardKPIOutput> {
    return (await this.getAll(companyId, month)).find(k => k.name === 'maintenance_cost_per_vehicle')!;
  }

  async getVehiclesInWorkshop(companyId: string, month = currentMonth()): Promise<StandardKPIOutput> {
    return (await this.getAll(companyId, month)).find(k => k.name === 'vehicles_in_workshop')!;
  }

  async getAllForRange(
    companyId:    string,
    range:        DateRange,
    periodLabel?: string,
  ): Promise<StandardKPIOutput[]> {
    const input  = await fetchFleetKPIInput(companyId, range);
    const period = `${range.from.toISOString().slice(0, 10)} -> ${range.to.toISOString().slice(0, 10)}`;
    const label  = periodLabel ?? period;
    const none   = computeTrend(null, null);

    return [
      this._buildServicesDone(input, null, period, label, none),
      this._buildPendingMaintenance(input, null, period, label, none),
      this._buildMTBF(input, null, period, label, none),
      this._buildCostPerVehicle(input, null, period, label, none),
      this._buildVehiclesInWorkshop(input, null, period, label, none),
    ];
  }

  //  Builders 

  private _buildServicesDone(
    cur:            FleetKPIInput,
    prv:            FleetKPIInput | null,
    period:         string,
    periodLabel?:   string,
    trendOverride?: ReturnType<typeof computeTrend>,
  ): StandardKPIOutput {
    const result = calculateServicesDone({ maintenances: cur.maintenances }).value as ServicesDoneResult;
    const curVal = result.count;

    let trend = trendOverride ?? computeTrend(null, null);
    if (!trendOverride && prv) {
      const p = calculateServicesDone({ maintenances: prv.maintenances }).value as ServicesDoneResult;
      trend = computeTrend(curVal, p.count, false);
    }

    return buildKPIOutput({
      name:          'services_done',
      label:         'Servicios completados',
      description:   'Cantidad de mantenimientos con estado completado en el periodo',
      formula:       'COUNT(maintenances WHERE status LIKE "complet%")',
      value:         curVal,
      formatted:     String(curVal),
      unit:          'servicios',
      trend,
      period,
      periodLabel:   periodLabel ?? formatPeriodLabel(period),
      previousValue: prv ? (calculateServicesDone({ maintenances: prv.maintenances }).value as ServicesDoneResult).count : null,
      status:        curVal === 0 ? 'no_data' : 'ok',
      detail:        { byType: result.byType, byStatus: result.byStatus, byVehicle: result.byVehicle },
    });
  }

  private _buildPendingMaintenance(
    cur:            FleetKPIInput,
    prv:            FleetKPIInput | null,
    period:         string,
    periodLabel?:   string,
    trendOverride?: ReturnType<typeof computeTrend>,
  ): StandardKPIOutput {
    const result = calculatePendingMaintenance({ maintenances: cur.maintenances, vehicles: cur.vehicles }).value as PendingMaintenanceResult;
    const curVal = result.count;

    let trend = trendOverride ?? computeTrend(null, null);
    if (!trendOverride && prv) {
      const p = calculatePendingMaintenance({ maintenances: prv.maintenances, vehicles: prv.vehicles }).value as PendingMaintenanceResult;
      trend = computeTrend(curVal, p.count, true);
    }

    const status: KPIStatus = result.overdueCount > 0 ? 'critical' : curVal > 0 ? 'warning' : 'ok';

    return buildKPIOutput({
      name:          'pending_maintenance',
      label:         'Mantenimientos pendientes',
      description:   'Mantenimientos en estado pendiente o vencidos en el periodo',
      formula:       'COUNT(maintenances WHERE status LIKE "pendiente%" OR "programad%")',
      value:         curVal,
      formatted:     String(curVal),
      unit:          'pendientes',
      trend,
      period,
      periodLabel:   periodLabel ?? formatPeriodLabel(period),
      previousValue: prv ? (calculatePendingMaintenance({ maintenances: prv.maintenances, vehicles: prv.vehicles }).value as PendingMaintenanceResult).count : null,
      status,
      detail:        { overdueCount: result.overdueCount, perVehicle: result.perVehicle },
    });
  }

  private _buildMTBF(
    cur:            FleetKPIInput,
    prv:            FleetKPIInput | null,
    period:         string,
    periodLabel?:   string,
    trendOverride?: ReturnType<typeof computeTrend>,
  ): StandardKPIOutput {
    const result = calculateMTBF({ maintenances: cur.maintenances, vehicles: cur.vehicles }).value as MTBFResult;
    const curVal = result.fleetAvgMtbfDays;

    let trend = trendOverride ?? computeTrend(null, null);
    if (!trendOverride && prv) {
      const p = calculateMTBF({ maintenances: prv.maintenances, vehicles: prv.vehicles }).value as MTBFResult;
      trend = computeTrend(curVal, p.fleetAvgMtbfDays, false);
    }

    const status: KPIStatus =
      curVal === null ? 'no_data' : curVal < 7 ? 'critical' : curVal < 30 ? 'warning' : 'ok';

    return buildKPIOutput({
      name:          'mtbf',
      label:         'MTBF - Tiempo medio entre fallas',
      description:   'Promedio de dias entre eventos correctivos consecutivos por vehiculo',
      formula:       'AVG(gaps between consecutive corrective maintenances per vehicle)',
      value:         curVal,
      formatted:     curVal !== null ? `${curVal} dias` : 'Sin datos',
      unit:          'dias',
      trend,
      period,
      periodLabel:   periodLabel ?? formatPeriodLabel(period),
      previousValue: prv ? (calculateMTBF({ maintenances: prv.maintenances, vehicles: prv.vehicles }).value as MTBFResult).fleetAvgMtbfDays : null,
      status,
      detail:        { perVehicle: result.perVehicle },
    });
  }

  private _buildCostPerVehicle(
    cur:            FleetKPIInput,
    prv:            FleetKPIInput | null,
    period:         string,
    periodLabel?:   string,
    trendOverride?: ReturnType<typeof computeTrend>,
  ): StandardKPIOutput {
    const result = calculateMaintenanceCostPerVehicle({ maintenances: cur.maintenances, vehicles: cur.vehicles }).value as CostPerVehicleResult;
    const curVal = result.total;
    const formatted = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(curVal);

    let trend = trendOverride ?? computeTrend(null, null);
    if (!trendOverride && prv) {
      const p = calculateMaintenanceCostPerVehicle({ maintenances: prv.maintenances, vehicles: prv.vehicles }).value as CostPerVehicleResult;
      trend = computeTrend(curVal, p.total, true);
    }

    return buildKPIOutput({
      name:          'maintenance_cost_per_vehicle',
      label:         'Costo de mantenimiento por vehiculo',
      description:   'Desglose de costos de mantenimiento por vehiculo con participacion porcentual',
      formula:       'SUM(maintenance.cost) GROUP BY vehicleId',
      value:         curVal,
      formatted,
      unit:          'CLP',
      trend,
      period,
      periodLabel:   periodLabel ?? formatPeriodLabel(period),
      previousValue: prv ? (calculateMaintenanceCostPerVehicle({ maintenances: prv.maintenances, vehicles: prv.vehicles }).value as CostPerVehicleResult).total : null,
      status:        result.perVehicle.length === 0 ? 'no_data' : 'info',
      detail:        result.perVehicle,
    });
  }

  private _buildVehiclesInWorkshop(
    cur:            FleetKPIInput,
    prv:            FleetKPIInput | null,
    period:         string,
    periodLabel?:   string,
    trendOverride?: ReturnType<typeof computeTrend>,
  ): StandardKPIOutput {
    const result = calculateVehiclesInWorkshop({ maintenances: cur.maintenances, vehicles: cur.vehicles }).value as VehiclesInWorkshopResult;
    const curVal = result.count;

    let trend = trendOverride ?? computeTrend(null, null);
    if (!trendOverride && prv) {
      const p = calculateVehiclesInWorkshop({ maintenances: prv.maintenances, vehicles: prv.vehicles }).value as VehiclesInWorkshopResult;
      trend = computeTrend(curVal, p.count, true);
    }

    const status: KPIStatus = curVal === 0 ? 'ok' : curVal <= 3 ? 'warning' : 'critical';

    return buildKPIOutput({
      name:          'vehicles_in_workshop',
      label:         'Vehiculos en taller',
      description:   'Cantidad de vehiculos con estado "en taller" y dias transcurridos',
      formula:       'COUNT(vehicles WHERE latest maintenance.status LIKE "%taller%")',
      value:         curVal,
      formatted:     String(curVal),
      unit:          'vehiculos',
      trend,
      period,
      periodLabel:   periodLabel ?? formatPeriodLabel(period),
      previousValue: prv ? (calculateVehiclesInWorkshop({ maintenances: prv.maintenances, vehicles: prv.vehicles }).value as VehiclesInWorkshopResult).count : null,
      status,
      detail:        result.vehicles,
    });
  }
}

export const maintenanceKPIService = new MaintenanceKPIService();
export { MaintenanceKPIService };
