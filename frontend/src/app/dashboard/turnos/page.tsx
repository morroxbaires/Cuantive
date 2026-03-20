'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, ClipboardList, Pencil, Trash2, CalendarDays, TrendingUp, Gauge, Route, Hash } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useTurnos }      from '@/hooks/useTurnos';
import { vehiclesService } from '@/services/vehicles.service';
import { driversService }  from '@/services/drivers.service';
import { turnosService }   from '@/services/turnos.service';
import { Table }           from '@/components/ui/Table';
import { Button }          from '@/components/ui/Button';
import { Badge }           from '@/components/ui/Badge';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input }           from '@/components/ui/Input';
import { Select }          from '@/components/ui/Select';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState }      from '@/components/ui/EmptyState';
import { PageLoader }      from '@/components/ui/Spinner';
import { Tooltip, InfoIcon } from '@/components/ui/Tooltip';
import { formatDate, formatNumber, debounce } from '@/lib/utils';
import type { Turno, TurnoStats, Vehicle, Driver } from '@/types';
import type { TurnoPayload } from '@/services/turnos.service';

// ─── Zod schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  vehicleId:   z.string().min(1,  'Seleccioná un vehículo'),
  driverId:    z.string().min(1,  'Seleccioná un conductor'),
  shiftDate:   z.string().min(1,  'La fecha es obligatoria'),
  shiftNumber: z.coerce.number().int().positive('Debe ser un número positivo'),
  totalFichas: z.coerce.number().min(0, 'No puede ser negativo'),
  kmOcupados:  z.coerce.number().min(0, 'No puede ser negativo'),
  kmLibres:    z.coerce.number().min(0, 'No puede ser negativo'),
  notes:       z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateInput(iso: string): string {
  return iso ? iso.slice(0, 10) : '';
}

