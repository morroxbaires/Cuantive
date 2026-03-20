/**
 * analytics_engine/alert_engine/kpi_alert.engine.ts
 *
 * KPI-Driven Alert Engine — generates Alert objects from KPI results.
 *
 * This layer sits ON TOP of the existing alert-engine.service.ts (which is
 * left untouched). It enriches alerts by deriving them from pre-calculated
 * KPI results, allowing new alert types based on composite KPIs.
 *
 * Current alert generators:
 *   fromFuelEfficiency       — vehicle below threshold → fuel_excess alert signal
 *   fromMaintenanceUrgency   — critical urgency → maintenance alert signal
 *   fromDocumentCompliance   — expiring docs → vehicle_document_expiry alert signal
 *   fromLicenseCompliance    — expiring licenses → license_expiry alert signal
 *   fromFleetHealthScore     — global score below threshold → custom alert signal
 *
 * Outputs: KPIAlertSignal[] — NOT persisted here.
 *   Persistence is the caller's responsibility (keeps this layer pure).
 */

import type {
  FleetKPIInput,
  FuelEfficiencyBreakdown,
  MaintenanceUrgency,
  KPIStatus,
} from '../types';

import { calculateFuelEfficiency }            from '../kpi_calculators/fuel_kpis';
import { calculateMaintenanceUrgencyFleet }   from '../kpi_calculators/maintenance_kpis';
import { calculateDocumentCompliance }        from '../kpi_calculators/availability_kpis';
import { calculateLicenseCompliance }         from '../kpi_calculators/availability_kpis';
import { aggregateFleetHealth }               from '../aggregators/fleet_health.aggregator';

// ─── Types ───────────────────────────────────────────────────────────────────

export type KPIAlertType =
  | 'kpi_fuel_efficiency'
  | 'kpi_maintenance_urgency'
  | 'kpi_document_expiry'
  | 'kpi_license_expiry'
  | 'kpi_fleet_health'
  | 'kpi_custom';

export type KPIAlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface KPIAlertSignal {
  type:       KPIAlertType;
  severity:   KPIAlertSeverity;
  vehicleId?: string;
  driverId?:  string;
  title:      string;
  detail:     string;
  meta:       Record<string, unknown>;
  /** KPI id that generated this signal */
  sourceKPI:  string;
  generatedAt: Date;
}

// ─── Severity mapper ─────────────────────────────────────────────────────────

function kpiStatusToSeverity(status: KPIStatus, deviation?: number): KPIAlertSeverity {
  if (status === 'critical') return 'critical';
  if (status === 'warning')  return 'high';
  if (Math.abs(deviation ?? 0) > 30) return 'high';
  return 'medium';
}

// ─── Fuel efficiency alert signals ───────────────────────────────────────────

export function fromFuelEfficiency(input: FleetKPIInput): KPIAlertSignal[] {
  const result = calculateFuelEfficiency({
    vehicles:            input.vehicles,
    fuelLoads:           input.fuelLoads,
    anomalyThresholdPct: input.settings.alertFuelExcessPct,
  });

  const anomalies = (result.value as FuelEfficiencyBreakdown[]).filter(r => r.isAnomaly);

  return anomalies.map(a => ({
    type:        'kpi_fuel_efficiency' as const,
    severity:    kpiStatusToSeverity(result.status, a.deviationPct ?? undefined),
    vehicleId:   a.vehicleId,
    title:       `Sobreconsumo detectado — ${a.plate}`,
    detail:      `Rendimiento real ${a.avgKmPerUnit?.toFixed(2)} km/L vs referencia ${a.efficiencyReference} km/L (${a.deviationPct?.toFixed(1)}% desvío)`,
    meta: {
      plate:               a.plate,
      avgKmPerUnit:        a.avgKmPerUnit,
      efficiencyReference: a.efficiencyReference,
      deviationPct:        a.deviationPct,
      totalLiters:         a.totalLiters,
    },
    sourceKPI:   'fuel.efficiency_per_vehicle',
    generatedAt: new Date(),
  }));
}

// ─── Maintenance urgency alert signals ───────────────────────────────────────

export function fromMaintenanceUrgency(input: FleetKPIInput): KPIAlertSignal[] {
  const result = calculateMaintenanceUrgencyFleet({
    vehicles:     input.vehicles,
    maintenances: input.maintenances,
    settings:     input.settings,
  });

  const urgentItems = (result.value as MaintenanceUrgency[])
    .filter(u => u.urgencyLevel !== 'ok');

  return urgentItems.map(u => ({
    type:        'kpi_maintenance_urgency' as const,
    severity:    u.urgencyLevel === 'critical' ? 'critical' : 'high',
    vehicleId:   u.vehicleId,
    title:       `Mantenimiento ${u.urgencyLevel === 'critical' ? 'vencido/crítico' : 'próximo'} — ${u.plate}`,
    detail:      [
      u.kmRemaining !== null
        ? `${u.kmRemaining > 0 ? `${u.kmRemaining} km restantes` : `${Math.abs(u.kmRemaining)} km vencido`}`
        : null,
      u.daysRemaining !== null
        ? `${u.daysRemaining > 0 ? `${u.daysRemaining} días restantes` : `${Math.abs(u.daysRemaining)} días vencido`}`
        : null,
    ].filter(Boolean).join(' | ') || 'Sin datos de próximo servicio',
    meta: {
      plate:           u.plate,
      urgencyScore:    u.urgencyScore,
      kmRemaining:     u.kmRemaining,
      daysRemaining:   u.daysRemaining,
      nextServiceDate: u.nextServiceDate,
      nextServiceKm:   u.nextServiceKm,
    },
    sourceKPI:   'maintenance.urgency_fleet',
    generatedAt: new Date(),
  }));
}

