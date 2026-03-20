/**
 * Cuantive Analytics Service
 * -----------------------------------------------------------
 * Algoritmos de análisis inteligente de flota:
 *   1.  Resumen general (overview)
 *   2.  Consumo real vs consumo esperado por vehículo
 *   3.  Vehículos con sobreconsumo (anomalías de eficiencia)
 *   4.  Conductores con anomalías de consumo
 *   5.  Costos por vehículo + costo por km
 *   6.  Predicción de mantenimiento (urgencia por km y fechas)
 *   7.  Tendencia mensual de combustible
 *   8.  Cargas irregulares (detección por Z-score)
 * -----------------------------------------------------------
 */

import { prisma } from '../../config/database';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DateRange {
  from?: string; // ISO date string
  to?:   string;
}

export interface ConsumptionRow {
  vehicleId:          string;
  plate:              string;
  vehicleName:        string;
  efficiencyReference: number | null;
  loadCount:          number;
  avgKmPerUnit:       number | null;
  totalLiters:        number;
  totalCost:          number;
  /** Porcentaje de desviación: positivo = mejor, negativo = peor que lo esperado */
  deviationPct:       number | null;
  anomaly:            boolean;
}

export interface VehicleCostRow {
  vehicleId:       string;
  plate:           string;
  vehicleName:     string;
  totalFuelCost:   number;
  totalMaintCost:  number;
  totalCost:       number;
  totalLiters:     number;
  totalKm:         number;
  costPerKm:       number | null;
  avgKmPerUnit:    number | null;
}

// Ficha enriquecida de costos para un único vehículo
export interface VehicleCostDetail {
  vehicle: {
    id:                  string;
    plate:               string;
    name:                string;
    brand:               string | null;
    model:               string | null;
    year:                number | null;
    color:               string | null;
    vin:                 string | null;
    currentOdometer:     number;
    efficiencyReference: number | null;
    fuelType:            string | null;
    vehicleType:         string | null;
    active:              boolean;
  };
  /** Rango consultado en formato ISO */
  period: { from: string; to: string };

  // ─ Costos totales ─
  total_fuel_cost:        number;
  total_maintenance_cost: number;
  /** total_fuel_cost + total_maintenance_cost */
  total_cost:             number;

  // ─ Combustible ─
  total_liters:       number;
  fuel_loads_count:   number;
  /** Promedio ponderado km/L del período */
  avg_km_per_liter:   number | null;
  /** Costo total / litros */
  avg_cost_per_liter: number | null;

  // ─ KM y costo/km ─
  /** km MAX(odometer) − MIN(odometer) en el período */
  km_travelled:       number | null;
  /** total_cost / km_travelled */
  cost_per_km:        number | null;
  /** solo combustible / km */
  fuel_cost_per_km:   number | null;

  // ─ Eficiencia vs referencia ─
  /** (avg_km_per_liter / efficiencyReference) × 100; null sin referencia */
  efficiency_score: number | null;
  /** (avg_km_per_liter − ref) / ref × 100 */
  deviation_pct:    number | null;

  // ─ Mantenimiento ─
  maintenance_count:   number;
  /** Desglose por tipo de mantenimiento */
  maintenance_by_type: Array<{ type: string; count: number; total_cost: number }>;

  // ─ Tendencia mensual (para gráficos) ─
  monthly_fuel_trend: Array<{
    month: string;        // 'YYYY-MM'
    fuel_cost:   number;
    liters:      number;
    loads_count: number;
  }>;
  monthly_maint_trend: Array<{
    month: string;
    maint_cost:  number;
    maint_count: number;
  }>;

  // ─ Comparativa con la flota ─
  /** Costo/km promedio del resto de la flota en el mismo período */
  fleet_avg_cost_per_km:    number | null;
  /** km/L promedio del resto de la flota */
  fleet_avg_km_per_liter:   number | null;
  /**
   * Cuánto más caro/barato en costo/km respecto a la flota.
   * Positivo = más caro, negativo = más barato.
   */
  cost_per_km_vs_fleet_pct:    number | null;
  /** Positivo = más eficiente que la flota, negativo = menos */
  km_per_liter_vs_fleet_pct:   number | null;

  // ─ Historial detallado ─
  fuel_loads: Array<{
    id:          string;
    date:        string;
    liters:      number;
    unit_price:  number | null;
    price_total: number | null;
    odometer:    number | null;
    km_per_unit: number | null;
    station:     string | null;
    driver_name: string | null;
    fuel_type:   string | null;
  }>;
  maintenances: Array<{
    id:               string;
    date:             string;
    type:             string;
    description:      string;
    cost:             number | null;
    odometer:         number | null;
    provider:         string | null;
    next_service_km:  number | null;
    next_service_date:string | null;
  }>;
}

export interface DriverAnomalyRow {
  driverId:           string;
  driverName:         string;
  loadCount:          number;
  avgKmPerUnit:       number | null;
  totalCost:          number;
  totalLiters:        number;
  avgVehicleReference: number | null;
  deviationPct:       number | null;
  anomaly:            boolean;
}

export interface MaintenancePredictionRow {
  vehicleId:           string;
  plate:               string;
  vehicleName:         string;
  currentOdometer:     number;
  lastMaintenanceDate: string | null;
  description:         string | null;
  nextOdometer:       number | null;
  nextDate:     string | null;
  kmRemaining:         number | null;
  daysRemaining:       number | null;
  /**
   * urgencyScore 0-100
   *   > 80 = crítico (rojo)
   *   50-80 = próximo (naranja)
   *   < 50 = planificado (verde)
   */
  urgencyScore:        number;
  urgencyLevel:        'critical' | 'warning' | 'ok';
}

export interface IrregularLoadRow {
  id:           string;
  date:         string;
  plate:        string;
  vehicleName:  string;
  driverName:   string | null;
  kmPerUnit:    number;
  vehicleAvg:   number;
  zScore:       number;
  liters:       number;
  priceTotal:   number | null;
  anomalyType:  'under' | 'over'; // consumo menor o mayor al típico
}

/**
 * Una fila del ranking de conductores.
 * position se asigna en memoria después de ordenar por ranking_score DESC.
 */
export interface DriverRankingRow {
  /** Posición en el ranking (1 = mejor) */
  position:           number;
  driverId:           string;
  /** Nombre completo: 'Nombre Apellido' */
  driver:             string;
  driverName:         string;
  driverLastname:     string;
  document:           string | null;
  licenseCategory:    string | null;
  /** Cantidad de cargas de combustible en el período */
  total_loads:        number;
  /** Cargas con km_per_unit registrado (usadas en el cálculo de eficiencia) */
  loads_with_kml:     number;
  /** Vehículos distintos conducidos */
  vehicles_used:      number;
  /** Km recorridos estimados: Σ(km_per_unit × liters) por cada carga con odómetro */
  total_km:           number;
  /** Litros / kWh totales cargados */
  fuel_used:          number;
  /** Gasto total en combustible */
  total_cost:         number;
  /**
   * Eficiencia real del conductor: promedio ponderado por volumen de km/L.
   * = Σ(km_per_unit × liters) / Σ(liters)  — evita sesgo de cargas grandes.
   * null si ninguna carga tiene km_per_unit.
   */
  efficiency:         number | null;
  /**
   * Eficiencia de referencia ponderada: promedio del efficiency_reference
   * de los vehículos manejados, ponderado por litros cargados en ese vehículo.
   * null si ningún vehículo tiene referencia.
   */
  ref_efficiency:     number | null;
  /**
   * ranking_score = (efficiency / ref_efficiency) × 100
   *   100 = exactamente igual a la referencia
   *   > 100 = más eficiente que la referencia (mejor)
   *   < 100 = menos eficiente que la referencia (peor)
   * null cuando no hay referencia disponible.
   */
  ranking_score:      number | null;
  /**
   * Desviación porcentual respecto a la referencia.
   * = (efficiency - ref_efficiency) / ref_efficiency × 100
   * Positivo = mejor que la referencia.
   */
  deviation_pct:      number | null;
  /**
   * Grado de eficiencia:
   *   A  ≥ 105% de la referencia  (≥ +5 %)
   *   B  95–104.9%               (±5 %)
   *   C  80–94.9%                (-5 % a -20 %)
   *   D  < 80%                   (> -20 %)
   *   N/A sin referencia disponible
   */
  grade:              'A' | 'B' | 'C' | 'D' | 'N/A';
}

export interface FuelTrendMonthRow {
  month:           string; // 'YYYY-MM'
  totalLiters:     number;
  totalCost:       number;
  loadCount:       number;
  activeVehicles:  number;
  avgCostPerLiter: number | null;
}

export interface VehicleMonthlyExpense {
  vehicleId:         string;
  plate:             string;
  vehicleName:       string;
  /** Gasto total en combustible durante el mes */
  fuel_cost:         number;
  /** Gasto total en mantenimiento durante el mes */
  maintenance_cost:  number;
  /** fuel_cost + maintenance_cost */
  total_cost:        number;
  /** Costo $ / km recorrido (null si no hay odómetro disponible) */
  cost_per_km:       number | null;
  /** Rendimiento promedio km/L del mes */
  avg_km_per_liter:  number | null;
  /** Litros / kWh totales cargados en el mes */
  total_liters:      number;
  /** Kilómetros recorridos estimados (diferencia max-min odómetro) */
  total_km:          number | null;
  /** Cantidad de cargas de combustible */
  fuel_loads_count:  number;
  /** Cantidad de registros de mantenimiento */
  maintenance_count: number;
  /** Porcentaje del costo total de la flota */
  cost_share_pct:    number;
}

