/**
 * AlertEngine · Automatic detection of fleet anomalies
 *
 * Runs all enabled alert algorithms for a company and creates
 * AlertNotification records for newly detected issues.
 *
 * ─── Deduplication ────────────────────────────────────────────
 * A new notification is suppressed when an UNRESOLVED notification
 * of the same (companyId + type + vehicleId/driverId) already exists
 * and was created within the last DEDUP_WINDOW_HOURS hours.
 *
 * ─── 7 Algorithms ─────────────────────────────────────────────
 *
 * #1  fuel_excess          — avg km/unit in window < reference × (1 – threshold%)
 * #2  maintenance_overdue  — nextDate < today  OR  nextOdometer ≤ odometer
 * #3  maintenance_due_date — nextDate within threshold days
 * #4  maintenance_due_km   — (nextOdometer – odometer) ≤ threshold km
 * #5  no_fuel_load         — no load in the last threshold days
 * #6  odometer_mismatch    — |actualKm – loadsKm| / loadsKm > threshold %
 * #7  no_maintenance       — zero maintenance records  OR  last > threshold days ago
 */

import { v4 as uuidv4 } from 'uuid';
import { AlertType, AlertSeverity } from '@prisma/client';
import { prisma } from '../../config/database';
import { AlertConfigService } from './alert-config.service';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotifDraft {
  companyId:  string;
  vehicleId:  string | null;
  driverId:   string | null;
  type:       string;           // AlertType value
  severity:   AlertSeverity;
  message:    string;
  metadata:   Record<string, unknown>;
}

export interface EngineRunResult {
  /** Total active vehicles evaluated */
  vehiclesChecked: number;
  /** New notifications created */
  notificationsCreated: number;
  /** Notifications skipped due to deduplication */
  notificationsDeduplicated: number;
  /** Breakdown by alert type */
  byType: Record<string, { detected: number; created: number }>;
  /** Milliseconds the run took */
  durationMs: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Suppress duplicate notifications within this window */
const DEDUP_WINDOW_HOURS = 23;

const configSvc = new AlertConfigService();

// ─── Engine ──────────────────────────────────────────────────────────────────

export class AlertEngineService {
  /** Run all enabled algorithms for a company. */
  async run(companyId: string): Promise<EngineRunResult> {
    const start = Date.now();
    const drafts: NotifDraft[] = [];

    // Load all active vehicles with relations
    const vehicles = await prisma.vehicle.findMany({
      where:   { companyId, active: true },
      include: {
        fuelLoads:    { orderBy: { date: 'asc' } },
        maintenances: { orderBy: { date: 'asc' } },
      },
    });

    // Load all active drivers
    const drivers = await prisma.driver.findMany({
      where: { companyId, active: true },
    });

    // ── #1  Sobreconsumo de combustible ──────────────────────────────────
    const cfgFuelExcess = await configSvc.getEffective(companyId, AlertType.fuel_excess);
    if (cfgFuelExcess.enabled) {
      const windowMs = (cfgFuelExcess.windowDays ?? 30) * 86_400_000;
      const since    = new Date(Date.now() - windowMs);

      for (const v of vehicles) {
        if (!v.efficiencyReference) continue;              // no reference → skip
        const ref = Number(v.efficiencyReference);

        const loadsInWindow = v.fuelLoads.filter(
          l => l.date >= since && l.kmPerUnit !== null,
        );
        if (loadsInWindow.length < 2) continue;           // need ≥ 2 loads for trend

        const avgKmPerUnit =
          loadsInWindow.reduce((sum, l) => sum + Number(l.kmPerUnit), 0) /
          loadsInWindow.length;

        const lowerBound = ref * (1 - cfgFuelExcess.threshold / 100);

        if (avgKmPerUnit < lowerBound) {
          const pctBelow = ((ref - avgKmPerUnit) / ref) * 100;
          drafts.push({
            companyId,
            vehicleId: v.id,
            driverId:  null,
            type:      AlertType.fuel_excess,
            severity:  pctBelow > 35 ? AlertSeverity.critical : pctBelow > 25 ? AlertSeverity.high : AlertSeverity.medium,
            message:   `Sobreconsumo detectado en ${v.plate ?? v.name}: promedio ${avgKmPerUnit.toFixed(2)} km/L (ref: ${ref} km/L, ${pctBelow.toFixed(1)}% por debajo del umbral).`,
            metadata: {
              avgKmPerUnit:       round2(avgKmPerUnit),
              referenceKmPerUnit: ref,
              lowerBound:         round2(lowerBound),
              thresholdPct:       cfgFuelExcess.threshold,
              pctBelowRef:        round2(pctBelow),
              loadsCount:         loadsInWindow.length,
              windowDays:         cfgFuelExcess.windowDays,
            },
          });
        }
      }
    }

    // ── #2  Mantenimiento vencido ────────────────────────────────────────
    const cfgOverdue = await configSvc.getEffective(companyId, AlertType.maintenance_overdue);
    if (cfgOverdue.enabled) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const v of vehicles) {
        const lastMaint = v.maintenances.at(-1);
        if (!lastMaint) continue;

        const overdueByDate =
          lastMaint.nextDate !== null &&
          lastMaint.nextDate < today;

        const overdueByKm =
          lastMaint.nextOdometer !== null &&
          v.currentOdometer >= lastMaint.nextOdometer;

        if (!overdueByDate && !overdueByKm) continue;

        let daysOverdue = 0;
        if (overdueByDate && lastMaint.nextDate) {
          daysOverdue = Math.floor(
            (today.getTime() - lastMaint.nextDate.getTime()) / 86_400_000,
          );
        }

        const kmOverdue = overdueByKm && lastMaint.nextOdometer
          ? v.currentOdometer - lastMaint.nextOdometer
          : 0;

        drafts.push({
          companyId,
          vehicleId: v.id,
          driverId:  null,
          type:      AlertType.maintenance_overdue,
          severity:  daysOverdue > 30 || kmOverdue > 1000 ? AlertSeverity.critical : AlertSeverity.high,
          message:   `Mantenimiento vencido en ${v.plate ?? v.name}${overdueByDate ? ` — ${daysOverdue}d desde la fecha programada` : ''}${overdueByKm ? ` — ${kmOverdue} km excedidos` : ''}.`,
          metadata: {
            lastMaintenanceDate:  lastMaint.date,
            nextDate:      lastMaint.nextDate,
            nextOdometer:        lastMaint.nextOdometer,
            currentOdometer:      v.currentOdometer,
            daysOverdue,
            kmOverdue,
          },
        });
      }
    }

