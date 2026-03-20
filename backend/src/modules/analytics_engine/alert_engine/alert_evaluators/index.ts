/**
 * analytics_engine/alert_engine/alert_evaluators/index.ts
 *
 * Alert evaluator functions — one per AlertRuleType.
 *
 * Each evaluator:
 *   1. Receives the full FleetKPIInput + the matching AlertRule
 *   2. Calls the relevant pure calculator
 *   3. Compares results against rule.thresholds
 *   4. Returns an EvaluatedAlert[] for every vehicle / item that fires
 *
 * Evaluators are intentionally isolated — a failure in one does not affect others.
 */

import type { FleetKPIInput, FuelEfficiencyBreakdown } from '../../types';
import type { AlertRule }                              from '../alert_rules';

import { calculateFuelEfficiency }                     from '../../kpi_calculators/fuel_kpis';
import { calculateFuelLoss }                           from '../../kpi_calculators/fuel_kpis';
import {
  calculateMaintenanceCostPerVehicle,
  calculatePendingMaintenance,
  type CostPerVehicleResult,
  type PendingMaintenanceResult,
}                                                      from '../../kpi_calculators/maintenance_kpis';
import {
  calculateFleetUtilization,
  type FleetUtilizationResult,
}                                                      from '../../kpi_calculators/utilization_kpi_calculator';
import {
  calculateVehicleDowntime,
  type VehicleDowntimeResult,
}                                                      from '../../kpi_calculators/availability_kpi_calculator';
import type { FuelLossResult }                         from '../../kpi_calculators/fuel_kpis';

// ─── EvaluatedAlert ───────────────────────────────────────────────────────────

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface EvaluatedAlert {
  ruleId:     string;
  ruleType:   AlertRule['type'];
  category:   AlertRule['category'];
  ruleName:   string;
  vehicleId?: string;
  plate?:     string;
  severity:   AlertSeverity;
  message:    string;
  value:      number;
  threshold:  number;
  meta:       Record<string, unknown>;
}

// ─── Severity helpers ─────────────────────────────────────────────────────────

function severityByRatio(value: number, threshold: number): AlertSeverity {
  const ratio = threshold > 0 ? value / threshold : 1;
  if (ratio >= 3)   return 'critical';
  if (ratio >= 2)   return 'high';
  if (ratio >= 1.5) return 'medium';
  return 'low';
}

function severityByDays(daysOverdue: number): AlertSeverity {
  if (daysOverdue > 30) return 'critical';
  if (daysOverdue > 7)  return 'high';
  if (daysOverdue > 0)  return 'medium';
  return 'low';
}

// ─── 1. Abnormal fuel consumption ────────────────────────────────────────────

export function evaluateFuelConsumption(input: FleetKPIInput, rule: AlertRule): EvaluatedAlert[] {
  const threshold = rule.thresholds.fuelDeviationPct ?? 20;

  const result = calculateFuelEfficiency({
    vehicles:            input.vehicles,
    fuelLoads:           input.fuelLoads,
    anomalyThresholdPct: threshold,
  });

  const breakdown = result.value as FuelEfficiencyBreakdown[];
  const alerts: EvaluatedAlert[] = [];

  for (const v of breakdown) {
    if (!v.isAnomaly) continue;
    const dev = v.deviationPct ?? 0;
    if (dev >= 0) continue;                      // only flag excess consumption

    const absDeviation = Math.abs(dev);
    const severity     = severityByRatio(absDeviation, threshold);

    alerts.push({
      ruleId:    rule.id,
      ruleType:  rule.type,
      category:  rule.category,
      ruleName:  rule.name,
      vehicleId: v.vehicleId,
      plate:     v.plate,
      severity,
      message:   `Consumo anormal en ${v.plate}: rendimiento real ${v.avgKmPerUnit?.toFixed(2) ?? '?'} km/L vs referencia ${v.efficiencyReference ?? '?'} km/L (${dev.toFixed(1)}% desvío)`,
      value:     Math.round(absDeviation * 10) / 10,
      threshold,
      meta: {
        avgKmPerUnit:        v.avgKmPerUnit,
        efficiencyReference: v.efficiencyReference,
        deviationPct:        v.deviationPct,
        totalLiters:         v.totalLiters,
        totalCost:           v.totalCost,
      },
    });
  }

  return alerts;
}

