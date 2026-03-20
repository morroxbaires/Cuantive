/**
 * analytics_engine/utils/standard_output.ts
 *
 * Defines the StandardKPIOutput shape (the contract consumed by any UI/API layer)
 * and a factory function that converts raw computed values into that shape.
 *
 * This is the answer to: "every KPI must expose: name, description, formula,
 * value, trend, period".
 */

import type { KPIStatus } from '../types';
import type { TrendResult } from './trend.helper';

// ─── Standard output type ─────────────────────────────────────────────────────

/**
 * The canonical shape returned by every fleet KPI service method.
 * Mirrors the requested format exactly:
 *
 *   {
 *     name:        "cost_per_km",
 *     value:       0.42,
 *     unit:        "CLP/km",
 *     trend:       "+3%",
 *     period:      "monthly"
 *   }
 */
export interface StandardKPIOutput {
  /** Snake_case identifier, stable across versions */
  name: string;
  /** Human-readable label */
  label: string;
  /** One-line user-facing description */
  description: string;
  /** The formula used to compute this KPI (human-readable) */
  formula: string;
  /** The computed numeric value (null if insufficient data) */
  value: number | null;
  /** Formatted value for display (e.g. "$1,234,567" or "12.3 km/L") */
  formatted: string | null;
  /** Unit descriptor */
  unit: string;
  /** Period-over-period change, e.g. "+3.2%" or "-5.0%" */
  trend: string | null;
  /** Raw trend percentage (for programmatic use) */
  trendPct: number | null;
  /** Trend direction for colour-coding */
  trendDirection: TrendResult['direction'];
  /** String describing the period, e.g. "2026-03" or "2026-01 → 2026-03" */
  period: string;
  /** Human-readable period, e.g. "Marzo 2026" */
  periodLabel: string;
  /** Previous period value (for rendering comparison) */
  previousValue: number | null;
  /** Health status based on thresholds */
  status: KPIStatus;
  /** ISO timestamp of when this KPI was computed */
  computedAt: string;
  /** Optional supporting data (breakdowns, sub-items, etc.) */
  detail?: unknown;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export interface BuildKPIOutputParams {
  name:          string;
  label:         string;
  description:   string;
  formula:       string;
  value:         number | null;
  formatted?:    string | null;
  unit:          string;
  trend:         TrendResult;
  period:        string;
  periodLabel:   string;
  previousValue?: number | null;
  status:        KPIStatus;
  detail?:       unknown;
}

/**
 * Build a StandardKPIOutput from raw components.
 * Centralises all formatting logic so individual services stay lean.
 */
export function buildKPIOutput(p: BuildKPIOutputParams): StandardKPIOutput {
  return {
    name:           p.name,
    label:          p.label,
    description:    p.description,
    formula:        p.formula,
    value:          p.value,
    formatted:      p.formatted ?? null,
    unit:           p.unit,
    trend:          p.trend.formatted,
    trendPct:       p.trend.changePct,
    trendDirection: p.trend.direction,
    period:         p.period,
    periodLabel:    p.periodLabel,
    previousValue:  p.previousValue ?? null,
    status:         p.status,
    computedAt:     new Date().toISOString(),
    detail:         p.detail,
  };
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function formatCLP(value: number | null): string | null {
  if (value === null) return null;
  return `$${value.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`;
}

export function formatCLPKm(value: number | null): string | null {
  if (value === null) return null;
  return `$${value.toFixed(2)}/km`;
}