    // ── #3  Próximo mantenimiento — por fecha ────────────────────────────
    const cfgDueDate = await configSvc.getEffective(companyId, AlertType.maintenance_due_date);
    if (cfgDueDate.enabled) {
      const today      = new Date();
      today.setHours(0, 0, 0, 0);
      const alertLimit = new Date(today.getTime() + cfgDueDate.threshold * 86_400_000);

      for (const v of vehicles) {
        const lastMaint = v.maintenances.at(-1);
        if (!lastMaint?.nextDate) continue;

        const daysRemaining = Math.floor(
          (lastMaint.nextDate.getTime() - today.getTime()) / 86_400_000,
        );

        if (daysRemaining < 0) continue; // already overdue → handled by #2
        if (lastMaint.nextDate > alertLimit) continue;

        drafts.push({
          companyId,
          vehicleId: v.id,
          driverId:  null,
          type:      AlertType.maintenance_due_date,
          severity:  daysRemaining <= 3 ? AlertSeverity.high : AlertSeverity.medium,
          message:   `Mantenimiento próximo para ${v.plate ?? v.name}: programado en ${daysRemaining} día(s) (${fmtDate(lastMaint.nextDate)}).`,
          metadata: {
            nextDate: lastMaint.nextDate,
            daysRemaining,
            threshold: cfgDueDate.threshold,
          },
        });
      }
    }

