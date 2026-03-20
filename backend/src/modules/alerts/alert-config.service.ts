/**
 * AlertConfig · Per-company alert type configuration
 *
 * Each company has one row per AlertType that stores:
 *   - enabled:       whether automatic detection runs for this type
 *   - threshold:     numeric trigger value (varies per type)
 *   - thresholdUnit: human-readable unit for the threshold
 *   - windowDays:    lookback period in days (where applicable)
 *
 * Default thresholds (conservative production-safe values):
 * ┌───────────────────────┬──────────┬─────────────┬────────────┐
 * │ alertType             │ threshold│ unit        │ windowDays │
 * ├───────────────────────┼──────────┼─────────────┼────────────┤
 * │ fuel_excess           │     20   │ %           │     30     │
 * │ maintenance_overdue   │      0   │ days        │    null    │
 * │ maintenance_due_date  │     15   │ days        │    null    │
 * │ maintenance_due_km    │    500   │ km          │    null    │
 * │ no_fuel_load          │      7   │ days        │    null    │
 * │ odometer_mismatch     │     15   │ %           │     60     │
 * │ no_maintenance        │     90   │ days        │    null    │
 * │ license_expiry        │     30   │ days        │    null    │
 * └───────────────────────┴──────────┴─────────────┴────────────┘
 */

import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { AlertConfig } from '@prisma/client';
import { AlertType } from '@prisma/client';
import { prisma } from '../../config/database';

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const upsertConfigSchema = z.object({
  alertType:     z.nativeEnum(AlertType),
  enabled:       z.boolean().optional(),
  threshold:     z.number().min(0).optional(),
  thresholdUnit: z.string().max(30).optional(),
  windowDays:    z.number().int().min(1).max(365).optional(),
});

export const bulkUpsertSchema = z.array(upsertConfigSchema).min(1).max(20);

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const ALERT_DEFAULTS: Record<
  string,
  { enabled: boolean; threshold: number | null; thresholdUnit: string | null; windowDays: number | null }
> = {
  fuel_excess:            { enabled: true,  threshold: 20,   thresholdUnit: '%',    windowDays: 30 },
  maintenance_overdue:    { enabled: true,  threshold: 0,    thresholdUnit: 'days', windowDays: null },
  maintenance_due_date:   { enabled: true,  threshold: 15,   thresholdUnit: 'days', windowDays: null },
  maintenance_due_km:     { enabled: true,  threshold: 500,  thresholdUnit: 'km',   windowDays: null },
  no_fuel_load:           { enabled: true,  threshold: 7,    thresholdUnit: 'days', windowDays: null },
  odometer_mismatch:      { enabled: true,  threshold: 15,   thresholdUnit: '%',    windowDays: 60  },
  no_maintenance:         { enabled: true,  threshold: 90,   thresholdUnit: 'days', windowDays: null },
  license_expiry:         { enabled: true,  threshold: 30,   thresholdUnit: 'days', windowDays: null },
  vehicle_document_expiry:{ enabled: false, threshold: 30,   thresholdUnit: 'days', windowDays: null },
  custom:                 { enabled: false, threshold: null,  thresholdUnit: null,   windowDays: null },
};

// ─── Service ──────────────────────────────────────────────────────────────────

export class AlertConfigService {
  /**
   * Return configs for all alert types for a company.
   * If a config row doesn't exist yet, the default is returned in-memory
   * (not persisted — call initDefaults to persist them).
   */
  async getAll(companyId: string) {
    const rows = await prisma.alertConfig.findMany({
      where: { companyId },
      orderBy: { alertType: 'asc' },
    });

    // Merge with defaults so every type is always represented
    const rowMap = Object.fromEntries(rows.map((r: AlertConfig) => [r.alertType as string, r]));

    return Object.values(AlertType)
      .filter(t => t !== 'custom')
      .map(alertType => {
        const key = alertType as string;
        if (rowMap[key]) return rowMap[key];
        const def = ALERT_DEFAULTS[key] ?? ALERT_DEFAULTS.custom;
        return {
          id:            null,
          companyId,
          alertType,
          enabled:       def.enabled,
          threshold:     def.threshold,
          thresholdUnit: def.thresholdUnit,
          windowDays:    def.windowDays,
          createdAt:     null,
          updatedAt:     null,
          _default:      true,   // not yet persisted
        };
      });
  }

  /**
   * Create or update a single alert type config.
   */
  async upsert(companyId: string, data: z.infer<typeof upsertConfigSchema>) {
    const def = ALERT_DEFAULTS[data.alertType as string] ?? ALERT_DEFAULTS.custom;

    return prisma.alertConfig.upsert({
      where:  { companyId_alertType: { companyId, alertType: data.alertType } },
      create: {
        id:            uuidv4(),
        companyId,
        alertType:     data.alertType,
        enabled:       data.enabled   ?? def.enabled,
        threshold:     data.threshold ?? def.threshold,
        thresholdUnit: data.thresholdUnit ?? def.thresholdUnit,
        windowDays:    data.windowDays    ?? def.windowDays,
      },
      update: {
        ...(data.enabled       !== undefined && { enabled:       data.enabled }),
        ...(data.threshold     !== undefined && { threshold:     data.threshold }),
        ...(data.thresholdUnit !== undefined && { thresholdUnit: data.thresholdUnit }),
        ...(data.windowDays    !== undefined && { windowDays:    data.windowDays }),
      },
    });
  }

  /**
   * Bulk upsert — update multiple configs in one call.
   */
  async bulkUpsert(companyId: string, configs: z.infer<typeof bulkUpsertSchema>) {
    return Promise.all(configs.map(c => this.upsert(companyId, c)));
  }

  /**
   * Ensure all default configs exist in DB for a company (idempotent).
   * Called once during company onboarding.
   */
  async initDefaults(companyId: string) {
    const existing = await prisma.alertConfig.findMany({
      where: { companyId },
      select: { alertType: true },
    });
    const existingTypes = new Set(existing.map((r: { alertType: string }) => r.alertType));

    const toCreate = Object.entries(ALERT_DEFAULTS)
      .filter(([type]) => !existingTypes.has(type as AlertType))
      .map(([alertType, def]) => ({
        id:            uuidv4(),
        companyId,
        alertType:     alertType as AlertType,
        enabled:       def.enabled,
        threshold:     def.threshold ?? undefined,
        thresholdUnit: def.thresholdUnit ?? undefined,
        windowDays:    def.windowDays ?? undefined,
      }));

    if (toCreate.length === 0) return { created: 0 };

    await prisma.alertConfig.createMany({ data: toCreate, skipDuplicates: true });
    return { created: toCreate.length };
  }

  /**
   * Helper used by the engine: resolve effective config for a type,
   * falling back to defaults if no DB row exists.
   */
  async getEffective(
    companyId: string,
    alertType: AlertType,
  ): Promise<{
    enabled: boolean;
    threshold: number;
    thresholdUnit: string;
    windowDays: number | null;
  }> {
    const row = await prisma.alertConfig.findUnique({
      where: { companyId_alertType: { companyId, alertType } },
    });
    const def = ALERT_DEFAULTS[alertType as string] ?? ALERT_DEFAULTS.custom;
    return {
      enabled:       row?.enabled       ?? def.enabled,
      threshold:     Number(row?.threshold ?? def.threshold ?? 0),
      thresholdUnit: row?.thresholdUnit  ?? def.thresholdUnit ?? '',
      windowDays:    row?.windowDays     ?? def.windowDays,
    };
  }
}
