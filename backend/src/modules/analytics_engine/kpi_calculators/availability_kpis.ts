/**
 * analytics_engine/kpi_calculators/availability_kpis.ts
 *
 * Availability KPI calculators — all pure functions.
 *
 * Exported KPIs:
 *   calculateFleetAvailability      — % active vehicles / total
 *   calculateDocumentCompliance     — % documents not expired / not expiring
 *   calculateLicenseCompliance      — % drivers with valid licenses
 *   calculateDocumentsExpiringSoon  — list of expiring documents
 */

import type {
  KPIDefinition,
  KPIResult,
  VehicleDTO,
  DriverDTO,
  VehicleDocumentDTO,
  SettingsDTO,
  KPIStatus,
} from '../types';

const MS_PER_DAY = 86_400_000;

function daysUntil(date: Date): number {
  return Math.floor((date.getTime() - Date.now()) / MS_PER_DAY);
}

// ─── KPI: Fleet availability (active vs total) ────────────────────────────────

export interface FleetAvailabilityInput {
  vehicles: VehicleDTO[];
}

export function calculateFleetAvailability(
  input: FleetAvailabilityInput,
): KPIResult<{ total: number; active: number; inactive: number; availabilityPct: number }> {
  const total    = input.vehicles.length;
  const active   = input.vehicles.filter(v => v.active).length;
  const inactive = total - active;
  const pct      = total > 0 ? Math.round((active / total) * 1000) / 10 : 0;

  const status: KPIStatus =
    pct < 50 ? 'critical' :
    pct < 80 ? 'warning'  : 'ok';

  return {
    id:        'availability.fleet',
    label:     'Disponibilidad de flota',
    value:     { total, active, inactive, availabilityPct: pct },
    formatted: `${pct.toFixed(1)}%`,
    unit:      '%',
    status,
    meta:      { total, active, inactive },
  };
}

// ─── KPI: Vehicle document compliance ────────────────────────────────────────

export interface ExpiringDocument {
  documentId:   string;
  vehicleId:    string;
  plate:        string;
  documentType: string;
  expirationDate: string;
  daysRemaining: number;
  status: 'expired' | 'critical' | 'warning' | 'expiring';
}

export interface DocumentComplianceInput {
  documents: VehicleDocumentDTO[];
  vehicles: VehicleDTO[];
  warnDays?: number;    // default: 30
  critDays?: number;    // default: 5
}

export function calculateDocumentCompliance(
  input: DocumentComplianceInput,
): KPIResult<{ compliancePct: number; expiring: ExpiringDocument[] }> {
  const { warnDays = 30, critDays = 5 } = input;

  const all: ExpiringDocument[] = [];

  for (const doc of input.documents) {
    if (!doc.expirationDate) continue;
    const days = daysUntil(doc.expirationDate);
    const status: ExpiringDocument['status'] =
      days < 0          ? 'expired'  :
      days <= critDays  ? 'critical' :
      days <= warnDays  ? 'warning'  : 'expiring';

    if (days <= warnDays) {
      all.push({
        documentId:     doc.id,
        vehicleId:      doc.vehicleId,
        plate:          doc.plate,
        documentType:   doc.documentType,
        expirationDate: doc.expirationDate.toISOString().slice(0, 10),
        daysRemaining:  days,
        status,
      });
    }
  }

  all.sort((a, b) => a.daysRemaining - b.daysRemaining);

  const total      = input.documents.length;
  const problematic = all.filter(d => d.status !== 'expiring').length;
  const compliancePct = total > 0 ? Math.round(((total - problematic) / total) * 1000) / 10 : 100;

  const status: KPIStatus =
    all.some(d => d.status === 'expired')   ? 'critical' :
    all.some(d => d.status === 'critical')  ? 'critical' :
    all.some(d => d.status === 'warning')   ? 'warning'  : 'ok';

  return {
    id:        'availability.document_compliance',
    label:     'Cumplimiento documental',
    value:     { compliancePct, expiring: all },
    formatted: `${compliancePct.toFixed(1)}%`,
    unit:      '%',
    status,
    meta:      {
      totalDocuments: total,
      expiredCount:  all.filter(d => d.status === 'expired').length,
      criticalCount: all.filter(d => d.status === 'critical').length,
      warningCount:  all.filter(d => d.status === 'warning').length,
    },
  };
}

