'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Pencil, Trash2, Star, QrCode, Award, TrendingDown, ImageIcon, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import QRCode from 'react-qr-code';

import { useSatisfacciones }  from '@/hooks/useSatisfacciones';
import { vehiclesService }    from '@/services/vehicles.service';
import { Table }              from '@/components/ui/Table';
import { Button }             from '@/components/ui/Button';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input }              from '@/components/ui/Input';
import { Select }             from '@/components/ui/Select';
import { EmptyState }         from '@/components/ui/EmptyState';
import { PageLoader }         from '@/components/ui/Spinner';
import { Badge }              from '@/components/ui/Badge';
import { ReactNode } from 'react';
import type { Satisfaccion, Vehicle } from '@/types';
import { SatisfaccionPayload } from '@/services/satisfacciones.service';
import { formatDate, cn } from '@/lib/utils';

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  vehicleId:    z.string().min(1, 'Selecciona un vehículo'),
  fecha:        z.string().optional().transform(v => v || undefined),
  hora:         z.string().optional().transform(v => v || undefined),
  puntuacion:   z.coerce.number().int().min(1).max(10, 'Puntuación 1-10'),
  observaciones: z.string().optional().transform(v => v || undefined),
});
type FormValues = z.infer<typeof schema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score?: number | null }) {
  if (score == null) return <span className="text-slate-300">—</span>;
  const color =
    score >= 8 ? 'text-emerald-600 bg-emerald-50' :
    score >= 6 ? 'text-blue-600 bg-blue-50' :
    score >= 4 ? 'text-amber-600 bg-amber-50' :
                 'text-red-600 bg-red-50';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold', color)}>
      <Star className="h-3 w-3 fill-current" />{score}/10
    </span>
  );
}

