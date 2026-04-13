'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip as ChartTooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import {
  TrendingDown, AlertTriangle, Award, Fuel, Users, Truck, ChevronDown, DollarSign, Wrench, Download,
  AlignLeft, BarChart2, TrendingUp, ScatterChart,
} from 'lucide-react';
import { fuelLoadsService }  from '@/services/fuel-loads.service';
import { vehiclesService }   from '@/services/vehicles.service';
import { driversService }    from '@/services/drivers.service';
import { analyticsService }  from '@/services/analytics.service';
import { formatNumber, formatCurrency, cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type { FuelLoad, Vehicle, Driver, DriverSiniestroRankingRow } from '@/types';
import { PageLoader } from '@/components/ui/Spinner';
import { Badge }      from '@/components/ui/Badge';
import { Tooltip, InfoIcon } from '@/components/ui/Tooltip';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, ChartTooltip, Legend, Filler,
);

type RankingView = 'list' | 'line' | 'vbar';
type TrendView   = 'area' | 'line' | 'bar';

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewMode = 'vehicles' | 'drivers';
type CostFilter = 'all' | 'fuel' | 'maintenance';

interface EntityAnalytics {
  id:              string;
  label:           string;
  loads:           number;
  totalLitersFuel: number;          // litros (nafta/gasoil)
  totalKwhElec:    number;          // kWh (eléctrico)
  totalKm:         number;          // km estimados combinados
  avgKmPerLiter:   number | null;   // km/L (combustible)
  avgKmPerKwh:     number | null;   // km/kWh (eléctrico)
  isElectric:      boolean;         // true si principalmente usa kWh
  refKmPerUnit:    number | null;
  efficiencyPct:   number | null;
  excessUnits:     number;          // L extra (comb.) o kWh extra (eléc.)
  estimatedLoss:   number;
  avgUnitPrice:    number | null;
  monthlyTrend:    { month: string; avgKm: number | null }[];
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

    let totalLitersFuel = 0, totalKwhElec = 0, totalKm = 0;
    let kmFuelAccum = 0, kmElecAccum = 0;
    let totalCost = 0, pricedUnits = 0, excessUnits = 0;
    for (const l of eLoads) {
      const lit    = Number(l.litersOrKwh ?? 0);
      const kpu    = l.kmPerUnit != null ? Number(l.kmPerUnit) : null;
      const price  = l.unitPrice  != null ? Number(l.unitPrice) : null;
      const isElec = l.fuelType?.unit === 'kwh';
      if (isElec) {
        totalKwhElec += lit;
        if (kpu != null) kmElecAccum += kpu * lit;
      } else {
        totalLitersFuel += lit;
        if (kpu != null) kmFuelAccum += kpu * lit;
      }
      if (kpu != null) totalKm += kpu * lit;
      if (price != null && lit > 0) { totalCost += price * lit; pricedUnits += lit; }
      if (kpu != null && entityRef != null && entityRef > 0 && kpu > 0) {
        excessUnits += lit - (kpu * lit) / entityRef;
      }
    }

    const isElectric    = totalKwhElec >= totalLitersFuel;
    const avgKmPerLiter = kmFuelAccum > 0 && totalLitersFuel > 0 ? kmFuelAccum / totalLitersFuel : null;
    const avgKmPerKwh   = kmElecAccum > 0 && totalKwhElec > 0   ? kmElecAccum / totalKwhElec   : null;
    const avgKmPrimary  = isElectric ? avgKmPerKwh : avgKmPerLiter;
    const avgUnitPrice  = pricedUnits > 0 ? totalCost / pricedUnits : null;
    const efficiencyPct = avgKmPrimary != null && entityRef != null && entityRef > 0
      ? (avgKmPrimary / entityRef) * 100 : null;
    const estimatedLoss = excessUnits > 0 && avgUnitPrice != null ? excessUnits * avgUnitPrice : 0;

    const monthlyTrend = months.map(mo => {
      const ml = eLoads.filter(l => l.date.startsWith(mo));
      let mLitFuel = 0, mKmFuel = 0, mLitElec = 0, mKmElec = 0;
      for (const l of ml) {
        const lit    = Number(l.litersOrKwh ?? 0);
        const kpu    = l.kmPerUnit != null ? Number(l.kmPerUnit) : null;
        const isElec = l.fuelType?.unit === 'kwh';
        if (isElec) { mLitElec += lit; if (kpu != null) mKmElec += kpu * lit; }
        else        { mLitFuel += lit; if (kpu != null) mKmFuel += kpu * lit; }
      }
      const avgKm = isElectric
        ? (mLitElec > 0 && mKmElec > 0 ? mKmElec / mLitElec : null)
        : (mLitFuel > 0 && mKmFuel > 0 ? mKmFuel / mLitFuel : null);
      return { month: mo, avgKm };
    });

