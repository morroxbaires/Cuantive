/**
 * analytics_engine/alert_engine/smart_alert.engine.ts
 *
 * Top-level orchestrator for the intelligent alert system.
 *
 * runSmartAlertEngine():
 *   1. Reads enabled rules from AlertRuleRegistry (or accepts an override list)
 *   2. Dispatches each rule to its matching evaluator
 *   3. Formats EvaluatedAlert[] → SmartAlert[] via the notification formatter
 *   4. Returns a SmartAlertEngineResult with grouped summaries and the full list
 *
 * Rules can be customised before calling:
 *   alertRuleRegistry.disable('rule.low_usage');
 *   alertRuleRegistry.setThresholds('rule.fuel_loss', { fuelLossLiters: 20 });
 *   runSmartAlertEngine(input);
 *
 * Or a custom rule list can be passed directly:
 *   runSmartAlertEngine(input, myRules);
 */

import type { FleetKPIInput } from '../types';
import { alertRuleRegistry, type AlertRule } from './alert_rules';
import { EVALUATORS, type EvaluatedAlert }  from './alert_evaluators';
import {
  formatSmartAlerts,
  buildSmartAlertSummary,
  type SmartAlert,
  type SmartAlertSummary,
} from './alert_notifications';

// ─── Result type ──────────────────────────────────────────────────────────────

export interface SmartAlertEngineResult {
  /** Canonical SmartAlert[] sorted by severity desc, then vehicleId */
  alerts:       SmartAlert[];
  /** Grouped summary with counts and severity buckets */
  summary:      SmartAlertSummary;
  /** Rules that were evaluated in this run */
  rulesRun:     string[];
  /** Rules that were skipped (disabled) */
  rulesSkipped: string[];
  /** Errors encountered per rule (rule.id → error message) */
  errors:       Record<string, string>;
  generatedAt:  Date;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

/**
 * Run the smart alert engine over a FleetKPIInput bundle.
 *
 * @param input   Full fleet KPI input (vehicles, loads, maintenances, range…)
 * @param rules   Optional custom rule list; defaults to alertRuleRegistry.getEnabled()
 */
export function runSmartAlertEngine(
  input:   FleetKPIInput,
  rules?:  AlertRule[],
): SmartAlertEngineResult {
  const allRules   = alertRuleRegistry.getAll();
  const activeRules = rules ?? alertRuleRegistry.getEnabled();
  const activeIds   = new Set(activeRules.map(r => r.id));

  const rulesRun:     string[] = [];
  const rulesSkipped: string[] = allRules.filter(r => !activeIds.has(r.id)).map(r => r.id);
  const errors:       Record<string, string> = {};
  const evaluated:    EvaluatedAlert[] = [];

  for (const rule of activeRules) {
    const evaluator = EVALUATORS[rule.type];
    if (!evaluator) {
      errors[rule.id] = `No evaluator registered for type "${rule.type}"`;
      continue;
    }
    try {
      const results = evaluator(input, rule);
      evaluated.push(...results);
      rulesRun.push(rule.id);
    } catch (err) {
      errors[rule.id] = err instanceof Error ? err.message : String(err);
    }
  }

  const alerts  = formatSmartAlerts(evaluated);
  const summary = buildSmartAlertSummary(alerts);

  return {
    alerts,
    summary,
    rulesRun,
    rulesSkipped,
    errors,
    generatedAt: new Date(),
  };
}

// ─── Convenience: run only specific categories ────────────────────────────────

export function runSmartAlertEngineForCategory(
  input:    FleetKPIInput,
  category: AlertRule['category'],
): SmartAlertEngineResult {
  const rules = alertRuleRegistry.getEnabled().filter(r => r.category === category);
  return runSmartAlertEngine(input, rules);
}

// ─── Convenience: run only specific rule types ────────────────────────────────

export function runSmartAlertEngineForTypes(
  input: FleetKPIInput,
  types: AlertRule['type'][],
): SmartAlertEngineResult {
  const typeSet = new Set(types);
  const rules   = alertRuleRegistry.getEnabled().filter(r => typeSet.has(r.type));
  return runSmartAlertEngine(input, rules);
}
