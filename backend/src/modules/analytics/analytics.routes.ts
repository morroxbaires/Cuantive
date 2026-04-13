import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { analyticsController } from './analytics.controller';

const router = Router();

// Todas las rutas de analytics requieren autenticación y tenant
router.use(authMiddleware);
router.use(tenantMiddleware);

/**
 * GET /api/analytics/dashboard
 * Carga todos los datos de analytics en una sola petición.
 * Query params: from, to (ISO date strings)
 */
router.get('/dashboard', analyticsController.dashboard.bind(analyticsController));

/**
 * GET /api/analytics/overview
 * Resumen ejecutivo: totales, anomalías, alertas próximas.
 */
router.get('/overview', analyticsController.overview.bind(analyticsController));

/**
 * GET /api/analytics/consumption
 * Consumo real vs consumo esperado por vehículo.
 * Incluye desvío porcentual respecto al efficiencyReference.
 */
router.get('/consumption', analyticsController.consumption.bind(analyticsController));

/**
 * GET /api/analytics/overconsumption
 * Solo vehículos que superan el umbral de sobreconsumo configurado.
 */
router.get('/overconsumption', analyticsController.overconsumption.bind(analyticsController));

/**
 * GET /api/analytics/driver-anomalies
 * Conductores cuyo consumo promedio se desvía del vehículo que usaron.
 */
router.get('/driver-anomalies', analyticsController.driverAnomalies.bind(analyticsController));

/**
 * GET /api/analytics/costs
 * Costos por vehículo: combustible + mantenimiento + costo/km.
 */
router.get('/costs', analyticsController.costs.bind(analyticsController));

/**
 * GET /api/analytics/maintenance-prediction
 * Predicción de mantenimiento: urgencyScore + días/km restantes.
 */
router.get('/maintenance-prediction', analyticsController.maintenancePrediction.bind(analyticsController));

/**
 * GET /api/analytics/fuel-trend?months=6
 * Tendencia mensual de combustible para gráficos de línea/barra.
 */
router.get('/fuel-trend', analyticsController.fuelTrend.bind(analyticsController));

/**
 * GET /api/analytics/irregular-loads?z=1.5&limit=30
 * Cargas irregulares detectadas por Z-score.
 */
router.get('/irregular-loads', analyticsController.irregularLoads.bind(analyticsController));

/**
 * GET /api/analytics/monthly-expenses?month=YYYY-MM
 *
 * Calcula el gasto mensual completo de la flota para el mes indicado.
 * Si no se provee `month`, usa el mes actual.
 *
 * Respuesta:
 *   total_fuel_cost         — Σ fuel_loads.price_total
 *   total_maintenance_cost  — Σ maintenance.cost
 *   total_cost              — suma de ambos
 *   avg_cost_per_km         — cost / km estimado desde odómetro
 *   total_liters            — litros/kWh totales
 *   vehicles_with_activity  — vehículos con al menos 1 movimiento
 *   vehicles_cost_breakdown — desglose por vehículo (fuel, maint, km, L, costo/km, %)
 *   daily_fuel_trend        — gasto combustible día a día (para gráfico)
 *   prev_month              — mes anterior YYYY-MM
 *   prev_total_cost         — costo total del mes anterior
 *   mom_change_pct          — variación % MoM (null si mes anterior = $0)
 */
router.get('/monthly-expenses', analyticsController.monthlyExpenses.bind(analyticsController));

/**
 * GET /api/analytics/drivers-ranking?from=2026-01-01&to=2026-03-31&min_loads=3
 *
 * Ranking de conductores ordenado por eficiencia real vs referencia del vehículo.
 *
 * Respuesta por conductor:
 *   position        — posición en el ranking (1 = mejor)
 *   driver          — nombre completo
 *   total_km        — km estimados: Σ(km_per_unit × litros)
 *   fuel_used       — litros / kWh totales
 *   total_loads     — cantidad de cargas de combustible
 *   vehicles_used   — vehículos distintos conducidos
 *   efficiency      — km/L real ponderado por volumen
 *   ref_efficiency  — km/L de referencia ponderado por vehículo utilizado
 *   ranking_score   — (efficiency / ref_efficiency) × 100  [100 = par, >100 = mejor]
 *   deviation_pct   — desviación % vs referencia (positivo = mejor)
 *   grade           — A | B | C | D | N/A
 */
router.get('/drivers-ranking', analyticsController.driversRanking.bind(analyticsController));

/**
 * GET /api/analytics/vehicle/:vehicleId/costs?from=2026-01-01&to=2026-03-31
 *
 * Perfil completo de costos de un vehículo específico.
 * 9 consultas en paralelo: datos vehículo, agregados combustible,
 * agregados mantenimiento, tendencias mensuales, breakdown por tipo,
 * promedios flota para benchmark e historial detallado.
 *
 * Respuesta:
 *   vehicle               — ficha técnica completa
 *   period                — rango consultado { from, to }
 *   total_fuel_cost       — Σ fuel_loads.price_total
 *   total_maintenance_cost— Σ maintenance.cost
 *   total_cost            — suma de ambos
 *   km_travelled          — MAX(odometer) − MIN(odometer) en el período
 *   cost_per_km           — total_cost / km_travelled
 *   fuel_cost_per_km      — sólo combustible / km
 *   avg_km_per_liter      — promedio ponderado por volumen
 *   efficiency_score      — (avg_km_per_liter / efficiencyReference) × 100
 *   deviation_pct         — desviación % vs referencia del vehículo
 *   maintenance_by_type   — preventivo / correctivo con costos
 *   monthly_fuel_trend    — serie temporal combustible por mes
 *   monthly_maint_trend   — serie temporal mantenimiento por mes
 *   fleet_avg_cost_per_km — benchmark promedio flota
 *   cost_per_km_vs_fleet_pct — cuánto más/menos caro vs flota
 *   fuel_loads[]          — historial completo cargas (máx 200)
 *   maintenances[]        — historial completo mantenimientos (máx 200)
 */
router.get('/vehicle/:vehicleId/costs', analyticsController.vehicleCosts.bind(analyticsController));

/**
 * GET /api/analytics/documents-expiring?days=30
 * Docummentos próximos a vencer o ya vencidos.
 * Query params: days — ventana de días a considerar [default: 30]
 */
router.get('/documents-expiring', analyticsController.documentsExpiring.bind(analyticsController));

/**
 * GET /api/analytics/drivers-siniestro-ranking?from=2026-01-01&to=2026-03-31
 *
 * Ranking de conductores por costo total acumulado en siniestros/daños.
 * Ordenado de mayor a menor costo total.
 *
 * Respuesta por conductor:
 *   position   — posición en el ranking (1 = mayor costo)
 *   driverId   — UUID del conductor
 *   driver     — nombre completo
 *   totalCost  — suma de costos en UYU
 *   totalCount — cantidad de siniestros registrados
 */
router.get('/drivers-siniestro-ranking', analyticsController.driversSiniestroRanking.bind(analyticsController));

/**
 * GET /api/analytics/kpi-dashboard?month=YYYY-MM
 *
 * Carga todos los KPIs del analytics_engine en una sola petición:
 *   fleetCost, fuel, maintenance, availability, utilization, alerts, alertSummary.
 * Si no se provee `month`, se usa el mes actual (UTC).
 */
router.get('/kpi-dashboard', analyticsController.kpiDashboard.bind(analyticsController));

export default router;
