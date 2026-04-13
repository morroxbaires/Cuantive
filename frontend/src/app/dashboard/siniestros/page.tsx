'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, AlertTriangle, Pencil, Trash2, ImageIcon, Car } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useSiniestros }   from '@/hooks/useSiniestros';
import { vehiclesService } from '@/services/vehicles.service';
import { driversService  } from '@/services/drivers.service';
import { Table }             from '@/components/ui/Table';
import { Button }            from '@/components/ui/Button';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input }             from '@/components/ui/Input';
import { Select }            from '@/components/ui/Select';
import { EmptyState }        from '@/components/ui/EmptyState';
import { PageLoader }        from '@/components/ui/Spinner';
import type { Siniestro, Vehicle, Driver } from '@/types';
import { SiniestroPayload }  from '@/services/siniestros.service';
import { formatDate, formatCurrency, daysUntil } from '@/lib/utils';

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  vehicleId:    z.string().optional().transform(v => v || undefined),
  driverId:     z.string().optional().transform(v => v || undefined),
  fecha:        z.string().optional().transform(v => v || undefined),
  hora:         z.string().optional().transform(v => v || undefined),
  observaciones: z.string().optional().transform(v => v || undefined),
  costo:        z.union([z.coerce.number().min(0), z.literal('')]).optional(),
  estado:       z.enum(['PENDIENTE', 'EN_PROCESO', 'CERRADO', 'RECHAZADO']).default('PENDIENTE'),
  tipo:         z.enum(['CHOQUE', 'RASPADURA', 'ROBO', 'VANDALISMO', 'INCENDIO', 'OTRO', '']).optional().transform(v => v || undefined),
});
type FormValues = z.infer<typeof schema>;

// ─── Component ───────────────────────────────────────────────────────────────

