/**
 * analytics_engine/kpi_calculators/maintenance_kpis.ts
 *
 * Maintenance KPI calculators — all pure functions.
 *
 * Exported KPIs:
 *   calculateMaintenanceCost          — total cost, avg per vehicle, breakdown by type
 *   calculateMaintenanceUrgencyFleet  — urgency scores for all vehicles
 *   calculateMaintenanceCompliance    — % vehicles with compliant maintenance schedule
 *   calculateMaintenanceCostTrend     — monthly trend
 */

import type {
  KPIDefinition,
  KPIResult,
  MaintenanceDTO,
  VehicleDTO,
  SettingsDTO,
  MaintenanceUrgency,
  KPIStatus,
} from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

function daysFromNow(date: Date): number {
  return Math.floor((date.getTime() - Date.now()) / MS_PER_DAY);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ─── KPI: Maintenance cost ────────────────────────────────────────────────────

export interface MaintenanceCostInput {
  maintenances: MaintenanceDTO[];
  vehicles: VehicleDTO[];
}

export function calculateMaintenanceCost(
  input: MaintenanceCostInput,
): KPIResult<{ total: number; avgPerVehicle: number | null; byType: Record<string, number>; count: number }> {
  const total = input.maintenances.reduce((s, m) => s + (m.cost ?? 0), 0);

  const byType: Record<string, number> = {};
  for (const m of input.maintenances) {
    const t = m.type || 'sin tipo';
    byType[t] = (byType[t] ?? 0) + (m.cost ?? 0);
  }

  const vehiclesWithMaint = new Set(input.maintenances.map(m => m.vehicleId)).size;
  const avgPerVehicle = vehiclesWithMaint > 0
    ? Math.round((total / vehiclesWithMaint) * 100) / 100
    : null;

  return {
    id:        'maintenance.total_cost',
    label:     'Costo total de mantenimiento',
    value:     { total, avgPerVehicle, byType, count: input.maintenances.length },
    formatted: `$${total.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`,
    unit:      'CLP',
    status:    'info',
    meta:      { vehiclesWithMaint, typeCount: Object.keys(byType).length },
  };
}

// ─── KPI: Urgency score per vehicle ──────────────────────────────────────────

export interface MaintenanceUrgencyInput {
  vehicles: VehicleDTO[];
  maintenances: MaintenanceDTO[];
  settings: SettingsDTO;
}

export function calculateMaintenanceUrgencyFleet(
  input: MaintenanceUrgencyInput,
): KPIResult<MaintenanceUrgency[]> {
  const { alertKmBeforeMaint, alertDaysBeforeMaint } = input.settings;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastMaintByVehicle = new Map<string, MaintenanceDTO>();

  // Find the most recent maintenance per vehicle (for nextDate/nextOdometer signals)
  for (const m of input.maintenances) {
    const cur = lastMaintByVehicle.get(m.vehicleId);
    if (!cur || m.date > cur.date) lastMaintByVehicle.set(m.vehicleId, m);
  }

  const results: MaintenanceUrgency[] = [];

  for (const v of input.vehicles) {
    const last = lastMaintByVehicle.get(v.id);

    let kmRemaining:   number | null = null;
    let daysRemaining: number | null = null;
    let kmSignal    = 0;
    let dateSignal  = 0;

    if (last?.nextOdometer != null) {
      kmRemaining = last.nextOdometer - v.currentOdometer;
      if (kmRemaining <= alertKmBeforeMaint) {
        kmSignal = clamp(
          Math.round((1 - kmRemaining / alertKmBeforeMaint) * 100),
          0, 100,
        );
      }
    }

    if (last?.nextDate != null) {
      daysRemaining = daysFromNow(last.nextDate);
      if (daysRemaining <= alertDaysBeforeMaint) {
        dateSignal = clamp(
          Math.round((1 - daysRemaining / alertDaysBeforeMaint) * 100),
          0, 100,
        );
      }
    }

    const urgencyScore = Math.max(kmSignal, dateSignal);
    const urgencyLevel: 'critical' | 'warning' | 'ok' =
      urgencyScore >= 80 ? 'critical' :
      urgencyScore >= 50 ? 'warning'  : 'ok';

    results.push({
      vehicleId:           v.id,
      plate:               v.plate,
      urgencyScore,
      urgencyLevel,
      kmRemaining,
      daysRemaining,
      nextServiceDate:     last?.nextDate
        ? last.nextDate.toISOString().slice(0, 10)
        : null,
      nextServiceKm:       last?.nextOdometer   ?? null,
      lastMaintenanceDate: last?.date
        ? last.date.toISOString().slice(0, 10)
        : null,
    });
  }

  results.sort((a, b) => b.urgencyScore - a.urgencyScore);

  const critCount = results.filter(r => r.urgencyLevel === 'critical').length;
  const warnCount = results.filter(r => r.urgencyLevel === 'warning').length;

  const status: KPIStatus =
    critCount > 0    ? 'critical' :
    warnCount > 0    ? 'warning'  : 'ok';

  return {
    id:     'maintenance.urgency_fleet',
    label:  'Urgencia de mantenimiento (flota)',
    value:  results,
    unit:   'score',
    status,
    meta:   { critCount, warnCount, okCount: results.length - critCount - warnCount },
  };
}

// ─── KPI: Maintenance compliance ─────────────────────────────────────────────

export interface MaintenanceComplianceInput {
  vehicles: VehicleDTO[];
  maintenances: MaintenanceDTO[];
  settings: SettingsDTO;
}

export function calculateMaintenanceCompliance(
  input: MaintenanceComplianceInput,
): KPIResult<number | null> {
  const activeVehicles = input.vehicles.filter(v => v.active);
  if (activeVehicles.length === 0) {
    return {
      id: 'maintenance.compliance', label: 'Cumplimiento de mantenimiento', value: null,
      unit: '%', status: 'no_data',
    };
  }

  const vehiclesWithMaint = new Set(input.maintenances.map(m => m.vehicleId));
  const compliant = activeVehicles.filter(v => vehiclesWithMaint.has(v.id)).length;
  const pct = Math.round((compliant / activeVehicles.length) * 1000) / 10;

  const status: KPIStatus =
    pct < 50 ? 'critical' :
    pct < 80 ? 'warning'  : 'ok';

  return {
    id:        'maintenance.compliance',
    label:     'Cumplimiento de mantenimiento',
    value:     pct,
    formatted: `${pct.toFixed(1)}%`,
    unit:      '%',
    status,
    meta:      { compliant, total: activeVehicles.length },
  };
}

// ─── KPI: Maintenance monthly trend ──────────────────────────────────────────

export interface MaintenanceTrendPoint {
  month: string;
  totalCost: number;
  count: number;
  avgCost: number | null;
}

export interface MaintenanceTrendInput {
  maintenances: MaintenanceDTO[];
}

export function calculateMaintenanceCostTrend(
  input: MaintenanceTrendInput,
): KPIResult<MaintenanceTrendPoint[]> {
  const byMonth = new Map<string, { cost: number; count: number }>();

  for (const m of input.maintenances) {
    const key = m.date.toISOString().slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, { cost: 0, count: 0 });
    const b = byMonth.get(key)!;
    b.cost  += m.cost ?? 0;
    b.count += 1;
  }

  const points: MaintenanceTrendPoint[] = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => ({
      month,
      totalCost: Math.round(d.cost * 100) / 100,
      count:     d.count,
      avgCost:   d.count > 0 ? Math.round((d.cost / d.count) * 100) / 100 : null,
    }));

  return {
    id:     'maintenance.monthly_trend',
    label:  'Tendencia mensual de mantenimiento',
    value:  points,
    unit:   'CLP',
    status: 'info',
    meta:   { months: points.length },
  };
}

