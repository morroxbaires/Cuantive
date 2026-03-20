'use client';

import { useState, useEffect } from 'react';
import { Plus, Wrench, Pencil, Trash2, Calendar } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useMaintenance }  from '@/hooks/useMaintenance';
import { vehiclesService } from '@/services/vehicles.service';
import { driversService  } from '@/services/drivers.service';
import { Table }           from '@/components/ui/Table';
import { Button }          from '@/components/ui/Button';
import { Badge }           from '@/components/ui/Badge';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input }           from '@/components/ui/Input';
import { Select }          from '@/components/ui/Select';
import { EmptyState }      from '@/components/ui/EmptyState';
import { PageLoader }      from '@/components/ui/Spinner';
import type { Maintenance, Vehicle, Driver, MaintenanceStatus } from '@/types';
import { MaintenancePayload } from '@/services/maintenance.service';
import { formatDate, formatCurrency, MAINTENANCE_TYPES, STATUS_LABELS } from '@/lib/utils';

const schema = z.object({
  vehicleId:    z.string().min(1, 'Vehículo requerido'),
  driverId:     z.string().optional(),
  date:         z.string().min(1, 'Fecha requerida'),
  type:         z.string().min(1, 'Tipo requerido'),
  description:  z.string().min(1, 'Descripción requerida'),
  cost:         z.coerce.number().min(0),
  odometer:     z.coerce.number().optional(),
  status:       z.enum(['pending','in_progress','completed','cancelled']).default('completed'),
  workshopName: z.string().optional(),
  nextDate:     z.string().optional(),
  notes:        z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const statusVariant: Record<MaintenanceStatus, 'info' | 'warning' | 'success' | 'default'> = {
  pending:     'warning',
  in_progress: 'info',
  completed:   'success',
  cancelled:   'default',
};

export default function MaintenancePage() {
  const { records, upcoming, total, totalPages, loading, filters, setFilters, create, update, remove } = useMaintenance();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers,  setDrivers]  = useState<Driver[]>([]);
  const [modal,    setModal]    = useState<'create' | 'edit' | null>(null);
  const [confirm,  setConfirm]  = useState<Maintenance | null>(null);
  const [selected, setSelected] = useState<Maintenance | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    vehiclesService.getAll({ active: true, limit: 100 }).then((r) => setVehicles(r.data)).catch(() => {});
    driversService.getAll({ active: true, limit: 100 }).then((r) => setDrivers(r.data)).catch(() => {});
  }, []);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().slice(0, 10), status: 'completed' },
  });

  const openCreate = () => { reset({ date: new Date().toISOString().slice(0, 10), status: 'completed' }); setSelected(null); setModal('create'); };
  const openEdit   = (m: Maintenance) => {
    setSelected(m);
    reset({ vehicleId: m.vehicleId, driverId: m.driverId ?? '', date: m.date.slice(0, 10), type: m.type, description: m.description, cost: m.cost, odometer: m.odometer, status: m.status, workshopName: m.workshopName ?? '', nextDate: m.nextDate?.slice(0, 10) ?? '', notes: m.notes ?? '' });
    setModal('edit');
  };
  const closeModal = () => { setModal(null); setSelected(null); reset(); };
  const onSubmit   = async (data: FormValues) => {
    if (modal === 'create') await create(data as MaintenancePayload);
    if (modal === 'edit' && selected) await update(selected.id, data);
    closeModal();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Mantenimiento</h2>
          <p className="text-sm text-slate-500">{total} registro{total !== 1 ? 's' : ''} · {upcoming.length} próximo{upcoming.length !== 1 ? 's' : ''}</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Nuevo mantenimiento</Button>
      </div>

      {/* Upcoming banner */}
      {upcoming.length > 0 && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-800">{upcoming.length} mantenimiento{upcoming.length !== 1 ? 's' : ''} próximo{upcoming.length !== 1 ? 's' : ''} (60 días)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {upcoming.slice(0, 4).map((m) => (
                  <span key={m.id} className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
                    {m.vehicle?.plate ?? '—'} · {m.type} · {formatDate(m.nextDate ?? m.date)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? <PageLoader /> : records.length === 0 ? (
        <EmptyState icon={Wrench} title="Sin mantenimientos" description="Registra el primer mantenimiento" action={<Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Nuevo</Button>} />
      ) : (
        <Table
          data={records as unknown as Record<string, unknown>[]}
          keyField="id"
          page={filters.page}
          totalPages={totalPages}
          onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
          columns={[
            { key: 'date', label: 'Fecha', render: (row) => formatDate((row as unknown as Maintenance).date) },
            { key: 'vehicle', label: 'Vehículo', render: (row) => <span className="font-mono font-medium">{(row as unknown as Maintenance).vehicle?.plate ?? '—'}</span> },
            { key: 'type', label: 'Tipo' },
            { key: 'description', label: 'Descripción', render: (row) => <span className="line-clamp-1 max-w-[200px]">{(row as unknown as Maintenance).description}</span> },
            { key: 'cost', label: 'Costo', render: (row) => <span className="font-semibold">{formatCurrency((row as unknown as Maintenance).cost)}</span> },
            { key: 'status', label: 'Estado', render: (row) => {
              const m = row as unknown as Maintenance;
              return <Badge variant={statusVariant[m.status]} dot>{STATUS_LABELS[m.status]}</Badge>;
            }},
            { key: 'nextDate', label: 'Próximo', render: (row) => {
              const m = row as unknown as Maintenance;
              return m.nextDate ? <span className="text-slate-600">{formatDate(m.nextDate)}</span> : <span className="text-slate-400">—</span>;
            }},
            { key: 'actions', label: '', width: '80px', render: (row) => {
              const m = row as unknown as Maintenance;
              return (
                <div className="flex items-center justify-end gap-1.5">
                  <button onClick={() => openEdit(m)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setConfirm(m)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              );
            }},
          ]}
        />
      )}

      <Modal
        open={modal !== null}
        onClose={closeModal}
        title={modal === 'create' ? 'Nuevo mantenimiento' : 'Editar mantenimiento'}
        size="lg"
        footer={<><Button variant="outline" onClick={closeModal}>Cancelar</Button><Button loading={isSubmitting} onClick={handleSubmit(onSubmit)}>{modal === 'create' ? 'Registrar' : 'Guardar'}</Button></>}
      >
        <form className="grid grid-cols-2 gap-4" onSubmit={handleSubmit(onSubmit)}>
          <Select label="Vehículo" required options={vehicles.map((v) => ({ value: v.id, label: `${v.plate} — ${v.brand} ${v.model}` }))} placeholder="Seleccionar…" error={errors.vehicleId?.message} {...register('vehicleId')} className="col-span-2" />
          <Input label="Fecha" type="date" required error={errors.date?.message} {...register('date')} />
          <Select
            label="Estado"
            options={[{value:'pending',label:'Pendiente'},{value:'in_progress',label:'En progreso'},{value:'completed',label:'Completado'},{value:'cancelled',label:'Cancelado'}]}
            {...register('status')}
          />
          <Select
            label="Tipo de mantenimiento"
            required
            options={MAINTENANCE_TYPES.map((t) => ({ value: t, label: t }))}
            placeholder="Seleccionar…"
            error={errors.type?.message}
            {...register('type')}
          />
          <Input label="Costo (UYU)" type="number" step="1" required error={errors.cost?.message} {...register('cost')} />
          <Input label="Descripción" required error={errors.description?.message} {...register('description')} className="col-span-2" />
          <Input label="Odómetro (km)" type="number" {...register('odometer')} />
          <Input label="Taller / Mecánico" placeholder="Taller central" {...register('workshopName')} />
          <Input label="Próximo mantenimiento" type="date" hint="Fecha estimada del próximo servicio" {...register('nextDate')} className="col-span-2" />
          <Input label="Notas" placeholder="Observaciones adicionales…" {...register('notes')} className="col-span-2" />
        </form>
      </Modal>

      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        loading={deleting}
        title="Eliminar mantenimiento"
        description={`¿Eliminar el registro de ${confirm?.type} del ${confirm ? formatDate(confirm.date) : ''}?`}
        onConfirm={async () => {
          if (!confirm) return;
          setDeleting(true);
          await remove(confirm.id);
          setDeleting(false);
          setConfirm(null);
        }}
      />
    </div>
  );
}