// ─── KPI: Driver license compliance ──────────────────────────────────────────

export interface LicenseExpiryRow {
  driverId: string;
  driverName: string;
  licenseExpiry: string;
  daysRemaining: number;
  status: 'expired' | 'critical' | 'warning';
}

export interface LicenseComplianceInput {
  drivers: DriverDTO[];
  settings: SettingsDTO;
}

export function calculateLicenseCompliance(
  input: LicenseComplianceInput,
): KPIResult<{ compliancePct: number; expiring: LicenseExpiryRow[] }> {
  const threshold = input.settings.alertDaysBeforeLicense;
  const expiring: LicenseExpiryRow[] = [];

  const activeDrivers = input.drivers.filter(d => d.active);

  for (const d of activeDrivers) {
    if (!d.licenseExpiry) continue;
    const days = daysUntil(d.licenseExpiry);
    if (days > threshold) continue;

    const status: LicenseExpiryRow['status'] =
      days < 0   ? 'expired'  :
      days <= 7  ? 'critical' : 'warning';

    expiring.push({
      driverId:     d.id,
      driverName:   `${d.name} ${d.lastname}`.trim(),
      licenseExpiry: d.licenseExpiry.toISOString().slice(0, 10),
      daysRemaining: days,
      status,
    });
  }

  expiring.sort((a, b) => a.daysRemaining - b.daysRemaining);

  const total         = activeDrivers.filter(d => d.licenseExpiry !== null).length;
  const problematic   = expiring.filter(r => r.status === 'expired').length;
  const compliancePct = total > 0 ? Math.round(((total - problematic) / total) * 1000) / 10 : 100;

  const status: KPIStatus =
    expiring.some(r => r.status === 'expired')  ? 'critical' :
    expiring.some(r => r.status === 'critical') ? 'critical' :
    expiring.length > 0                          ? 'warning'  : 'ok';

  return {
    id:        'availability.license_compliance',
    label:     'Cumplimiento de licencias',
    value:     { compliancePct, expiring },
    formatted: `${compliancePct.toFixed(1)}%`,
    unit:      '%',
    status,
    meta:      { expiredCount: problematic, expiringCount: expiring.length - problematic },
  };
}

// ─── KPI Definitions for registry registration ────────────────────────────────

export const availabilityKPIs: KPIDefinition<unknown, unknown>[] = [
  {
    id:          'availability.fleet',
    name:        'Disponibilidad de flota',
    description: 'Porcentaje de vehículos activos sobre el total registrado',
    category:    'availability',
    unit:        '%',
    thresholds:  { warningMin: 80, criticalMin: 50 },
    calculate:   (i) => calculateFleetAvailability(i as FleetAvailabilityInput),
  },
  {
    id:          'availability.document_compliance',
    name:        'Cumplimiento documental',
    description: 'Documentos vehiculares con estado vigente (seguro, revisión, permiso)',
    category:    'availability',
    unit:        '%',
    thresholds:  { warningMin: 90, criticalMin: 70 },
    calculate:   (i) => calculateDocumentCompliance(i as DocumentComplianceInput),
  },
  {
    id:          'availability.license_compliance',
    name:        'Cumplimiento de licencias',
    description: 'Conductores activos con licencia vigente y no próxima a vencer',
    category:    'availability',
    unit:        '%',
    thresholds:  { warningMin: 95, criticalMin: 80 },
    calculate:   (i) => calculateLicenseCompliance(i as LicenseComplianceInput),
  },
];