function StatRow({ label, value, sub, tooltip }: { label: string; value: string; sub?: string; tooltip?: string }) {
  return (
    <div className="flex flex-col">
      {tooltip ? (
        <Tooltip text={tooltip}>
          <span className="text-xs text-slate-500 uppercase font-medium tracking-wide leading-none mb-0.5">{label}</span>
          <InfoIcon />
        </Tooltip>
      ) : (
        <span className="text-xs text-slate-500 uppercase font-medium tracking-wide leading-none mb-0.5">{label}</span>
      )}
      <span className="text-xl font-bold text-slate-900 leading-tight">{value}</span>
      {sub && <span className="text-xs text-slate-400 mt-0.5">{sub}</span>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TurnosPage() {
  const {
    turnos, total, totalPages, loading, filters,
    setFilters, create, update, remove,
  } = useTurnos();

  const [modal,    setModal]    = useState<'create' | 'edit' | null>(null);
  const [selected, setSelected] = useState<Turno | null>(null);
  const [confirm,  setConfirm]  = useState<Turno | null>(null);
  const [stats,    setStats]    = useState<TurnoStats | null>(null);

  // Catalogs
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers,  setDrivers]  = useState<Driver[]>([]);

  // Computed km total preview
  const [kmOcupPreview, setKmOcupPreview] = useState(0);
  const [kmLibrePreview, setKmLibrePreview] = useState(0);

  const {
    register, handleSubmit, reset, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const watchKmOcup  = watch('kmOcupados');
  const watchKmLibre = watch('kmLibres');
  const kmTotal      = (Number(watchKmOcup) || 0) + (Number(watchKmLibre) || 0);

  // Load catalogs on mount
  useEffect(() => {
    vehiclesService.getAll({ limit: 200, active: true })
      .then((r) => setVehicles(r.data))
      .catch(() => {});
    driversService.getAll({ limit: 200, active: true })
      .then((r) => setDrivers(r.data))
      .catch(() => {});
  }, []);

  // Load stats
  useEffect(() => {
    turnosService.getStats({
      dateFrom:  filters.dateFrom,
      dateTo:    filters.dateTo,
      vehicleId: filters.vehicleId,
      driverId:  filters.driverId,
    }).then(setStats).catch(() => {});
  }, [filters.dateFrom, filters.dateTo, filters.vehicleId, filters.driverId]);

  // Modal helpers
  const openCreate = () => {
    reset({ vehicleId: '', driverId: '', shiftDate: '', shiftNumber: undefined as unknown as number, totalFichas: 0, kmOcupados: 0, kmLibres: 0, notes: '' });
    setSelected(null);
    setModal('create');
  };

  const openEdit = (t: Turno) => {
    setSelected(t);
    reset({
      vehicleId:   t.vehicleId,
      driverId:    t.driverId,
      shiftDate:   toDateInput(t.shiftDate),
      shiftNumber: t.shiftNumber,
      totalFichas: t.totalFichas,
      kmOcupados:  t.kmOcupados,
      kmLibres:    t.kmLibres,
      notes:       t.notes ?? '',
    });
    setModal('edit');
  };

  const closeModal = () => { setModal(null); setSelected(null); reset(); };

  const onSubmit = async (data: FormValues) => {
    const payload: TurnoPayload = {
      vehicleId:   data.vehicleId,
      driverId:    data.driverId,
      shiftDate:   data.shiftDate,
      shiftNumber: data.shiftNumber,
      totalFichas: data.totalFichas,
      kmOcupados:  data.kmOcupados,
      kmLibres:    data.kmLibres,
      notes:       data.notes || undefined,
    };
    if (modal === 'create') await create(payload);
    if (modal === 'edit' && selected) await update(selected.id, payload);
    closeModal();
  };

  const handleSearch = debounce(
    (q: string) => setFilters((f) => ({ ...f, search: q, page: 1 })),
    350,
  );

  // ─── Vehicle / Driver labels ─────────────────────────────────────────────
  const vehicleLabel = (v: Vehicle) => `${v.plate} — ${v.brand ?? ''} ${v.model ?? ''}`.trim();
  const driverLabel  = (d: Driver)  => `${d.name} ${d.lastname}`;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Turnos</h2>
          <p className="text-sm text-slate-500">{total} turno{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          Nuevo turno
        </Button>
      </div>

      {/* ── Stats strip ────────────────────────────────────────────────── */}
      {stats && stats.totalTurnos > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-5">
          <Card padding="sm" className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50">
              <ClipboardList className="h-4 w-4 text-brand-600" />
            </div>
            <StatRow label="Turnos" value={String(stats.totalTurnos)} />
          </Card>
          <Card padding="sm" className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50">
              <Hash className="h-4 w-4 text-amber-600" />
            </div>
            <StatRow label="Fichas" value={formatNumber(stats.totalFichas, 0)} sub={`Avg ${formatNumber(stats.avgFichas, 1)}`} tooltip="Total de fichas acumuladas en los turnos filtrados. 'Avg' = total fichas ÷ cantidad de turnos." />
          </Card>
          <Card padding="sm" className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
              <Route className="h-4 w-4 text-emerald-600" />
            </div>
            <StatRow label="Km Totales" value={`${formatNumber(stats.totalKmTotales, 0)} km`} sub={`Avg ${formatNumber(stats.avgKmTotales, 1)} km`} tooltip="Km ocupados + km libres de cada turno. 'Avg' = km totales ÷ cantidad de turnos." />
          </Card>
          <Card padding="sm" className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50">
              <Gauge className="h-4 w-4 text-blue-600" />
            </div>
            <StatRow label="Km Ocupados" value={`${formatNumber(stats.totalKmOcupados, 0)} km`} tooltip="Suma de km recorridos con pasajeros o con servicio activo en todos los turnos filtrados." />
          </Card>
          <Card padding="sm" className="flex items-center gap-3 col-span-2 sm:col-span-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-50">
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </div>
            <StatRow label="Eficiencia" value={`${formatNumber(stats.eficienciaKm, 1)}%`} sub="km ocupados / totales" tooltip="(km ocupados ÷ km totales) × 100. Indica qué porcentaje del recorrido total se realizó con servicio activo." />
          </Card>
        </div>
      )}

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por patente o conductor…"
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500 hover:border-slate-300"
          />
        </div>

        {/* Vehicle filter */}
        <select
          onChange={(e) => setFilters((f) => ({ ...f, vehicleId: e.target.value || undefined, page: 1 }))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none w-full sm:w-44"
        >
          <option value="">Todos los vehículos</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}
        </select>

        {/* Driver filter */}
        <select
          onChange={(e) => setFilters((f) => ({ ...f, driverId: e.target.value || undefined, page: 1 }))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none w-full sm:w-44"
        >
          <option value="">Todos los conductores</option>
          {drivers.map((d) => <option key={d.id} value={d.id}>{d.name} {d.lastname}</option>)}
        </select>

        {/* Date range */}
        <input
          type="date"
          onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined, page: 1 }))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none w-full sm:w-36"
          title="Desde"
        />
        <input
          type="date"
          onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value || undefined, page: 1 }))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none w-full sm:w-36"
          title="Hasta"
        />
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {loading ? <PageLoader /> : turnos.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Sin turnos registrados"
          description="Registrá el primer turno de la flota"
          action={<Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Nuevo turno</Button>}
        />
      ) : (
        <Table
          data={turnos as unknown as Record<string, unknown>[]}
          keyField="id"
          page={filters.page ?? 1}
          totalPages={totalPages}
          onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
          columns={[
            {
              key: 'shiftDate', label: 'Fecha',
              render: (row) => {
                const t = row as unknown as Turno;
                return (
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-800">{formatDate(t.shiftDate)}</span>
                  </div>
                );
              },
            },
            {
              key: 'shiftNumber', label: 'N° Turno',
              render: (row) => {
                const t = row as unknown as Turno;
                return <Badge variant="info">Turno {t.shiftNumber}</Badge>;
              },
            },
            {
              key: 'vehicle', label: 'Vehículo',
              render: (row) => {
                const t = row as unknown as Turno;
                return (
                  <div>
                    <span className="font-semibold text-slate-900 font-mono tracking-wide">{t.vehicle?.plate ?? '—'}</span>
                    {(t.vehicle?.brand || t.vehicle?.model) && (
                      <span className="block text-xs text-slate-400">{t.vehicle?.brand} {t.vehicle?.model}</span>
                    )}
                  </div>
                );
              },
            },
            {
              key: 'driver', label: 'Conductor',
              render: (row) => {
                const t = row as unknown as Turno;
                return t.driver
                  ? <span>{t.driver.name} {t.driver.lastname}</span>
                  : <span className="text-slate-400">—</span>;
              },
            },
            {
              key: 'totalFichas', label: 'Fichas',
              render: (row) => {
                const t = row as unknown as Turno;
                return <span className="font-semibold">{formatNumber(t.totalFichas, 0)}</span>;
              },
            },
            {
              key: 'kmOcupados', label: 'Km Ocup.',
              render: (row) => {
                const t = row as unknown as Turno;
                return <span>{formatNumber(t.kmOcupados, 1)} km</span>;
              },
            },
            {
              key: 'kmLibres', label: 'Km Libres',
              render: (row) => {
                const t = row as unknown as Turno;
                return <span>{formatNumber(t.kmLibres, 1)} km</span>;
              },
            },
            {
              key: 'kmTotales', label: 'Km Total',
              render: (row) => {
                const t = row as unknown as Turno;
                const pct = t.kmTotales > 0
                  ? Math.round((t.kmOcupados / t.kmTotales) * 100)
                  : 0;
                return (
                  <div>
                    <span className="font-semibold text-slate-900">{formatNumber(t.kmTotales, 1)} km</span>
                    <span className={`block text-xs ${pct >= 60 ? 'text-emerald-500' : pct >= 40 ? 'text-amber-500' : 'text-red-400'}`}>
                      {pct}% ocupado
                    </span>
                  </div>
                );
              },
            },
            {
              key: 'actions', label: '', width: '90px',
              render: (row) => {
                const t = row as unknown as Turno;
                return (
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => openEdit(t)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirm(t)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              },
            },
          ]}
        />
      )}

      {/* ── Create / Edit Modal ─────────────────────────────────────────── */}
      <Modal
        open={modal !== null}
        onClose={closeModal}
        title={modal === 'create' ? 'Nuevo turno' : 'Editar turno'}
        subtitle={modal === 'edit' && selected ? `Turno ${selected.shiftNumber} — ${formatDate(selected.shiftDate)}` : undefined}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button loading={isSubmitting} onClick={handleSubmit(onSubmit)}>
              {modal === 'create' ? 'Registrar turno' : 'Guardar cambios'}
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          {/* Row 1: Vehicle + Driver */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Vehículo"
              required
              error={errors.vehicleId?.message}
              options={vehicles.map((v) => ({ value: v.id, label: vehicleLabel(v) }))}
              placeholder="Seleccionar vehículo…"
              {...register('vehicleId')}
            />
            <Select
              label="Conductor"
              required
              error={errors.driverId?.message}
              options={drivers.map((d) => ({ value: d.id, label: driverLabel(d) }))}
              placeholder="Seleccionar conductor…"
              {...register('driverId')}
            />
          </div>

          {/* Row 2: Date + Shift number */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Fecha de turno"
              type="date"
              required
              error={errors.shiftDate?.message}
              {...register('shiftDate')}
            />
            <Input
              label="Número de turno"
              type="number"
              min={1}
              placeholder="1"
              required
              error={errors.shiftNumber?.message}
              leading={<Hash className="h-3.5 w-3.5" />}
              {...register('shiftNumber')}
            />
          </div>

          {/* Row 3: Fichas */}
          <Input
            label="Fichas totales"
            type="number"
            min={0}
            step="0.01"
            placeholder="0"
            required
            error={errors.totalFichas?.message}
            {...register('totalFichas')}
            onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
          />

          {/* Row 4: Km fields */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Km ocupados"
              type="number"
              min={0}
              step="0.1"
              placeholder="0"
              required
              error={errors.kmOcupados?.message}
              leading={<Route className="h-3.5 w-3.5" />}
              {...register('kmOcupados')}
              onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
            />
            <Input
              label="Km libres"
              type="number"
              min={0}
              step="0.1"
              placeholder="0"
              required
              error={errors.kmLibres?.message}
              leading={<Route className="h-3.5 w-3.5" />}
              {...register('kmLibres')}
              onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
            />
            {/* Calculated total — read only */}
            <div className="w-full">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Km totales <span className="text-xs font-normal text-slate-400">(calculado)</span>
              </label>
              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                <Route className="mr-2 h-3.5 w-3.5 text-slate-400" />
                {formatNumber(kmTotal, 1)} km
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="w-full">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Notas</label>
            <textarea
              rows={2}
              placeholder="Observaciones opcionales…"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500 hover:border-slate-300 resize-none"
              {...register('notes')}
            />
          </div>
        </form>
      </Modal>

      {/* ── Confirm delete ─────────────────────────────────────────────── */}
      <ConfirmModal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm) await remove(confirm.id);
          setConfirm(null);
        }}
        title="Eliminar turno"
        description={confirm
          ? `¿Eliminás el turno ${confirm.shiftNumber} del ${formatDate(confirm.shiftDate)}? Esta acción no se puede deshacer.`
          : ''}
        variant="danger"
      />
    </div>
  );
}
