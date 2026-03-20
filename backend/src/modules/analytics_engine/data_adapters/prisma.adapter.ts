/**
 * analytics_engine/data_adapters/prisma.adapter.ts
 *
 * Prisma Data Adapter — fetches raw Prisma records and converts them
 * into plain DTOs that calculator functions can consume.
 *
 * Design principles:
 *  - This is the ONLY layer that touches Prisma
 *  - All methods return arrays of plain DTOs (no Prisma types exported)
 *  - Calculators NEVER call this directly — they receive DTOs via their input parameter
 *  - Aggregators call adapters to compose FleetKPIInput bundles
 */

import { PrismaClient } from '@prisma/client';
import type {
  DateRange,
  DriverDTO,
  FleetKPIInput,
  FuelLoadDTO,
  MaintenanceDTO,
  SettingsDTO,
  VehicleDTO,
  VehicleDocumentDTO,
} from '../types';

const prisma = new PrismaClient();

// ─── Individual adapters ──────────────────────────────────────────────────────

export async function fetchVehicles(companyId: string): Promise<VehicleDTO[]> {
  const rows = await prisma.vehicle.findMany({
    where: { companyId, deletedAt: null },
    include: {
      fuelType:    { select: { name: true } },
      vehicleType: { select: { name: true } },
    },
  });

  return rows.map(v => ({
    id:                  v.id,
    plate:               v.plate,
    name:                v.name ?? v.plate,
    brand:               v.brand               ?? null,
    model:               v.model               ?? null,
    year:                v.year                ?? null,
    currentOdometer:     v.currentOdometer,
    efficiencyReference: v.efficiencyReference !== null
      ? Number(v.efficiencyReference)
      : null,
    fuelType:    v.fuelType?.name    ?? null,
    vehicleType: v.vehicleType?.name ?? null,
    active:      v.active,
  }));
}

export async function fetchFuelLoads(
  companyId: string,
  range: DateRange,
): Promise<FuelLoadDTO[]> {
  const rows = await prisma.fuelLoad.findMany({
    where: {
      companyId,
      date: { gte: range.from, lte: range.to },
    },
    orderBy: { date: 'asc' },
  });

  return rows.map(r => ({
    id:          r.id,
    vehicleId:   r.vehicleId,
    driverId:    r.driverId   ?? null,
    date:        r.date,
    litersOrKwh: Number(r.litersOrKwh),
    unitPrice:   r.unitPrice  !== null ? Number(r.unitPrice)  : null,
    priceTotal:  r.priceTotal !== null ? Number(r.priceTotal) : null,
    odometer:    r.odometer   ?? null,
    kmPerUnit:   r.kmPerUnit  !== null ? Number(r.kmPerUnit)  : null,
    station:     r.station    ?? null,
  }));
}

export async function fetchMaintenances(
  companyId: string,
  range: DateRange,
): Promise<MaintenanceDTO[]> {
  const rows = await prisma.maintenance.findMany({
    where: {
      companyId,
      date: { gte: range.from, lte: range.to },
    },
    orderBy: { date: 'asc' },
  });

  return rows.map(r => ({
    id:           r.id,
    vehicleId:    r.vehicleId,
    date:         r.date,
    type:         r.type,
    status:       r.status,
    description:  r.description ?? null,
    cost:         r.cost        !== null ? Number(r.cost) : null,
    odometer:     r.odometer    ?? null,
    nextOdometer: r.nextOdometer ?? null,
    nextDate:     r.nextDate    ?? null,
    workshopName: r.workshopName ?? null,
  }));
}

export async function fetchDrivers(companyId: string): Promise<DriverDTO[]> {
  const rows = await prisma.driver.findMany({
    where: { companyId, deletedAt: null },
  });

  return rows.map(d => ({
    id:              d.id,
    name:            d.name,
    lastname:        d.lastname,
    document:        d.document        ?? null,
    licenseCategory: d.licenseCategory ?? null,
    licenseExpiry:   d.licenseExpiry   ?? null,
    active:          d.active,
  }));
}

export async function fetchVehicleDocuments(
  companyId: string,
): Promise<VehicleDocumentDTO[]> {
  const rows = await prisma.vehicleDocument.findMany({
    where: { companyId },
    include: { vehicle: { select: { plate: true } } },
  });

  return rows.map(r => ({
    id:             r.id,
    vehicleId:      r.vehicleId,
    plate:          r.vehicle.plate,
    documentType:   r.documentType,
    documentNumber: r.documentNumber ?? null,
    expirationDate: r.expirationDate ?? null,
  }));
}

export async function fetchSettings(companyId: string): Promise<SettingsDTO> {
  const s = await prisma.settings.findUnique({ where: { companyId } });

  return {
    fuelPrice:              s?.fuelPrice         !== undefined && s.fuelPrice !== null
      ? Number(s.fuelPrice) : null,
    electricityPrice:       s?.electricityPrice  !== undefined && s.electricityPrice !== null
      ? Number(s.electricityPrice) : null,
    alertFuelExcessPct:     Number(s?.alertFuelExcessPct     ?? 20),
    alertDaysBeforeLicense: Number(s?.alertDaysBeforeLicense ?? 30),
    alertDaysBeforeMaint:   Number(s?.alertDaysBeforeMaint   ?? 15),
    alertKmBeforeMaint:     Number(s?.alertKmBeforeMaint     ?? 500),
    alertNoLoadDays:        Number(s?.alertNoLoadDays         ?? 7),
  };
}

// ─── Composite adapter — builds the full FleetKPIInput bundle ─────────────────

/**
 * Fetches all data required for fleet-level KPI calculations in a single call.
 * All queries run in parallel via Promise.all.
 *
 * This is the primary entry point for aggregators.
 */
export async function fetchFleetKPIInput(
  companyId: string,
  range: DateRange,
): Promise<FleetKPIInput> {
  const [vehicles, fuelLoads, maintenances, drivers, documents, settings] =
    await Promise.all([
      fetchVehicles(companyId),
      fetchFuelLoads(companyId, range),
      fetchMaintenances(companyId, range),
      fetchDrivers(companyId),
      fetchVehicleDocuments(companyId),
      fetchSettings(companyId),
    ]);

  return { vehicles, fuelLoads, maintenances, drivers, documents, settings, range };
}