// ─── Document expiry alert signals ───────────────────────────────────────────

export function fromDocumentCompliance(input: FleetKPIInput): KPIAlertSignal[] {
  const result = calculateDocumentCompliance({
    documents: input.documents,
    vehicles:  input.vehicles,
    warnDays:  30,
    critDays:  5,
  });

  const expiring = (result.value as { expiring: Array<{
    documentId: string;
    vehicleId: string;
    plate: string;
    documentType: string;
    expirationDate: string;
    daysRemaining: number;
    status: string;
  }> }).expiring;

  return expiring.map(doc => ({
    type:        'kpi_document_expiry' as const,
    severity:    doc.status === 'expired' || doc.status === 'critical' ? 'critical' : 'high',
    vehicleId:   doc.vehicleId,
    title:       `Documento ${doc.status === 'expired' ? 'vencido' : 'por vencer'} — ${doc.plate}`,
    detail:      `${doc.documentType}: ${doc.status === 'expired' ? `vencido hace ${Math.abs(doc.daysRemaining)} días` : `vence en ${doc.daysRemaining} días (${doc.expirationDate})`}`,
    meta: {
      plate:          doc.plate,
      documentType:   doc.documentType,
      expirationDate: doc.expirationDate,
      daysRemaining:  doc.daysRemaining,
      docStatus:      doc.status,
    },
    sourceKPI:   'availability.document_compliance',
    generatedAt: new Date(),
  }));
}

// ─── License expiry alert signals ────────────────────────────────────────────

export function fromLicenseCompliance(input: FleetKPIInput): KPIAlertSignal[] {
  const result = calculateLicenseCompliance({
    drivers:  input.drivers,
    settings: input.settings,
  });

  const expiring = (result.value as { expiring: Array<{
    driverId: string;
    driverName: string;
    licenseExpiry: string;
    daysRemaining: number;
    status: string;
  }> }).expiring;

  return expiring.map(lic => ({
    type:        'kpi_license_expiry' as const,
    severity:    lic.status === 'expired' ? 'critical' : 'high',
    driverId:    lic.driverId,
    title:       `Licencia ${lic.status === 'expired' ? 'vencida' : 'por vencer'} — ${lic.driverName}`,
    detail:      lic.status === 'expired'
      ? `Licencia vencida hace ${Math.abs(lic.daysRemaining)} días`
      : `Vence en ${lic.daysRemaining} días (${lic.licenseExpiry})`,
    meta: {
      driverName:    lic.driverName,
      licenseExpiry: lic.licenseExpiry,
      daysRemaining: lic.daysRemaining,
    },
    sourceKPI:   'availability.license_compliance',
    generatedAt: new Date(),
  }));
}

// ─── Fleet health alert signal ────────────────────────────────────────────────

export function fromFleetHealthScore(
  input: FleetKPIInput,
  criticalThreshold = 50,
  warningThreshold  = 70,
): KPIAlertSignal[] {
  const result = aggregateFleetHealth(input);
  const health = result.value as { score: number; grade: string; status: string };

  if (health.score >= warningThreshold) return [];

  return [{
    type:        'kpi_fleet_health' as const,
    severity:    health.score < criticalThreshold ? 'critical' : 'high',
    title:       `Fleet Health Score bajo — ${health.score}/100 (${health.grade})`,
    detail:      `El score de salud de la flota está por debajo del umbral de ${health.score < criticalThreshold ? 'alerta crítica' : 'advertencia'}`,
    meta:        { score: health.score, grade: health.grade },
    sourceKPI:   'aggregator.fleet_health',
    generatedAt: new Date(),
  }];
}

// ─── Composite: run all KPI alert generators ─────────────────────────────────

export interface KPIAlertEngineResult {
  signals:       KPIAlertSignal[];
  byType:        Record<string, number>;
  bySeverity:    Record<string, number>;
  totalSignals:  number;
  generatedAt:   Date;
}

export function runKPIAlertEngine(input: FleetKPIInput): KPIAlertEngineResult {
  const generators = [
    fromFuelEfficiency,
    fromMaintenanceUrgency,
    fromDocumentCompliance,
    fromLicenseCompliance,
    (i: FleetKPIInput) => fromFleetHealthScore(i),
  ];

  const signals: KPIAlertSignal[] = [];

  for (const gen of generators) {
    try {
      signals.push(...gen(input));
    } catch {
      // Isolate individual generator failures
    }
  }

  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};

  for (const s of signals) {
    byType[s.type]         = (byType[s.type]         ?? 0) + 1;
    bySeverity[s.severity] = (bySeverity[s.severity] ?? 0) + 1;
  }

  return {
    signals,
    byType,
    bySeverity,
    totalSignals: signals.length,
    generatedAt:  new Date(),
  };
}