    // ── #4  Próximo mantenimiento — por km ───────────────────────────────
    const cfgDueKm = await configSvc.getEffective(companyId, AlertType.maintenance_due_km);
    if (cfgDueKm.enabled) {
      for (const v of vehicles) {
        const lastMaint = v.maintenances.at(-1);
        if (!lastMaint?.nextOdometer) continue;

        const kmRemaining = lastMaint.nextOdometer - v.currentOdometer;
        if (kmRemaining < 0) continue; // overdue → handled by #2
        if (kmRemaining > cfgDueKm.threshold) continue;

        drafts.push({
          companyId,
          vehicleId: v.id,
          driverId:  null,
          type:      AlertType.maintenance_due_km,
          severity:  kmRemaining <= 100 ? AlertSeverity.high : AlertSeverity.medium,
          message:   `Mantenimiento próximo para ${v.plate ?? v.name}: quedan ${kmRemaining} km para el próximo servicio (${lastMaint.nextOdometer.toLocaleString()} km programados).`,
          metadata: {
            nextOdometer:   lastMaint.nextOdometer,
            currentOdometer: v.currentOdometer,
            kmRemaining,
            threshold:       cfgDueKm.threshold,
          },
        });
      }
    }

    // ── #5  Vehículo sin carga reciente ──────────────────────────────────
    const cfgNoLoad = await configSvc.getEffective(companyId, AlertType.no_fuel_load);
    if (cfgNoLoad.enabled) {
      const thresholdMs = cfgNoLoad.threshold * 86_400_000;
      const cutoff      = new Date(Date.now() - thresholdMs);

      for (const v of vehicles) {
        const lastLoad = v.fuelLoads.at(-1);
        if (!lastLoad) {
          // Never fueled — also an alert
          const daysSinceCreated = Math.floor(
            (Date.now() - v.createdAt.getTime()) / 86_400_000,
          );
          if (daysSinceCreated < cfgNoLoad.threshold) continue;

          drafts.push({
            companyId,
            vehicleId: v.id,
            driverId:  null,
            type:      AlertType.no_fuel_load,
            severity:  AlertSeverity.medium,
            message:   `Sin cargas registradas para ${v.plate ?? v.name} desde su ingreso al sistema (${daysSinceCreated}d).`,
            metadata: { lastLoadDate: null, daysSinceLoad: daysSinceCreated, threshold: cfgNoLoad.threshold },
          });
          continue;
        }

        if (lastLoad.date >= cutoff) continue;

        const daysSince = Math.floor((Date.now() - lastLoad.date.getTime()) / 86_400_000);
        drafts.push({
          companyId,
          vehicleId: v.id,
          driverId:  null,
          type:      AlertType.no_fuel_load,
          severity:  daysSince > cfgNoLoad.threshold * 2 ? AlertSeverity.high : AlertSeverity.medium,
          message:   `Sin carga de combustible en ${v.plate ?? v.name} hace ${daysSince} días (umbral: ${cfgNoLoad.threshold}d).`,
          metadata: {
            lastLoadDate:  lastLoad.date,
            daysSinceLoad: daysSince,
            threshold:     cfgNoLoad.threshold,
          },
        });
      }
    }

