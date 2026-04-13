'use client';

import { useEffect, useState, useMemo } from 'react';
import { Truck, Users, Gauge, Fuel, Route, ChevronDown, Wrench, DollarSign, Download } from 'lucide-react';
import { PageLoader } from '@/components/ui/Spinner';
import { fuelLoadsService }   from '@/services/fuel-loads.service';
import { maintenanceService } from '@/services/maintenance.service';
import { vehiclesService }    from '@/services/vehicles.service';
import { driversService }     from '@/services/drivers.service';
import { formatNumber, formatCurrency, cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type { Vehicle, Driver, FuelLoad, Maintenance } from '@/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

type ViewMode   = 'vehicles' | 'drivers';

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthRange(ym: string): { from: string; to: string } {
  const [year, month] = ym.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${ym}-01`,
    to:   `${ym}-${String(lastDay).padStart(2, '0')}`,
  };
}

interface EntityStats {
  id:                string;
  label:             string;
  totalLoads:        number;
  totalLitersFuel:   number;     // litros (nafta/gasoil)
  totalKwhElec:      number;     // kWh (electric)
  totalKm:           number;     // combined km estimate
  kmFuelAccum:       number;     // Σ(kmPerUnit × liters) fuel
  kmElecAccum:       number;     // Σ(kmPerUnit × kWh) electric
  fuelCost:          number;
  maintenanceCost:   number;
  maintenanceCount:  number;
  avgKmPerLiter:     number | null;   // km/L (fuel only)
  avgKmPerKwh:       number | null;   // km/kWh (electric only)
}

function aggregateStats(
  loads: FuelLoad[],
  maintenances: Maintenance[],
  mode: ViewMode,
): EntityStats[] {
  const map = new Map<string, EntityStats>();

  const blank = (id: string, label: string): EntityStats => ({
    id, label, totalLoads: 0, totalLitersFuel: 0, totalKwhElec: 0, totalKm: 0,
    kmFuelAccum: 0, kmElecAccum: 0,
    fuelCost: 0, maintenanceCost: 0, maintenanceCount: 0,
    avgKmPerLiter: null, avgKmPerKwh: null,
  });

  // Aggregate fuel loads
  for (const load of loads) {
    let id: string;
    let label: string;
    if (mode === 'vehicles') {
      id    = load.vehicleId;
      label = load.vehicle?.plate ?? load.vehicleId.slice(0, 8);
    } else {
      if (!load.driverId) continue;
      id    = load.driverId;
      const d = load.driver;
      label = d ? `${d.name} ${d.lastname}` : load.driverId.slice(0, 8);
    }
    if (!map.has(id)) map.set(id, blank(id, label));
    const s      = map.get(id)!;
    const liters = Number(load.litersOrKwh ?? 0);
    const kmPerU = load.kmPerUnit != null ? Number(load.kmPerUnit) : null;
    const isElec = load.fuelType?.unit === 'kwh';
    s.totalLoads++;
    if (isElec) {
      s.totalKwhElec += liters;
      if (kmPerU != null) s.kmElecAccum += kmPerU * liters;
    } else {
      s.totalLitersFuel += liters;
      if (kmPerU != null) s.kmFuelAccum += kmPerU * liters;
    }
    if (kmPerU != null) s.totalKm += kmPerU * liters;
    s.fuelCost += load.priceTotal != null ? Number(load.priceTotal) : 0;
  }

  // Aggregate maintenance (only available per vehicle)
  if (mode === 'vehicles') {
    for (const m of maintenances) {
      const id    = m.vehicleId;
      const plate = (m as unknown as { vehicle?: { plate?: string } }).vehicle?.plate ?? id.slice(0, 8);
      if (!map.has(id)) map.set(id, blank(id, plate));
      const s = map.get(id)!;
      s.maintenanceCost  += Number(m.cost ?? 0);
      s.maintenanceCount++;
    }
  }

  for (const s of map.values()) {
    s.avgKmPerLiter = s.kmFuelAccum > 0 && s.totalLitersFuel > 0 ? s.kmFuelAccum / s.totalLitersFuel : null;
    s.avgKmPerKwh   = s.kmElecAccum > 0 && s.totalKwhElec > 0   ? s.kmElecAccum / s.totalKwhElec   : null;
  }

  return Array.from(map.values()).sort((a, b) => (b.fuelCost + b.maintenanceCost) - (a.fuelCost + a.maintenanceCost));
}

// ─── SummaryCard ─────────────────────────────────────────────────────────────

function SummaryCard({
  title, value, unit, icon: Icon, iconBg, iconColor,
}: {
  title: string; value: string | number; unit?: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
}) {
  return (
    <div className="rounded-xl bg-white border border-slate-100 shadow-card p-5 flex items-center gap-4">
      <div className={cn('flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl', iconBg)}>
        <Icon className={cn('h-5 w-5', iconColor)} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 uppercase font-medium tracking-wide truncate">{title}</p>
        <p className="text-xl font-bold text-slate-900 mt-0.5">
          {value}{unit && <span className="text-sm font-medium text-slate-400 ml-1">{' '}{unit}</span>}
        </p>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  // catalogue state (loaded once)
  const [vehicleList,    setVehicleList]    = useState<Vehicle[]>([]);
  const [driverList,     setDriverList]     = useState<Driver[]>([]);
  const [totalVehicles,  setTotalVehicles]  = useState(0);
  const [totalDrivers,   setTotalDrivers]   = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(true);

  // filter state
  const [mode,      setMode]      = useState<ViewMode>('vehicles');
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [entityId,  setEntityId]  = useState('');

  // fuel loads + maintenance for the selected filters
  const [loads,        setLoads]        = useState<FuelLoad[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [loadsLoading, setLoadsLoading] = useState(false);

  // Load catalogues once
  useEffect(() => {
    Promise.all([
      vehiclesService.getAll({ limit: 500 }),
      driversService.getAll({ limit: 500 }),
    ]).then(([vehs, drvs]) => {
      setVehicleList(vehs.data);
      setTotalVehicles(vehs.meta.total);
      setDriverList(drvs.data);
      setTotalDrivers(drvs.meta.total);
    }).catch(console.error)
      .finally(() => setCatalogLoading(false));
  }, []);

  // Load fuel loads + maintenance whenever filters change
  useEffect(() => {
    const { from, to } = monthRange(yearMonth);
    setLoadsLoading(true);

    const fuelParams: Record<string, unknown> = { from, to, limit: 1000 };
    const maintParams: Record<string, unknown> = { from, to, limit: 1000 };

    if (entityId) {
      if (mode === 'vehicles') {
        fuelParams.vehicleId  = entityId;
        maintParams.vehicleId = entityId;
      } else {
        fuelParams.driverId = entityId;
        // maintenance has no driverId filter — fetch all
      }
    }

    Promise.all([
      fuelLoadsService.getAll(fuelParams as Parameters<typeof fuelLoadsService.getAll>[0]),
      maintenanceService.getAll(maintParams as Parameters<typeof maintenanceService.getAll>[0]),
    ])
      .then(([fuels, maints]) => {
        setLoads(fuels.data);
        setMaintenances(maints.data);
      })
      .catch(console.error)
      .finally(() => setLoadsLoading(false));
  }, [mode, yearMonth, entityId]);

  // Reset entity selection when mode changes
  const handleModeChange = (next: ViewMode) => {
    setMode(next);
    setEntityId('');
  };

  const downloadCSV = () => {
    const esc = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const isVehicles = mode === 'vehicles';
    const headers = isVehicles
      ? ['Vehículo', 'Repostajes', 'Litros', 'kWh', 'Gasto Combust.', 'Cant. Mant.', 'Gasto Mant.', 'Gasto Total', 'KM Recorridos', 'Km/L', 'Km/kWh']
      : ['Conductor', 'Repostajes', 'Litros', 'kWh', 'Gasto Combust.', 'Gasto Total', 'KM Recorridos', 'Km/L', 'Km/kWh'];
    const dataRows = rows.map(r => {
      const base: (string | number | null)[] = [
        r.label, r.totalLoads,
        Number(r.totalLitersFuel.toFixed(1)),
        Number(r.totalKwhElec.toFixed(1)),
        Number(r.fuelCost.toFixed(2)),
      ];
      if (isVehicles) { base.push(r.maintenanceCount, Number(r.maintenanceCost.toFixed(2))); }
      base.push(
        Number((r.fuelCost + r.maintenanceCost).toFixed(2)),
        Number(r.totalKm.toFixed(0)),
        r.avgKmPerLiter != null ? Number(r.avgKmPerLiter.toFixed(2)) : '',
        r.avgKmPerKwh   != null ? Number(r.avgKmPerKwh.toFixed(2))   : '',
      );
      return base;
    });
    const totalRow: (string | number | null)[] = isVehicles
      ? ['TOTAL', totals.totalLoads, Number(totals.totalLitersFuel.toFixed(1)), Number(totals.totalKwhElec.toFixed(1)), Number(totals.totalFuelCost.toFixed(2)), rows.reduce((s, r) => s + r.maintenanceCount, 0), Number(totals.totalMaintCost.toFixed(2)), Number(totals.totalCost.toFixed(2)), Number(totals.totalKm.toFixed(0)), totals.avgKmPerLiterFuel != null ? Number(totals.avgKmPerLiterFuel.toFixed(2)) : '', totals.avgKmPerKwhElec != null ? Number(totals.avgKmPerKwhElec.toFixed(2)) : '']
      : ['TOTAL', totals.totalLoads, Number(totals.totalLitersFuel.toFixed(1)), Number(totals.totalKwhElec.toFixed(1)), Number(totals.totalFuelCost.toFixed(2)), Number(totals.totalCost.toFixed(2)), Number(totals.totalKm.toFixed(0)), totals.avgKmPerLiterFuel != null ? Number(totals.avgKmPerLiterFuel.toFixed(2)) : '', totals.avgKmPerKwhElec != null ? Number(totals.avgKmPerKwhElec.toFixed(2)) : ''];
    const csv = '\uFEFF' + [headers, ...dataRows, totalRow].map(row => (row as (string | number | null)[]).map(esc).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
      download: `dashboard-${mode}-${yearMonth}.csv`,
    });
    a.click(); URL.revokeObjectURL(a.href);
  };

  // Derived aggregated stats
  const rows = useMemo(
    () => aggregateStats(loads, maintenances, mode),
    [loads, maintenances, mode],
  );

  const totals = useMemo(() => {
    const totalLoads         = rows.reduce((s, r) => s + r.totalLoads, 0);
    const totalLitersFuel    = rows.reduce((s, r) => s + r.totalLitersFuel, 0);
    const totalKwhElec       = rows.reduce((s, r) => s + r.totalKwhElec, 0);
    const totalKm            = rows.reduce((s, r) => s + r.totalKm, 0);
    const totalFuelCost      = rows.reduce((s, r) => s + r.fuelCost, 0);
    const totalMaintCost     = rows.reduce((s, r) => s + r.maintenanceCost, 0);
    const totalCost          = totalFuelCost + totalMaintCost;
    const kmFuelAccum        = rows.reduce((s, r) => s + r.kmFuelAccum, 0);
    const kmElecAccum        = rows.reduce((s, r) => s + r.kmElecAccum, 0);
    const avgKmPerLiterFuel  = kmFuelAccum > 0 && totalLitersFuel > 0 ? kmFuelAccum / totalLitersFuel : null;
    const avgKmPerKwhElec    = kmElecAccum > 0 && totalKwhElec > 0   ? kmElecAccum / totalKwhElec   : null;
    return { totalLoads, totalLitersFuel, totalKwhElec, totalKm, totalFuelCost, totalMaintCost, totalCost, avgKmPerLiterFuel, avgKmPerKwhElec };
  }, [rows]);

  const entityCount = mode === 'vehicles' ? totalVehicles : totalDrivers;
  const entityLabel = mode === 'vehicles' ? 'vehículos' : 'conductores';
  const entityList  = mode === 'vehicles'
    ? vehicleList.map(v => ({ id: v.id, label: v.plate + (v.brand ? ` — ${v.brand} ${v.model}` : '') }))
    : driverList.map(d => ({ id: d.id, label: `${d.name} ${d.lastname}` }));

  const [ymYear, ymMonth] = yearMonth.split('-').map(Number);
  const monthLabel = new Date(ymYear, ymMonth - 1, 1)
    .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  if (catalogLoading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Filters bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h2 className="text-lg font-semibold text-slate-900">Panel de control</h2>
          <p className="text-sm text-slate-500 capitalize">{monthLabel}</p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-sm">
          <button onClick={() => handleModeChange('vehicles')} className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors', mode === 'vehicles' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            <Truck className="h-3.5 w-3.5" />Vehículos
          </button>
          <button onClick={() => handleModeChange('drivers')} className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors', mode === 'drivers' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            <Users className="h-3.5 w-3.5" />Conductores
          </button>
        </div>

        {/* Month selector */}
        <input type="month" value={yearMonth} onChange={e => setYearMonth(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />

        {/* Entity selector */}
        <div className="relative">
          <select value={entityId} onChange={e => setEntityId(e.target.value)}
            className="appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 py-1.5 text-sm text-slate-700 shadow-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 max-w-[220px]"
          >
            <option value="">{mode === 'vehicles' ? 'Todos los vehículos' : 'Todos los conductores'}</option>
            {entityList.map(e => (<option key={e.id} value={e.id}>{e.label}</option>))}
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

      {/* Summary cards — 2 rows of 3 */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          title={'Total ' + entityLabel}
          value={entityId
            ? (mode === 'vehicles'
                ? (vehicleList.find(v => v.id === entityId)?.plate ?? '—')
                : (driverList.find(d => d.id === entityId)?.name ?? '—'))
            : entityCount}
          unit={entityId ? undefined : entityLabel}
          icon={mode === 'vehicles' ? Truck : Users}
          iconBg={mode === 'vehicles' ? 'bg-brand-50' : 'bg-emerald-50'}
          iconColor={mode === 'vehicles' ? 'text-brand-600' : 'text-emerald-600'}
        />
        <SummaryCard
          title="Gasto total"
          value={formatCurrency(totals.totalCost)}
          icon={DollarSign}
          iconBg="bg-slate-100"
          iconColor="text-slate-600"
        />
        <SummaryCard
          title="Gasto combustible"
          value={formatCurrency(totals.totalFuelCost)}
          icon={Fuel}
          iconBg="bg-cyan-50"
          iconColor="text-cyan-600"
        />
        <SummaryCard
          title="Gasto mantenimiento"
          value={formatCurrency(totals.totalMaintCost)}
          icon={Wrench}
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
        />
        <SummaryCard
          title="KM recorridos"
          value={formatNumber(totals.totalKm, 0)}
          unit="km"
          icon={Route}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
        />
        {totals.avgKmPerLiterFuel != null && (
          <SummaryCard
            title="Rendimiento km/L"
            value={formatNumber(totals.avgKmPerLiterFuel, 2)}
            unit="km/L"
            icon={Gauge}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
          />
        )}
        {totals.avgKmPerKwhElec != null && (
          <SummaryCard
            title="Rendimiento km/kWh"
            value={formatNumber(totals.avgKmPerKwhElec, 2)}
            unit="km/kWh"
            icon={Gauge}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
          />
        )}
        {totals.avgKmPerLiterFuel == null && totals.avgKmPerKwhElec == null && (
          <SummaryCard
            title="Rendimiento promedio"
            value="—"
            icon={Gauge}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
          />
        )}
      </div>

      {/* Detail table */}
      <div className="rounded-xl bg-white border border-slate-100 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {mode === 'vehicles' ? 'Detalle por vehículo' : 'Detalle por conductor'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 capitalize">{monthLabel}</p>
          </div>
          {loadsLoading && (
            <span className="text-xs text-slate-400 animate-pulse">Cargando…</span>
          )}
        </div>

        {rows.length === 0 && !loadsLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Fuel className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">Sin registros en el período</p>
            <p className="text-xs text-slate-400">Prueba seleccionando otro mes o cambiando el filtro</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{mode === 'vehicles' ? 'Vehículo' : 'Conductor'}</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Repostajes</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Combustible</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Gasto combust.</th>
                  {mode === 'vehicles' && <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Mant.</th>}
                  {mode === 'vehicles' && <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Gasto mant.</th>}
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Gasto total</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">KM recorridos</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Rendimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-800">{r.label}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{r.totalLoads}</td>
                    <td className="px-5 py-3 text-right text-slate-600">
                      {r.totalLitersFuel > 0 && <span>{formatNumber(r.totalLitersFuel, 1)} L</span>}
                      {r.totalLitersFuel > 0 && r.totalKwhElec > 0 && <br />}
                      {r.totalKwhElec > 0 && <span>{formatNumber(r.totalKwhElec, 1)} kWh</span>}
                      {r.totalLitersFuel === 0 && r.totalKwhElec === 0 && '—'}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600">{r.fuelCost > 0 ? formatCurrency(r.fuelCost) : '—'}</td>
                    {mode === 'vehicles' && <td className="px-5 py-3 text-right text-slate-600">{r.maintenanceCount || '—'}</td>}
                    {mode === 'vehicles' && <td className="px-5 py-3 text-right text-slate-600">{r.maintenanceCost > 0 ? formatCurrency(r.maintenanceCost) : '—'}</td>}
                    <td className="px-5 py-3 text-right font-semibold text-slate-800">{formatCurrency(r.fuelCost + r.maintenanceCost)}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{r.totalKm > 0 ? formatNumber(r.totalKm, 0) + ' km' : '—'}</td>
                    <td className="px-5 py-3 text-right">
                      {r.avgKmPerLiter != null && (
                        <span className="font-semibold text-brand-600">{formatNumber(r.avgKmPerLiter, 2)} km/L</span>
                      )}
                      {r.avgKmPerLiter != null && r.avgKmPerKwh != null && <br />}
                      {r.avgKmPerKwh != null && (
                        <span className="font-semibold text-emerald-600">{formatNumber(r.avgKmPerKwh, 2)} km/kWh</span>
                      )}
                      {r.avgKmPerLiter == null && r.avgKmPerKwh == null && (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 1 && (
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Total</td>
                    <td className="px-5 py-3 text-right text-sm font-semibold text-slate-700">{totals.totalLoads}</td>
                    <td className="px-5 py-3 text-right text-sm font-semibold text-slate-700">
                      {totals.totalLitersFuel > 0 && <span>{formatNumber(totals.totalLitersFuel, 1)} L</span>}
                      {totals.totalLitersFuel > 0 && totals.totalKwhElec > 0 && <br />}
                      {totals.totalKwhElec > 0 && <span>{formatNumber(totals.totalKwhElec, 1)} kWh</span>}
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-semibold text-slate-700">{formatCurrency(totals.totalFuelCost)}</td>
                    {mode === 'vehicles' && <td className="px-5 py-3 text-right text-sm font-semibold text-slate-700">{rows.reduce((s,r) => s + r.maintenanceCount, 0) || '—'}</td>}
                    {mode === 'vehicles' && <td className="px-5 py-3 text-right text-sm font-semibold text-slate-700">{formatCurrency(totals.totalMaintCost)}</td>}
                    <td className="px-5 py-3 text-right text-sm font-semibold text-slate-800">{formatCurrency(totals.totalCost)}</td>
                    <td className="px-5 py-3 text-right text-sm font-semibold text-slate-700">{totals.totalKm > 0 ? formatNumber(totals.totalKm, 0) + ' km' : '—'}</td>
                    <td className="px-5 py-3 text-right text-sm font-semibold">
                      {totals.avgKmPerLiterFuel != null && (
                        <span className="block text-brand-600">{formatNumber(totals.avgKmPerLiterFuel, 2)} km/L</span>
                      )}
                      {totals.avgKmPerKwhElec != null && (
                        <span className="block text-emerald-600">{formatNumber(totals.avgKmPerKwhElec, 2)} km/kWh</span>
                      )}
                      {totals.avgKmPerLiterFuel == null && totals.avgKmPerKwhElec == null && '—'}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