export interface DailyFuelPoint {
  day:         string; // 'YYYY-MM-DD'
  fuel_cost:   number;
  liters:      number;
  loads_count: number;
}

export interface MonthlyExpensesResult {
  /** Mes analizado, formato YYYY-MM */
  month:                   string;
  /** Etiqueta legible: 'marzo 2026' */
  period_label:            string;
  /** Suma de fuel_loads.price_total del mes */
  total_fuel_cost:         number;
  /** Suma de maintenance.cost del mes */
  total_maintenance_cost:  number;
  /** total_fuel_cost + total_maintenance_cost */
  total_cost:              number;
  /** Promedio de costo por km de toda la flota en el mes */
  avg_cost_per_km:         number | null;
  /** Litros/kWh totales del mes */
  total_liters:            number;
  /** Vehículos con al menos una carga o mantenimiento en el mes */
  vehicles_with_activity:  number;
  /** Desglose por vehículo ordenado por total_cost DESC */
  vehicles_cost_breakdown: VehicleMonthlyExpense[];
  /** Gasto diario de combustible dentro del mes (para gráfico) */
  daily_fuel_trend:        DailyFuelPoint[];
  /** Mes anterior, formato YYYY-MM */
  prev_month:              string;
  /** Costo total del mes anterior */
  prev_total_cost:         number;
  /**
   * Variación porcentual mes a mes.
   * null si prev_total_cost = 0.
   * Positivo = gasto mayor, negativo = gasto menor.
   */
  mom_change_pct:          number | null;
}

