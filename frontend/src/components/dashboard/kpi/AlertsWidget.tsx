/**
 * AlertsWidget.tsx
 *
 * Displays the SmartAlert[] produced by the analytics_engine alert system
 * as a scrollable list inside a Card, grouped by severity.
 */
'use client';

import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge  } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { SmartAlert, SmartAlertSummary } from '@/services/kpi-dashboard.service';

// ─── Severity config ──────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  critical: {
    icon:      AlertCircle,
    iconClass: 'text-red-500',
    bg:        'bg-red-50',
    badge:     'danger'  as const,
    label:     'Crítico',
  },
  high: {
    icon:      AlertTriangle,
    iconClass: 'text-orange-500',
    bg:        'bg-orange-50',
    badge:     'warning'  as const,
    label:     'Alto',
  },
  medium: {
    icon:      AlertTriangle,
    iconClass: 'text-amber-500',
    bg:        'bg-amber-50',
    badge:     'warning'  as const,
    label:     'Medio',
  },
  low: {
    icon:      Info,
    iconClass: 'text-blue-500',
    bg:        'bg-blue-50',
    badge:     'info'  as const,
    label:     'Bajo',
  },
} as const;

// ─── Props ────────────────────────────────────────────────────────────────────

interface AlertsWidgetProps {
  alerts:      SmartAlert[];
  summary:     SmartAlertSummary;
  /** Max alerts to show before scroll; default 6 */
  maxVisible?: number;
  className?:  string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AlertsWidget({ alerts, summary, maxVisible = 6, className }: AlertsWidgetProps) {
  const safeAlerts = Array.isArray(alerts) ? alerts : [];

  // Normalize counts: backend may return SmartAlert[] or number for severity buckets
  const toCount = (v: unknown): number => {
    if (typeof v === 'number') return v;
    if (Array.isArray(v)) return v.length;
    return 0;
  };

  const criticalCount = toCount(summary?.critical);
  const highCount     = toCount(summary?.high);
  const mediumCount   = toCount(summary?.medium);
  const lowCount      = toCount(summary?.low);
  const totalCount    = typeof summary?.total === 'number' ? summary.total : safeAlerts.length;
  const urgent        = criticalCount + highCount;

  return (
    <Card padding="md" className={className}>
      <CardHeader
        title="Alertas inteligentes"
        subtitle={`Motor de análisis — ${totalCount} alerta${totalCount !== 1 ? 's' : ''} detectada${totalCount !== 1 ? 's' : ''}`}
        action={
          <Badge variant={urgent > 0 ? 'danger' : mediumCount > 0 ? 'warning' : 'success'} dot>
            {urgent > 0 ? `${urgent} urgente${urgent !== 1 ? 's' : ''}` : 'Sin urgentes'}
          </Badge>
        }
      />

      {safeAlerts.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="mb-2 h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCircle className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="text-sm font-medium text-slate-700">Sin alertas activas</p>
          <p className="mt-0.5 text-xs text-slate-400">La flota opera dentro de parámetros normales</p>
        </div>
      ) : (
        <ul className={cn('space-y-2', safeAlerts.length > maxVisible && 'max-h-72 overflow-y-auto pr-1')}>
          {safeAlerts.slice(0, maxVisible).map((alert, idx) => {
            const cfg = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.low;
            const SeverityIcon = cfg.icon;
            return (
              <li
                key={`${String(alert.rule_id)}-${String(alert.vehicle_id ?? 'fleet')}-${idx}`}
                className="flex items-start gap-3 rounded-lg border border-slate-50 bg-slate-50/50 px-3 py-2.5"
              >
                <div className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', cfg.bg)}>
                  <SeverityIcon className={cn('h-3.5 w-3.5', cfg.iconClass)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-800 truncate">{String(alert.message ?? '')}</p>
                    {alert.plate && (
                      <span className="text-xs text-slate-400 font-mono shrink-0">{String(alert.plate)}</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                    <Badge variant={cfg.badge} dot className="text-xs">
                      {cfg.label}
                    </Badge>
                    <span className="text-xs text-slate-400">{String(alert.rule_name ?? '')}</span>
                  </div>
                </div>
              </li>
            );
          })}
          {safeAlerts.length > maxVisible && (
            <li className="text-center py-1">
              <span className="text-xs text-slate-400">
                + {safeAlerts.length - maxVisible} alerta{safeAlerts.length - maxVisible !== 1 ? 's' : ''} más
              </span>
            </li>
          )}
        </ul>
      )}

      {/* Severity summary row */}
      {totalCount > 0 && (
        <div className="mt-4 flex gap-3 flex-wrap border-t border-slate-100 pt-3">
          {([
            { sev: 'critical' as const, count: criticalCount },
            { sev: 'high'     as const, count: highCount     },
            { sev: 'medium'   as const, count: mediumCount   },
            { sev: 'low'      as const, count: lowCount      },
          ]).map(({ sev, count }) => {
            if (count === 0) return null;
            const cfg = SEVERITY_CONFIG[sev];
            return (
              <div key={sev} className="flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', cfg.bg.replace('bg-', 'bg-').replace('-50', '-400'))} />
                <span className="text-xs text-slate-500">
                  {count} {cfg.label.toLowerCase()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