// ─── 2. High maintenance cost ─────────────────────────────────────────────────

export function evaluateMaintenanceCost(input: FleetKPIInput, rule: AlertRule): EvaluatedAlert[] {
  const threshold = rule.thresholds.maintenanceCostPerVehicle ?? 500_000;

  const result = calculateMaintenanceCostPerVehicle({
    maintenances: input.maintenances,
    vehicles:     input.vehicles,
  }).value as CostPerVehicleResult;

  return result.perVehicle
    .filter(v => v.totalCost > threshold)
    .map(v => {
      const severity = severityByRatio(v.totalCost, threshold);
      return {
        ruleId:    rule.id,
        ruleType:  rule.type,
        category:  rule.category,
        ruleName:  rule.name,
        vehicleId: v.vehicleId,
        plate:     v.plate,
        severity,
        message:   `Costo de mantenimiento alto en ${v.plate}: $${v.totalCost.toLocaleString('es-CL')} CLP (umbral: $${threshold.toLocaleString('es-CL')} CLP)`,
        value:     v.totalCost,
        threshold,
        meta: {
          count:     v.count,
          avgCost:   v.avgCost,
          costShare: v.costShare,
        },
      };
    });
}

// ─── 3. Low usage ────────────────────────────────────────────────────────────

export function evaluateLowUsage(input: FleetKPIInput, rule: AlertRule): EvaluatedAlert[] {
  const threshold = rule.thresholds.minActiveDaysInPeriod ?? 5;

  const result = calculateFleetUtilization({
    vehicles:     input.vehicles,
    fuelLoads:    input.fuelLoads,
    maintenances: input.maintenances,
    range:        input.range,
  }).value as FleetUtilizationResult;

  return result.perVehicle
    .filter(v => v.active && v.activeDays < threshold)
    .map(v => {
      const severity: AlertSeverity = v.activeDays === 0 ? 'high' : 'medium';
      return {
        ruleId:    rule.id,
        ruleType:  rule.type,
        category:  rule.category,
        ruleName:  rule.name,
        vehicleId: v.vehicleId,
        plate:     v.plate,
        severity,
        message:   v.activeDays === 0
          ? `Sin actividad registrada en el período — ${v.plate}`
          : `Bajo uso detectado en ${v.plate}: ${v.activeDays} días activos (mínimo: ${threshold})`,
        value:     v.activeDays,
        threshold,
        meta: {
          vehicleType: v.vehicleType,
          operational: v.operational,
        },
      };
    });
}

// ─── 4. High downtime ─────────────────────────────────────────────────────────

export function evaluateHighDowntime(input: FleetKPIInput, rule: AlertRule): EvaluatedAlert[] {
  const threshold = rule.thresholds.maxDowntimeHours ?? 48;

  const result = calculateVehicleDowntime({
    vehicles:     input.vehicles,
    maintenances: input.maintenances,
    range:        input.range,
  }).value as VehicleDowntimeResult;

  return result.perVehicle
    .filter(v => v.downtimeHours > threshold)
    .map(v => {
      const severity = severityByRatio(v.downtimeHours, threshold);
      return {
        ruleId:    rule.id,
        ruleType:  rule.type,
        category:  rule.category,
        ruleName:  rule.name,
        vehicleId: v.vehicleId,
        plate:     v.plate,
        severity,
        message:   `Alto downtime en ${v.plate}: ${v.downtimeHours.toFixed(1)} hrs fuera de servicio (umbral: ${threshold} hrs)`,
        value:     v.downtimeHours,
        threshold,
        meta: {
          downtimeDays:    v.downtimeDays,
          availabilityPct: v.availabilityPct,
          workshopEntries: v.workshopEntries.length,
          openEntries:     v.workshopEntries.filter(e => e.isOpen).length,
        },
      };
    });
}

