/**
 * analytics_engine/alert_engine/alert_rules/index.ts
 *
 * Alert rule definitions, defaults and the AlertRuleRegistry singleton.
 *
 * AlertRule:
 *   - Describes what to detect (type), when to fire (thresholds), and
 *     whether the rule is currently active (enabled).
 *   - Rules are mutable: callers can enable/disable them or adjust thresholds
 *     at runtime without touching the evaluator code.
 *
 * Usage:
 *   import { alertRuleRegistry } from './alert_rules';
 *   alertRuleRegistry.setThresholds('rule.fuel_loss', { fuelLossLiters: 20 });
 *   alertRuleRegistry.disable('rule.low_usage');
 */

// ─── Rule types ───────────────────────────────────────────────────────────────

export type AlertRuleType =
  | 'abnormal_fuel_consumption'
  | 'high_maintenance_cost'
  | 'low_usage'
  | 'high_downtime'
  | 'fuel_loss'
  | 'overdue_maintenance';

export type AlertRuleCategory = 'fuel' | 'maintenance' | 'utilization' | 'availability';

/**
 * Per-rule threshold configuration.
 * Only the fields relevant to each rule type are used.
 */
export interface AlertRuleThresholds {
  /** abnormal_fuel_consumption — deviation from reference km/L (%) */
  fuelDeviationPct?: number;
  /** high_maintenance_cost — cost per vehicle above which an alert fires (CLP) */
  maintenanceCostPerVehicle?: number;
  /** low_usage — minimum active-days in the period before flagging a vehicle */
  minActiveDaysInPeriod?: number;
  /** high_downtime — max workshop hours per vehicle in the period */
  maxDowntimeHours?: number;
  /** fuel_loss — minimum excess liters before flagging (per vehicle) */
  fuelLossLiters?: number;
  /** overdue_maintenance — days past the scheduled nextDate before firing */
  maxDaysOverdue?: number;
}

export interface AlertRule {
  id:          string;
  type:        AlertRuleType;
  name:        string;
  description: string;
  category:    AlertRuleCategory;
  enabled:     boolean;
  thresholds:  AlertRuleThresholds;
  createdAt:   Date;
  updatedAt:   Date;
}

// ─── Default rules ────────────────────────────────────────────────────────────

const now = new Date();

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id:          'rule.abnormal_fuel_consumption',
    type:        'abnormal_fuel_consumption',
    name:        'Consumo de combustible anormal',
    description: 'Detecta vehículos cuyo consumo real se desvía del rendimiento de referencia más allá del umbral configurado',
    category:    'fuel',
    enabled:     true,
    thresholds:  { fuelDeviationPct: 20 },
    createdAt:   now,
    updatedAt:   now,
  },
  {
    id:          'rule.high_maintenance_cost',
    type:        'high_maintenance_cost',
    name:        'Costo de mantenimiento alto',
    description: 'Detecta vehículos cuyo costo de mantenimiento en el período supera el umbral configurado',
    category:    'maintenance',
    enabled:     true,
    thresholds:  { maintenanceCostPerVehicle: 500_000 },
    createdAt:   now,
    updatedAt:   now,
  },
  {
    id:          'rule.low_usage',
    type:        'low_usage',
    name:        'Vehículo con bajo uso',
    description: 'Detecta vehículos activos sin actividad suficiente (cargas o mantenimientos) en el período',
    category:    'utilization',
    enabled:     true,
    thresholds:  { minActiveDaysInPeriod: 5 },
    createdAt:   now,
    updatedAt:   now,
  },
  {
    id:          'rule.high_downtime',
    type:        'high_downtime',
    name:        'Alto downtime de vehículo',
    description: 'Detecta vehículos que han estado en taller más tiempo del umbral configurado en el período',
    category:    'availability',
    enabled:     true,
    thresholds:  { maxDowntimeHours: 48 },
    createdAt:   now,
    updatedAt:   now,
  },
  {
    id:          'rule.fuel_loss',
    type:        'fuel_loss',
    name:        'Pérdida estimada de combustible',
    description: 'Detecta vehículos con exceso de litros cargados respecto al consumo esperado por km recorridos',
    category:    'fuel',
    enabled:     true,
    thresholds:  { fuelLossLiters: 10 },
    createdAt:   now,
    updatedAt:   now,
  },
  {
    id:          'rule.overdue_maintenance',
    type:        'overdue_maintenance',
    name:        'Mantenimiento vencido',
    description: 'Detecta mantenimientos programados que han superado su fecha nextDate sin completarse',
    category:    'maintenance',
    enabled:     true,
    thresholds:  { maxDaysOverdue: 0 },
    createdAt:   now,
    updatedAt:   now,
  },
];

// ─── AlertRuleRegistry ────────────────────────────────────────────────────────

class AlertRuleRegistry {
  private rules = new Map<string, AlertRule>();

  constructor(defaults: AlertRule[]) {
    defaults.forEach(r => this.rules.set(r.id, { ...r }));
  }

  /** All rules (enabled and disabled). */
  getAll(): AlertRule[] {
    return [...this.rules.values()];
  }

  /** Only rules currently enabled. */
  getEnabled(): AlertRule[] {
    return this.getAll().filter(r => r.enabled);
  }

  /** Look up rule by its AlertRuleType (returns first match). */
  getByType(type: AlertRuleType): AlertRule | undefined {
    return this.getAll().find(r => r.type === type);
  }

  /** Look up rule by its id. */
  getById(id: string): AlertRule | undefined {
    return this.rules.get(id);
  }

  /** Enable or disable a rule by id. */
  enable(id: string): void {
    const rule = this.rules.get(id);
    if (rule) { rule.enabled = true; rule.updatedAt = new Date(); }
  }

  disable(id: string): void {
    const rule = this.rules.get(id);
    if (rule) { rule.enabled = false; rule.updatedAt = new Date(); }
  }

  /** Update specific threshold fields for a rule. */
  setThresholds(id: string, thresholds: Partial<AlertRuleThresholds>): void {
    const rule = this.rules.get(id);
    if (rule) {
      rule.thresholds  = { ...rule.thresholds, ...thresholds };
      rule.updatedAt   = new Date();
    }
  }

  /** Register a completely custom rule (or overwrite an existing one). */
  register(rule: AlertRule): void {
    this.rules.set(rule.id, { ...rule });
  }

  /** Remove a rule by id. */
  remove(id: string): boolean {
    return this.rules.delete(id);
  }
}

/**
 * Singleton registry initialised with the 6 default rules.
 * Import this instance wherever rules are read or mutated.
 */
export const alertRuleRegistry = new AlertRuleRegistry(DEFAULT_ALERT_RULES);
export { AlertRuleRegistry };
