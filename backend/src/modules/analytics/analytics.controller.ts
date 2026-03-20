import { Request, Response, NextFunction } from 'express';
import { analyticsService } from './analytics.service';
import { sendSuccess } from '../../utils/response';
import { fleetCostKPIService }   from '../analytics_engine/services/fleet_cost_kpi.service';
import { fuelKPIService }        from '../analytics_engine/services/fuel_kpi.service';
import { maintenanceKPIService } from '../analytics_engine/services/maintenance_kpi.service';
import { availabilityKPIService } from '../analytics_engine/services/availability_kpi.service';
import { utilizationKPIService } from '../analytics_engine/services/utilization_kpi.service';
import { fetchFleetKPIInput }    from '../analytics_engine/data_adapters/prisma.adapter';
import { runSmartAlertEngine }   from '../analytics_engine/alert_engine/smart_alert.engine';
import { currentMonth, monthToDateRange } from '../analytics_engine/utils/trend.helper';

function extractRange(req: Request) {
  return {
    from:      typeof req.query.from      === 'string' ? req.query.from      : undefined,
    to:        typeof req.query.to        === 'string' ? req.query.to        : undefined,
    vehicleId: typeof req.query.vehicleId === 'string' ? req.query.vehicleId : undefined,
  };
}

export class AnalyticsController {

  /** GET /api/analytics/overview */
  async overview(req: Request, res: Response, next: NextFunction) {
    try {
      const r = extractRange(req);
      const data = await analyticsService.getOverview(req.tenantId, r, r.vehicleId);
      sendSuccess(res, data);
    } catch (e) { next(e); }
  }

  /** GET /api/analytics/consumption */
  async consumption(req: Request, res: Response, next: NextFunction) {
    try {
      const r = extractRange(req);
      const data = await analyticsService.getConsumptionAnalysis(req.tenantId, r, r.vehicleId);
      sendSuccess(res, data);
    } catch (e) { next(e); }
  }

  /** GET /api/analytics/overconsumption */
  async overconsumption(req: Request, res: Response, next: NextFunction) {
    try {
      const r = extractRange(req);
      const data = await analyticsService.getOverconsumptionVehicles(req.tenantId, r, r.vehicleId);
      sendSuccess(res, data);
    } catch (e) { next(e); }
  }

  /** GET /api/analytics/driver-anomalies */
  async driverAnomalies(req: Request, res: Response, next: NextFunction) {
    try {
      const r = extractRange(req);
      const data = await analyticsService.getDriverAnomalies(req.tenantId, r, r.vehicleId);
      sendSuccess(res, data);
    } catch (e) { next(e); }
  }

  /** GET /api/analytics/costs */
  async costs(req: Request, res: Response, next: NextFunction) {
    try {
      const r = extractRange(req);
      const data = await analyticsService.getCostsByVehicle(req.tenantId, r, r.vehicleId);
      sendSuccess(res, data);
    } catch (e) { next(e); }
  }

  /** GET /api/analytics/maintenance-prediction */
  async maintenancePrediction(req: Request, res: Response, next: NextFunction) {
    try {
      const r = extractRange(req);
      const data = await analyticsService.getMaintenancePrediction(req.tenantId, r.vehicleId);
      sendSuccess(res, data);
    } catch (e) { next(e); }
  }

  /** GET /api/analytics/fuel-trend?months=6 */
  async fuelTrend(req: Request, res: Response, next: NextFunction) {
    try {
      const months = parseInt(String(req.query.months ?? '6'), 10);
      const r = extractRange(req);
      const data   = await analyticsService.getFuelTrend(req.tenantId, isNaN(months) ? 6 : Math.min(months, 24), r.vehicleId);
      sendSuccess(res, data);
    } catch (e) { next(e); }
  }

  /** GET /api/analytics/irregular-loads */
  async irregularLoads(req: Request, res: Response, next: NextFunction) {
    try {
      const z     = parseFloat(String(req.query.z     ?? '1.5'));
      const limit = parseInt  (String(req.query.limit ?? '30'),  10);
      const r = extractRange(req);
      const data  = await analyticsService.getIrregularLoads(
        req.tenantId, r,
        isNaN(z) ? 1.5 : z,
        isNaN(limit) ? 30 : Math.min(limit, 100),
        r.vehicleId,
      );
      sendSuccess(res, data);
    } catch (e) { next(e); }
  }