// ─── 5. Fuel loss ─────────────────────────────────────────────────────────────

export function evaluateFuelLoss(input: FleetKPIInput, rule: AlertRule): EvaluatedAlert[] {
  const threshold = rule.thresholds.fuelLossLiters ?? 10;

  const result = calculateFuelLoss({
    vehicles:          input.vehicles,
    fuelLoads:         input.fuelLoads,
    lossThresholdPct:  input.settings.alertFuelExcessPct,
  }).value as FuelLossResult;

  return result.perVehicle
    .filter(v => v.lossLiters !== null && v.lossLiters > threshold)
    .map(v => {
      const loss      = v.lossLiters!;
      const risk      = v.fraudRisk;
      const severity: AlertSeverity =
        risk === 'high'   ? 'critical' :
        risk === 'medium' ? 'high'     :
        risk === 'low'    ? 'medium'   : 'low';

      return {
        ruleId:    rule.id,
        ruleType:  rule.type,
        category:  rule.category,
        ruleName:  rule.name,
        vehicleId: v.vehicleId,
        plate:     v.plate,
        severity,
        message:   `Posible pérdida de combustible en ${v.plate}: ~${loss.toFixed(1)} L exceso (riesgo de fraude: ${risk})`,
        value:     Math.round(loss * 10) / 10,
        threshold,
        meta: {
          actualLiters:        v.actualLiters,
          expectedLiters:      v.expectedLiters,
          lossPct:             v.lossPct,
          kmDriven:            v.kmDriven,
          efficiencyReference: v.efficiencyReference,
          fraudRisk:           v.fraudRisk,
          fraudFlag:           v.fraudFlag,
        },
      };
    });
}

// ─── 6. Overdue maintenance ───────────────────────────────────────────────────

export function evaluateOverdueMaintenance(input: FleetKPIInput, rule: AlertRule): EvaluatedAlert[] {
  const threshold = rule.thresholds.maxDaysOverdue ?? 0;

  const result = calculatePendingMaintenance({
    maintenances: input.maintenances,
    vehicles:     input.vehicles,
  }).value as PendingMaintenanceResult;

  // Build a plate map for enriching alerts
  const plateMap: Record<string, string> = {};
  for (const v of input.vehicles) plateMap[v.id] = v.plate;

  return result.perVehicle
    .filter(m => m.daysOverdue !== null && m.daysOverdue > threshold)
    .map(m => {
      const days     = m.daysOverdue!;
      const severity = severityByDays(days);
      const plate    = plateMap[m.vehicleId] ?? m.vehicleId;

      return {
        ruleId:    rule.id,
        ruleType:  rule.type,
        category:  rule.category,
        ruleName:  rule.name,
        vehicleId: m.vehicleId,
        plate,
        severity,
        message:   `Mantenimiento vencido en ${plate}: ${days} días desde la fecha programada (tipo: ${m.type})`,
        value:     days,
        threshold,
        meta: {
          maintenanceId: m.maintenanceId,
          type:          m.type,
          nextDate:      m.nextDate,
          status:        m.status,
        },
      };
    });
}

// ─── Evaluator dispatch map ───────────────────────────────────────────────────

export type EvaluatorFn = (input: FleetKPIInput, rule: AlertRule) => EvaluatedAlert[];

export const EVALUATORS: Record<AlertRule['type'], EvaluatorFn> = {
  abnormal_fuel_consumption: evaluateFuelConsumption,
  high_maintenance_cost:     evaluateMaintenanceCost,
  low_usage:                 evaluateLowUsage,
  high_downtime:             evaluateHighDowntime,
  fuel_loss:                 evaluateFuelLoss,
  overdue_maintenance:       evaluateOverdueMaintenance,
};
