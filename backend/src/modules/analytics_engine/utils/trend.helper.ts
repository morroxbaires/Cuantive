/**
 * analytics_engine/utils/trend.helper.ts
 *
 * Utilities for computing period-over-period trends.
 *
 * All functions are pure — no I/O.
 */

// ─── Month helpers ────────────────────────────────────────────────────────────

/**
 * Parse a 'YYYY-MM' string into { year, month } integers (1-indexed month).
 */
export function parseMonth(month: string): { year: number; month: number } {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) {
    throw new Error(`Invalid month format: "${month}". Expected YYYY-MM.`);
  }
  return { year: y, month: m };
}

/**
 * Given 'YYYY-MM', return the previous month in 'YYYY-MM' format.
 */
export function prevMonth(month: string): string {
  const { year, month: m } = parseMonth(month);
  const prev = m === 1 ? { year: year - 1, month: 12 } : { year, month: m - 1 };
  return `${prev.year}-${String(prev.month).padStart(2, '0')}`;
}

/**
 * Given 'YYYY-MM', return a { from, to } Date range covering the full calendar month.
 * fromDate = first day 00:00 UTC
 * toDate   = last millisecond of the last day (or first day of next month exclusive)
 */
export function monthToDateRange(month: string): { from: Date; to: Date } {
  const { year, month: m } = parseMonth(month);
  const from = new Date(Date.UTC(year, m - 1, 1));
  // to = last instant of the month = first instant of next month minus 1ms
  const toExcl = new Date(Date.UTC(year, m, 1));
  const to     = new Date(toExcl.getTime() - 1);
  return { from, to };
}

/**
 * Return the current month in 'YYYY-MM' format (UTC).
 */
export function currentMonth(): string {
  const now = new Date();
  const y   = now.getUTCFullYear();
  const m   = now.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

// ─── Trend calculation ────────────────────────────────────────────────────────

export interface TrendResult {
  /** Formatted string e.g. '+3.2%' or '-12.5%'. null if no previous datum. */
  formatted: string | null;
  /** Raw percentage change (positive = increase). null if previous is 0 or absent. */
  changePct: number | null;
  /** Direction: 'up' | 'down' | 'flat' | 'no_data' */
  direction: 'up' | 'down' | 'flat' | 'no_data';
}

/**
 * Compute the period-over-period trend between a current and previous numeric value.
 *
 * @param current   Current period value
 * @param previous  Previous period value (null = no data)
 * @param invertPositive
 *   When true, an increase is considered negative (e.g. cost per km going UP is bad).
 *   For display purposes only — does not affect the raw changePct.
 */
export function computeTrend(
  current:         number | null,
  previous:        number | null,
  _invertPositive = false,
): TrendResult {
  if (current === null || previous === null) {
    return { formatted: null, changePct: null, direction: 'no_data' };
  }
  if (previous === 0) {
    return { formatted: null, changePct: null, direction: 'no_data' };
  }

  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.round(pct * 10) / 10;

  const direction: TrendResult['direction'] =
    rounded > 0  ? 'up'   :
    rounded < 0  ? 'down' : 'flat';

  const sign      = rounded > 0 ? '+' : '';
  const formatted = `${sign}${rounded.toFixed(1)}%`;

  return { formatted, changePct: rounded, direction };
}

/**
 * Human-readable period label for display.
 * 'YYYY-MM' → 'Marzo 2026'
 */
export function formatPeriodLabel(month: string, locale = 'es-CL'): string {
  try {
    const { year, month: m } = parseMonth(month);
    const date = new Date(Date.UTC(year, m - 1, 1));
    return date.toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  } catch {
    return month;
  }
}