    // ── #6  Diferencia odómetro vs consumo registrado ────────────────────
    /**
     * CÁLCULO:
     *   loadsKm  = suma de diferencias entre lecturas de odómetro consecutivas
     *              de las cargas en el período (solo cargas con odómetro)
     *   actualKm = odómetro actual − odómetro de la primera carga del período
     *   discrepancy (%) = |actualKm − loadsKm| / loadsKm × 100
     *
     * Ejemplo:
     *   Cargas en 60d con odómetros: [50000, 50850, 51700, 52600]
     *   loadsKm  = (50850-50000) + (51700-50850) + (52600-51700) = 2600 km
     *   actualKm = odomCurrent (53200) − 50000 = 3200 km
     *   Δ = |3200 − 2600| / 2600 = 23.1% → ALERTA (umbral 15%)
     */
    const cfgOdo = await configSvc.getEffective(companyId, AlertType.odometer_mismatch);
    if (cfgOdo.enabled) {
      const windowMs = (cfgOdo.windowDays ?? 60) * 86_400_000;
      const since    = new Date(Date.now() - windowMs);

      for (const v of vehicles) {
        const loadsWithOdo = v.fuelLoads
          .filter(l => l.date >= since && l.odometer !== null)
          .sort((a, b) => a.date.getTime() - b.date.getTime());

        if (loadsWithOdo.length < 3) continue; // not enough data points

        const firstOdo = loadsWithOdo[0].odometer as number;
        let loadsKm    = 0;
        for (let i = 1; i < loadsWithOdo.length; i++) {
          const diff = (loadsWithOdo[i].odometer as number) - (loadsWithOdo[i - 1].odometer as number);
          if (diff > 0) loadsKm += diff; // ignore negative diffs (data entry errors)
        }

        if (loadsKm === 0) continue;

        const actualKm     = v.currentOdometer - firstOdo;
        if (actualKm <= 0) continue;

        const discrepancyPct = (Math.abs(actualKm - loadsKm) / loadsKm) * 100;

        if (discrepancyPct <= cfgOdo.threshold) continue;

        drafts.push({
          companyId,
          vehicleId: v.id,
          driverId:  null,
          type:      AlertType.odometer_mismatch,
          severity:  discrepancyPct > 40 ? AlertSeverity.critical : discrepancyPct > 25 ? AlertSeverity.high : AlertSeverity.medium,
          message:   `Discrepancia odómetro en ${v.plate ?? v.name}: ${discrepancyPct.toFixed(1)}% de diferencia entre km registrados en cargas (${loadsKm.toLocaleString()} km) y km del odómetro (${actualKm.toLocaleString()} km).`,
          metadata: {
            loadsKm,
            actualKm,
            discrepancyPct:  round2(discrepancyPct),
            firstOdometer:   firstOdo,
            currentOdometer: v.currentOdometer,
            loadsCount:      loadsWithOdo.length,
            windowDays:      cfgOdo.windowDays,
            threshold:       cfgOdo.threshold,
          },
        });
      }
    }

    // ── #7  Vehículo sin mantenimiento ───────────────────────────────────
    const cfgNoMaint = await configSvc.getEffective(companyId, AlertType.no_maintenance);
    if (cfgNoMaint.enabled) {
      const thresholdMs = cfgNoMaint.threshold * 86_400_000;

      for (const v of vehicles) {
        if (v.maintenances.length === 0) {
          const daysSinceCreated = Math.floor(
            (Date.now() - v.createdAt.getTime()) / 86_400_000,
          );
          if (daysSinceCreated < cfgNoMaint.threshold) continue;

          drafts.push({
            companyId,
            vehicleId: v.id,
            driverId:  null,
            type:      AlertType.no_maintenance,
            severity:  AlertSeverity.medium,
            message:   `${v.plate ?? v.name} no tiene ningún registro de mantenimiento (ingresado hace ${daysSinceCreated}d).`,
            metadata: {
              maintenanceCount:  0,
              daysSinceCreated,
              threshold:         cfgNoMaint.threshold,
            },
          });
          continue;
        }

        const lastMaint     = v.maintenances.at(-1)!;
        const daysSinceLast = Math.floor(
          (Date.now() - lastMaint.date.getTime()) / 86_400_000,
        );
        if (daysSinceLast <= cfgNoMaint.threshold) continue;

        drafts.push({
          companyId,
          vehicleId: v.id,
          driverId:  null,
          type:      AlertType.no_maintenance,
          severity:  daysSinceLast > cfgNoMaint.threshold * 1.5 ? AlertSeverity.high : AlertSeverity.medium,
          message:   `${v.plate ?? v.name} sin mantenimiento hace ${daysSinceLast} días (último: ${fmtDate(lastMaint.date)}).`,
          metadata: {
            lastMaintenanceDate: lastMaint.date,
            maintenanceCount:    v.maintenances.length,
            daysSinceLast,
            threshold:           cfgNoMaint.threshold,
          },
        });
      }
    }