// ─── KPI: Services done ──────────────────────────────────────────────────────

export interface ServicesDoneInput {
  maintenances: MaintenanceDTO[];
}

export interface ServicesDoneRow {
  vehicleId: string;
  count:     number;
}

export interface ServicesDoneResult {
  count:    number;
  byType:   Record<string, number>;
  byStatus: Record<string, number>;
  byVehicle: ServicesDoneRow[];
}

export function calculateServicesDone(
  input: ServicesDoneInput,
): KPIResult<ServicesDoneResult> {
  const done = input.maintenances.filter(
    m => (m.status ?? '').toLowerCase().includes('complet'),
  );

  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const vehicleMap: Record<string, number> = {};

  for (const m of done) {
    const t = m.type || 'sin tipo';
    byType[t] = (byType[t] ?? 0) + 1;

    const s = m.status || 'sin estado';
    byStatus[s] = (byStatus[s] ?? 0) + 1;

    vehicleMap[m.vehicleId] = (vehicleMap[m.vehicleId] ?? 0) + 1;
  }

  const byVehicle: ServicesDoneRow[] = Object.entries(vehicleMap).map(
    ([vehicleId, count]) => ({ vehicleId, count }),
  );

  const status: KPIStatus = done.length === 0 ? 'no_data' : 'ok';

  return {
    id:     'maintenance.services_done',
    label:  'Servicios completados',
    value:  { count: done.length, byType, byStatus, byVehicle },
    unit:   'servicios',
    status,
  };
}

