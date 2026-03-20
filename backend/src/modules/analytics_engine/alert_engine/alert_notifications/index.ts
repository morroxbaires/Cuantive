/**
 * analytics_engine/alert_engine/alert_notifications/index.ts
 *
 * Defines the canonical SmartAlert output shape and the formatter that
 * converts an EvaluatedAlert into a SmartAlert.
 *
 * SmartAlert is the final JSON-serialisable alert delivered to callers:
 *
 *   {
 *     type:        "fuel_loss",
 *     vehicle_id:  "V102",
 *     severity:    "high",
 *     message:     "Posible pérdida de combustible detectada",
 *     value:       25,
 *     threshold:   10
 *   }
 *
 * Extra fields (rule_id, category, rule_name, plate, generated_at, meta)
 * provide richer context for the UI without breaking the base contract.
 */

import type { EvaluatedAlert } from '../alert_evaluators';
import type { AlertRule }      from '../alert_rules';

// ─── SmartAlert ───────────────────────────────────────────────────────────────

/** Base shape — matches the requested JSON contract exactly. */
export interface SmartAlert {
  /** Snake_case alert type identifier */
  type:          AlertRule['type'];
  /** ID of the vehicle that triggered the alert (when applicable) */
  vehicle_id?:   string;
  /** licence plate of the vehicle (when applicable) */
  plate?:        string;
  /** Alert severity */
  severity:      EvaluatedAlert['severity'];
  /** Human-readable alert message */
  message:       string;
  /** The computed value that exceeded the threshold */
  value:         number;
  /** The configured threshold that was exceeded */
  threshold:     number;

  // ── Enriched context (for UI / logging) ──────────────────────────────────
  /** ID of the AlertRule that fired */
  rule_id:       string;
  /** Friendly name of the rule */
  rule_name:     string;
  /** Functional category */
  category:      AlertRule['category'];
  /** ISO timestamp */
  generated_at:  string;
  /** Raw detail data from the evaluator */
  meta:          Record<string, unknown>;
}

// ─── Severity ordering ────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<EvaluatedAlert['severity'], number> = {
  critical: 4,
  high:     3,
  medium:   2,
  low:      1,
};

export function compareSeverity(
  a: EvaluatedAlert['severity'],
  b: EvaluatedAlert['severity'],
): number {
  return SEVERITY_ORDER[b] - SEVERITY_ORDER[a];  // descending
}

// ─── Formatter ────────────────────────────────────────────────────────────────

/**
 * Convert an EvaluatedAlert into the canonical SmartAlert output.
 */
export function formatSmartAlert(alert: EvaluatedAlert): SmartAlert {
  return {
    type:         alert.ruleType,
    vehicle_id:   alert.vehicleId,
    plate:        alert.plate,
    severity:     alert.severity,
    message:      alert.message,
    value:        alert.value,
    threshold:    alert.threshold,
    rule_id:      alert.ruleId,
    rule_name:    alert.ruleName,
    category:     alert.category,
    generated_at: new Date().toISOString(),
    meta:         alert.meta,
  };
}

/**
 * Convert an array of EvaluatedAlerts → SmartAlert[],
 * sorted by severity (critical first) then by vehicle_id.
 */
export function formatSmartAlerts(alerts: EvaluatedAlert[]): SmartAlert[] {
  return alerts
    .map(formatSmartAlert)
    .sort((a, b) => {
      const bySeverity = compareSeverity(a.severity, b.severity);
      if (bySeverity !== 0) return bySeverity;
      return (a.vehicle_id ?? '').localeCompare(b.vehicle_id ?? '');
    });
}

// ─── Grouped summary ─────────────────────────────────────────────────────────

export interface SmartAlertSummary {
  total:      number;
  byType:     Record<string, number>;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  critical:   SmartAlert[];
  high:       SmartAlert[];
  medium:     SmartAlert[];
  low:        SmartAlert[];
}

export function buildSmartAlertSummary(alerts: SmartAlert[]): SmartAlertSummary {
  const byType:     Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  for (const a of alerts) {
    byType[a.type]         = (byType[a.type]         ?? 0) + 1;
    bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;
    byCategory[a.category] = (byCategory[a.category] ?? 0) + 1;
  }

  return {
    total:      alerts.length,
    byType,
    bySeverity,
    byCategory,
    critical:   alerts.filter(a => a.severity === 'critical'),
    high:       alerts.filter(a => a.severity === 'high'),
    medium:     alerts.filter(a => a.severity === 'medium'),
    low:        alerts.filter(a => a.severity === 'low'),
  };
}