    results.push({
      id, label, loads: eLoads.length,
      totalLitersFuel, totalKwhElec, totalKm,
      avgKmPerLiter, avgKmPerKwh, isElectric,
      refKmPerUnit: entityRef ?? null,
      efficiencyPct, excessUnits, estimatedLoss, avgUnitPrice, monthlyTrend,
    });
  }
  return results.sort((a, b) => {
    const ap = a.isElectric ? (a.avgKmPerKwh ?? 0) : (a.avgKmPerLiter ?? 0);
    const bp = b.isElectric ? (b.avgKmPerKwh ?? 0) : (b.avgKmPerLiter ?? 0);
    return bp - ap;
  });
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

// ─── RankingList ─────────────────────────────────────────────────────────────

// ─── ChartViewToggle ─────────────────────────────────────────────────────

function ChartViewToggle<T extends string>({
  value, onChange, options,
}: {
  value:    T;
  onChange: (v: T) => void;
  options:  { value: T; icon: React.ElementType; label: string }[];
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
      {options.map(({ value: v, icon: Icon, label }) => (
        <button
          key={v}
          type="button"
          title={label}
          onClick={() => onChange(v)}
          className={cn(
            'flex items-center justify-center h-6 w-6 rounded-md transition-colors',
            value === v
              ? 'bg-white text-brand-600 shadow-sm'
              : 'text-slate-400 hover:text-slate-600',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}

function RankingList({ data }: { data: EntityAnalytics[] }) {
  if (data.length === 0) return <p className="text-sm text-slate-400 py-10 text-center">Sin datos en el período</p>;
  const maxVal = Math.max(...data.map(a => a.isElectric ? (a.avgKmPerKwh ?? 0) : (a.avgKmPerLiter ?? 0)));
  return (
    <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight: 340 }}>
      {data.map((a, i) => {
        const val    = a.isElectric ? (a.avgKmPerKwh ?? 0) : (a.avgKmPerLiter ?? 0);
        const barPct = maxVal > 0 ? (val / maxVal) * 100 : 0;
        const refPct = a.refKmPerUnit && maxVal > 0 ? (a.refKmPerUnit / maxVal) * 100 : null;
        const eff    = a.efficiencyPct;
        const isOpt  = eff != null && eff >= 105;
        const isOk   = eff != null && eff >= 85 && eff < 105;
        const isBad  = eff != null && eff < 85;
        const barCls = isOpt ? 'bg-emerald-400' : isOk ? 'bg-blue-400' : isBad ? 'bg-red-400' : a.isElectric ? 'bg-emerald-300' : 'bg-blue-300';
        const rowBg  = isOpt ? 'bg-emerald-50/60' : isBad ? 'bg-red-50/50' : 'bg-slate-50/60';
        const valCls = isOpt ? 'text-emerald-700' : isBad ? 'text-red-600' : a.isElectric ? 'text-emerald-700' : 'text-blue-700';
        const badgeCls = isOpt ? 'bg-emerald-100 text-emerald-700' : isOk ? 'bg-blue-100 text-blue-700' : isBad ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500';
        return (
          <div key={a.id} className={`rounded-lg px-3 py-2.5 ${rowBg} group`}>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-bold text-slate-400 w-5 shrink-0 tabular-nums">#{i + 1}</span>
                <span className="text-xs font-semibold text-slate-700 truncate">
                  {a.isElectric ? `⚡ ${a.label}` : a.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`text-xs font-bold tabular-nums ${valCls}`}>
                  {a.isElectric ? `${formatNumber(val, 2)} km/kWh` : `${formatNumber(val, 2)} km/L`}
                </span>
                {eff != null && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${badgeCls}`}>
                    {formatNumber(eff, 0)}%
                  </span>
                )}
              </div>
            </div>
            <div className="relative h-2 rounded-full bg-slate-200/80 overflow-visible">
              <div
                className={`h-full rounded-full transition-all duration-700 ${barCls}`}
                style={{ width: `${barPct}%` }}
              />
              {refPct != null && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-px h-3.5 bg-slate-500/50 rounded-full"
                  style={{ left: `${refPct}%` }}
                  title={`Referencia: ${formatNumber(a.refKmPerUnit!, 2)} ${a.isElectric ? 'km/kWh' : 'km/L'}`}
                />
              )}
            </div>
          </div>
        );
      })}
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
  const { user } = useAuth();
  const now = currentYearMonth();

  // ─ Chart view preferences (persisted per user in localStorage) ─────────────────────
  const storageKey = useCallback(
    (k: string) => `cuantive:${user?.id ?? 'anon'}:${k}`,
    [user?.id],
  );
  const [rankingView, setRankingViewState] = useState<RankingView>(() => {
    if (typeof window === 'undefined') return 'list';
    return (localStorage.getItem(`cuantive:${typeof window !== 'undefined' ? (document.cookie.match(/user_id=([^;]+)/)?.[1] ?? '') : ''}:rankingView`) as RankingView) ?? 'list';
  });
  const [trendView, setTrendViewState] = useState<TrendView>(() => {
    if (typeof window === 'undefined') return 'area';
    return (localStorage.getItem(`cuantive:${typeof window !== 'undefined' ? (document.cookie.match(/user_id=([^;]+)/)?.[1] ?? '') : ''}:trendView`) as TrendView) ?? 'area';
  });

  // Re-load prefs once user is known (hydration)
  useEffect(() => {
    if (!user?.id) return;
    const rv = localStorage.getItem(storageKey('rankingView')) as RankingView | null;
    const tv = localStorage.getItem(storageKey('trendView'))   as TrendView   | null;
    if (rv) setRankingViewState(rv);
    if (tv) setTrendViewState(tv);
  }, [user?.id, storageKey]);

  const setRankingView = useCallback((v: RankingView) => {
    setRankingViewState(v);
    localStorage.setItem(storageKey('rankingView'), v);
  }, [storageKey]);

  const setTrendView = useCallback((v: TrendView) => {
    setTrendViewState(v);
    localStorage.setItem(storageKey('trendView'), v);
  }, [storageKey]);
  const [mode,      setMode]      = useState<ViewMode>('vehicles');
  const [fromMonth, setFromMonth] = useState(() => prevYearMonth(now, 5));
  const [toMonth,   setToMonth]   = useState(now);
  const [entityId,  setEntityId]  = useState('');
  const [costFilter, setCostFilter] = useState<CostFilter>('all');
  const [vehicles,  setVehicles]  = useState<Vehicle[]>([]);
  const [drivers,   setDrivers]   = useState<Driver[]>([]);
  const [loads,     setLoads]     = useState<FuelLoad[]>([]);
  const [siniestroRanking, setSiniestroRanking] = useState<DriverSiniestroRankingRow[]>([]);
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
    Promise.all([
      fuelLoadsService.getAll(params as Parameters<typeof fuelLoadsService.getAll>[0]),
      analyticsService.getDriversSiniestroRanking({ from, to }),
    ])
      .then(([r, ranking]) => { setLoads(r.data); setSiniestroRanking(ranking); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [mode, fromMonth, toMonth, entityId]);

  const months    = useMemo(() => monthsBetween(fromMonth, toMonth), [fromMonth, toMonth]);
  const analytics = useMemo(() => computeAnalytics(loads, vehicles, mode, months), [loads, vehicles, mode, months]);
  const displayed = entityId ? analytics.filter(a => a.id === entityId) : analytics;

  const fuelDisplayed = useMemo(() => displayed.filter(a => !a.isElectric), [displayed]);
  const elecDisplayed = useMemo(() => displayed.filter(a =>  a.isElectric), [displayed]);

  const fleetAvgFuel = useMemo(() => {
    const tKm  = fuelDisplayed.reduce((s,a) => s + (a.avgKmPerLiter ?? 0) * a.totalLitersFuel, 0);
    const tLit = fuelDisplayed.reduce((s,a) => s + a.totalLitersFuel, 0);
    return tKm > 0 && tLit > 0 ? tKm / tLit : null;
  }, [fuelDisplayed]);

  const fleetAvgElec = useMemo(() => {
    const tKm  = elecDisplayed.reduce((s,a) => s + (a.avgKmPerKwh ?? 0) * a.totalKwhElec, 0);
    const tKwh = elecDisplayed.reduce((s,a) => s + a.totalKwhElec, 0);
    return tKm > 0 && tKwh > 0 ? tKm / tKwh : null;
  }, [elecDisplayed]);

  const totalLoss   = useMemo(() => displayed.reduce((s, a) => s + a.estimatedLoss, 0), [displayed]);
  const bestFuel    = useMemo(() => fuelDisplayed.filter(a => a.avgKmPerLiter != null)[0] ?? null, [fuelDisplayed]);
  const worstFuel   = useMemo(() => [...fuelDisplayed].filter(a => a.avgKmPerLiter != null).at(-1) ?? null, [fuelDisplayed]);
  const bestElec    = useMemo(() => elecDisplayed.filter(a => a.avgKmPerKwh != null)[0] ?? null, [elecDisplayed]);
  const worstElec   = useMemo(() => [...elecDisplayed].filter(a => a.avgKmPerKwh != null).at(-1) ?? null, [elecDisplayed]);

  const rankingData = useMemo(() => (
    [...displayed]
      .filter(a => a.isElectric ? a.avgKmPerKwh != null : a.avgKmPerLiter != null)
      .sort((a, b) => {
        const ap = a.isElectric ? (a.avgKmPerKwh ?? 0) : (a.avgKmPerLiter ?? 0);
        const bp = b.isElectric ? (b.avgKmPerKwh ?? 0) : (b.avgKmPerLiter ?? 0);
        return bp - ap;
      })
  ), [displayed]);

  const rankingBarChart = useMemo(() => {
    const FUEL_C  = '#60a5fa';
    const ELEC_C  = '#34d399';
    const BAD_C   = '#f87171';
    const labels  = rankingData.map(a => a.isElectric ? `⚡ ${a.label}` : a.label);
    const values  = rankingData.map(a => a.isElectric ? a.avgKmPerKwh : a.avgKmPerLiter);
    const colors  = rankingData.map(a => {
      const avg = a.isElectric ? a.avgKmPerKwh : a.avgKmPerLiter;
      if (!a.refKmPerUnit) return a.isElectric ? ELEC_C : FUEL_C;
      const p = (avg ?? 0) / a.refKmPerUnit;
      return p >= 1.05 ? '#34d399' : p >= 0.85 ? FUEL_C : BAD_C;
    });
    return { labels, datasets: [{ label: 'km/L · km/kWh', data: values, backgroundColor: colors, borderRadius: 5, borderSkipped: false, barThickness: 'flex' as const }] };
  }, [rankingData]);

  const trendChart = useMemo(() => {
    const mLabels      = months.map(mlabel);
    const entities     = entityId ? displayed : displayed.slice(0, 5);
    const FUEL_COLORS  = ['#3b82f6', '#2563eb', '#60a5fa', '#1d4ed8', '#93c5fd'];
    const ELEC_COLORS  = ['#10b981', '#059669', '#34d399', '#047857', '#6ee7b7'];
    let fi = 0, ei = 0;
    return {
      labels: mLabels,
      datasets: entities.map(a => {
        const c = a.isElectric ? ELEC_COLORS[ei++ % ELEC_COLORS.length] : FUEL_COLORS[fi++ % FUEL_COLORS.length];
        return {
          label: a.isElectric ? `⚡ ${a.label}` : a.label,
          data: a.monthlyTrend.map(t => t.avgKm),
          borderColor: c,
          backgroundColor: c + '28',
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
          spanGaps: true,
        };
      }),
    };
  }, [displayed, months, entityId]);

  const entityList = mode === 'vehicles'
    ? vehicles.map(v => ({ id: v.id, label: `${v.plate}${v.brand ? ` — ${v.brand} ${v.model}` : ''}` }))
    : drivers.map(d => ({ id: d.id, label: `${d.name} ${d.lastname}` }));

  const downloadCSV = () => {
    const esc = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = [
      mode === 'vehicles' ? 'Vehículo' : 'Conductor',
      'Tipo', 'Repostajes', 'Litros', 'kWh', 'KM estimados',
      'Km/L', 'Km/kWh', 'Ref. Esperada', 'Eficiencia %',
      'Exceso (L o kWh)', 'Pérdida Est. ($)', 'Ahorro Pot./Mes ($)', 'Estado',
    ];
    const dataRows = displayed.map(a => {
      const pct = a.efficiencyPct;
      let estado = 'Sin ref.';
      if (pct != null) {
        if (pct >= 110) estado = 'Óptimo';
        else if (pct >= 90) estado = 'Esperado';
        else if (pct >= 75) estado = 'Bajo';
        else estado = 'Crítico';
      }
      const saving = a.estimatedLoss / (months.length || 1);
      return [
        a.label,
        a.isElectric ? 'Eléctrico' : 'Combustible',
        a.loads,
        Number(a.totalLitersFuel.toFixed(1)),
        Number(a.totalKwhElec.toFixed(1)),
        Number(a.totalKm.toFixed(0)),
        a.avgKmPerLiter != null ? Number(a.avgKmPerLiter.toFixed(2)) : '',
        a.avgKmPerKwh   != null ? Number(a.avgKmPerKwh.toFixed(2))   : '',
        a.refKmPerUnit  != null ? Number(a.refKmPerUnit.toFixed(2))  : '',
        pct != null ? Number(pct.toFixed(1)) : '',
        a.refKmPerUnit != null ? Number(a.excessUnits.toFixed(1)) : '',
        Number(a.estimatedLoss.toFixed(2)),
        a.estimatedLoss > 0 ? Number(saving.toFixed(2)) : '',
        estado,
      ];
    });
    const csv = '\uFEFF' + [headers, ...dataRows].map(row => (row as (string | number | null)[]).map(esc).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
      download: `analytics-${mode}-${fromMonth}-${toMonth}.csv`,
    });
    a.click(); URL.revokeObjectURL(a.href);
  };

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

        {/* CSV Download */}
        {user?.canDownloadMetrics && (
          <button
            onClick={downloadCSV}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-800 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Descargar CSV
          </button>
        )}
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
            {/* Rendimiento combustible */}
            {fleetAvgFuel != null && (
              <KpiCard title="Rendimiento km/L"
                value={`${formatNumber(fleetAvgFuel, 2)} km/L`}
                sub={`${fuelDisplayed.reduce((s,a)=>s+a.loads,0)} repostaje${fuelDisplayed.reduce((s,a)=>s+a.loads,0) !== 1 ? 's' : ''} de combustible`}
                icon={Fuel} iconBg="bg-blue-50" iconColor="text-blue-600"
                tip="Promedio ponderado de km/L de los repostajes de nafta y gasoil del período."
              />
            )}
            {/* Rendimiento eléctrico */}
            {fleetAvgElec != null && (
              <KpiCard title="Rendimiento km/kWh"
                value={`${formatNumber(fleetAvgElec, 2)} km/kWh`}
                sub={`${elecDisplayed.reduce((s,a)=>s+a.loads,0)} repostajes eléctricos`}
                icon={Fuel} iconBg="bg-emerald-50" iconColor="text-emerald-600"
                tip="Promedio ponderado de km/kWh de los repostajes de vehículos eléctricos del período."
              />
            )}
            {/* Fallback sin datos de rendimiento */}
            {fleetAvgFuel == null && fleetAvgElec == null && (
              <KpiCard title="Rendimiento promedio"
                value="—"
                sub={`${displayed.reduce((s,a)=>s+a.loads,0)} repostajes registrados`}
                icon={Fuel} iconBg="bg-blue-50" iconColor="text-blue-600"
                tip="Sin datos de rendimiento en el período."
              />
            )}
            {/* Mejor rendidor km/L */}
            {bestFuel && (
              <KpiCard title="Mejor km/L"
                value={bestFuel.avgKmPerLiter != null ? `${formatNumber(bestFuel.avgKmPerLiter,2)} km/L` : '—'}
                sub={bestFuel.label}
                icon={Award} iconBg="bg-emerald-50" iconColor="text-emerald-600" highlight="green"
                tip="Entidad con mayor km/L promedio en el período seleccionado."
              />
            )}
            {/* Mejor rendidor km/kWh */}
            {bestElec && (
              <KpiCard title="Mejor km/kWh"
                value={bestElec.avgKmPerKwh != null ? `${formatNumber(bestElec.avgKmPerKwh,2)} km/kWh` : '—'}
                sub={`⚡ ${bestElec.label}`}
                icon={Award} iconBg="bg-green-50" iconColor="text-green-600" highlight="green"
                tip="Vehículo eléctrico con mayor km/kWh promedio en el período seleccionado."
              />
            )}
            {/* Peor rendidor km/L */}
            {worstFuel && worstFuel.id !== bestFuel?.id && (
              <KpiCard title="Peor km/L"
                value={worstFuel.avgKmPerLiter != null ? `${formatNumber(worstFuel.avgKmPerLiter,2)} km/L` : '—'}
                sub={worstFuel.label}
                icon={TrendingDown} iconBg="bg-red-50" iconColor="text-red-500" highlight="red"
                tip="Entidad con menor km/L promedio. Candidata a revisión mecánica o de hábitos."
              />
            )}
            {/* Peor rendidor km/kWh */}
            {worstElec && worstElec.id !== bestElec?.id && (
              <KpiCard title="Peor km/kWh"
                value={worstElec.avgKmPerKwh != null ? `${formatNumber(worstElec.avgKmPerKwh,2)} km/kWh` : '—'}
                sub={`⚡ ${worstElec.label}`}
                icon={TrendingDown} iconBg="bg-red-50" iconColor="text-red-500" highlight="red"
                tip="Vehículo eléctrico con menor km/kWh promedio."
              />
            )}
            <KpiCard title="Pérdida estimada (período)"
              value={formatCurrency(totalLoss)}
              sub={totalLoss > 0 ? `≈ ${formatCurrency(totalLoss / (months.length||1))}/mes` : 'Sin exceso detectado'}
              icon={AlertTriangle} iconBg="bg-amber-50" iconColor="text-amber-600"
              highlight={totalLoss > 0 ? 'amber' : 'none'}
              tip="Dinero estimado gastado de más por rendir menos de lo esperado: (unidades reales − unidades ideales para los km recorridos) × precio/unidad por repostaje."
            />
          </div>

          {/* Charts */}
          <div className="grid gap-5 xl:grid-cols-2">
            {/* ── Ranking de rendimiento ── */}
            <div className="rounded-xl bg-white border border-slate-100 shadow-card p-5">
              <div className="flex items-start justify-between mb-1">
                <h3 className="text-sm font-semibold text-slate-900">Ranking de rendimiento</h3>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />Óptimo</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-blue-400" />Esperado</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-400" />Exceso</span>
                  </div>
                  <ChartViewToggle<RankingView>
                    value={rankingView}
                    onChange={setRankingView}
                    options={[
                      { value: 'list',  icon: AlignLeft,       label: 'Lista de barras' },
                      { value: 'line',  icon: TrendingUp,      label: 'Línea de ranking' },
                      { value: 'vbar',  icon: BarChart2,       label: 'Barras verticales' },
                    ]}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                {rankingView === 'list'
                  ? 'La línea vertical gris marca el rendimiento de referencia del vehículo'
                  : rankingView === 'line'
                  ? 'Curva de rendimiento ordenada de mayor a menor'
                  : 'Color según eficiencia vs. referencia'}
              </p>
              {rankingView === 'list' ? (
                <RankingList data={rankingData} />
              ) : rankingView === 'line' ? (
                <div style={{ height: 240 }}>
                  <Line
                    data={{
                      labels: rankingData.map((a, i) => `#${i + 1} ${a.isElectric ? '⚡' : ''} ${a.label}`),
                      datasets: [{
                        label: 'km/L · km/kWh',
                        data: rankingData.map(a => a.isElectric ? a.avgKmPerKwh : a.avgKmPerLiter),
                        borderColor: '#3b82f6',
                        backgroundColor: '#3b82f620',
                        pointBackgroundColor: rankingData.map(a => {
                          const avg = a.isElectric ? a.avgKmPerKwh : a.avgKmPerLiter;
                          if (!a.refKmPerUnit) return a.isElectric ? '#34d399' : '#60a5fa';
                          const p = (avg ?? 0) / a.refKmPerUnit;
                          return p >= 1.05 ? '#34d399' : p >= 0.85 ? '#60a5fa' : '#f87171';
                        }),
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        tension: 0.3,
                        fill: true,
                        borderWidth: 2,
                        spanGaps: true,
                      }],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          callbacks: {
                            label: (ctx) => {
                              const a = rankingData[ctx.dataIndex];
                              if (!a || ctx.raw == null) return '';
                              const unit = a.isElectric ? 'km/kWh' : 'km/L';
                              return ` ${formatNumber(ctx.raw as number, 2)} ${unit}`;
                            },
                          },
                        },
                      },
                      scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 40 } },
                        y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } }, beginAtZero: false },
                      },
                    }}
                  />
                </div>
              ) : (
                <div style={{ height: Math.max(200, rankingData.length * 52) }}>
                  <Bar
                    data={rankingBarChart}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      indexAxis: 'x' as const,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          callbacks: {
                            label: (ctx) => {
                              const a = rankingData[ctx.dataIndex];
                              if (!a) return '';
                              const unit = a.isElectric ? 'km/kWh' : 'km/L';
                              return ` ${formatNumber(ctx.raw as number, 2)} ${unit}`;
                            },
                          },
                        },
                      },
                      scales: {
                        x: {
                          grid: { color: 'transparent' },
                          ticks: { font: { size: 10 }, maxRotation: 45 },
                        },
                        y: {
                          grid: { color: '#f1f5f9' },
                          ticks: { font: { size: 10 } },
                          beginAtZero: true,
                        },
                      },
                    }}
                  />
                </div>
              )}
            </div>

            {/* ── Tendencia mensual ── */}
            <div className="rounded-xl bg-white border border-slate-100 shadow-card p-5">
              <div className="flex items-start justify-between mb-1">
                <h3 className="text-sm font-semibold text-slate-900">Tendencia mensual de rendimiento</h3>
                <div className="flex items-center gap-2">
                  {(fuelDisplayed.length > 0 && elecDisplayed.length > 0) && (
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-0.5 rounded bg-blue-500" />Combustible</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-0.5 rounded bg-emerald-500" />Eléctrico</span>
                    </div>
                  )}
                  <ChartViewToggle<TrendView>
                    value={trendView}
                    onChange={setTrendView}
                    options={[
                      { value: 'area',  icon: TrendingUp,  label: 'Área (tendencia rellena)' },
                      { value: 'line',  icon: ScatterChart, label: 'Líneas y puntos' },
                      { value: 'bar',   icon: BarChart2,   label: 'Barras agrupadas' },
                    ]}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400 mb-3">{entityId ? 'Evolución km/unidad por mes' : 'Top 5 · km/L o km/kWh por mes'}</p>
              <div style={{ height: 240 }}>
                {trendView === 'bar' ? (
                  <Bar
                    data={trendChart}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      interaction: { mode: 'index' as const, intersect: false },
                      plugins: {
                        legend: {
                          display: !entityId && displayed.length > 1,
                          position: 'bottom' as const,
                          labels: { font: { size: 11 }, boxWidth: 10, padding: 14, usePointStyle: true, pointStyle: 'circle' },
                        },
                        tooltip: {
                          callbacks: {
                            label: (ctx) => {
                              const ents = entityId ? displayed : displayed.slice(0, 5);
                              const a = ents[ctx.datasetIndex];
                              if (!a || ctx.raw == null) return '';
                              const unit = a.isElectric ? 'km/kWh' : 'km/L';
                              return ` ${ctx.dataset.label}: ${formatNumber(ctx.raw as number, 2)} ${unit}`;
                            },
                          },
                        },
                      },
                      scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                        y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 } }, beginAtZero: false },
                      },
                    }}
                  />
                ) : (
                  <Line
                    data={{
                      ...trendChart,
                      datasets: trendChart.datasets.map(ds => ({
                        ...ds,
                        fill:        trendView === 'area',
                        tension:     trendView === 'area' ? 0.4 : 0.1,
                        pointRadius: trendView === 'line' ? 5 : 4,
                        borderWidth: trendView === 'line' ? 1.5 : 2,
                        backgroundColor: trendView === 'area' ? ds.backgroundColor : 'transparent',
                      })),
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      interaction: { mode: 'index' as const, intersect: false },
                      plugins: {
                        legend: {
                          display: !entityId && displayed.length > 1,
                          position: 'bottom' as const,
                          labels: { font: { size: 11 }, boxWidth: 10, padding: 14, usePointStyle: true, pointStyle: 'circle' },
                        },
                        tooltip: {
                          callbacks: {
                            label: (ctx) => {
                              const ents = entityId ? displayed : displayed.slice(0, 5);
                              const a = ents[ctx.datasetIndex];
                              if (!a || ctx.raw == null) return '';
                              const unit = a.isElectric ? 'km/kWh' : 'km/L';
                              return ` ${ctx.dataset.label}: ${formatNumber(ctx.raw as number, 2)} ${unit}`;
                            },
                          },
                        },
                      },
                      scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                        y: {
                          grid: { color: '#f1f5f9' },
                          ticks: { font: { size: 11 } },
                          beginAtZero: false,
                        },
                      },
                    }}
                  />
                )}
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
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Rendimiento real</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ref. esperada</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <Tooltip text="(rendimiento real ÷ referencia esperada) × 100. Sobre 110% = Óptimo."><span>Eficiencia %</span><InfoIcon /></Tooltip>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <Tooltip text="Unidades (L o kWh) consumidas de más respecto al rendimiento esperado del vehículo."><span>Exceso consumo</span><InfoIcon /></Tooltip>
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
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          {a.isElectric
                            ? (a.avgKmPerKwh  != null ? `${formatNumber(a.avgKmPerKwh, 2)} km/kWh` : '—')
                            : (a.avgKmPerLiter != null ? `${formatNumber(a.avgKmPerLiter, 2)} km/L`  : '—')}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500">
                          {a.refKmPerUnit != null
                            ? `${formatNumber(a.refKmPerUnit,2)} ${a.isElectric ? 'km/kWh' : 'km/L'}`
                            : <span className="text-slate-300">No definido</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {pct != null
                            ? <span className={cn('font-semibold', pct>=110?'text-emerald-600':pct>=90?'text-blue-600':pct>=75?'text-amber-600':'text-red-600')}>{formatNumber(pct,1)}%</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {a.refKmPerUnit != null
                            ? <span className={cn('font-medium', a.excessUnits>0?'text-red-600':'text-emerald-600')}>{a.excessUnits>0?'+':''}{formatNumber(a.excessUnits,1)} {a.isElectric ? 'kWh' : 'L'}</span>
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
                      <td className="px-4 py-3 text-right font-bold text-slate-800">
                        {fleetAvgFuel != null && <span className="block">{formatNumber(fleetAvgFuel,2)} km/L</span>}
                        {fleetAvgElec != null && <span className="block text-emerald-700">{formatNumber(fleetAvgElec,2)} km/kWh</span>}
                        {fleetAvgFuel == null && fleetAvgElec == null && '—'}
                      </td>
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

          {/* Siniestros driver ranking */}
          {siniestroRanking.length > 0 && (
            <div className="rounded-xl bg-white border border-slate-100 shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Ranking conductores por siniestros</h3>
                  <p className="text-xs text-slate-400">Conductores con mayor costo acumulado en siniestros/daños en el período</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 w-12">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Conductor</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Siniestros</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Costo total (UYU)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {siniestroRanking.map((row, i) => (
                      <tr key={row.driverId} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <span className={cn('text-xs font-bold', i === 0 ? 'text-red-600' : i === 1 ? 'text-orange-500' : 'text-slate-400')}>
                            #{row.position}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{row.driver}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{row.totalCount}</td>
                        <td className="px-4 py-3 text-right font-semibold text-red-600">{formatCurrency(row.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Driver comparison bar (drivers mode, multiple, no entity filter) */}
          {mode === 'drivers' && !entityId && (() => {
            const primaryKm = (a: EntityAnalytics) => a.isElectric ? (a.avgKmPerKwh ?? 0) : (a.avgKmPerLiter ?? 0);
            const hasPrimary = (a: EntityAnalytics) => a.isElectric ? a.avgKmPerKwh != null : a.avgKmPerLiter != null;
            const fuelDrivers = displayed.filter(a => !a.isElectric && hasPrimary(a));
            const elecDrivers = displayed.filter(a =>  a.isElectric && hasPrimary(a));

            const renderGroup = (group: EntityAnalytics[], unit: string, title: string) => {
              if (group.length < 2) return null;
              const sorted = [...group].sort((a,b) => primaryKm(b) - primaryKm(a));
              const best = primaryKm(sorted[0]);
              return (
                <div className="rounded-xl bg-white border border-slate-100 shadow-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                    <Users className="h-4 w-4 text-blue-500" />
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                      <p className="text-xs text-slate-400">Diferencia de rendimiento respecto al mejor del período</p>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {sorted.map((a, i, arr) => {
                      const km     = primaryKm(a);
                      const pct    = best > 0 ? (km / best) * 100 : 0;
                      const isTop  = i === 0;
                      const isLast = i === arr.length - 1;
                      return (
                        <div key={a.id} className="flex items-center gap-4 px-5 py-3.5">
                          <span className={cn('text-xs font-bold w-5 text-center shrink-0', isTop?'text-emerald-600':isLast?'text-red-500':'text-slate-400')}>#{i+1}</span>
                          <span className="w-40 truncate text-sm font-medium text-slate-800 shrink-0">{a.label}</span>
                          <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className={cn('h-full rounded-full', isTop?'bg-emerald-500':pct>=90?'bg-blue-400':pct>=75?'bg-amber-400':'bg-red-400')} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-sm font-semibold text-slate-700 w-28 text-right shrink-0">{formatNumber(km,2)} {unit}</span>
                          {isTop
                            ? <span className="text-xs text-emerald-600 w-28 text-right shrink-0 font-semibold">✓ Mejor</span>
                            : <span className="text-xs text-red-500 w-28 text-right shrink-0">−{formatNumber(best-km,2)} {unit} vs mejor</span>}
                          <span className={cn('text-xs w-28 text-right shrink-0', a.estimatedLoss>0?'text-amber-700 font-medium':'text-slate-300')}>
                            {a.estimatedLoss > 0 ? `${formatCurrency(a.estimatedLoss)} perdido` : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            };

            return (
              <>
                {renderGroup(fuelDrivers, 'km/L', 'Comparativa conductores — combustible')}
                {renderGroup(elecDrivers, 'km/kWh', 'Comparativa conductores — eléctrico')}
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}
