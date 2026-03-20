'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip as ChartTooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import {
  TrendingDown, AlertTriangle, Award, Fuel, Users, Truck, ChevronDown, DollarSign, Wrench,
} from 'lucide-react';
import { fuelLoadsService } from '@/services/fuel-loads.service';
import { vehiclesService }  from '@/services/vehicles.service';
import { driversService }   from '@/services/drivers.service';
import { formatNumber, formatCurrency, cn } from '@/lib/utils';
import type { FuelLoad, Vehicle, Driver } from '@/types';
import { PageLoader } from '@/components/ui/Spinner';
import { Badge }      from '@/components/ui/Badge';
import { Tooltip, InfoIcon } from '@/components/ui/Tooltip';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, ChartTooltip, Legend, Filler,
);

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewMode = 'vehicles' | 'drivers';
type CostFilter = 'all' | 'fuel' | 'maintenance';

interface EntityAnalytics {
  id:            string;
  label:         string;
  loads:         number;
  totalLiters:   number;
  totalKm:       number;
  avgKmPerUnit:  number | null;
  refKmPerUnit:  number | null;
  efficiencyPct: number | null;
  excessLiters:  number;
  estimatedLoss: number;
  avgUnitPrice:  number | null;
  monthlyTrend:  { month: string; avgKm: number | null }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function prevYearMonth(ym: string, months: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 - months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthRangeBounds(from: string, to: string) {
  const [ty, tm] = to.split('-').map(Number);
  const lastDay  = new Date(ty, tm, 0).getDate();
  return { from: `${from}-01`, to: `${to}-${String(lastDay).padStart(2, '0')}` };
}

function monthsBetween(from: string, to: string): string[] {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  const months: string[] = [];
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return months;
}

function mlabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
}

function computeAnalytics(
  loads: FuelLoad[], vehicles: Vehicle[], mode: ViewMode, months: string[],
): EntityAnalytics[] {
  const vehicleRef = new Map<string, number | null>(
    vehicles.map(v => [v.id, v.efficiencyReference != null ? Number(v.efficiencyReference) : null]),
  );

  const map = new Map<string, { label: string; loads: FuelLoad[]; ref: number | null }>();

  for (const load of loads) {
    let id: string, label: string, ref: number | null = null;
    if (mode === 'vehicles') {
      id    = load.vehicleId;
      label = load.vehicle?.plate ?? id.slice(0, 8);
      ref   = vehicleRef.get(id) ?? (load.vehicle?.efficiencyReference != null ? Number(load.vehicle.efficiencyReference) : null);
    } else {
      if (!load.driverId) continue;
      id    = load.driverId;
      const d = load.driver;
      label = d ? `${d.name} ${d.lastname}` : id.slice(0, 8);
    }
    if (!map.has(id)) map.set(id, { label, loads: [], ref });
    const e = map.get(id)!;
    e.loads.push(load);
    if (mode === 'vehicles' && ref != null) e.ref = ref;
  }

  const results: EntityAnalytics[] = [];
  for (const [id, entry] of map) {
    const { label, loads: eLoads } = entry;
    let entityRef = entry.ref;

    // drivers: weighted avg ref across vehicles used
    if (mode === 'drivers') {
      const rw = eLoads
        .filter(l => l.vehicle?.efficiencyReference != null && Number(l.litersOrKwh) > 0)
        .map(l => ({ ref: Number(l.vehicle!.efficiencyReference!), lit: Number(l.litersOrKwh) }));
      if (rw.length) {
        const tl = rw.reduce((s, r) => s + r.lit, 0);
        entityRef = rw.reduce((s, r) => s + r.ref * r.lit, 0) / tl;
      }
    }

    let totalLiters = 0, totalKm = 0, totalCost = 0, pricedLiters = 0, excessLiters = 0;
    for (const l of eLoads) {
      const lit   = Number(l.litersOrKwh ?? 0);
      const kpu   = l.kmPerUnit != null ? Number(l.kmPerUnit) : null;
      const price = l.unitPrice  != null ? Number(l.unitPrice)  : null;
      totalLiters += lit;
      if (kpu != null) totalKm += kpu * lit;
      if (price != null && lit > 0) { totalCost += price * lit; pricedLiters += lit; }
      if (kpu != null && entityRef != null && entityRef > 0 && kpu > 0) {
        excessLiters += lit - (kpu * lit) / entityRef;
      }
    }

    const avgKmPerUnit  = totalKm > 0 && totalLiters > 0 ? totalKm / totalLiters : null;
    const avgUnitPrice  = pricedLiters > 0 ? totalCost / pricedLiters : null;
    const efficiencyPct = avgKmPerUnit != null && entityRef != null && entityRef > 0
      ? (avgKmPerUnit / entityRef) * 100 : null;
    const estimatedLoss = excessLiters > 0 && avgUnitPrice != null ? excessLiters * avgUnitPrice : 0;

    const monthlyTrend = months.map(mo => {
      const ml = eLoads.filter(l => l.date.startsWith(mo));
      let mLit = 0, mKm = 0;
      for (const l of ml) {
        const lit = Number(l.litersOrKwh ?? 0);
        const kpu = l.kmPerUnit != null ? Number(l.kmPerUnit) : null;
        mLit += lit;
        if (kpu != null) mKm += kpu * lit;
      }
      return { month: mo, avgKm: mLit > 0 && mKm > 0 ? mKm / mLit : null };
    });

    results.push({
      id, label, loads: eLoads.length, totalLiters, totalKm,
      avgKmPerUnit, refKmPerUnit: entityRef ?? null,
      efficiencyPct, excessLiters, estimatedLoss, avgUnitPrice, monthlyTrend,
    });
  }
  return results.sort((a, b) => (b.avgKmPerUnit ?? 0) - (a.avgKmPerUnit ?? 0));
}

// ─── KpiCard ─────────────────────────────────────────────────────────────────

function KpiCard({ title, value, sub, icon: Icon, iconBg, iconColor, highlight, tip }: {
  title: string; value: string; sub?: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
  highlight?: 'green' | 'red' | 'amber' | 'none'; tip?: string;
}) {
  const hl = { green: 'ring-1 ring-emerald-200 bg-emerald-50/40', red: 'ring-1 ring-red-200 bg-red-50/40', amber: 'ring-1 ring-amber-200 bg-amber-50/40', none: '' }[highlight ?? 'none'];
  return (
    <div className={cn('rounded-xl bg-white border border-slate-100 shadow-card p-5 flex items-start gap-4', hl)}>
      <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl mt-0.5', iconBg)}>
        <Icon className={cn('h-5 w-5', iconColor)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <p className="text-xs text-slate-500 uppercase font-medium tracking-wide">{title}</p>
          {tip && <Tooltip text={tip}><InfoIcon /></Tooltip>}
        </div>
        <p className="text-xl font-bold text-slate-900 mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Chart defaults ──────────────────────────────────────────────────────────

const BASE_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 11 } } },
    y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 } } },
  },
} as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const now = currentYearMonth();
  const [mode,      setMode]      = useState<ViewMode>('vehicles');
  const [fromMonth, setFromMonth] = useState(() => prevYearMonth(now, 5));
  const [toMonth,   setToMonth]   = useState(now);
  const [entityId,  setEntityId]  = useState('');
  const [costFilter, setCostFilter] = useState<CostFilter>('all');
  const [vehicles,  setVehicles]  = useState<Vehicle[]>([]);
  const [drivers,   setDrivers]   = useState<Driver[]>([]);
  const [loads,     setLoads]     = useState<FuelLoad[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      vehiclesService.getAll({ limit: 500 }),
      driversService.getAll({ limit: 500 }),
    ]).then(([v, d]) => { setVehicles(v.data); setDrivers(d.data); });
  }, []);

  useEffect(() => {
    setLoading(true);
    const { from, to } = monthRangeBounds(fromMonth, toMonth);
    const params: Record<string, unknown> = { from, to, limit: 2000 };
    if (entityId) { if (mode === 'vehicles') params.vehicleId = entityId; else params.driverId = entityId; }
    fuelLoadsService.getAll(params as Parameters<typeof fuelLoadsService.getAll>[0])
      .then(r => setLoads(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [mode, fromMonth, toMonth, entityId]);

  const months    = useMemo(() => monthsBetween(fromMonth, toMonth), [fromMonth, toMonth]);
  const analytics = useMemo(() => computeAnalytics(loads, vehicles, mode, months), [loads, vehicles, mode, months]);
  const displayed = entityId ? analytics.filter(a => a.id === entityId) : analytics;

  const fleetAvg   = useMemo(() => { const v = displayed.filter(a => a.avgKmPerUnit != null); return v.length ? v.reduce((s,a) => s + a.avgKmPerUnit!, 0) / v.length : null; }, [displayed]);
  const totalLoss  = useMemo(() => displayed.reduce((s, a) => s + a.estimatedLoss, 0), [displayed]);
  const bestEntity = useMemo(() => displayed.filter(a => a.avgKmPerUnit != null)[0] ?? null, [displayed]);
  const worstEntity= useMemo(() => [...displayed].filter(a => a.avgKmPerUnit != null).at(-1) ?? null, [displayed]);

  const rankingChart = useMemo(() => {
    const sorted = [...displayed].filter(a => a.avgKmPerUnit != null).sort((a,b) => (b.avgKmPerUnit??0)-(a.avgKmPerUnit??0));
    return {
      labels: sorted.map(a => a.label),
      datasets: [{
        label: 'km/L promedio', data: sorted.map(a => a.avgKmPerUnit),
        backgroundColor: sorted.map(a => {
          if (!a.refKmPerUnit) return '#60a5fa';
          const p = (a.avgKmPerUnit ?? 0) / a.refKmPerUnit;
          return p > 1.1 ? '#34d399' : p >= 0.9 ? '#60a5fa' : '#f87171';
        }),
        borderRadius: 6,
      }],
    };
  }, [displayed]);

  const trendChart = useMemo(() => {
    const mLabels  = months.map(mlabel);
    const entities = entityId ? displayed : displayed.slice(0, 5);
    const colors   = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6'];
    return {
      labels: mLabels,
      datasets: entities.map((a, i) => ({
        label: a.label, data: a.monthlyTrend.map(t => t.avgKm),
        borderColor: colors[i % 5], backgroundColor: colors[i % 5] + '20',
        tension: 0.35, fill: false, pointRadius: 4, spanGaps: true,
      })),
    };
  }, [displayed, months, entityId]);

  const entityList = mode === 'vehicles'
    ? vehicles.map(v => ({ id: v.id, label: `${v.plate}${v.brand ? ` — ${v.brand} ${v.model}` : ''}` }))
    : drivers.map(d => ({ id: d.id, label: `${d.name} ${d.lastname}` }));

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h2 className="text-lg font-semibold text-slate-900">Análisis de rendimiento</h2>
          <p className="text-sm text-slate-500">Eficiencia, comparativas y pérdidas estimadas por combustible</p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-sm">
          {(['vehicles','drivers'] as ViewMode[]).map(m => (
            <button key={m} onClick={() => { setMode(m); setEntityId(''); }}
              className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors', mode === m ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
            >
              {m === 'vehicles' ? <Truck className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
              {m === 'vehicles' ? 'Vehículos' : 'Conductores'}
            </button>
          ))}
        </div>
        {/* Cost-type filter */}
        <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-sm">
          {(['all', 'fuel', 'maintenance'] as CostFilter[]).map((cf) => (
            <button
              key={cf}
              onClick={() => setCostFilter(cf)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors',
                costFilter === cf ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {cf === 'all'         && <DollarSign className="h-3.5 w-3.5" />}
              {cf === 'fuel'        && <Fuel       className="h-3.5 w-3.5" />}
              {cf === 'maintenance' && <Wrench     className="h-3.5 w-3.5" />}
              {cf === 'all' ? 'Todo' : cf === 'fuel' ? 'Combustible' : 'Mantenimiento'}
            </button>
          ))}
        </div>
        {/* Date range */}
        <div className="flex items-center gap-2">
          <input type="month" value={fromMonth} max={toMonth}
            onChange={e => setFromMonth(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm outline-none focus:ring-1 focus:ring-brand-500"
          />
          <span className="text-slate-400 text-xs">→</span>
          <input type="month" value={toMonth} min={fromMonth}
            onChange={e => setToMonth(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {/* Entity selector */}
        <div className="relative">
          <select value={entityId} onChange={e => setEntityId(e.target.value)}
            className="appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 py-1.5 text-sm text-slate-700 shadow-sm outline-none max-w-[220px]"
          >
            <option value="">{mode === 'vehicles' ? 'Todos los vehículos' : 'Todos los conductores'}</option>
            {entityList.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        </div>
      </div>

      {loading ? <PageLoader /> : costFilter === 'maintenance' ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <Wrench className="h-10 w-10 text-slate-200" />
          <p className="text-sm font-medium text-slate-500">Análisis de mantenimiento próximamente</p>
          <p className="text-xs text-slate-400">Selecciona &quot;Todo&quot; o &quot;Combustible&quot; para ver el análisis de rendimiento</p>
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <Fuel className="h-10 w-10 text-slate-200" />
          <p className="text-sm font-medium text-slate-500">Sin datos de repostaje en el período seleccionado</p>
          <p className="text-xs text-slate-400">Prueba ampliando el rango de fechas o cambiando el filtro</p>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Rendimiento promedio"
              value={fleetAvg != null ? `${formatNumber(fleetAvg, 2)} km/L` : '—'}
              sub={`${displayed.reduce((s,a)=>s+a.loads,0)} repostajes registrados`}
              icon={Fuel} iconBg="bg-blue-50" iconColor="text-blue-600"
              tip="Promedio de km por litro de todos los repostajes del período."
            />
            <KpiCard title="Mejor rendidor"
              value={bestEntity?.avgKmPerUnit != null ? `${formatNumber(bestEntity.avgKmPerUnit,2)} km/L` : '—'}
              sub={bestEntity?.label}
              icon={Award} iconBg="bg-emerald-50" iconColor="text-emerald-600" highlight="green"
              tip="La entidad con mayor km/L promedio en el período seleccionado."
            />
            <KpiCard title="Peor rendidor"
              value={worstEntity?.avgKmPerUnit != null ? `${formatNumber(worstEntity.avgKmPerUnit,2)} km/L` : '—'}
              sub={worstEntity?.label}
              icon={TrendingDown} iconBg="bg-red-50" iconColor="text-red-500"
              highlight={worstEntity && bestEntity && worstEntity.id !== bestEntity.id ? 'red' : 'none'}
              tip="La entidad con menor km/L promedio. Candidata a revisión mecánica o de hábitos."
            />
            <KpiCard title="Pérdida estimada (período)"
              value={formatCurrency(totalLoss)}
              sub={totalLoss > 0 ? `≈ ${formatCurrency(totalLoss / (months.length||1))}/mes` : 'Sin exceso detectado'}
              icon={AlertTriangle} iconBg="bg-amber-50" iconColor="text-amber-600"
              highlight={totalLoss > 0 ? 'amber' : 'none'}
              tip="Dinero estimado gastado de más por rendir menos de lo esperado: (litros reales − litros ideales para los km recorridos) × precio/L por repostaje."
            />
          </div>

          {/* Charts */}
          <div className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-xl bg-white border border-slate-100 shadow-card p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Ranking de rendimiento</h3>
              <p className="text-xs text-slate-400 mb-4">Verde &gt; ref+10% · Azul: dentro del rango · Rojo &lt; ref−10%</p>
              <div style={{ height: Math.max(160, rankingChart.labels.length * 34) }}>
                <Bar data={rankingChart} options={{ ...BASE_OPTS, indexAxis: 'y' as const, scales: { x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 } } }, y: { grid: { display: false }, ticks: { font: { size: 11 } } } } }} />
              </div>
            </div>

            <div className="rounded-xl bg-white border border-slate-100 shadow-card p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Tendencia mensual km/L</h3>
              <p className="text-xs text-slate-400 mb-4">{entityId ? 'Evolución del período seleccionado' : 'Top 5 entidades del período'}</p>
              <div style={{ height: 220 }}>
                <Line data={trendChart} options={{ ...BASE_OPTS, plugins: { legend: { display: !entityId && displayed.length > 1, position: 'bottom' as const, labels: { font: { size: 11 }, boxWidth: 12 } } } }} />
              </div>
            </div>
          </div>

          {/* Efficiency & loss table */}
          <div className="rounded-xl bg-white border border-slate-100 shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Análisis de eficiencia y pérdidas</h3>
                <p className="text-xs text-slate-400">Comparación real vs rendimiento esperado del vehículo</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{mode === 'vehicles' ? 'Vehículo' : 'Conductor'}</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">km/L Real</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">km/L Esperado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <Tooltip text="(km/L real ÷ km/L esperado) × 100. Sobre 110% = Óptimo."><span>Eficiencia %</span><InfoIcon /></Tooltip>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <Tooltip text="Litros consumidos de más respecto al rendimiento esperado del vehículo."><span>Litros extra</span><InfoIcon /></Tooltip>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <Tooltip text="Litros extra × precio promedio/L del período."><span>$ Pérdida est.</span><InfoIcon /></Tooltip>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <Tooltip text="Ahorro mensual potencial si el rendimiento igualara el esperado."><span>Ahorro pot./mes</span><InfoIcon /></Tooltip>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {displayed.map(a => {
                    const saving = a.estimatedLoss / (months.length || 1);
                    const pct    = a.efficiencyPct;
                    let sv: 'success'|'info'|'warning'|'danger' = 'info', sl = 'Sin ref.';
                    if (pct != null) {
                      if (pct >= 110)      { sv = 'success'; sl = 'Óptimo'; }
                      else if (pct >= 90)  { sv = 'info';    sl = 'Esperado'; }
                      else if (pct >= 75)  { sv = 'warning'; sl = 'Bajo'; }
                      else                 { sv = 'danger';  sl = 'Crítico'; }
                    }
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800">{a.label}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">{a.avgKmPerUnit != null ? `${formatNumber(a.avgKmPerUnit,2)} km/L` : '—'}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{a.refKmPerUnit != null ? `${formatNumber(a.refKmPerUnit,2)} km/L` : <span className="text-slate-300">No definido</span>}</td>
                        <td className="px-4 py-3 text-right">
                          {pct != null
                            ? <span className={cn('font-semibold', pct>=110?'text-emerald-600':pct>=90?'text-blue-600':pct>=75?'text-amber-600':'text-red-600')}>{formatNumber(pct,1)}%</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {a.refKmPerUnit != null
                            ? <span className={cn('font-medium', a.excessLiters>0?'text-red-600':'text-emerald-600')}>{a.excessLiters>0?'+':''}{formatNumber(a.excessLiters,1)} L</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {a.estimatedLoss > 0
                            ? <span className="font-semibold text-red-600">{formatCurrency(a.estimatedLoss)}</span>
                            : a.refKmPerUnit != null
                              ? <span className="text-emerald-600 font-semibold">{formatCurrency(0)}</span>
                              : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {a.estimatedLoss > 0 ? <span className="text-amber-700 font-medium">{formatCurrency(saving)}/mes</span> : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center"><Badge variant={sv} size="sm">{sl}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
                {displayed.length > 1 && (
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                    <tr>
                      <td className="px-4 py-3 text-xs font-bold uppercase text-slate-500">TOTAL / PROM.</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{fleetAvg != null ? `${formatNumber(fleetAvg,2)} km/L` : '—'}</td>
                      <td colSpan={3} />
                      <td className="px-4 py-3 text-right font-bold text-red-600">{totalLoss > 0 ? formatCurrency(totalLoss) : '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-amber-700">{totalLoss > 0 ? `${formatCurrency(totalLoss/(months.length||1))}/mes` : '—'}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Driver comparison bar (drivers mode, multiple, no entity filter) */}
          {mode === 'drivers' && !entityId && displayed.filter(a=>a.avgKmPerUnit!=null).length >= 2 && (
            <div className="rounded-xl bg-white border border-slate-100 shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                <Users className="h-4 w-4 text-blue-500" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Comparativa entre conductores</h3>
                  <p className="text-xs text-slate-400">Diferencia de rendimiento respecto al mejor del período</p>
                </div>
              </div>
              <div className="divide-y divide-slate-50">
                {[...displayed].filter(a=>a.avgKmPerUnit!=null)
                  .sort((a,b)=>(b.avgKmPerUnit??0)-(a.avgKmPerUnit??0))
                  .map((a, i, arr) => {
                    const best = arr[0].avgKmPerUnit!;
                    const pct  = ((a.avgKmPerUnit??0)/best)*100;
                    const isTop  = i === 0;
                    const isLast = i === arr.length - 1 && arr.length > 1;
                    return (
                      <div key={a.id} className="flex items-center gap-4 px-5 py-3.5">
                        <span className={cn('text-xs font-bold w-5 text-center shrink-0', isTop?'text-emerald-600':isLast?'text-red-500':'text-slate-400')}>#{i+1}</span>
                        <span className="w-40 truncate text-sm font-medium text-slate-800 shrink-0">{a.label}</span>
                        <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className={cn('h-full rounded-full', isTop?'bg-emerald-500':pct>=90?'bg-blue-400':pct>=75?'bg-amber-400':'bg-red-400')} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-sm font-semibold text-slate-700 w-24 text-right shrink-0">{formatNumber(a.avgKmPerUnit!,2)} km/L</span>
                        {isTop
                          ? <span className="text-xs text-emerald-600 w-28 text-right shrink-0 font-semibold">✓ Mejor</span>
                          : <span className="text-xs text-red-500 w-28 text-right shrink-0">−{formatNumber(best-a.avgKmPerUnit!,2)} km/L vs mejor</span>}
                        <span className={cn('text-xs w-28 text-right shrink-0', a.estimatedLoss>0?'text-amber-700 font-medium':'text-slate-300')}>
                          {a.estimatedLoss > 0 ? `${formatCurrency(a.estimatedLoss)} perdido` : '—'}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