export default function SiniestrosPage() {
  const { siniestros, total, totalPages, stats, loading, filters, setFilters, create, update, remove } = useSiniestros();
  const [vehicles,  setVehicles]  = useState<Vehicle[]>([]);
  const [drivers,   setDrivers]   = useState<Driver[]>([]);
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
  const [modal,     setModal]     = useState<'create' | 'edit' | null>(null);
  const [confirm,   setConfirm]   = useState<Siniestro | null>(null);
  const [selected,  setSelected]  = useState<Siniestro | null>(null);
  const [deleting,  setDeleting]  = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    vehiclesService.getAll({ active: true, limit: 200 }).then(r => setVehicles(r.data)).catch(() => {});
    driversService.getAll({ active: true, limit: 200 }).then(r => {
      setAllDrivers(r.data);
      setDrivers(r.data);
    }).catch(() => {});
  }, []);

  const { register, handleSubmit, reset, control, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fecha: new Date().toISOString().slice(0, 10) },
  });

  const watchedVehicleId = useWatch({ control, name: 'vehicleId' });

  // Filtrar conductores por vehículo seleccionado
  useEffect(() => {
    if (!watchedVehicleId) {
      setDrivers(allDrivers);
      return;
    }
    const vehicle = vehicles.find(v => v.id === watchedVehicleId);
    if (vehicle?.drivers && vehicle.drivers.length > 0) {
      const vehicleDriverIds = new Set(vehicle.drivers.map(d => d.id));
      const filtered = allDrivers.filter(d => vehicleDriverIds.has(d.id));
      setDrivers(filtered.length > 0 ? filtered : allDrivers);
    } else {
      setDrivers(allDrivers);
    }
  }, [watchedVehicleId, vehicles, allDrivers]);

  const openCreate = () => {
    reset({ fecha: new Date().toISOString().slice(0, 10), estado: 'PENDIENTE' });
    setSelected(null);
    setImageFile(null);
    setImagePreview(null);
    setModal('create');
  };

  const openEdit = (s: Siniestro) => {
    setSelected(s);
    reset({
      vehicleId:     s.vehicleId ?? '',
      driverId:      s.driverId  ?? '',
      fecha:         s.fecha     ? s.fecha.slice(0, 10)  : '',
      hora:          s.hora      ? new Date(s.hora).toISOString().slice(11, 16) : '',
      observaciones: s.observaciones ?? '',
      costo:         s.costo ?? '',
      estado:        s.estado ?? 'PENDIENTE',
      tipo:          s.tipo ?? '',
    });
    setImageFile(null);
    setImagePreview(null);
    setModal('edit');
  };

  const closeModal = () => { setModal(null); setSelected(null); reset(); setImageFile(null); setImagePreview(null); };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  };

  const onSubmit = async (data: FormValues) => {
    const payload: SiniestroPayload = {
      vehicleId:     data.vehicleId     || undefined,
      driverId:      data.driverId      || undefined,
      fecha:         data.fecha         || undefined,
      hora:          data.hora          || undefined,
      observaciones: data.observaciones || undefined,
      costo:         data.costo !== '' && data.costo !== undefined ? Number(data.costo) : undefined,
      estado:        data.estado,
      tipo:          data.tipo          || undefined,
    };
    if (modal === 'create') await create(payload, imageFile ?? undefined);
    if (modal === 'edit' && selected) await update(selected.id, payload, imageFile ?? undefined);
    closeModal();
  };

  const handleDelete = async () => {
    if (!confirm) return;
    setDeleting(true);
    try { await remove(confirm.id); } finally { setDeleting(false); setConfirm(null); }
  };

  const imageUrl = (sin: Siniestro) => sin.image?.storagePath
    ? `/uploads/${sin.image.storagePath}`
    : null;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Siniestros / Daños</h2>
          <p className="text-sm text-slate-500">{total} registro{total !== 1 ? 's' : ''}</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Nuevo siniestro</Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Costo total',   value: formatCurrency(stats.totalCost) },
            { label: 'Siniestros',    value: String(stats.totalCount) },
            {
              label: 'Conductor más costoso',
              value: stats.byDriver[0]
                ? `${stats.byDriver[0].name} (${formatCurrency(stats.byDriver[0].total)})`
                : '—',
            },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-white border border-slate-100 shadow-card px-4 py-3">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-0.5 text-base font-bold text-slate-900 truncate">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          className="w-full sm:w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filters.vehicleId ?? ''}
          onChange={e => setFilters({ vehicleId: e.target.value || undefined })}
        >
          <option value="">Todos los vehículos</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate}{v.brand ? ` — ${v.brand}` : ''}</option>)}
        </select>
        <select
          className="w-full sm:w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filters.driverId ?? ''}
          onChange={e => setFilters({ driverId: e.target.value || undefined })}
        >
          <option value="">Todos los conductores</option>
          {allDrivers.map(d => <option key={d.id} value={d.id}>{d.name} {d.lastname}{d.licenseExpiry && daysUntil(d.licenseExpiry) < 0 ? ' ⚠ Licencia vencida' : ''}</option>)}
        </select>
        <input
          type="date"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filters.from ?? ''}
          onChange={e => setFilters({ from: e.target.value || undefined })}
          placeholder="Desde"
        />
        <input
          type="date"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filters.to ?? ''}
          onChange={e => setFilters({ to: e.target.value || undefined })}
          placeholder="Hasta"
        />
        {(filters.vehicleId || filters.driverId || filters.from || filters.to) && (
          <button
            className="text-xs text-slate-500 hover:text-slate-700 underline whitespace-nowrap"
            onClick={() => setFilters({ vehicleId: undefined, driverId: undefined, from: undefined, to: undefined })}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? <PageLoader /> : siniestros.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="Sin siniestros registrados"
          description="Registra el primer siniestro o daño"
          action={<Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Nuevo siniestro</Button>}
        />
      ) : (
        <Table
          data={siniestros as unknown as Record<string, unknown>[]}
          keyField="id"
          page={filters.page}
          totalPages={totalPages}
          onPageChange={p => setFilters({ page: p })}
          columns={[
            {
              key: 'fecha',
              label: 'Fecha',
              render: row => {
                const s = row as unknown as Siniestro;
                return s.fecha ? formatDate(s.fecha) : <span className="text-slate-400">—</span>;
              },
            },
            {
              key: 'hora',
              label: 'Hora',
              render: row => {
                const s = row as unknown as Siniestro;
                if (!s.hora) return <span className="text-slate-400">—</span>;
                const t = new Date(s.hora);
                return `${String(t.getUTCHours()).padStart(2,'0')}:${String(t.getUTCMinutes()).padStart(2,'0')}`;
              },
            },
            {
              key: 'vehicle',
              label: 'Vehículo',
              render: row => {
                const s = row as unknown as Siniestro;
                return s.vehicle
                  ? <span className="font-medium font-mono">{s.vehicle.plate}</span>
                  : <span className="text-slate-400">—</span>;
              },
            },
            {
              key: 'driver',
              label: 'Conductor',
              render: row => {
                const s = row as unknown as Siniestro;
                return s.driver
                  ? `${s.driver.name} ${s.driver.lastname}`
                  : <span className="text-slate-400">—</span>;
              },
            },
            {
              key: 'costo',
              label: 'Costo (UYU)',
              render: row => {
                const s = row as unknown as Siniestro;
                return s.costo != null
                  ? <span className="font-semibold text-red-600">{formatCurrency(Number(s.costo))}</span>
                  : <span className="text-slate-400">—</span>;
              },
            },
            {
              key: 'tipo',
              label: 'Tipo',
              render: row => {
                const s = row as unknown as Siniestro;
                if (!s.tipo) return <span className="text-slate-400">—</span>;
                const labels: Record<string, string> = { CHOQUE: 'Choque', RASPADURA: 'Raspadura', ROBO: 'Robo', VANDALISMO: 'Vandalismo', INCENDIO: 'Incendio', OTRO: 'Otro' };
                return <span className="text-xs font-medium text-slate-600">{labels[s.tipo] ?? s.tipo}</span>;
              },
            },
            {
              key: 'estado',
              label: 'Estado',
              render: row => {
                const s = row as unknown as Siniestro;
                const map: Record<string, { label: string; cls: string }> = {
                  PENDIENTE:  { label: 'Pendiente',   cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
                  EN_PROCESO: { label: 'En proceso',  cls: 'bg-blue-50  text-blue-700  ring-1 ring-blue-200'  },
                  CERRADO:    { label: 'Cerrado',     cls: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200' },
                  RECHAZADO:  { label: 'Rechazado',   cls: 'bg-red-50   text-red-600   ring-1 ring-red-200'   },
                };
                const e = map[s.estado] ?? { label: s.estado, cls: 'bg-slate-100 text-slate-600' };
                return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${e.cls}`}>{e.label}</span>;
              },
            },
            {
              key: 'observaciones',
              label: 'Observaciones',
              render: row => {
                const s = row as unknown as Siniestro;
                if (!s.observaciones) return <span className="text-slate-400">—</span>;
                return (
                  <span className="max-w-[200px] truncate block text-slate-600 text-sm" title={s.observaciones}>
                    {s.observaciones}
                  </span>
                );
              },
            },
            {
              key: 'image',
              label: 'Imagen',
              render: row => {
                const s = row as unknown as Siniestro;
                if (!s.image) return <span className="text-slate-400">—</span>;
                return (
                  <a
                    href={`/api/files/${s.imageFile}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:underline text-xs"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    {s.image.originalName}
                  </a>
                );
              },
            },
            {
              key: 'actions',
              label: '',
              width: '80px',
              render: row => {
                const s = row as unknown as Siniestro;
                return (
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => openEdit(s)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setConfirm(s)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              },
            },
          ]}
        />
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modal !== null}
        onClose={closeModal}
        title={modal === 'create' ? 'Nuevo siniestro / daño' : 'Editar siniestro / daño'}
        footer={
          <>
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button loading={isSubmitting} onClick={handleSubmit(onSubmit)}>
              {modal === 'create' ? 'Registrar' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form className="grid grid-cols-2 gap-4" onSubmit={handleSubmit(onSubmit)}>
          {/* Vehículo */}
          <div className="col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-slate-700">Vehículo</label>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              {...register('vehicleId')}
            >
              <option value="">— Sin vehículo —</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.plate}{v.brand ? ` — ${v.brand} ${v.model ?? ''}` : ''}</option>
              ))}
            </select>
          </div>

          {/* Conductor */}
          <div className="col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-slate-700">Conductor</label>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              {...register('driverId')}
            >
              <option value="">— Sin conductor —</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.name} {d.lastname}{d.licenseExpiry && daysUntil(d.licenseExpiry) < 0 ? ' ⚠ Licencia vencida' : ''}</option>
              ))}
            </select>
          </div>

          {/* Fecha */}
          <div>
            <Input
              label="Fecha del siniestro"
              type="date"
              error={errors.fecha?.message}
              {...register('fecha')}
            />
          </div>

          {/* Hora */}
          <div>
            <Input
              label="Hora"
              type="time"
              error={errors.hora?.message}
              {...register('hora')}
            />
          </div>

          {/* Costo */}
          <div className="col-span-2">
            <Input
              label="Costo del daño (UYU)"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              error={errors.costo?.message}
              {...register('costo')}
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">Tipo</label>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              {...register('tipo')}
            >
              <option value="">— Sin especificar —</option>
              <option value="CHOQUE">Choque</option>
              <option value="RASPADURA">Raspadura</option>
              <option value="ROBO">Robo</option>
              <option value="VANDALISMO">Vandalismo</option>
              <option value="INCENDIO">Incendio</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>

          {/* Estado */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">Estado</label>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              {...register('estado')}
            >
              <option value="PENDIENTE">Pendiente</option>
              <option value="EN_PROCESO">En proceso</option>
              <option value="CERRADO">Cerrado</option>
              <option value="RECHAZADO">Rechazado</option>
            </select>
          </div>

          {/* Observaciones */}
          <div className="col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-slate-700">Observaciones</label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Descripción del siniestro o daño…"
              {...register('observaciones')}
            />
          </div>

          {/* Imagen */}
          <div className="col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-slate-700">Imagen del siniestro</label>
            <div
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 cursor-pointer hover:border-blue-400 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="max-h-40 rounded-lg object-contain" />
              ) : selected?.image ? (
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <ImageIcon className="h-5 w-5 text-slate-400" />
                  <span>Imagen actual: {selected.image.originalName}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-slate-400">
                  <ImageIcon className="h-8 w-8" />
                  <span className="text-xs">Clic para adjuntar imagen (JPG, PNG)</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>
            {imageFile && (
              <p className="mt-1 text-xs text-slate-500">{imageFile.name}</p>
            )}
          </div>
        </form>
      </Modal>

      {/* Confirm Delete */}
      <ConfirmModal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Eliminar siniestro"
        description="¿Estás seguro de eliminar este registro? Esta acción no se puede deshacer."
        variant="danger"
      />
    </div>
  );
}