function AvgBar({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color = score >= 8 ? 'bg-emerald-500' : score >= 6 ? 'bg-blue-500' : score >= 4 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-700 w-8 text-right">{score.toFixed(1)}</span>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SatisfaccionPage() {
  const { items, total, totalPages, stats, loading, filters, setFilters, create, update, remove } = useSatisfacciones();
  const [vehicles, setVehicles]       = useState<Vehicle[]>([]);
  const [modal,    setModal]          = useState<'create' | 'edit' | null>(null);
  const [qrModal,  setQrModal]        = useState<Vehicle | null>(null);
  const [confirm,  setConfirm]        = useState<Satisfaccion | null>(null);
  const [selected, setSelected]       = useState<Satisfaccion | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const [imageFile, setImageFile]     = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    vehiclesService.getAll({ active: true, limit: 200 }).then(r => setVehicles(r.data)).catch(() => {});
  }, []);

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fecha: new Date().toISOString().slice(0, 10), puntuacion: 0 as unknown as number },
  });

  const openCreate = () => {
    setSelected(null);
    setImageFile(null);
    setImagePreview(null);
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    reset({
      fecha: now.toISOString().slice(0, 10),
      hora: currentTime,
      puntuacion: 0 as unknown as number,
    });
    setModal('create');
  };
  const openEdit   = (s: Satisfaccion) => {
    setSelected(s);
    setImageFile(null);
    setImagePreview(null);
    reset({
      vehicleId:    s.vehicleId ?? '',
      fecha:        s.fecha?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      hora:         s.hora ? (() => { const t = new Date(s.hora); return `${String(t.getUTCHours()).padStart(2,'0')}:${String(t.getUTCMinutes()).padStart(2,'0')}`; })() : '',
      puntuacion:   s.puntuacion ?? (0 as unknown as number),
      observaciones: s.observaciones ?? '',
    });
    setModal('edit');
  };

  const onImageChange = useCallback((file: File | null) => {
    setImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = e => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  }, []);

  const onSubmit = async (values: FormValues) => {
    const payload: SatisfaccionPayload = {
      vehicleId:    values.vehicleId,
      fecha:        values.fecha,
      hora:         values.hora,
      puntuacion:   values.puntuacion,
      observaciones: values.observaciones,
    };
    try {
      if (modal === 'create') { await create(payload, imageFile ?? undefined); }
      else if (selected)      { await update(selected.id, payload, imageFile ?? undefined); }
      setModal(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    setDeleting(true);
    try { await remove(confirm.id); } finally { setDeleting(false); setConfirm(null); }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Satisfacción</h2>
          <p className="text-sm text-slate-500">{total} evaluaci{total !== 1 ? 'ones' : 'ón'} registrada{total !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openCreate} className="flex items-center gap-2 self-start sm:self-auto">
          <Plus className="h-4 w-4" /> Nueva evaluación
        </Button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Overall */}
          <div className="rounded-xl bg-white border border-slate-100 shadow-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
                <Star className="h-5 w-5 text-amber-500 fill-amber-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Satisfacción promedio</p>
                <p className="text-2xl font-bold text-slate-900">
                  {stats.overallAvg != null ? stats.overallAvg.toFixed(1) : '—'}
                  <span className="text-sm font-normal text-slate-400">/10</span>
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-400">{stats.totalReviews} evaluaci{stats.totalReviews !== 1 ? 'ones' : 'ón'} en total</p>
          </div>

          {/* Best */}
          <div className="rounded-xl bg-white border border-slate-100 shadow-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
                <Award className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Mejor puntuado</p>
                <p className="text-base font-bold text-slate-900 truncate">
                  {stats.bestVehicle?.name ?? '—'}
                </p>
              </div>
            </div>
            {stats.bestVehicle && (
              <AvgBar score={stats.bestVehicle.avgScore} />
            )}
          </div>

          {/* Worst */}
          <div className="rounded-xl bg-white border border-slate-100 shadow-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Peor puntuado</p>
                <p className="text-base font-bold text-slate-900 truncate">
                  {stats.worstVehicle?.name ?? '—'}
                </p>
              </div>
            </div>
            {stats.worstVehicle && (
              <AvgBar score={stats.worstVehicle.avgScore} />
            )}
          </div>
        </div>
      )}

      {/* Vehicle scores breakdown */}
      {stats && stats.byVehicle.length > 0 && (
        <div className="rounded-xl bg-white border border-slate-100 shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Puntuación por vehículo</h3>
            <span className="text-xs text-slate-400">Promedio de todas las evaluaciones</span>
          </div>
          <div className="divide-y divide-slate-50">
            {stats.byVehicle.map((v, i) => (
              <div key={v.vehicleId} className="flex items-center gap-4 px-5 py-3">
                <span className={cn('text-xs font-bold w-5 text-center shrink-0', i === 0 ? 'text-emerald-600' : i === stats.byVehicle.length - 1 && stats.byVehicle.length > 1 ? 'text-red-500' : 'text-slate-400')}>#{i+1}</span>
                <div className="w-32 shrink-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{v.name !== v.plate ? v.name : v.plate}</p>
                  {v.name !== v.plate && <p className="text-xs text-slate-400">{v.plate}</p>}
                </div>
                <div className="flex-1"><AvgBar score={v.avgScore} /></div>
                <span className="text-xs text-slate-400 shrink-0">{v.count} eval.</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 flex items-center gap-1"
                  onClick={() => setQrModal(vehicles.find(vv => vv.id === v.vehicleId) ?? { id: v.vehicleId, plate: v.plate, name: v.name } as unknown as Vehicle)}
                >
                  <QrCode className="h-3.5 w-3.5" /> QR
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
          <Select
            label=""
            value={filters.vehicleId ?? ''}
            onChange={e => setFilters({ vehicleId: e.target.value || undefined })}
            options={[
              { value: '', label: 'Todos los vehículos' },
              ...vehicles.map(v => ({ value: v.id, label: v.name ?? v.plate })),
            ]}
            className="w-52"
          />
        <Input type="date" label="" value={filters.from ?? ''} onChange={e => setFilters({ from: e.target.value || undefined })} className="w-38" />
        <Input type="date" label="" value={filters.to ?? ''} onChange={e => setFilters({ to: e.target.value || undefined })} className="w-38" />
      </div>

      {/* Table */}
      {loading ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Sin evaluaciones"
          description="Agrega la primera evaluación de satisfacción."
          action={<Button onClick={openCreate} className="flex items-center gap-2"><Plus className="h-4 w-4" /> Nueva evaluación</Button>}
        />
      ) : (
        <Table
          data={items as unknown as Record<string, unknown>[]}
          keyField="id"
          page={filters.page}
          totalPages={totalPages}
          onPageChange={p => setFilters({ page: p })}
          columns={[
            {
              key: 'fecha',
              label: 'Fecha',
              render: (row): ReactNode => { const s = row as unknown as Satisfaccion; return s.fecha ? formatDate(s.fecha) : '—'; },
            },
            {
              key: 'hora',
              label: 'Hora',
              render: (row): ReactNode => {
                const s = row as unknown as Satisfaccion;
                if (!s.hora) return '—';
                const t = new Date(s.hora);
                return `${String(t.getUTCHours()).padStart(2,'0')}:${String(t.getUTCMinutes()).padStart(2,'0')}`;
              },
            },
            {
              key: 'vehicle',
              label: 'Vehículo',
              render: (row): ReactNode => { const s = row as unknown as Satisfaccion; return <span className="font-medium text-slate-800">{s.vehicle?.name ?? s.vehicle?.plate ?? '—'}</span>; },
            },
            {
              key: 'puntuacion',
              label: 'Puntuación',
              render: (row): ReactNode => { const s = row as unknown as Satisfaccion; return <ScoreBadge score={s.puntuacion} />; },
            },
            {
              key: 'source',
              label: 'Origen',
              render: (row): ReactNode => { const s = row as unknown as Satisfaccion; return <Badge variant={s.source === 'qr' ? 'info' : 'default'} size="sm">{s.source === 'qr' ? 'QR' : 'Manual'}</Badge>; },
            },
            {
              key: 'observaciones',
              label: 'Obs.',
              render: (row): ReactNode => {
                const s = row as unknown as Satisfaccion;
                return s.observaciones
                  ? <span className="text-slate-500 text-xs" title={s.observaciones}>{s.observaciones.slice(0, 40)}{s.observaciones.length > 40 ? '…' : ''}</span>
                  : <span className="text-slate-300">—</span>;
              },
            },
            {
              key: 'image',
              label: 'Foto',
              render: (row): ReactNode => {
                const s = row as unknown as Satisfaccion;
                return s.image?.storagePath
                  ? <a href={`/uploads/${s.image.storagePath}`} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline text-xs flex items-center gap-1"><ImageIcon className="h-3 w-3" />Ver</a>
                  : <span className="text-slate-300">—</span>;
              },
            },
            {
              key: 'actions',
              label: 'Acciones',
              render: (row): ReactNode => {
                const s = row as unknown as Satisfaccion;
                return (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirm(s)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                  </div>
                );
              },
            },
          ]}
        />
      )}

      {/* QR vehicles buttons (if no stats yet, show QR buttons for all vehicles) */}
      {!loading && stats?.byVehicle.length === 0 && vehicles.length > 0 && (
        <div className="rounded-xl bg-white border border-slate-100 shadow-card p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <QrCode className="h-4 w-4 text-brand-600" /> Generar QR por vehículo
          </h3>
          <div className="flex flex-wrap gap-2">
            {vehicles.slice(0, 20).map(v => (
              <Button key={v.id} variant="outline" size="sm" onClick={() => setQrModal(v)} className="flex items-center gap-1.5">
                <QrCode className="h-3.5 w-3.5" /> {v.name ?? v.plate}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'Nueva evaluación' : 'Editar evaluación'}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(null)} disabled={isSubmitting}>Cancelar</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
              {modal === 'create' ? 'Guardar' : 'Actualizar'}
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          {/* Vehicle */}
          <Select
            label="Vehículo *"
            {...register('vehicleId')}
            options={[
              { value: '', label: 'Seleccionar vehículo…' },
              ...vehicles.map(v => ({ value: v.id, label: v.name ?? v.plate })),
            ]}
            error={errors.vehicleId?.message}
          />

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <Input type="date" label="Fecha" {...register('fecha')} error={errors.fecha?.message} />
            <Input type="time" label="Hora" {...register('hora')} error={errors.hora?.message} />
          </div>

          {/* Score 1-10 radio */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Puntuación <span className="text-xs text-slate-400">(1 = pésimo · 10 = excelente)</span>
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                <label key={n} className="cursor-pointer">
                  <input type="radio" value={n} {...register('puntuacion')} className="sr-only peer" />
                  <span className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-bold transition-all',
                    'border-slate-200 text-slate-500 hover:border-brand-400 hover:text-brand-600',
                    'peer-checked:border-brand-500 peer-checked:bg-brand-500 peer-checked:text-white',
                    n <= 4 && 'peer-checked:border-red-500 peer-checked:bg-red-500',
                    n >= 5 && n <= 7 && 'peer-checked:border-amber-500 peer-checked:bg-amber-500',
                    n >= 8 && 'peer-checked:border-emerald-500 peer-checked:bg-emerald-500',
                  )}>{n}</span>
                </label>
              ))}
            </div>
            {errors.puntuacion && <p className="text-xs text-red-500 mt-1">{errors.puntuacion.message}</p>}
          </div>

          {/* Observations */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones</label>
            <textarea
              {...register('observaciones')}
              rows={3}
              placeholder="Comentarios del pasajero o inspector…"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
            />
          </div>

          {/* Photo */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Foto (opcional)</label>
            <div
              className="relative flex items-center justify-center w-full h-28 rounded-lg border-2 border-dashed border-slate-200 cursor-pointer hover:border-brand-400 transition-colors overflow-hidden"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); }}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onImageChange(f); }}
            >
              {imagePreview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="preview" className="h-full w-full object-cover" />
                  <button type="button" className="absolute top-1 right-1 rounded-full bg-black/50 p-0.5 text-white" onClick={e => { e.stopPropagation(); onImageChange(null); }}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1 text-slate-400">
                  <ImageIcon className="h-6 w-6" />
                  <span className="text-xs">Arrastrá o hacé click para subir</span>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={e => onImageChange(e.target.files?.[0] ?? null)} />
          </div>
        </form>
      </Modal>

      {/* QR Modal */}
      {qrModal && (
        <Modal
          open={!!qrModal}
          onClose={() => setQrModal(null)}
          title={`Código QR — ${qrModal.name ?? qrModal.plate}`}
          size="sm"
          footer={<Button variant="outline" onClick={() => setQrModal(null)}>Cerrar</Button>}
        >
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="rounded-xl bg-white p-4 shadow-inner border border-slate-100">
              <QRCode
                value={typeof window !== 'undefined' ? `${window.location.origin}/survey/${qrModal.id}` : `/survey/${qrModal.id}`}
                size={200}
                bgColor="#ffffff"
                fgColor="#1e293b"
              />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-700">{qrModal.name ?? qrModal.plate}</p>
              <p className="text-xs text-slate-400 mt-1">Escaneá para dejar una evaluación</p>
              <p className="text-xs text-slate-300 break-all mt-1">
                {typeof window !== 'undefined' ? `${window.location.origin}/survey/${qrModal.id}` : ''}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Eliminar evaluación"
        description="¿Estás seguro de eliminar esta evaluación? Esta acción no se puede deshacer."
        variant="danger"
      />
    </div>
  );
}
