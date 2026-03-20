/**
 * analytics_engine/aggregators/fleet_health.aggregator.ts
 *
 * Fleet Health Aggregator — composes multiple KPIs into a single
 * "Fleet Health Score" (0-100) and per-category breakdown.
 *
 * This is the highest-level summary produced by the analytics engine.
 * It calls individual calculators directly (no I/O) and combines results.
 *
 * Score composition:
 *   Efficiency    30 pts  — fleet efficiency score vs reference
 *   Availability  20 pts  — % active vehicles
 *   Maintenance   25 pts  — inverse of urgency critical + compliance
 *   Utilization   15 pts  — fuel coverage of active fleet
 *   Documents     10 pts  — document compliance
 */

import type { FleetKPIInput, FleetHealthScore, KPIResult } from '../types';

import { calculateFleetEfficiencyScore } from '../kpi_calculators/efficiency_kpis';
import { calculateFleetAvailability }     from '../kpi_calculators/availability_kpis';
import { calculateDocumentCompliance }    from '../kpi_calculators/availability_kpis';
import {
  calculateMaintenanceUrgencyFleet,
  calculateMaintenanceCompliance,
} from '../kpi_calculators/maintenance_kpis';
import { calculateFleetFuelCoverage }     from '../kpi_calculators/utilization_kpis';

// ─── Individual sub-score builders ───────────────────────────────────────────

/** Max 30 pts — fleet avg efficiency score normalized to 0-30 */
function efficiencyPoints(input: FleetKPIInput): number {
  const result = calculateFleetEfficiencyScore({
    vehicles: input.vehicles,
    fuelLoads: input.fuelLoads,
  });

  if (result.value === null) return 15;  // neutral if no reference data

  const score = result.value as number;
  // score=100 → 30pts, score=80 → 6pts, score=120 → 30pts (capped)
  return Math.round(Math.min(30, Math.max(0, (score / 100) * 30)));
}

/** Max 20 pts — availability % normalized to 0-20 */
function availabilityPoints(input: FleetKPIInput): number {
  const result = calculateFleetAvailability({ vehicles: input.vehicles });
  const pct = (result.value as { availabilityPct: number }).availabilityPct;
  return Math.round((pct / 100) * 20);
}

/** Max 25 pts — maintenance (compliance + no critical urgency) */
function maintenancePoints(input: FleetKPIInput): number {
  const urgencyResult = calculateMaintenanceUrgencyFleet({
    vehicles: input.vehicles,
    maintenances: input.maintenances,
    settings: input.settings,
  });

  const complianceResult = calculateMaintenanceCompliance({
    vehicles: input.vehicles,
    maintenances: input.maintenances,
    settings: input.settings,
  });

  const urgencyItems = urgencyResult.value as Array<{ urgencyLevel: string }>;
  const totalVehicles = Math.max(1, input.vehicles.length);
  const critRatio = urgencyItems.filter(u => u.urgencyLevel === 'critical').length / totalVehicles;
  const urgencyScore = Math.round((1 - critRatio) * 15);  // 0-15 pts

  const compliancePct = complianceResult.value as number | null ?? 0;
  const complianceScore = Math.round((compliancePct / 100) * 10);  // 0-10 pts

  return urgencyScore + complianceScore;
}

/** Max 15 pts — fuel coverage */
function utilizationPoints(input: FleetKPIInput): number {
  const result = calculateFleetFuelCoverage({
    vehicles: input.vehicles,
    fuelLoads: input.fuelLoads,
  });

  if (result.value === null) return 8;  // neutral
  return Math.round(((result.value as number) / 100) * 15);
}

/** Max 10 pts — document compliance */
function documentPoints(input: FleetKPIInput): number {
  const result = calculateDocumentCompliance({
    documents: input.documents,
    vehicles: input.vehicles,
  });
  const pct = (result.value as { compliancePct: number }).compliancePct;
  return Math.round((pct / 100) * 10);
}

// ─── Main aggregator ──────────────────────────────────────────────────────────

export function aggregateFleetHealth(
  input: FleetKPIInput,
): KPIResult<FleetHealthScore> {
  const effPts   = efficiencyPoints(input);
  const availPts = availabilityPoints(input);
  const maintPts = maintenancePoints(input);
  const utilPts  = utilizationPoints(input);
  const docPts   = documentPoints(input);

  const score = effPts + availPts + maintPts + utilPts + docPts;

  const grade: FleetHealthScore['grade'] =
    score >= 85 ? 'A' :
    score >= 70 ? 'B' :
    score >= 50 ? 'C' : 'D';

  const health: FleetHealthScore = {
    score,
    grade,
    components: {
      efficiencyScore:       effPts,
      availabilityScore:     availPts,
      maintenanceScore:      maintPts,
      alertResolutionScore:  0,   // updated in Fase 2 when alert KPI is added
      documentScore:         docPts,
    },
    status:
      score >= 85 ? 'ok'       :
      score >= 60 ? 'warning'  : 'critical',
  };

  return {
    id:        'aggregator.fleet_health',
    label:     'Fleet Health Score',
    value:     health,
    formatted: `${score}/100 (${grade})`,
    unit:      'score',
    status:    health.status,
    meta: {
      breakdown: {
        efficiency:   `${effPts}/30`,
        availability: `${availPts}/20`,
        maintenance:  `${maintPts}/25`,
        utilization:  `${utilPts}/15`,
        documents:    `${docPts}/10`,
      },
    },
  };
}

// ─── Re-export for convenience ────────────────────────────────────────────────
export type { FleetHealthScore };