    // ── License expiry (bonus — drivers) ────────────────────────────────
    const cfgLicense = await configSvc.getEffective(companyId, AlertType.license_expiry);
    if (cfgLicense.enabled) {
      const today      = new Date();
      const alertLimit = new Date(today.getTime() + cfgLicense.threshold * 86_400_000);

      for (const d of drivers) {
        if (!d.licenseExpiry) continue;
        if (d.licenseExpiry > alertLimit) continue;

        const daysRemaining = Math.floor(
          (d.licenseExpiry.getTime() - today.getTime()) / 86_400_000,
        );
        const expired = daysRemaining < 0;

        drafts.push({
          companyId,
          vehicleId: null,
          driverId:  d.id,
          type:      AlertType.license_expiry,
          severity:  expired ? AlertSeverity.critical : daysRemaining <= 7 ? AlertSeverity.high : AlertSeverity.medium,
          message:   expired
            ? `Licencia de ${d.name} ${d.lastname} VENCIDA hace ${Math.abs(daysRemaining)} días.`
            : `Licencia de ${d.name} ${d.lastname} vence en ${daysRemaining} días (${fmtDate(d.licenseExpiry)}).`,
          metadata: {
            licenseExpiry:  d.licenseExpiry,
            daysRemaining,
            expired,
            threshold:      cfgLicense.threshold,
          },
        });
      }
    }

    // ── Deduplication + Persist ──────────────────────────────────────────
    const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_HOURS * 3_600_000);

    const existingKeys = await prisma.alertNotification.findMany({
      where: {
        companyId,
        resolvedAt: null,
        createdAt:  { gte: dedupCutoff },
      },
      select: { type: true, vehicleId: true, driverId: true },
    });

    const existingSet = new Set(
      existingKeys.map(r => dedupKey(r.type, r.vehicleId, r.driverId)),
    );

    const toInsert: NotifDraft[] = [];
    let deduplicated = 0;
    const byType: Record<string, { detected: number; created: number }> = {};

    for (const draft of drafts) {
      const t = draft.type;
      if (!byType[t]) byType[t] = { detected: 0, created: 0 };
      byType[t].detected++;

      const key = dedupKey(draft.type, draft.vehicleId, draft.driverId);
      if (existingSet.has(key)) {
        deduplicated++;
        continue;
      }

      toInsert.push(draft);
      existingSet.add(key); // prevent intra-batch duplicates
      byType[t].created++;
    }

    if (toInsert.length > 0) {
      await prisma.alertNotification.createMany({
        data: toInsert.map(d => ({
          id:         uuidv4(),
          companyId:  d.companyId,
          vehicleId:  d.vehicleId,
          driverId:   d.driverId,
          type:       d.type,
          severity:   d.severity,
          message:    d.message,
          metadata:   d.metadata as object,
        })),
      });
    }

    return {
      vehiclesChecked:           vehicles.length,
      notificationsCreated:      toInsert.length,
      notificationsDeduplicated: deduplicated,
      byType,
      durationMs: Date.now() - start,
    };
  }

  /**
   * Resolve (dismiss) a notification — marks it as no longer active.
   * Different from "read" — resolving means the issue is acknowledged/fixed.
   */
  async resolve(id: string, companyId: string) {
    const notif = await prisma.alertNotification.findFirst({ where: { id, companyId } });
    if (!notif) throw new Error('Notificación no encontrada');
    return prisma.alertNotification.update({
      where: { id },
      data:  { resolvedAt: new Date() },
    });
  }

  /**
   * Get aggregated dashboard summary — unread counts by severity + type.
   */
  async getDashboardSummary(companyId: string) {
    const [bySeverity, byType, total] = await Promise.all([
      prisma.alertNotification.groupBy({
        by:     ['severity'],
        where:  { companyId, resolvedAt: null },
        _count: { id: true },
      }),
      prisma.alertNotification.groupBy({
        by:     ['type'],
        where:  { companyId, resolvedAt: null },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.alertNotification.count({
        where: { companyId, resolvedAt: null },
      }),
    ]);

    return {
      total,
      unread: await prisma.alertNotification.count({ where: { companyId, resolvedAt: null, readAt: null } }),
      bySeverity: Object.fromEntries(
        bySeverity.map(r => [r.severity, r._count.id]),
      ),
      byType: Object.fromEntries(
        byType.map(r => [r.type, r._count.id]),
      ),
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dedupKey(type: string, vehicleId: string | null, driverId: string | null): string {
  return `${type}::${vehicleId ?? '-'}::${driverId ?? '-'}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmtDate(d: Date): string {
  return d.toISOString().split('T')[0];
}