  /** GET /api/analytics/dashboard — endpoint unificado para cargar todo en una petición */
  async dashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const r = extractRange(req);
      const data = await analyticsService.getFullDashboard(req.tenantId, r, r.vehicleId);
      sendSuccess(res, data);
    } catch (e) { next(e); }
  }

  /**
   * GET /api/analytics/monthly-expenses?month=YYYY-MM
   *
   * Calcula el gasto mensual completo de la flota:
   *   - total_fuel_cost          →  Σ fuel_loads.price_total del mes
   *   - total_maintenance_cost   →  Σ maintenance.cost del mes
   *   - total_cost               →  suma de ambos
   *   - avg_cost_per_km          →  costo total / km recorridos (estimado por odómetro)
   *   - vehicles_cost_breakdown  →  desglose por vehículo con fuel, maint, km, L, costo/km
   *   - daily_fuel_trend         →  gasto de combustible día a día (para gráfico)
   *   - mom_change_pct           →  variación % respecto al mes anterior
   *
   * Si no se provee `month`, se usa el mes actual.
   */
  async monthlyExpenses(req: Request, res: Response, next: NextFunction) {
    try {
      const now         = new Date();
      const defaultMonth =
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const month = typeof req.query.month === 'string'
        ? req.query.month.trim()
        : defaultMonth;

      const data = await analyticsService.getMonthlyExpenses(req.tenantId, month);
      sendSuccess(res, data);
    } catch (e) { next(e); }
  }

  /**
   * GET /api/analytics/drivers-ranking
   * Query params:
   *   from      — fecha ISO inicio  [default: últimos 90 días]
   *   to        — fecha ISO fin     [default: hoy]
   *   min_loads — mínimo de cargas para incluir al conductor [default: 3]
   */
  async driversRanking(req: Request, res: Response, next: NextFunction) {
    try {
      const minLoads = parseInt(String(req.query.min_loads ?? '3'), 10);
      const data = await analyticsService.getDriversRanking(
        req.tenantId,
        extractRange(req),
        isNaN(minLoads) || minLoads < 1 ? 3 : minLoads,
      );
      sendSuccess(res, data);
    } catch (e) { next(e); }
  }

  /**
   * GET /api/analytics/vehicle/:vehicleId/costs
   * Query params: from, to (ISO date strings; defaults al rango de los últimos 90 días)
   *
   * Retorna ficha completa de costos del vehículo:
   *   total_fuel_cost / total_maintenance_cost / total_cost
   *   km_travelled (MAX odometer − MIN odometer del período)
   *   cost_per_km / fuel_cost_per_km
   *   avg_km_per_liter (ponderado por volumen)
   *   efficiency_score vs efficiencyReference del vehículo
   *   monthly_fuel_trend / monthly_maint_trend  (para gráficos)
   *   maintenance_by_type (breakdown preventivo / correctivo)
   *   fleet_avg_cost_per_km / km_per_liter_vs_fleet_pct  (benchmark)
   *   fuel_loads[] / maintenances[]  (historial completo)
   */
  async vehicleCosts(req: Request, res: Response, next: NextFunction) {
    try {
      const { vehicleId } = req.params;
      if (!vehicleId?.trim()) {
        res.status(400).json({ success: false, message: 'vehicleId es requerido' });
        return;
      }
      const data = await analyticsService.getVehicleCostDetail(
        req.tenantId,
        vehicleId,
        extractRange(req),
      );
      sendSuccess(res, data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'Vehicle not found') {
        res.status(404).json({ success: false, message: 'Vehículo no encontrado' });
      } else {
        next(e);
      }
    }
  }

  /**
   * GET /api/analytics/documents-expiring
   * Query params: days (default: 30)
   */
  async documentsExpiring(req: Request, res: Response, next: NextFunction) {
    try {
      const days = parseInt(String(req.query.days ?? '30'), 10);
      const data = await analyticsService.getDocumentsExpiring(
        req.tenantId,
        isNaN(days) || days < 1 ? 30 : days,
      );
      sendSuccess(res, data);
    } catch (e) { next(e); }
  }

  /**
   * GET /api/analytics/kpi-dashboard?month=YYYY-MM
   *
   * Carga todos los KPIs del analytics_engine en una sola petición.
   * Si no se provee `month`, usa el mes actual (UTC).
   *
   * Respuesta:
   *   month          — período analizado 'YYYY-MM'
   *   fleetCost      — 5 KPIs: total_fleet_cost, cost_per_vehicle, cost_per_km, maintenance_cost, fuel_cost
   *   fuel           — 4 KPIs: avg_consumption, fuel_deviation, fuel_loaded, fuel_loss
   *   maintenance    — 5 KPIs: services_done, pending_maintenance, mtbf, maintenance_cost_per_vehicle, vehicles_in_workshop
   *   availability   — 2 KPIs: fleet_availability, vehicle_downtime
   *   utilization    — 3 KPIs: km_per_vehicle, usage_hours, fleet_utilization
   *   alerts         — SmartAlert[] generadas por el motor inteligente
   *   alertSummary   — conteos por severidad y categoría
   *   generatedAt    — timestamp ISO
   */
  async kpiDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const month = typeof req.query.month === 'string' && req.query.month.trim()
        ? req.query.month.trim()
        : currentMonth();

      const companyId = req.tenantId;

      // Fetch the raw fleet input once (each service also caches internally,
      // so the cost of an extra call is minimal — but fetching up-front lets
      // us pass it to runSmartAlertEngine without an extra DB round-trip).
      const range = monthToDateRange(month);
      const fleetInput = await fetchFleetKPIInput(companyId, range);

      // Run all KPI services + alert engine in parallel
      const [fleetCost, fuel, maintenance, availability, utilization, alertResult] =
        await Promise.all([
          fleetCostKPIService.getAll(companyId, month),
          fuelKPIService.getAll(companyId, month),
          maintenanceKPIService.getAll(companyId, month),
          availabilityKPIService.getAll(companyId, month),
          utilizationKPIService.getAll(companyId, month),
          Promise.resolve(runSmartAlertEngine(fleetInput)),
        ]);

      sendSuccess(res, {
        month,
        fleetCost,
        fuel,
        maintenance,
        availability,
        utilization,
        alerts: alertResult.alerts,
        // Normalise summary: critical/high/medium/low come as SmartAlert[] from
        // buildSmartAlertSummary but the frontend (and API contract) expect counts.
        alertSummary: {
          total:      alertResult.summary.total,
          critical:   alertResult.summary.critical.length,
          high:       alertResult.summary.high.length,
          medium:     alertResult.summary.medium.length,
          low:        alertResult.summary.low.length,
          byCategory: alertResult.summary.byCategory,
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (e) { next(e); }
  }
}
export const analyticsController = new AnalyticsController();