export interface OverviewStats {
  totalVehicles:      number;
  activeVehicles:     number;
  totalFuelCost:      number;
  totalMaintCost:     number;
  totalCost:          number;
  totalLiters:        number;
  fleetAvgKmPerUnit:  number | null;
  anomalyVehicles:    number;
  anomalyDrivers:     number;
  upcomingMaint:      number; // próximos 30 días
  irregularLoads:     number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Construye rango de fechas para WHERE con valores seguros para parameterized queries */
function dateRange(from?: string, to?: string): { fromDate: Date; toDate: Date } {
  const now = new Date();
  return {
    fromDate: from ? new Date(from) : new Date(now.getFullYear(), now.getMonth() - 2, 1),
    toDate:   to   ? new Date(to)   : now,
  };
}

/**
 * Calcula un umbral de sobreconsumo dinámico.
 * Usa el alertFuelExcessPct de la empresa si está disponible (default 20%).
 */
async function getExcessPct(companyId: string): Promise<number> {
  const s = await prisma.settings.findUnique({ where: { companyId } });
  return Number(s?.alertFuelExcessPct ?? 20);
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class AnalyticsService {

  // ── 1. Overview ────────────────────────────────────────────────────────────

  async getOverview(companyId: string, range: DateRange, vehicleId?: string): Promise<OverviewStats> {
    const { fromDate, toDate } = dateRange(range.from, range.to);

    const excessPct = await getExcessPct(companyId);

    const [
      vehicleCounts,
      fuelAgg,
      maintAgg,
      anomalyVehiclesRes,
      anomalyDriversRes,
      upcomingMaintenanceRes,
      irregularRes,
    ] = await Promise.all([
      // Totales de flota
      prisma.vehicle.groupBy({
        by: ['active'],
        where: { companyId, deletedAt: null },
        _count: { id: true },
      }),

      // Combustible
      (prisma.fuelLoad.aggregate({
        where: {
          companyId,
          date: { gte: fromDate, lte: toDate },
          ...(vehicleId ? { vehicleId } : {}),
        },
        _sum: { priceTotal: true, litersOrKwh: true },
        _avg: { kmPerUnit: true },
      }) as Promise<{ _sum: { priceTotal: unknown; litersOrKwh: unknown }; _avg: { kmPerUnit: unknown } }>),

      // Mantenimiento
      prisma.maintenance.aggregate({
        where: {
          companyId,
          date: { gte: fromDate, lte: toDate },
          ...(vehicleId ? { vehicleId } : {}),
        },
        _sum: { cost: true },
      }),

      // Vehículos con anomalía de consumo
      prisma.$queryRawUnsafe<{ cnt: number }[]>(`
        SELECT COUNT(DISTINCT v.id) as cnt
        FROM vehicles v
        JOIN (
          SELECT vehicle_id,
                 AVG(km_per_unit) as avg_kpu
          FROM fuel_loads
          WHERE company_id = ? AND km_per_unit IS NOT NULL
            AND date BETWEEN ? AND ?
          GROUP BY vehicle_id
        ) agg ON agg.vehicle_id = v.id
        WHERE v.company_id = ?
          AND v.deleted_at IS NULL
          AND v.efficiency_reference IS NOT NULL
          AND (agg.avg_kpu - v.efficiency_reference) / v.efficiency_reference * 100 < -?
      `, companyId, fromDate, toDate, companyId, excessPct),

      // Conductores con anomalía
      prisma.$queryRawUnsafe<{ cnt: number }[]>(`
        SELECT COUNT(DISTINCT d.id) as cnt
        FROM drivers d
        JOIN fuel_loads fl ON fl.driver_id = d.id AND fl.km_per_unit IS NOT NULL
          AND fl.date BETWEEN ? AND ?
        JOIN vehicles v ON v.id = fl.vehicle_id
        WHERE d.company_id = ?
          AND d.deleted_at IS NULL
          AND v.efficiency_reference IS NOT NULL
        GROUP BY d.id
        HAVING AVG(fl.km_per_unit) < AVG(v.efficiency_reference) * (1 - ? / 100)
      `, fromDate, toDate, companyId, excessPct),

      // Mantenimientos próximos (30 días)
      prisma.$queryRawUnsafe<{ cnt: number }[]>(`
        SELECT COUNT(*) as cnt
        FROM (
          SELECT v.id
          FROM vehicles v
          JOIN (
            SELECT m1.vehicle_id, m1.next_service_date, m1.next_service_km
            FROM maintenance m1
            INNER JOIN (
              SELECT vehicle_id, MAX(date) as max_date
              FROM maintenance WHERE company_id = ?
              GROUP BY vehicle_id
            ) lm ON lm.vehicle_id = m1.vehicle_id AND lm.max_date = m1.date
          ) last_m ON last_m.vehicle_id = v.id
          WHERE v.company_id = ? AND v.deleted_at IS NULL AND v.active = 1
            AND (
              (last_m.next_service_date IS NOT NULL AND DATEDIFF(last_m.next_service_date, NOW()) BETWEEN 0 AND 30)
              OR (last_m.next_service_km IS NOT NULL AND (last_m.next_service_km - v.current_odometer) BETWEEN 0 AND 500)
            )
        ) sub
      `, companyId, companyId),

      // Cargas irregulares (Z > 1.5)
      prisma.$queryRawUnsafe<{ cnt: number }[]>(`
        SELECT COUNT(*) as cnt
        FROM fuel_loads fl
        JOIN (
          SELECT vehicle_id,
                 AVG(km_per_unit)    as avg_kpu,
                 STDDEV(km_per_unit) as std_kpu
          FROM fuel_loads
          WHERE company_id = ? AND km_per_unit IS NOT NULL
            AND date BETWEEN ? AND ?
          GROUP BY vehicle_id
          HAVING STDDEV(km_per_unit) > 0
        ) stats ON stats.vehicle_id = fl.vehicle_id
        WHERE fl.company_id = ?
          AND fl.km_per_unit IS NOT NULL
          AND fl.date BETWEEN ? AND ?
          AND ABS(fl.km_per_unit - stats.avg_kpu) / stats.std_kpu > 1.5
      `, companyId, fromDate, toDate, companyId, fromDate, toDate),
    ]);

    const totalVehicles  = vehicleCounts.reduce((s, r) => s + r._count.id, 0);
    const activeVehicles = vehicleCounts.find(r => r.active)?._count.id ?? 0;
    const totalFuelCost  = Number(fuelAgg._sum.priceTotal  ?? 0);
    const totalMaintCost = Number(maintAgg._sum.cost        ?? 0);
    const totalLiters    = Number(fuelAgg._sum.litersOrKwh  ?? 0);

    return {
      totalVehicles,
      activeVehicles,
      totalFuelCost,
      totalMaintCost,
      totalCost:         totalFuelCost + totalMaintCost,
      totalLiters,
      fleetAvgKmPerUnit: Number(fuelAgg._avg.kmPerUnit ?? 0) || null,
      anomalyVehicles:   Number(anomalyVehiclesRes[0]?.cnt ?? 0),
      anomalyDrivers:    Number(anomalyDriversRes.length),
      upcomingMaint:     Number(upcomingMaintenanceRes[0]?.cnt ?? 0),
      irregularLoads:    Number(irregularRes[0]?.cnt ?? 0),
    };
  }

  // ── 2. Consumo real vs esperado por vehículo ───────────────────────────────

  async getConsumptionAnalysis(
    companyId: string,
    range: DateRange,
    vehicleId?: string,
  ): Promise<ConsumptionRow[]> {
    const { fromDate, toDate } = dateRange(range.from, range.to);
    const excessPct = await getExcessPct(companyId);

    const rows = await prisma.$queryRawUnsafe<{
      vehicleId:           string;
      plate:               string;
      vehicleName:         string;
      efficiencyReference: string | null;
      loadCount:           number | string;
      avgKmPerUnit:        string | null;
      totalLiters:         string;
      totalCost:           string;
      deviationPct:        string | null;
    }[]>(`
      SELECT
        v.id                                                   AS vehicleId,
        v.plate,
        COALESCE(v.name, v.plate)                              AS vehicleName,
        v.efficiency_reference                                 AS efficiencyReference,
        COUNT(fl.id)                                           AS loadCount,
        ROUND(AVG(fl.km_per_unit), 2)                          AS avgKmPerUnit,
        ROUND(COALESCE(SUM(fl.liters_or_kwh), 0), 2)           AS totalLiters,
        ROUND(COALESCE(SUM(fl.price_total), 0), 2)             AS totalCost,
        CASE
          WHEN v.efficiency_reference IS NOT NULL
               AND AVG(fl.km_per_unit) IS NOT NULL
          THEN ROUND(
                 (AVG(fl.km_per_unit) - v.efficiency_reference)
                 / v.efficiency_reference * 100, 1)
          ELSE NULL
        END                                                    AS deviationPct
      FROM vehicles v
      LEFT JOIN fuel_loads fl
             ON fl.vehicle_id   = v.id
            AND fl.km_per_unit IS NOT NULL
            AND fl.date BETWEEN ? AND ?
      WHERE v.company_id  = ?
        AND v.deleted_at IS NULL
        AND v.active      = 1
        ${vehicleId ? 'AND v.id = ?' : ''}
      GROUP BY v.id, v.plate, v.name, v.efficiency_reference
      ORDER BY deviationPct ASC
    `, fromDate, toDate, companyId, ...(vehicleId ? [vehicleId] : []));

    return rows.map(r => ({
      vehicleId:           r.vehicleId,
      plate:               r.plate,
      vehicleName:         r.vehicleName,
      efficiencyReference: r.efficiencyReference !== null ? Number(r.efficiencyReference) : null,
      loadCount:           Number(r.loadCount),
      avgKmPerUnit:        r.avgKmPerUnit !== null ? Number(r.avgKmPerUnit) : null,
      totalLiters:         Number(r.totalLiters),
      totalCost:           Number(r.totalCost),
      deviationPct:        r.deviationPct !== null ? Number(r.deviationPct) : null,
      anomaly:             r.deviationPct !== null && Number(r.deviationPct) < -excessPct,
    }));
  }

  // ── 3. Vehículos con sobreconsumo ──────────────────────────────────────────

  async getOverconsumptionVehicles(
    companyId: string,
    range: DateRange,
    vehicleId?: string,
  ): Promise<ConsumptionRow[]> {
    const analysis = await this.getConsumptionAnalysis(companyId, range, vehicleId);
    return analysis.filter(r => r.anomaly);
  }

  // ── 4. Conductores con anomalías ───────────────────────────────────────────

  async getDriverAnomalies(
    companyId: string,
    range: DateRange,
    vehicleId?: string,
  ): Promise<DriverAnomalyRow[]> {
    const { fromDate, toDate } = dateRange(range.from, range.to);
    const excessPct = await getExcessPct(companyId);

    const rows = await prisma.$queryRawUnsafe<{
      driverId:            string;
      driverName:          string;
      loadCount:           number | string;
      avgKmPerUnit:        string | null;
      totalCost:           string;
      totalLiters:         string;
      avgVehicleReference: string | null;
      deviationPct:        string | null;
    }[]>(`
      SELECT
        d.id                                        AS driverId,
        CONCAT(d.name, ' ', d.lastname)             AS driverName,
        COUNT(fl.id)                                AS loadCount,
        ROUND(AVG(fl.km_per_unit), 2)               AS avgKmPerUnit,
        ROUND(COALESCE(SUM(fl.price_total), 0), 2)  AS totalCost,
        ROUND(SUM(fl.liters_or_kwh), 2)             AS totalLiters,
        ROUND(AVG(v.efficiency_reference), 2)       AS avgVehicleReference,
        CASE
          WHEN AVG(v.efficiency_reference) IS NOT NULL
               AND AVG(fl.km_per_unit) IS NOT NULL
          THEN ROUND(
                 (AVG(fl.km_per_unit) - AVG(v.efficiency_reference))
                 / AVG(v.efficiency_reference) * 100, 1)
          ELSE NULL
        END                                         AS deviationPct
      FROM drivers d
      JOIN fuel_loads fl
        ON fl.driver_id      = d.id
       AND fl.km_per_unit IS NOT NULL
       AND fl.date BETWEEN ? AND ?
       ${vehicleId ? 'AND fl.vehicle_id = ?' : ''}
      JOIN vehicles v ON v.id = fl.vehicle_id
      WHERE d.company_id   = ?
        AND d.deleted_at  IS NULL
      GROUP BY d.id, d.name, d.lastname
      ORDER BY deviationPct ASC
    `, fromDate, toDate, ...(vehicleId ? [vehicleId] : []), companyId);

    return rows.map(r => ({
      driverId:            r.driverId,
      driverName:          r.driverName,
      loadCount:           Number(r.loadCount),
      avgKmPerUnit:        r.avgKmPerUnit !== null ? Number(r.avgKmPerUnit)        : null,
      totalCost:           Number(r.totalCost),
      totalLiters:         Number(r.totalLiters),
      avgVehicleReference: r.avgVehicleReference !== null ? Number(r.avgVehicleReference) : null,
      deviationPct:        r.deviationPct !== null ? Number(r.deviationPct) : null,
      anomaly:             r.deviationPct !== null && Number(r.deviationPct) < -excessPct,
    }));
  }

  // ── 5. Costos por vehículo y costo por km ──────────────────────────────────

  async getCostsByVehicle(
    companyId: string,
    range: DateRange,
    vehicleId?: string,
  ): Promise<VehicleCostRow[]> {
    const { fromDate, toDate } = dateRange(range.from, range.to);

    const rows = await prisma.$queryRawUnsafe<{
      vehicleId:      string;
      plate:          string;
      vehicleName:    string;
      totalFuelCost:  string;
      totalMaintCost: string;
      totalLiters:    string;
      totalKm:        string | null;
      costPerKm:      string | null;
      avgKmPerUnit:   string | null;
    }[]>(`
      SELECT
        v.id                                          AS vehicleId,
        v.plate,
        COALESCE(v.name, v.plate)                     AS vehicleName,
        ROUND(COALESCE(SUM(fl.price_total),     0), 2) AS totalFuelCost,
        ROUND(COALESCE(SUM(m.cost),             0), 2) AS totalMaintCost,
        ROUND(COALESCE(SUM(fl.liters_or_kwh),   0), 2) AS totalLiters,
        CASE
          WHEN MAX(fl.odometer) IS NOT NULL
               AND MIN(fl.odometer) IS NOT NULL
               AND MAX(fl.odometer) > MIN(fl.odometer)
          THEN MAX(fl.odometer) - MIN(fl.odometer)
          ELSE NULL
        END                                           AS totalKm,
        CASE
          WHEN SUM(fl.price_total) > 0
               AND MAX(fl.odometer) IS NOT NULL
               AND MAX(fl.odometer) > MIN(fl.odometer)
          THEN ROUND(
                 SUM(fl.price_total)
                 / (MAX(fl.odometer) - MIN(fl.odometer)), 2)
          ELSE NULL
        END                                           AS costPerKm,
        ROUND(AVG(fl.km_per_unit), 2)                 AS avgKmPerUnit
      FROM vehicles v
      LEFT JOIN fuel_loads fl
             ON fl.vehicle_id = v.id
            AND fl.date BETWEEN ? AND ?
      LEFT JOIN maintenance m
             ON m.vehicle_id = v.id
            AND m.date BETWEEN ? AND ?
      WHERE v.company_id  = ?
        AND v.deleted_at IS NULL
        AND v.active      = 1
        ${vehicleId ? 'AND v.id = ?' : ''}
      GROUP BY v.id, v.plate, v.name
      HAVING totalFuelCost > 0 OR totalMaintCost > 0
      ORDER BY totalFuelCost DESC
    `, fromDate, toDate, fromDate, toDate, companyId, ...(vehicleId ? [vehicleId] : []));

    return rows.map(r => ({
      vehicleId:      r.vehicleId,
      plate:          r.plate,
      vehicleName:    r.vehicleName,
      totalFuelCost:  Number(r.totalFuelCost),
      totalMaintCost: Number(r.totalMaintCost),
      totalCost:      Number(r.totalFuelCost) + Number(r.totalMaintCost),
      totalLiters:    Number(r.totalLiters),
      totalKm:        r.totalKm !== null ? Number(r.totalKm) : 0,
      costPerKm:      r.costPerKm !== null ? Number(r.costPerKm) : null,
      avgKmPerUnit:   r.avgKmPerUnit !== null ? Number(r.avgKmPerUnit) : null,
    }));
  }

  // ── 6. Predicción de mantenimiento ─────────────────────────────────────────

  async getMaintenancePrediction(
    companyId: string,
    vehicleId?: string,
  ): Promise<MaintenancePredictionRow[]> {
    const settings = await prisma.settings.findUnique({ where: { companyId } });
    const alertKm   = settings?.alertKmBeforeMaint ?? 500;
    const alertDays = settings?.alertDaysBeforeMaint ?? 15;

    const rows = await prisma.$queryRawUnsafe<{
      vehicleId:           string;
      plate:               string;
      vehicleName:         string;
      currentOdometer:     number | string;
      lastMaintenanceDate: string | null;
      description:         string | null;
      nextOdometer:       number | string | null;
      nextDate:     string | null;
    }[]>(`
      SELECT
        v.id                          AS vehicleId,
        v.plate,
        COALESCE(v.name, v.plate)     AS vehicleName,
        v.current_odometer            AS currentOdometer,
        m.date                        AS lastMaintenanceDate,
        m.description,
        m.next_service_km             AS nextOdometer,
        DATE_FORMAT(m.next_service_date, '%Y-%m-%d') AS nextDate
      FROM vehicles v
      JOIN (
        SELECT m1.vehicle_id,
               m1.next_service_km,
               m1.next_service_date,
               m1.description,
               m1.date
        FROM maintenance m1
        INNER JOIN (
          SELECT vehicle_id, MAX(date) AS max_date
          FROM maintenance
          WHERE company_id = ?
          GROUP BY vehicle_id
        ) lm ON lm.vehicle_id = m1.vehicle_id
             AND lm.max_date  = m1.date
      ) m ON m.vehicle_id = v.id
      WHERE v.company_id  = ?
        AND v.deleted_at IS NULL
        AND v.active      = 1
        AND (m.next_service_km IS NOT NULL OR m.next_service_date IS NOT NULL)
        ${vehicleId ? 'AND v.id = ?' : ''}
      ORDER BY m.next_service_date ASC
    `, companyId, companyId, ...(vehicleId ? [vehicleId] : []));

    return rows.map(r => {
      const currentOdometer = Number(r.currentOdometer);
      const nextOdometer   = r.nextOdometer !== null ? Number(r.nextOdometer) : null;
      const nextDate = r.nextDate ?? null;
      const kmRemaining     = nextOdometer !== null ? nextOdometer - currentOdometer : null;
      const daysRemaining   = nextDate
        ? Math.round((new Date(nextDate).getTime() - Date.now()) / 86_400_000)
        : null;

      // ── Cálculo de urgencyScore ──────────────────────────────────────────
      // Score por km: 100 si ya pasó el umbral, escala linealmente hasta alertKm * 3
      let scoreKm = 0;
      if (kmRemaining !== null) {
        if (kmRemaining <= 0)    scoreKm = 100;
        else if (kmRemaining <= alertKm)         scoreKm = 80 + (1 - kmRemaining / alertKm) * 20;
        else if (kmRemaining <= alertKm * 3)     scoreKm = 50 + (1 - (kmRemaining - alertKm) / (alertKm * 2)) * 30;
        else                                     scoreKm = Math.max(0, 50 - ((kmRemaining - alertKm * 3) / (alertKm * 2)) * 50);
      }

      // Score por fecha
      let scoreDays = 0;
      if (daysRemaining !== null) {
        if (daysRemaining <= 0)            scoreDays = 100;
        else if (daysRemaining <= alertDays)     scoreDays = 80 + (1 - daysRemaining / alertDays) * 20;
        else if (daysRemaining <= alertDays * 3) scoreDays = 50 + (1 - (daysRemaining - alertDays) / (alertDays * 2)) * 30;
        else                                     scoreDays = Math.max(0, 50 - ((daysRemaining - alertDays * 3) / (alertDays * 2)) * 50);
      }

      const urgencyScore = Math.round(Math.max(scoreKm, scoreDays));
      const urgencyLevel: MaintenancePredictionRow['urgencyLevel'] =
        urgencyScore >= 80 ? 'critical' :
        urgencyScore >= 50 ? 'warning'  : 'ok';

      return {
        vehicleId:           r.vehicleId,
        plate:               r.plate,
        vehicleName:         r.vehicleName,
        currentOdometer,
        lastMaintenanceDate: r.lastMaintenanceDate
          ? new Date(r.lastMaintenanceDate).toISOString().slice(0, 10)
          : null,
        description:         r.description ?? null,
        nextOdometer,
        nextDate,
        kmRemaining,
        daysRemaining,
        urgencyScore,
        urgencyLevel,
      };
    });
  }

  // ── 7. Tendencia mensual de combustible ────────────────────────────────────

  async getFuelTrend(
    companyId: string,
    months = 6,
    vehicleId?: string,
  ): Promise<FuelTrendMonthRow[]> {
    const rows = await prisma.$queryRawUnsafe<{
      month:           string;
      totalLiters:     string;
      totalCost:       string;
      loadCount:       number | string;
      activeVehicles:  number | string;
    }[]>(`
      SELECT
        DATE_FORMAT(date, '%Y-%m')                     AS \`month\`,
        ROUND(SUM(liters_or_kwh), 2)                   AS totalLiters,
        ROUND(COALESCE(SUM(price_total), 0), 2)        AS totalCost,
        COUNT(*)                                       AS loadCount,
        COUNT(DISTINCT vehicle_id)                     AS activeVehicles
      FROM fuel_loads
      WHERE company_id = ?
        AND date >= DATE_SUB(NOW(), INTERVAL ? MONTH)
        ${vehicleId ? 'AND vehicle_id = ?' : ''}
      GROUP BY DATE_FORMAT(date, '%Y-%m')
      ORDER BY \`month\` ASC
    `, companyId, months, ...(vehicleId ? [vehicleId] : []));

    return rows.map(r => ({
      month:           r.month,
      totalLiters:     Number(r.totalLiters),
      totalCost:       Number(r.totalCost),
      loadCount:       Number(r.loadCount),
      activeVehicles:  Number(r.activeVehicles),
      avgCostPerLiter: Number(r.totalLiters) > 0
        ? Math.round((Number(r.totalCost) / Number(r.totalLiters)) * 100) / 100
        : null,
    }));
  }

  // ── 8. Cargas irregulares (detección Z-score) ──────────────────────────────

  async getIrregularLoads(
    companyId: string,
    range: DateRange,
    zThreshold = 1.5,
    limit = 30,
    vehicleId?: string,
  ): Promise<IrregularLoadRow[]> {
    const { fromDate, toDate } = dateRange(range.from, range.to);

    const rows = await prisma.$queryRawUnsafe<{
      id:          string;
      date:        string;
      plate:       string;
      vehicleName: string;
      driverName:  string | null;
      kmPerUnit:   string;
      vehicleAvg:  string;
      zScore:      string;
      liters:      string;
      priceTotal:  string | null;
    }[]>(`
      SELECT
        fl.id,
        DATE_FORMAT(fl.date, '%Y-%m-%d')             AS date,
        v.plate,
        COALESCE(v.name, v.plate)                    AS vehicleName,
        CONCAT(d.name, ' ', d.lastname)              AS driverName,
        ROUND(fl.km_per_unit, 2)                     AS kmPerUnit,
        ROUND(stats.avg_kpu, 2)                      AS vehicleAvg,
        ROUND(ABS(fl.km_per_unit - stats.avg_kpu)
              / stats.std_kpu, 2)                    AS zScore,
        fl.liters_or_kwh                             AS liters,
        fl.price_total                               AS priceTotal
      FROM fuel_loads fl
      JOIN vehicles v ON v.id = fl.vehicle_id
      LEFT JOIN drivers d ON d.id = fl.driver_id
      JOIN (
        SELECT vehicle_id,
               AVG(km_per_unit)    AS avg_kpu,
               STDDEV(km_per_unit) AS std_kpu
        FROM fuel_loads
        WHERE company_id     = ?
          AND km_per_unit IS NOT NULL
          AND date BETWEEN ? AND ?
          ${vehicleId ? 'AND vehicle_id = ?' : ''}
        GROUP BY vehicle_id
        HAVING STDDEV(km_per_unit) > 0
      ) stats ON stats.vehicle_id = fl.vehicle_id
      WHERE fl.company_id     = ?
        AND fl.km_per_unit IS NOT NULL
        AND fl.date BETWEEN ? AND ?
        ${vehicleId ? 'AND fl.vehicle_id = ?' : ''}
        AND ABS(fl.km_per_unit - stats.avg_kpu) / stats.std_kpu > ?
      ORDER BY zScore DESC
      LIMIT ?
    `, companyId, fromDate, toDate, ...(vehicleId ? [vehicleId] : []), companyId, fromDate, toDate, ...(vehicleId ? [vehicleId] : []), zThreshold, limit);

    return rows.map(r => ({
      id:           r.id,
      date:         r.date,
      plate:        r.plate,
      vehicleName:  r.vehicleName,
      driverName:   r.driverName ?? null,
      kmPerUnit:    Number(r.kmPerUnit),
      vehicleAvg:   Number(r.vehicleAvg),
      zScore:       Number(r.zScore),
      liters:       Number(r.liters),
      priceTotal:   r.priceTotal !== null ? Number(r.priceTotal) : null,
      anomalyType:  Number(r.kmPerUnit) < Number(r.vehicleAvg) ? 'under' : 'over',
    }));
  }

  // ── 9. Gastos mensuales — desglose por vehículo y totales de flota ─────────

  /**
   * Calcula el gasto total de la flota para un mes calendario específico.
   *
   * Estrategia de consultas (todas en paralelo, optimizadas para MySQL):
   *
   * Q1 — Agrupación de fuel_loads por vehículo en el mes:
   *       JOIN a vehicles para obtener plate/name/efficiencyReference.
   *       Índices usados: (company_id, date) en fuel_loads, PK en vehicles.
   *
   * Q2 — Agrupación de maintenance por vehículo en el mes:
   *       Solo columnas (vehicle_id, sum(cost), count).
   *       Índice (company_id, date) en maintenance.
   *
   * Q3 — Tendencia diaria de combustible:
   *       GROUP BY DATE(date) para gráfico de columnas/línea.
   *
   * Q4 — Totales del mes anterior (para variación MoM):
   *       Dos aggregate independientes, promovidos a scalars.
   *
   * @param companyId  Tenant ID
   * @param month      Formato 'YYYY-MM' (ej. '2026-03')
   */
  async getMonthlyExpenses(
    companyId: string,
    month:     string,
  ): Promise<MonthlyExpensesResult> {

    // ── Parseo de fechas ────────────────────────────────────────────────────
    // Validar formato básico
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new Error("Formato de mes inválido. Use 'YYYY-MM'.");
    }
    const [yearStr, monthStr] = month.split('-');
    const year  = parseInt(yearStr,  10);
    const mon   = parseInt(monthStr, 10);

    if (mon < 1 || mon > 12) throw new Error('Mes inválido (01-12).');

    // Rango estricto: primer día 00:00:00 → primer día del mes siguiente 00:00:00
    // El uso de < fechaNextMonth (en lugar de <= lastDay) evita problemas de
    // datetime vs date y funciona correctamente con índices de tipo DATETIME.
    const fromDate     = new Date(Date.UTC(year, mon - 1, 1));
    const toDateExcl   = new Date(Date.UTC(year, mon,     1));  // exclusive upper bound

    // Mes anterior
    const prevFrom     = new Date(Date.UTC(year, mon - 2, 1));
    const prevToExcl   = fromDate;

    // Etiqueta legible
    const periodLabel  = fromDate.toLocaleDateString('es-CL', {
      month: 'long', year: 'numeric', timeZone: 'UTC',
    });
    const prevMonthStr =
      `${prevFrom.getUTCFullYear()}-${String(prevFrom.getUTCMonth() + 1).padStart(2, '0')}`;

    // ── Q1: Combustible por vehículo ────────────────────────────────────────
    // Retorna una fila por vehículo con al menos una carga en el mes.
    const fuelByVehiclePromise = prisma.$queryRawUnsafe<{
      vehicleId:      string;
      plate:          string;
      vehicleName:    string;
      fuelCost:       string;
      totalLiters:    string;
      loadsCount:     string | number;
      avgKmPerLiter:  string | null;
      totalKm:        string | null;
    }[]>(`
      SELECT
        v.id                                             AS vehicleId,
        v.plate,
        COALESCE(v.name, v.plate)                        AS vehicleName,
        ROUND(COALESCE(SUM(fl.price_total),   0), 2)     AS fuelCost,
        ROUND(COALESCE(SUM(fl.liters_or_kwh), 0), 2)     AS totalLiters,
        COUNT(fl.id)                                     AS loadsCount,
        ROUND(AVG(NULLIF(fl.km_per_unit, 0)), 2)         AS avgKmPerLiter,
        CASE
          WHEN MAX(fl.odometer) IS NOT NULL
               AND MIN(fl.odometer) IS NOT NULL
               AND MAX(fl.odometer) > MIN(fl.odometer)
          THEN MAX(fl.odometer) - MIN(fl.odometer)
          ELSE NULL
        END                                              AS totalKm
      FROM vehicles v
      JOIN fuel_loads fl
        ON  fl.vehicle_id = v.id
        AND fl.date       >= ?
        AND fl.date        < ?
      WHERE v.company_id  = ?
        AND v.deleted_at IS NULL
      GROUP BY v.id, v.plate, v.name
    `, fromDate, toDateExcl, companyId);

    // ── Q2: Mantenimiento por vehículo ──────────────────────────────────────
    const maintByVehiclePromise = prisma.$queryRawUnsafe<{
      vehicleId:  string;
      maintCost:  string;
      maintCount: string | number;
    }[]>(`
      SELECT
        vehicle_id                                   AS vehicleId,
        ROUND(COALESCE(SUM(cost), 0), 2)             AS maintCost,
        COUNT(id)                                    AS maintCount
      FROM maintenance
      WHERE company_id = ?
        AND date       >= ?
        AND date        < ?
      GROUP BY vehicle_id
    `, companyId, fromDate, toDateExcl);

    // ── Q3: Tendencia diaria (combustible) ──────────────────────────────────
    const dailyTrendPromise = prisma.$queryRawUnsafe<{
      day:        string;
      fuel_cost:  string;
      liters:     string;
      loads_count:string | number;
    }[]>(`
      SELECT
        DATE_FORMAT(date, '%Y-%m-%d')                AS day,
        ROUND(COALESCE(SUM(price_total), 0), 2)      AS fuel_cost,
        ROUND(COALESCE(SUM(liters_or_kwh), 0), 2)    AS liters,
        COUNT(*)                                     AS loads_count
      FROM fuel_loads
      WHERE company_id = ?
        AND date       >= ?
        AND date        < ?
      GROUP BY DATE_FORMAT(date, '%Y-%m-%d')
      ORDER BY day ASC
    `, companyId, fromDate, toDateExcl);

    // ── Q4a: Totales combustible mes anterior ───────────────────────────────
    const prevFuelPromise = prisma.fuelLoad.aggregate({
      where: { companyId, date: { gte: prevFrom, lt: prevToExcl } },
      _sum:  { priceTotal: true },
    });

    // ── Q4b: Totales mantenimiento mes anterior ─────────────────────────────
    const prevMaintPromise = prisma.maintenance.aggregate({
      where: { companyId, date: { gte: prevFrom, lt: prevToExcl } },
      _sum:  { cost: true },
    });

    // ── Ejecución paralela ──────────────────────────────────────────────────
    const [
      fuelRows,
      maintRows,
      dailyRows,
      prevFuelAgg,
      prevMaintAgg,
    ] = await Promise.all([
      fuelByVehiclePromise,
      maintByVehiclePromise,
      dailyTrendPromise,
      prevFuelPromise,
      prevMaintPromise,
    ]);

    // ── Combinar fuel + maint por vehículo ──────────────────────────────────
    const maintMap = new Map<string, { maintCost: number; maintCount: number }>();
    maintRows.forEach(r => {
      maintMap.set(r.vehicleId, {
        maintCost:  Number(r.maintCost),
        maintCount: Number(r.maintCount),
      });
    });

    // También incluir vehículos que sólo tienen mantenimiento (sin cargas)
    const vehicleIds = new Set<string>([
      ...fuelRows.map(r => r.vehicleId),
      ...maintRows.map(r => r.vehicleId),
    ]);

    // Resolver datos de vehículo para los que sólo tienen mantenimiento
    const fuelMap = new Map(fuelRows.map(r => [r.vehicleId, r]));
    const missingIds = [...vehicleIds].filter(id => !fuelMap.has(id));

    let missingVehicles: { id: string; plate: string; vehicleName: string }[] = [];
    if (missingIds.length) {
      missingVehicles = await prisma.$queryRawUnsafe<{
        id:          string;
        plate:       string;
        vehicleName: string;
      }[]>(`
        SELECT id, plate, COALESCE(name, plate) AS vehicleName
        FROM vehicles
        WHERE id IN (${missingIds.map(() => '?').join(',')})
      `, ...missingIds);
    }

    // ── Calcular fleet totals ───────────────────────────────────────────────
    let fleetFuelCost  = 0;
    let fleetMaintCost = 0;
    let fleetLiters    = 0;
    let fleetKm        = 0;
    let fleetKmCount   = 0;

    fuelRows.forEach(r => {
      fleetFuelCost += Number(r.fuelCost);
      fleetLiters   += Number(r.totalLiters);
      if (r.totalKm != null) {
        fleetKm      += Number(r.totalKm);
        fleetKmCount += 1;
      }
    });
    maintRows.forEach(r => { fleetMaintCost += Number(r.maintCost); });

    const fleetTotalCost    = fleetFuelCost + fleetMaintCost;
    const fleetAvgCostPerKm = fleetKm > 0 ? fleetTotalCost / fleetKm : null;

    // ── Construir breakdown por vehículo ────────────────────────────────────
    const vehiclesBreakdown: VehicleMonthlyExpense[] = [];

    // Vehículos con cargas
    fuelRows.forEach(r => {
      const maint      = maintMap.get(r.vehicleId) ?? { maintCost: 0, maintCount: 0 };
      const fuelCost   = Number(r.fuelCost);
      const totalCost  = fuelCost + maint.maintCost;
      const totalKm    = r.totalKm != null ? Number(r.totalKm) : null;

      vehiclesBreakdown.push({
        vehicleId:         r.vehicleId,
        plate:             r.plate,
        vehicleName:       r.vehicleName,
        fuel_cost:         fuelCost,
        maintenance_cost:  maint.maintCost,
        total_cost:        totalCost,
        cost_per_km:       (totalKm && totalKm > 0) ? Math.round(totalCost / totalKm * 100) / 100 : null,
        avg_km_per_liter:  r.avgKmPerLiter != null ? Number(r.avgKmPerLiter) : null,
        total_liters:      Number(r.totalLiters),
        total_km:          totalKm,
        fuel_loads_count:  Number(r.loadsCount),
        maintenance_count: maint.maintCount,
        cost_share_pct:    fleetTotalCost > 0
          ? Math.round((totalCost / fleetTotalCost) * 1000) / 10  // 1 decimal
          : 0,
      });
    });

    // Vehículos con sólo mantenimiento
    missingVehicles.forEach(v => {
      const maint     = maintMap.get(v.id);
      if (!maint) return;
      vehiclesBreakdown.push({
        vehicleId:         v.id,
        plate:             v.plate,
        vehicleName:       v.vehicleName,
        fuel_cost:         0,
        maintenance_cost:  maint.maintCost,
        total_cost:        maint.maintCost,
        cost_per_km:       null,
        avg_km_per_liter:  null,
        total_liters:      0,
        total_km:          null,
        fuel_loads_count:  0,
        maintenance_count: maint.maintCount,
        cost_share_pct:    fleetTotalCost > 0
          ? Math.round((maint.maintCost / fleetTotalCost) * 1000) / 10
          : 0,
      });
    });

    // Ordenar por costo total descendente
    vehiclesBreakdown.sort((a, b) => b.total_cost - a.total_cost);

    // ── MoM (month-over-month) ──────────────────────────────────────────────
    const prevTotalCost =
      Number(prevFuelAgg._sum.priceTotal ?? 0) +
      Number(prevMaintAgg._sum.cost       ?? 0);

    const momChangePct = prevTotalCost > 0
      ? Math.round(((fleetTotalCost - prevTotalCost) / prevTotalCost) * 1000) / 10
      : null;

    // ── Daily trend mapping ─────────────────────────────────────────────────
    const dailyFuelTrend: DailyFuelPoint[] = dailyRows.map(r => ({
      day:         r.day,
      fuel_cost:   Number(r.fuel_cost),
      liters:      Number(r.liters),
      loads_count: Number(r.loads_count),
    }));

    return {
      month,
      period_label:           periodLabel,
      total_fuel_cost:        fleetFuelCost,
      total_maintenance_cost: fleetMaintCost,
      total_cost:             fleetTotalCost,
      avg_cost_per_km:        fleetAvgCostPerKm
        ? Math.round(fleetAvgCostPerKm * 100) / 100
        : null,
      total_liters:           fleetLiters,
      vehicles_with_activity: vehicleIds.size,
      vehicles_cost_breakdown: vehiclesBreakdown,
      daily_fuel_trend:       dailyFuelTrend,
      prev_month:             prevMonthStr,
      prev_total_cost:        prevTotalCost,
      mom_change_pct:         momChangePct,
    };
  }

  // ── 10. Ranking de conductores por eficiencia ────────────────────────────────

  /**
   * Calcula el ranking de eficiencia de todos los conductores de la empresa.
   *
   * Fórmula del score:
   *   efficiency       = Σ(km_per_unit × liters) / Σ(liters)  [promedio pond. por volumen]
   *   ref_efficiency   = Σ(ref_vehicle  × liters) / Σ(liters)  [ref pond. por vehículo usado]
   *   ranking_score    = (efficiency / ref_efficiency) × 100
   *
   * El promedio ponderado por volumen es más justo que el simple porque evita
   * que una carga pequeña con km/L alto infle la media del conductor.
   *
   * Consulta MySQL:
   *   - Un único JOIN fuel_loads ↔ vehicles ↔ drivers (todos indexados)
   *   - Agregación completa en el motor MySQL: SUM, COUNT, NULLIF
   *   - HAVING filtra conductores con menos de `minLoads` registros
   *   - Ordenación final en memoria (asignación de position)
   *
   * @param companyId  Tenant ID
   * @param range      Rango de fechas { from, to } ISO strings
   * @param minLoads   Mínimo de cargas para aparecer en el ranking (default 3)
   */
  async getDriversRanking(
    companyId: string,
    range:     DateRange,
    minLoads   = 3,
  ): Promise<DriverRankingRow[]> {
    const { fromDate, toDate } = dateRange(range.from, range.to);

    const rows = await prisma.$queryRawUnsafe<{
      driverId:        string;
      driverName:      string;
      driverLastname:  string;
      document:        string | null;
      licenseCategory: string | null;
      total_loads:     string | number;
      loads_with_kml:  string | number;
      vehicles_used:   string | number;
      fuel_used:       string;
      total_cost:      string;
      total_km:        string;
      efficiency:      string | null;
      ref_efficiency:  string | null;
      ranking_score:   string | null;
    }[]>(`
      SELECT
        d.id                                                       AS driverId,
        d.name                                                     AS driverName,
        d.lastname                                                 AS driverLastname,
        d.document,
        d.license_category                                         AS licenseCategory,

        COUNT(fl.id)                                               AS total_loads,
        SUM(CASE WHEN fl.km_per_unit IS NOT NULL THEN 1 ELSE 0 END) AS loads_with_kml,
        COUNT(DISTINCT fl.vehicle_id)                              AS vehicles_used,

        ROUND(COALESCE(SUM(fl.liters_or_kwh), 0), 2)              AS fuel_used,
        ROUND(COALESCE(SUM(fl.price_total), 0), 2)                 AS total_cost,

        -- km estimados: km_per_unit × liters para cada carga con odómetro
        ROUND(
          COALESCE(
            SUM(CASE WHEN fl.km_per_unit IS NOT NULL
                     THEN fl.km_per_unit * fl.liters_or_kwh ELSE 0 END),
            0
          ), 0
        )                                                          AS total_km,

        -- eficiencia real (promedio ponderado por volumen)
        ROUND(
          SUM(CASE WHEN fl.km_per_unit IS NOT NULL
                   THEN fl.km_per_unit * fl.liters_or_kwh ELSE NULL END)
          /
          NULLIF(
            SUM(CASE WHEN fl.km_per_unit IS NOT NULL
                     THEN fl.liters_or_kwh ELSE NULL END),
            0
          ),
        2)                                                         AS efficiency,

        -- eficiencia de referencia ponderada por volumen en ese vehículo
        ROUND(
          SUM(CASE WHEN v.efficiency_reference IS NOT NULL AND fl.km_per_unit IS NOT NULL
                   THEN v.efficiency_reference * fl.liters_or_kwh ELSE NULL END)
          /
          NULLIF(
            SUM(CASE WHEN v.efficiency_reference IS NOT NULL AND fl.km_per_unit IS NOT NULL
                     THEN fl.liters_or_kwh ELSE NULL END),
            0
          ),
        2)                                                         AS ref_efficiency,

        -- ranking_score = (efficiency / ref_efficiency) × 100
        ROUND(
          SUM(CASE WHEN fl.km_per_unit IS NOT NULL
                   THEN fl.km_per_unit * fl.liters_or_kwh ELSE NULL END)
          /
          NULLIF(
            SUM(CASE WHEN v.efficiency_reference IS NOT NULL AND fl.km_per_unit IS NOT NULL
                     THEN v.efficiency_reference * fl.liters_or_kwh ELSE NULL END),
            0
          )
          * 100,
        1)                                                         AS ranking_score

      FROM drivers d
      JOIN fuel_loads fl
        ON  fl.driver_id  = d.id
        AND fl.date      >= ?
        AND fl.date      <= ?
      JOIN vehicles v ON v.id = fl.vehicle_id
      WHERE d.company_id   = ?
        AND d.deleted_at  IS NULL
      GROUP BY d.id, d.name, d.lastname, d.document, d.license_category
      HAVING total_loads >= ?
      ORDER BY
        ranking_score DESC,   -- con referencia: mejor score primero
        efficiency DESC,       -- desempate por eficiencia absoluta
        total_km DESC          -- desempate por km recorridos
    `, fromDate, toDate, companyId, minLoads);

    // Asignar posición en memoria
    // Conductores sin ranking_score (sin referencia) van al final, con position según km
    const withScore    = rows.filter(r => r.ranking_score !== null);
    const withoutScore = rows.filter(r => r.ranking_score === null);

    const buildRow = (r: typeof rows[0], idx: number): DriverRankingRow => {
      const score     = r.ranking_score !== null ? Number(r.ranking_score) : null;
      const eff       = r.efficiency     !== null ? Number(r.efficiency)    : null;
      const refEff    = r.ref_efficiency !== null ? Number(r.ref_efficiency) : null;
      const devPct    = (score !== null) ? Math.round((score - 100) * 10) / 10 : null;

      let grade: DriverRankingRow['grade'] = 'N/A';
      if (score !== null) {
        grade = score >= 105 ? 'A'
              : score >= 95  ? 'B'
              : score >= 80  ? 'C'
              :                'D';
      }

      return {
        position:        idx + 1,
        driverId:        r.driverId,
        driver:          `${r.driverName} ${r.driverLastname}`.trim(),
        driverName:      r.driverName,
        driverLastname:  r.driverLastname,
        document:        r.document        ?? null,
        licenseCategory: r.licenseCategory ?? null,
        total_loads:     Number(r.total_loads),
        loads_with_kml:  Number(r.loads_with_kml),
        vehicles_used:   Number(r.vehicles_used),
        total_km:        Number(r.total_km),
        fuel_used:       Number(r.fuel_used),
        total_cost:      Number(r.total_cost),
        efficiency:      eff,
        ref_efficiency:  refEff,
        ranking_score:   score,
        deviation_pct:   devPct,
        grade,
      };
    };

    return [
      ...withScore.map((r, i) => buildRow(r, i)),
      ...withoutScore.map((r, i) => buildRow(r, withScore.length + i)),
    ];
  }

  // ── 11. Costos detallados de un vehículo individual ──────────────────────

  /**
   * Retorna un perfil completo de costos para un único vehículo.
   *
   * Consultas ejecutadas en paralelo (Promise.all):
   *   P1 — Prisma findFirst: datos del vehículo + relaciones fuelType / vehicleType
   *   P2 — SQL aggregate: totales fuel (cost, liters, km por odómetro, km/L ponderado)
   *   P3 — SQL aggregate: totales maintenance (cost, count)
   *   P4 — SQL GROUP BY: tendencia mensual combustible
   *   P5 — SQL GROUP BY: tendencia mensual mantenimiento
   *   P6 — SQL GROUP BY type: breakdown mantenimiento por tipo
   *   P7 — SQL aggregate: promedios de flota (excluye este vehículo) para comparativa
   *   P8 — Prisma findMany: historial de cargas (máx 200, desc)
   *   P9 — Prisma findMany: historial de mantenimientos (máx 200, desc)
   *
   * Lanza error si el vehículo no pertenece al tenant (validación de tenant en P1).
   *
   * @param companyId  Tenant ID
   * @param vehicleId  ID del vehículo
   * @param range      Rango de fechas { from?, to? }
   */
  async getVehicleCostDetail(
    companyId: string,
    vehicleId: string,
    range:     DateRange,
  ): Promise<VehicleCostDetail> {
    const { fromDate, toDate } = dateRange(range.from, range.to);

    // ─ P1: datos del vehículo (valida pertenencia al tenant) ──────────────────
    const vehicleP = prisma.vehicle.findFirst({
      where:   { id: vehicleId, companyId, deletedAt: null },
      include: {
        fuelType:    { select: { name: true } },
        vehicleType: { select: { name: true } },
      },
    });

    // ─ P2: agrupación de combustible para el vehículo ──────────────────────
    // Tres métricas clave:
    //   total_cost, total_liters, loads_count
    //   weighted_kml = SUM(km_per_unit * liters) / SUM(liters)  [ponderado por volumen]
    //   km_travelled  = MAX(odometer) - MIN(odometer)
    const fuelAggP = prisma.$queryRawUnsafe<[{
      total_cost:      string;
      total_liters:    string;
      loads_count:     string | number;
      weighted_kml:    string | null;
      odo_max:         string | number | null;
      odo_min:         string | number | null;
    }]>(`
      SELECT
        ROUND(COALESCE(SUM(price_total),   0), 2)         AS total_cost,
        ROUND(COALESCE(SUM(liters_or_kwh), 0), 2)         AS total_liters,
        COUNT(id)                                         AS loads_count,
        ROUND(
          SUM(CASE WHEN km_per_unit IS NOT NULL
                   THEN km_per_unit * liters_or_kwh END)
          / NULLIF(
            SUM(CASE WHEN km_per_unit IS NOT NULL
                     THEN liters_or_kwh END), 0),
        2)                                                AS weighted_kml,
        MAX(odometer)                                     AS odo_max,
        MIN(CASE WHEN odometer > 0 THEN odometer END)     AS odo_min
      FROM fuel_loads
      WHERE vehicle_id = ?
        AND company_id = ?
        AND date BETWEEN ? AND ?
    `, vehicleId, companyId, fromDate, toDate);

    // ─ P3: agrupación de mantenimiento ─────────────────────────────────
    const maintAggP = prisma.$queryRawUnsafe<[{
      total_cost:  string;
      maint_count: string | number;
    }]>(`
      SELECT
        ROUND(COALESCE(SUM(cost), 0), 2) AS total_cost,
        COUNT(id)                        AS maint_count
      FROM maintenance
      WHERE vehicle_id = ?
        AND company_id = ?
        AND date BETWEEN ? AND ?
    `, vehicleId, companyId, fromDate, toDate);

    // ─ P4: tendencia mensual combustible ───────────────────────────────
    const fuelTrendP = prisma.$queryRawUnsafe<Array<{
      month:       string;
      fuel_cost:   string;
      liters:      string;
      loads_count: string | number;
    }>>(`
      SELECT
        DATE_FORMAT(date, '%Y-%m')                     AS month,
        ROUND(COALESCE(SUM(price_total),   0), 2)      AS fuel_cost,
        ROUND(COALESCE(SUM(liters_or_kwh), 0), 2)      AS liters,
        COUNT(*)                                       AS loads_count
      FROM fuel_loads
      WHERE vehicle_id = ?
        AND company_id = ?
        AND date BETWEEN ? AND ?
      GROUP BY DATE_FORMAT(date, '%Y-%m')
      ORDER BY month ASC
    `, vehicleId, companyId, fromDate, toDate);

    // ─ P5: tendencia mensual mantenimiento ─────────────────────────────
    const maintTrendP = prisma.$queryRawUnsafe<Array<{
      month:       string;
      maint_cost:  string;
      maint_count: string | number;
    }>>(`
      SELECT
        DATE_FORMAT(date, '%Y-%m')               AS month,
        ROUND(COALESCE(SUM(cost), 0), 2)         AS maint_cost,
        COUNT(*)                                 AS maint_count
      FROM maintenance
      WHERE vehicle_id = ?
        AND company_id = ?
        AND date BETWEEN ? AND ?
      GROUP BY DATE_FORMAT(date, '%Y-%m')
      ORDER BY month ASC
    `, vehicleId, companyId, fromDate, toDate);

    // ─ P6: desglose mantenimiento por tipo ─────────────────────────────
    const maintTypeP = prisma.$queryRawUnsafe<Array<{
      type:       string;
      count:      string | number;
      total_cost: string;
    }>>(`
      SELECT
        type,
        COUNT(*)                         AS count,
        ROUND(COALESCE(SUM(cost), 0), 2) AS total_cost
      FROM maintenance
      WHERE vehicle_id = ?
        AND company_id = ?
        AND date BETWEEN ? AND ?
      GROUP BY type
      ORDER BY total_cost DESC
    `, vehicleId, companyId, fromDate, toDate);

    // ─ P7: promedios de la flota (sin este vehículo) ──────────────────────
    // Calcula costo/km y km/L promedio del resto de la flota para benchmark.
    // Un único subquery correlacionado: 2 JOINs laterales (fuel + maintenance).
    const fleetAvgP = prisma.$queryRawUnsafe<[{
      fleet_avg_cost_per_km:   string | null;
      fleet_avg_km_per_liter:  string | null;
    }]>(`
      SELECT
        ROUND(AVG(v_cost.cost_per_km), 2)    AS fleet_avg_cost_per_km,
        ROUND(AVG(v_cost.avg_kml),     2)    AS fleet_avg_km_per_liter
      FROM (
        SELECT
          v.id,
          CASE
            WHEN (SUM(fl.price_total) + COALESCE(SUM(m.cost), 0)) > 0
                 AND MAX(fl.odometer) IS NOT NULL
                 AND MAX(fl.odometer) > MIN(fl.odometer)
            THEN ROUND(
                   (SUM(fl.price_total) + COALESCE(SUM(m.cost), 0))
                   / (MAX(fl.odometer) - MIN(fl.odometer)), 2)
            ELSE NULL
          END AS cost_per_km,
          ROUND(
            SUM(CASE WHEN fl.km_per_unit IS NOT NULL
                     THEN fl.km_per_unit * fl.liters_or_kwh END)
            / NULLIF(
              SUM(CASE WHEN fl.km_per_unit IS NOT NULL
                       THEN fl.liters_or_kwh END), 0),
          2) AS avg_kml
        FROM vehicles v
        LEFT JOIN fuel_loads fl
               ON fl.vehicle_id = v.id
              AND fl.date BETWEEN ? AND ?
        LEFT JOIN maintenance m
               ON m.vehicle_id = v.id
              AND m.date BETWEEN ? AND ?
        WHERE v.company_id  = ?
          AND v.id         != ?
          AND v.deleted_at IS NULL
          AND v.active      = 1
        GROUP BY v.id
        HAVING SUM(fl.price_total) > 0 OR SUM(m.cost) > 0
      ) v_cost
    `, fromDate, toDate, fromDate, toDate, companyId, vehicleId);

    // ─ P8 + P9: historial detallado (Prisma ORM, máx 200 registros) ───────
    const loadsP = prisma.fuelLoad.findMany({
      where:   { vehicleId, companyId, date: { gte: fromDate, lte: toDate } },
      include: {
        driver:   { select: { name: true, lastname: true } },
        fuelType: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
      take:    200,
    });

    const maintsP = prisma.maintenance.findMany({
      where:   { vehicleId, companyId, date: { gte: fromDate, lte: toDate } },
      orderBy: { date: 'desc' },
      take:    200,
    });

    // ─ Ejecución paralela ──────────────────────────────────────────────────
    const [
      vehicle,
      [fuelAgg],
      [maintAgg],
      fuelTrendRows,
      maintTrendRows,
      maintTypeRows,
      [fleetAvg],
      loads,
      maints,
    ] = await Promise.all([
      vehicleP, fuelAggP, maintAggP,
      fuelTrendP, maintTrendP, maintTypeP,
      fleetAvgP, loadsP, maintsP,
    ]);

    if (!vehicle) throw new Error('Vehicle not found');

    // ─ Cálculos derivados ────────────────────────────────────────────────────
    const totalFuelCost  = Number(fuelAgg?.total_cost   ?? 0);
    const totalMaintCost = Number(maintAgg?.total_cost  ?? 0);
    const totalCost      = totalFuelCost + totalMaintCost;
    const totalLiters    = Number(fuelAgg?.total_liters ?? 0);
    const loadsCount     = Number(fuelAgg?.loads_count  ?? 0);
    const weightedKml    = fuelAgg?.weighted_kml != null ? Number(fuelAgg.weighted_kml) : null;
    const odoMax         = fuelAgg?.odo_max != null ? Number(fuelAgg.odo_max) : null;
    const odoMin         = fuelAgg?.odo_min != null ? Number(fuelAgg.odo_min) : null;
    const kmTravelled    = (odoMax !== null && odoMin !== null && odoMax > odoMin)
      ? odoMax - odoMin : null;

    const costPerKm      = (totalCost > 0 && kmTravelled !== null && kmTravelled > 0)
      ? Math.round((totalCost / kmTravelled) * 100) / 100 : null;
    const fuelCostPerKm  = (totalFuelCost > 0 && kmTravelled !== null && kmTravelled > 0)
      ? Math.round((totalFuelCost / kmTravelled) * 100) / 100 : null;
    const avgCostPerLiter = (totalFuelCost > 0 && totalLiters > 0)
      ? Math.round((totalFuelCost / totalLiters) * 100) / 100 : null;

    const effRef          = vehicle.efficiencyReference != null
      ? Number(vehicle.efficiencyReference) : null;
    const efficiencyScore = (weightedKml !== null && effRef !== null && effRef > 0)
      ? Math.round((weightedKml / effRef) * 1000) / 10 : null;   // 1 decimal
    const deviationPct    = (weightedKml !== null && effRef !== null && effRef > 0)
      ? Math.round(((weightedKml - effRef) / effRef) * 1000) / 10 : null;

    const fleetCpk = fleetAvg?.fleet_avg_cost_per_km != null
      ? Number(fleetAvg.fleet_avg_cost_per_km) : null;
    const fleetKml = fleetAvg?.fleet_avg_km_per_liter != null
      ? Number(fleetAvg.fleet_avg_km_per_liter) : null;
    const cpkVsFleet = (costPerKm !== null && fleetCpk !== null && fleetCpk > 0)
      ? Math.round(((costPerKm - fleetCpk) / fleetCpk) * 1000) / 10 : null;
    const kmlVsFleet = (weightedKml !== null && fleetKml !== null && fleetKml > 0)
      ? Math.round(((weightedKml - fleetKml) / fleetKml) * 1000) / 10 : null;

    const toISO = (d: Date) => d.toISOString().slice(0, 10);

    return {
      vehicle: {
        id:                  vehicle.id,
        plate:               vehicle.plate,
        name:                vehicle.name ?? vehicle.plate,
        brand:               vehicle.brand               ?? null,
        model:               vehicle.model               ?? null,
        year:                vehicle.year                ?? null,
        color:               vehicle.color               ?? null,
        vin:                 vehicle.vin                 ?? null,
        currentOdometer:     vehicle.currentOdometer,
        efficiencyReference: effRef,
        fuelType:            vehicle.fuelType?.name      ?? null,
        vehicleType:         vehicle.vehicleType?.name   ?? null,
        active:              vehicle.active,
      },
      period: {
        from: toISO(fromDate),
        to:   toISO(toDate),
      },
      total_fuel_cost:        totalFuelCost,
      total_maintenance_cost: totalMaintCost,
      total_cost:             totalCost,
      total_liters:           totalLiters,
      fuel_loads_count:       loadsCount,
      avg_km_per_liter:       weightedKml,
      avg_cost_per_liter:     avgCostPerLiter,
      km_travelled:           kmTravelled,
      cost_per_km:            costPerKm,
      fuel_cost_per_km:       fuelCostPerKm,
      efficiency_score:       efficiencyScore,
      deviation_pct:          deviationPct,
      maintenance_count:      Number(maintAgg?.maint_count ?? 0),
      maintenance_by_type: maintTypeRows.map(r => ({
        type:       r.type,
        count:      Number(r.count),
        total_cost: Number(r.total_cost),
      })),
      monthly_fuel_trend: fuelTrendRows.map(r => ({
        month:       r.month,
        fuel_cost:   Number(r.fuel_cost),
        liters:      Number(r.liters),
        loads_count: Number(r.loads_count),
      })),
      monthly_maint_trend: maintTrendRows.map(r => ({
        month:       r.month,
        maint_cost:  Number(r.maint_cost),
        maint_count: Number(r.maint_count),
      })),
      fleet_avg_cost_per_km:   fleetCpk,
      fleet_avg_km_per_liter:  fleetKml,
      cost_per_km_vs_fleet_pct:   cpkVsFleet,
      km_per_liter_vs_fleet_pct:  kmlVsFleet,
      fuel_loads: loads.map(l => ({
        id:          l.id,
        date:        toISO(l.date),
        liters:      Number(l.litersOrKwh),
        unit_price:  l.unitPrice  != null ? Number(l.unitPrice)  : null,
        price_total: l.priceTotal != null ? Number(l.priceTotal) : null,
        odometer:    l.odometer   ?? null,
        km_per_unit: l.kmPerUnit  != null ? Number(l.kmPerUnit)  : null,
        station:     l.station    ?? null,
        driver_name: l.driver ? `${l.driver.name} ${l.driver.lastname}`.trim() : null,
        fuel_type:   l.fuelType?.name ?? null,
      })),
      maintenances: maints.map(m => ({
        id:                m.id,
        date:              toISO(m.date),
        type:              m.type,
        description:       m.description,
        cost:              m.cost     != null ? Number(m.cost)            : null,
        odometer:          m.odometer ?? null,
        provider:          m.workshopName ?? null,
        next_service_km:   m.nextOdometer   ?? null,
        next_service_date: m.nextDate ? toISO(m.nextDate)   : null,
      })),
    };
  }

  // ── Combined: todos los datos para el dashboard de analítica ───────────────

  async getFullDashboard(companyId: string, range: DateRange, vehicleId?: string) {
    const [
      overview,
      consumption,
      costsByVehicle,
      driverAnomalies,
      maintenancePrediction,
      fuelTrend,
      irregularLoads,
    ] = await Promise.all([
      this.getOverview(companyId, range, vehicleId),
      this.getConsumptionAnalysis(companyId, range, vehicleId),
      this.getCostsByVehicle(companyId, range, vehicleId),
      this.getDriverAnomalies(companyId, range, vehicleId),
      this.getMaintenancePrediction(companyId, vehicleId),
      this.getFuelTrend(companyId, 6, vehicleId),
      this.getIrregularLoads(companyId, range, 1.5, 30, vehicleId),
    ]);

    return {
      overview,
      consumption,
      costsByVehicle,
      driverAnomalies,
      maintenancePrediction,
      fuelTrend,
      irregularLoads,
    };
  }

  // ── Documents Expiring ──────────────────────────────────────────────────────
  async getDocumentsExpiring(companyId: string, days = 30) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today.getTime() + days * 86_400_000);

    interface DocRow {
      id:              string;
      vehicle_id:      string;
      plate:           string;
      brand:           string | null;
      model:           string | null;
      document_type:   string;
      document_number: string | null;
      expiration_date: Date | string;
    }

    const rows = await prisma.$queryRawUnsafe<DocRow[]>(`
      SELECT
        vd.id,
        vd.vehicle_id,
        v.plate,
        v.brand,
        v.model,
        vd.document_type,
        vd.document_number,
        vd.expiration_date
      FROM vehicle_documents vd
      INNER JOIN vehicles v ON v.id = vd.vehicle_id
      WHERE vd.company_id = ?
        AND vd.expiration_date <= ?
      ORDER BY vd.expiration_date ASC
    `, companyId, cutoff);

    return rows.map(r => {
      const expDate      = new Date(r.expiration_date);
      const daysRemaining = Math.floor((expDate.getTime() - today.getTime()) / 86_400_000);
      const status =
        daysRemaining < 0  ? 'expired'  :
        daysRemaining <= 5 ? 'critical' :
        daysRemaining <= 15 ? 'warning' : 'expiring';

      return {
        id:              r.id,
        vehicle_id:      r.vehicle_id,
        plate:           r.plate,
        brand:           r.brand,
        model:           r.model,
        document_type:   r.document_type,
        document_number: r.document_number,
        expiration_date: expDate.toISOString().slice(0, 10),
        days_remaining:  daysRemaining,
        status,
      };
    });
  }
}

export const analyticsService = new AnalyticsService();