// ─── KPI: Pending maintenance ────────────────────────────────────────────────

export interface PendingMaintenanceInput {
  maintenances: MaintenanceDTO[];
  vehicles:     VehicleDTO[];
}

export interface PendingVehicleRow {
  vehicleId:  string;
  maintenanceId: string;
  type:       string;
  nextDate:   Date | null;
  daysOverdue: number | null;
  status:     string;
}

export interface PendingMaintenanceResult {
  count:        number;
  overdueCount: number;
  perVehicle:   PendingVehicleRow[];
}

export function calculatePendingMaintenance(
  input: PendingMaintenanceInput,
): KPIResult<PendingMaintenanceResult> {
  const now = Date.now();

  const pending = input.maintenances.filter(m => {
    const s = (m.status ?? '').toLowerCase();
    return s.includes('pendiente') || s.includes('programad');
  });

  let overdueCount = 0;
  const perVehicle: PendingVehicleRow[] = pending.map(m => {
    let daysOverdue: number | null = null;
    if (m.nextDate) {
      const diff = Math.floor((now - m.nextDate.getTime()) / MS_PER_DAY);
      if (diff > 0) {
        daysOverdue = diff;
        overdueCount++;
      }
    }
    return {
      vehicleId:     m.vehicleId,
      maintenanceId: m.id,
      type:          m.type || 'sin tipo',
      nextDate:      m.nextDate ?? null,
      daysOverdue,
      status:        m.status ?? '',
    };
  });

  const status: KPIStatus =
    overdueCount > 0 ? 'critical' : pending.length > 0 ? 'warning' : 'ok';

  return {
    id:     'maintenance.pending',
    label:  'Mantenimientos pendientes',
    value:  { count: pending.length, overdueCount, perVehicle },
    unit:   'pendientes',
    status,
  };
}

// ─── KPI: MTBF (Mean Time Between Failures) ──────────────────────────────────

export interface MTBFInput {
  maintenances: MaintenanceDTO[];
  vehicles:     VehicleDTO[];
}

export interface MTBFVehicleRow {
  vehicleId: string;
  plate:     string;
  mtbfDays:  number | null;
  failures:  number;
}

export interface MTBFResult {
  fleetAvgMtbfDays: number | null;
  perVehicle:       MTBFVehicleRow[];
}

export function calculateMTBF(
  input: MTBFInput,
): KPIResult<MTBFResult> {
  const plateMap: Record<string, string> = {};
  for (const v of input.vehicles) plateMap[v.id] = v.plate;

  const correctiveByVehicle: Record<string, Date[]> = {};
  for (const m of input.maintenances) {
    const t = (m.type ?? '').toLowerCase();
    const isCorrectivo = t.includes('correctivo') || t.includes('falla') || t.includes('repair');
    if (!isCorrectivo) continue;
    if (!correctiveByVehicle[m.vehicleId]) correctiveByVehicle[m.vehicleId] = [];
    correctiveByVehicle[m.vehicleId].push(m.date);
  }

  let fleetSum = 0;
  let fleetCount = 0;

  const perVehicle: MTBFVehicleRow[] = Object.entries(correctiveByVehicle).map(
    ([vehicleId, dates]) => {
      const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
      let mtbfDays: number | null = null;
      if (sorted.length >= 2) {
        let totalGap = 0;
        for (let i = 1; i < sorted.length; i++) {
          totalGap += (sorted[i].getTime() - sorted[i - 1].getTime()) / MS_PER_DAY;
        }
        mtbfDays = Math.round((totalGap / (sorted.length - 1)) * 10) / 10;
        fleetSum += mtbfDays;
        fleetCount++;
      }
      return { vehicleId, plate: plateMap[vehicleId] ?? vehicleId, mtbfDays, failures: sorted.length };
    },
  );

  const fleetAvgMtbfDays = fleetCount > 0 ? Math.round((fleetSum / fleetCount) * 10) / 10 : null;

  const status: KPIStatus =
    fleetAvgMtbfDays === null
      ? 'no_data'
      : fleetAvgMtbfDays < 7
      ? 'critical'
      : fleetAvgMtbfDays < 30
      ? 'warning'
      : 'ok';

  return {
    id:     'maintenance.mtbf',
    label:  'MTBF (Tiempo medio entre fallas)',
    value:  { fleetAvgMtbfDays, perVehicle },
    unit:   'días',
    status,
  };
}

