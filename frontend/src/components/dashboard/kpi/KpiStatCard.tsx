/**
 * KpiStatCard.tsx
 *
 * Renders a single StandardKPIOutput as a stat card consistent with the
 * existing StatCard component style.
 *
 * Displays: label, formatted value, unit, trend badge, status dot.
 */
'use client';

import { type LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StandardKPIOutput } from '@/services/kpi-dashboard.service';
import { Tooltip, InfoIcon } from '@/components/ui/Tooltip';

// ─── Status → colour mapping ──────────────────────────────────────────────────

const STATUS_STYLES = {
  ok:       { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-400' },
  warning:  { bg: 'bg-amber-50',   text: 'text-amber-600',   dot: 'bg-amber-400'   },
  critical: { bg: 'bg-red-50',     text: 'text-red-600',     dot: 'bg-red-400'     },
  no_data:  { bg: 'bg-slate-50',   text: 'text-slate-400',   dot: 'bg-slate-300'   },
} as const;

// ─── Trend direction → icon ───────────────────────────────────────────────────

function TrendIcon({ direction, className }: { direction?: string; className?: string }) {
  if (direction === 'up')   return <TrendingUp   className={cn('h-3.5 w-3.5', className)} />;
  if (direction === 'down') return <TrendingDown className={cn('h-3.5 w-3.5', className)} />;
  return <Minus className={cn('h-3.5 w-3.5', className)} />;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface KpiStatCardProps {
  kpi:        StandardKPIOutput;
  icon:       LucideIcon;
  /** Override icon bg colour class, e.g. 'bg-brand-50' */
  iconBg?:    string;
  /** Override icon colour class, e.g. 'text-brand-600' */
  iconColor?: string;
  className?: string;
  /**
   * When true, an upward trend is considered positive (green).
   * When false, upward is negative (e.g. for cost KPIs).
   * Defaults to true.
   */
  upIsGood?:  boolean;
  tooltip?:   string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function KpiStatCard({
  kpi,
  icon: Icon,
  iconBg    = 'bg-brand-50',
  iconColor = 'text-brand-600',
  className,
  upIsGood  = true,
  tooltip,
}: KpiStatCardProps) {
  const status  = kpi.status ?? 'no_data';
  const styles  = STATUS_STYLES[status] ?? STATUS_STYLES.no_data;

  // Trend colour: positive trend colour depends on whether up-is-good
  let trendColor = 'text-slate-400';
  if (kpi.trendDirection === 'up')   trendColor = upIsGood ? 'text-emerald-500' : 'text-red-500';
  if (kpi.trendDirection === 'down') trendColor = upIsGood ? 'text-red-500' : 'text-emerald-500';

  return (
    <div
      className={cn(
        'rounded-xl bg-white border border-slate-100 shadow-card p-5 flex flex-col gap-3',
        className,
      )}
    >
      {/* Icon + status dot */}
      <div className="flex items-start justify-between">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', iconBg)}>
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>
        {/* Status indicator */}
        <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', styles.bg, styles.text)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', styles.dot)} />
          {status === 'ok' ? 'Normal' : status === 'warning' ? 'Alerta' : status === 'critical' ? 'Crítico' : '—'}
        </span>
      </div>

      {/* Value */}
      <div>
        {tooltip ? (
          <Tooltip text={tooltip}>
            <p className="text-xs text-slate-500 uppercase font-medium tracking-wide leading-none mb-1">
              {kpi.label}
            </p>
            <InfoIcon />
          </Tooltip>
        ) : (
          <p className="text-xs text-slate-500 uppercase font-medium tracking-wide leading-none mb-1">
            {kpi.label}
          </p>
        )}
        <p className="text-2xl font-bold text-slate-900 leading-tight">
          {kpi.formatted}
          {kpi.unit && kpi.formatted && !kpi.formatted.includes(kpi.unit) && (
            <span className="text-sm font-medium text-slate-400 ml-1">{kpi.unit}</span>
          )}
        </p>
      </div>

      {/* Trend */}
      {kpi.trend && kpi.trendDirection && kpi.trendDirection !== 'no_data' && (
        <div className={cn('flex items-center gap-1 text-xs font-medium', trendColor)}>
          <TrendIcon direction={kpi.trendDirection} />
          <span>{kpi.trend} vs mes anterior</span>
        </div>
      )}
    </div>
  );
}
