/**
 * TopCostVehiclesWidget.tsx
 *
 * Renders the top vehicles by total fleet cost using the
 * fleetCost StandardKPIOutput[] (specifically the cost_per_vehicle KPI detail).
 * Falls back to the total_fleet_cost and fuel_cost/maintenance_cost breakdown
 * if per-vehicle detail is unavailable.
 */
'use client';

import { DollarSign, TrendingUp } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, cn } from '@/lib/utils';
import type { StandardKPIOutput } from '@/services/kpi-dashboard.service';

// ─── Detail entry type ────────────────────────────────────────────────────────

interface CostDetailEntry {
  vehicleId?:   string;
  plate?:       string;
  totalCost?:   number | null;
  fuelCost?:    number | null;
  maintCost?:   number | null;
  costPerKm?:   number | null;
  pctOfFleet?:  number | null;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function byName(kpis: StandardKPIOutput[], name: string): StandardKPIOutput | undefined {
  return kpis.find(k => k.name === name);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TopCostVehiclesWidgetProps {
  fleetCostKPIs: StandardKPIOutput[];
  /** Max rows to display; default 5 */
  top?:          number;
  className?:    string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TopCostVehiclesWidget({ fleetCostKPIs, top = 5, className }: TopCostVehiclesWidgetProps) {
  const totalKPI      = byName(fleetCostKPIs, 'total_fleet_cost');
  const perVehicleKPI = byName(fleetCostKPIs, 'cost_per_vehicle');

  const totalCost = totalKPI?.value ?? 0;

  // Try to extract per-vehicle breakdown from detail
  const rawDetail = perVehicleKPI?.detail as CostDetailEntry[] | undefined;
  const entries: CostDetailEntry[] = Array.isArray(rawDetail)
    ? [...rawDetail].sort((a, b) => (b.totalCost ?? 0) - (a.totalCost ?? 0)).slice(0, top)
    : [];

  return (
    <Card padding="md" className={className}>
      <CardHeader
        title="Vehículos con mayor costo"
        subtitle={`Costo total: ${formatCurrency(totalCost)}`}
        action={
          <Badge variant={totalKPI?.status === 'critical' ? 'danger' : totalKPI?.status === 'warning' ? 'warning' : 'default'} dot>
            {fleetCostKPIs.length > 0 ? `${fleetCostKPIs.length} KPIs` : 'Sin datos'}
          </Badge>
        }
      />

      {entries.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="mb-2 h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-amber-500" />
          </div>
          <p className="text-sm font-medium text-slate-700">Sin datos de costo por vehículo</p>
          <p className="mt-0.5 text-xs text-slate-400">
            Costo total de flota: {formatCurrency(totalCost)}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {entries.map((e, idx) => {
            const pct = e.pctOfFleet ?? (totalCost > 0 && e.totalCost ? (e.totalCost / totalCost) * 100 : null);
            return (
              <li
                key={e.vehicleId ?? idx}
                className="flex items-center gap-3 rounded-lg border border-slate-50 bg-slate-50/50 px-3 py-2.5"
              >
                {/* Rank badge */}
                <span className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  idx === 0 ? 'bg-red-100 text-red-700'  :
                  idx === 1 ? 'bg-orange-100 text-orange-700' :
                              'bg-slate-100 text-slate-500',
                )}>
                  {idx + 1}
                </span>

                {/* Vehicle info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{e.plate ?? e.vehicleId ?? '—'}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {e.fuelCost != null && (
                      <span className="text-xs text-slate-400">
                        Comb: {formatCurrency(e.fuelCost)}
                      </span>
                    )}
                    {e.maintCost != null && e.maintCost > 0 && (
                      <span className="text-xs text-slate-400">
                        Mant: {formatCurrency(e.maintCost)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Cost + pct */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-slate-900">{formatCurrency(e.totalCost ?? 0)}</p>
                  {pct != null && (
                    <p className="text-xs text-slate-400">{pct.toFixed(1)}% flota</p>
                  )}
                  {e.costPerKm != null && (
                    <p className="text-xs text-slate-400">{formatCurrency(e.costPerKm)}/km</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Fleet cost KPI chips */}
      {fleetCostKPIs.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {fleetCostKPIs
            .filter(k => k.name !== 'total_fleet_cost' && k.name !== 'cost_per_vehicle')
            .map(k => (
              <div key={k.name} className="flex flex-col rounded-lg bg-slate-50 px-2.5 py-1.5 min-w-0">
                <span className="text-xs text-slate-400 truncate">{k.label}</span>
                <span className="text-sm font-semibold text-slate-800">{k.formatted}</span>
              </div>
            ))}
        </div>
      )}
    </Card>
  );
}
