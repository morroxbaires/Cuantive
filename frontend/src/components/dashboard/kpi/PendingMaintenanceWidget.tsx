/**
 * PendingMaintenanceWidget.tsx
 *
 * Shows the pending_maintenance and vehicles_in_workshop KPIs from the
 * maintenance analytics_engine service, plus the list of vehicles with
 * pending or overdue services stored in the KPI detail.
 */
'use client';

import { Wrench, Clock } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import type { StandardKPIOutput } from '@/services/kpi-dashboard.service';

// ─── Helper: extract a KPI by name ───────────────────────────────────────────

function byName(kpis: StandardKPIOutput[], name: string): StandardKPIOutput | undefined {
  return kpis.find(k => k.name === name);
}

// ─── Row type for pending vehicle entries ─────────────────────────────────────

interface PendingEntry {
  vehicleId?: string;
  plate?:     string;
  type?:      string;
  daysLeft?:  number | null;
  cost?:      number | null;
  scheduled?: string | null;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PendingMaintenanceWidgetProps {
  maintenanceKPIs: StandardKPIOutput[];
  className?:      string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PendingMaintenanceWidget({ maintenanceKPIs, className }: PendingMaintenanceWidgetProps) {
  const pendingKPI   = byName(maintenanceKPIs, 'pending_maintenance');
  const workshopKPI  = byName(maintenanceKPIs, 'vehicles_in_workshop');

  const pendingCount  = pendingKPI?.value  ?? 0;
  const workshopCount = workshopKPI?.value ?? 0;

  // The detail field may carry a list of pending vehicles from the calculator
  const rawDetail = pendingKPI?.detail as PendingEntry[] | undefined;
  const entries: PendingEntry[] = Array.isArray(rawDetail) ? rawDetail.slice(0, 5) : [];

  return (
    <Card padding="md" className={className}>
      <CardHeader
        title="Mantenimiento pendiente"
        subtitle={`Servicios programados este período`}
        action={
          <Badge variant={pendingCount > 0 ? (pendingCount >= 3 ? 'danger' : 'warning') : 'success'} dot>
            {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
          </Badge>
        }
      />

      {/* Workshop stat */}
      {workshopCount > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2">
          <Wrench className="h-4 w-4 text-orange-500 shrink-0" />
          <span className="text-xs text-orange-700 font-medium">
            {workshopCount} vehículo{workshopCount !== 1 ? 's' : ''} en taller ahora
          </span>
        </div>
      )}

      {pendingCount === 0 && entries.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="mb-2 h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center">
            <Wrench className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="text-sm font-medium text-slate-700">Sin mantenimientos pendientes</p>
          <p className="mt-0.5 text-xs text-slate-400">Todos los vehículos al día</p>
        </div>
      ) : entries.length > 0 ? (
        <ul className="space-y-2">
          {entries.map((e, idx) => {
            const days = e.daysLeft ?? null;
            const overdue = days !== null && days < 0;
            return (
              <li
                key={e.vehicleId ?? idx}
                className="flex items-center justify-between rounded-lg border border-slate-50 bg-slate-50/50 px-3 py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-xl bg-brand-50 flex items-center justify-center">
                    <Wrench className="h-3.5 w-3.5 text-brand-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{e.plate ?? e.vehicleId ?? '—'}</p>
                    <p className="text-xs text-slate-400">{e.type ?? 'Mantenimiento'}</p>
                  </div>
                </div>
                <div className="text-right">
                  {e.scheduled && (
                    <p className="text-xs font-medium text-slate-700">{formatDate(e.scheduled)}</p>
                  )}
                  {days !== null ? (
                    <Badge variant={overdue ? 'danger' : days < 7 ? 'danger' : 'warning'} dot className="text-xs">
                      {overdue ? `${Math.abs(days)}d vencido` : `${days}d`}
                    </Badge>
                  ) : e.cost != null ? (
                    <p className="text-xs text-slate-400">{formatCurrency(e.cost)}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        /* No detail available — show numeric summary */
        <div className="flex items-center gap-3 rounded-lg bg-amber-50 px-4 py-3">
          <Clock className="h-5 w-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">{pendingCount} servicio{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''}</p>
            <p className="text-xs text-amber-600">Revisar el módulo de mantenimiento para detalles</p>
          </div>
        </div>
      )}
    </Card>
  );
}