// ─── KPI: Maintenance cost per vehicle ───────────────────────────────────────

export interface MaintenanceCostPerVehicleInput {
  maintenances: MaintenanceDTO[];
  vehicles:     VehicleDTO[];
}

export interface CostPerVehicleRow {
  vehicleId:  string;
  plate:      string;
  totalCost:  number;
  count:      number;
  avgCost:    number;
  costShare:  number; // percentage of fleet total
}

export interface CostPerVehicleResult {
  total:      number;
  perVehicle: CostPerVehicleRow[];
}

export function calculateMaintenanceCostPerVehicle(
  input: MaintenanceCostPerVehicleInput,
): KPIResult<CostPerVehicleResult> {
  const plateMap: Record<string, string> = {};
  for (const v of input.vehicles) plateMap[v.id] = v.plate;

  const map: Record<string, { total: number; count: number }> = {};

  for (const m of input.maintenances) {
    if (!map[m.vehicleId]) map[m.vehicleId] = { total: 0, count: 0 };
    map[m.vehicleId].total += m.cost ?? 0;
    map[m.vehicleId].count += 1;
  }

  const fleetTotal = Object.values(map).reduce((s, v) => s + v.total, 0);

  const rows: CostPerVehicleRow[] = Object.entries(map)
    .map(([vehicleId, { total, count }]) => ({
      vehicleId,
      plate:     plateMap[vehicleId] ?? vehicleId,
      totalCost: Math.round(total * 100) / 100,
      count,
      avgCost:   count > 0 ? Math.round((total / count) * 100) / 100 : 0,
      costShare: fleetTotal > 0 ? Math.round((total / fleetTotal) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);

  const status: KPIStatus = rows.length === 0 ? 'no_data' : 'info';

  return {
    id:     'maintenance.cost_per_vehicle',
    label:  'Costo de mantenimiento por vehículo',
    value:  { total: fleetTotal, perVehicle: rows },
    unit:   'CLP',
    status,
  };
}

// ─── KPI: Vehicles in workshop ────────────────────────────────────────────────

export interface VehiclesInWorkshopInput {
  maintenances: MaintenanceDTO[];
  vehicles:     VehicleDTO[];
}

export interface WorkshopVehicleRow {
  vehicleId:    string;
  plate:        string;
  workshopName: string | null;
  entryDate:    Date;
  daysInShop:   number;
}

export interface VehiclesInWorkshopResult {
  count:    number;
  vehicles: WorkshopVehicleRow[];
}

export function calculateVehiclesInWorkshop(
  input: VehiclesInWorkshopInput,
): KPIResult<VehiclesInWorkshopResult> {
  const plateMap: Record<string, string> = {};
  for (const v of input.vehicles) plateMap[v.id] = v.plate;

  // Deduplicate: for each vehicle take the most recent "en taller" maintenance
  const shopMap: Record<string, MaintenanceDTO> = {};
  for (const m of input.maintenances) {
    const s = (m.status ?? '').toLowerCase();
    if (!s.includes('taller') && !s.includes('workshop')) continue;
    const existing = shopMap[m.vehicleId];
    if (!existing || m.date > existing.date) shopMap[m.vehicleId] = m;
  }

  const now = Date.now();
  const vehicles: WorkshopVehicleRow[] = Object.values(shopMap).map(m => ({
    vehicleId:    m.vehicleId,
    plate:        plateMap[m.vehicleId] ?? m.vehicleId,
    workshopName: m.workshopName ?? null,
    entryDate:    m.date,
    daysInShop:   Math.floor((now - m.date.getTime()) / MS_PER_DAY),
  }));

  const status: KPIStatus = vehicles.length === 0 ? 'ok' : vehicles.length > 3 ? 'critical' : 'warning';

  return {
    id:     'maintenance.in_workshop',
    label:  'Vehículos en taller',
    value:  { count: vehicles.length, vehicles },
    unit:   'vehículos',
    status,
  };
}

// ─── KPI Definitions for registry registration ────────────────────────────────

export const maintenanceKPIs: KPIDefinition<unknown, unknown>[] = [
  {
    id:          'maintenance.total_cost',
    name:        'Costo total de mantenimiento',
    description: 'Suma de costos de mantenimiento con desglose por tipo',
    category:    'maintenance',
    unit:        'CLP',
    calculate:   (i) => calculateMaintenanceCost(i as MaintenanceCostInput),
  },
  {
    id:          'maintenance.urgency_fleet',
    name:        'Urgencia de mantenimiento',
    description: 'Score 0-100 de urgencia por vehículo basado en km restantes y fecha estimada',
    category:    'maintenance',
    unit:        'score',
    thresholds:  { warningMin: 50, criticalMin: 80 },
    calculate:   (i) => calculateMaintenanceUrgencyFleet(i as MaintenanceUrgencyInput),
  },
  {
    id:          'maintenance.compliance',
    name:        'Cumplimiento de mantenimiento',
    description: '% de vehículos activos con al menos un mantenimiento en el período',
    category:    'maintenance',
    unit:        '%',
    thresholds:  { warningMin: 50, criticalMin: 30 },
    calculate:   (i) => calculateMaintenanceCompliance(i as MaintenanceComplianceInput),
  },
  {
    id:          'maintenance.monthly_trend',
    name:        'Tendencia mensual de mantenimiento',
    description: 'Evolución mensual del costo y cantidad de mantenimientos',
    category:    'maintenance',
    unit:        'CLP',
    calculate:   (i) => calculateMaintenanceCostTrend(i as MaintenanceTrendInput),
  },
  {
    id:          'maintenance.services_done',
    name:        'Servicios completados',
    description: 'Cantidad de mantenimientos con estado completado en el período',
    category:    'maintenance',
    unit:        'servicios',
    calculate:   (i) => calculateServicesDone(i as ServicesDoneInput),
  },
  {
    id:          'maintenance.pending',
    name:        'Mantenimientos pendientes',
    description: 'Mantenimientos en estado pendiente o programado, con detalle de vencidos',
    category:    'maintenance',
    unit:        'pendientes',
    thresholds:  { warningMin: 1, criticalMin: 5 },
    calculate:   (i) => calculatePendingMaintenance(i as PendingMaintenanceInput),
  },
  {
    id:          'maintenance.mtbf',
    name:        'MTBF',
    description: 'Tiempo medio entre fallas correctivas por vehículo y promedio flota',
    category:    'maintenance',
    unit:        'días',
    thresholds:  { warningMin: 7, criticalMin: 3 },
    calculate:   (i) => calculateMTBF(i as MTBFInput),
  },
  {
    id:          'maintenance.cost_per_vehicle',
    name:        'Costo de mantenimiento por vehículo',
    description: 'Desglose de costos de mantenimiento por vehículo con participación porcentual',
    category:    'maintenance',
    unit:        'CLP',
    calculate:   (i) => calculateMaintenanceCostPerVehicle(i as MaintenanceCostPerVehicleInput),
  },
  {
    id:          'maintenance.in_workshop',
    name:        'Vehículos en taller',
    description: 'Vehículos actualmente en estado "en taller" con días transcurridos',
    category:    'maintenance',
    unit:        'vehículos',
    thresholds:  { warningMin: 1, criticalMin: 4 },
    calculate:   (i) => calculateVehiclesInWorkshop(i as VehiclesInWorkshopInput),
  },
];
