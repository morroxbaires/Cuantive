/**
 * analytics_engine/alert_engine/index.ts
 */
export {
  fromFuelEfficiency,
  fromMaintenanceUrgency,
  fromDocumentCompliance,
  fromLicenseCompliance,
  fromFleetHealthScore,
  runKPIAlertEngine,
} from './kpi_alert.engine';

export type {
  KPIAlertSignal,
  KPIAlertType,
  KPIAlertSeverity,
  KPIAlertEngineResult,
} from './kpi_alert.engine';

// ── Smart Alert Engine ────────────────────────────────────────────────────────

export { alertRuleRegistry, DEFAULT_ALERT_RULES, AlertRuleRegistry } from './alert_rules';
export type { AlertRule, AlertRuleType, AlertRuleCategory, AlertRuleThresholds } from './alert_rules';

export {
  evaluateFuelConsumption,
  evaluateMaintenanceCost,
  evaluateLowUsage,
  evaluateHighDowntime,
  evaluateFuelLoss,
  evaluateOverdueMaintenance,
  EVALUATORS,
} from './alert_evaluators';
export type { EvaluatedAlert, AlertSeverity, EvaluatorFn } from './alert_evaluators';

export {
  formatSmartAlert,
  formatSmartAlerts,
  buildSmartAlertSummary,
  compareSeverity,
} from './alert_notifications';
export type { SmartAlert, SmartAlertSummary } from './alert_notifications';

export {
  runSmartAlertEngine,
  runSmartAlertEngineForCategory,
  runSmartAlertEngineForTypes,
} from './smart_alert.engine';
export type { SmartAlertEngineResult } from './smart_alert.engine';
