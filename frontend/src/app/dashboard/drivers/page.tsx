'use client';

import { useState } from 'react';
import { Plus, Search, Users, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useDrivers }  from '@/hooks/useDrivers';
import { Table }       from '@/components/ui/Table';
import { Button }      from '@/components/ui/Button';
import { Badge }       from '@/components/ui/Badge';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input }       from '@/components/ui/Input';
import { EmptyState }  from '@/components/ui/EmptyState';
import { PageLoader }  from '@/components/ui/Spinner';
import type { Driver } from '@/types';
import { DriverPayload } from '@/services/drivers.service';
import { formatDate, daysUntil, debounce } from '@/lib/utils';

const schema = z.object({
  name:            z.string().min(2, 'Nombre requerido'),
  lastname:        z.string().min(2, 'Apellido requerido'),
  document:        z.string().optional(),
  licenseCategory: z.string().optional(),
  licenseExpiry:   z.string().optional(),
  phone:           z.string().optional(),
  email:           z.string().email('Email inválido').optional().or(z.literal('')),
});
type FormValues = z.infer<typeof schema>;

function licenseVariant(days: number): 'success' | 'warning' | 'danger' {
  if (days < 0)  return 'danger';
  if (days < 30) return 'warning';
  return 'success';
}

export default function DriversPage() {
  const { drivers, total, totalPages, loading, filters, setFilters, create, update, remove } = useDrivers();
  const [modal,    setModal]    = useState<'create' | 'edit' | null>(null);
  const [confirm,  setConfirm]  = useState<Driver | null>(null);
  const [selected, setSelected] = useState<Driver | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const openCreate = () => { reset(); setSelected(null); setModal('create'); };
  const openEdit   = (d: Driver) => {
    setSelected(d);
    reset({ name: d.name, lastname: d.lastname, document: d.document, licenseCategory: d.licenseCategory, licenseExpiry: d.licenseExpiry?.slice(0, 10) ?? '', phone: d.phone ?? '', email: d.email ?? '' });
    setModal('edit');
  };
  const closeModal = () => { setModal(null); setSelected(null); reset(); };

  const onSubmit = async (data: FormValues) => {
    if (modal === 'create') await create(data as DriverPayload);
    if (modal === 'edit' && selected) await update(selected.id, data);
    closeModal();
  };

  const handleSearch = debounce((q: string) => setFilters((f) => ({ ...f, search: q, page: 1 })), 350);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Conductores</h2>
          <p className="text-sm text-slate-500">{total} conductor{total !== 1 ? 'es' : ''}</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Nuevo conductor</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por nombre, cédula…"
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {loading ? <PageLoader /> : drivers.length === 0 ? (
        <EmptyState icon={Users} title="Sin conductores" description="Agrega el primer conductor" action={<Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Nuevo conductor</Button>} />
      ) : (
        <Table
          data={drivers as unknown as Record<string, unknown>[]}
          keyField="id"
          page={filters.page}
          totalPages={totalPages}
          onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
          columns={[
            { key: 'name', label: 'Conductor', render: (row) => {
              const d = row as unknown as Driver;
              return (
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{d.name.charAt(0)}</div>
                  <div>
                    <p className="font-medium text-slate-900">{d.name} {d.lastname}</p>
                    <p className="text-xs text-slate-400">{d.document ?? '—'}</p>
                  </div>
                </div>
              );
            }},
            { key: 'licenseCategory', label: 'Categoría lic.' },
            { key: 'licenseExpiry', label: 'Vencimiento', render: (row) => {
              const d  = row as unknown as Driver;
              if (!d.licenseExpiry) return <span className="text-slate-400">—</span>;
              const ds = daysUntil(d.licenseExpiry);
              return (
                <div className="flex items-center gap-2">
                  <span className="text-sm">{formatDate(d.licenseExpiry)}</span>
                  <Badge variant={licenseVariant(ds)} size="sm" dot>
                    {ds < 0 ? 'Vencida' : `${ds}d`}
                  </Badge>
                </div>
              );
            }},
            { key: 'phone', label: 'Teléfono', render: (row) => (row as unknown as Driver).phone ?? '—' },
            { key: 'active', label: 'Estado', render: (row) => {
              const d = row as unknown as Driver;
              return <Badge variant={d.active ? 'success' : 'default'} dot>{d.active ? 'Activo' : 'Inactivo'}</Badge>;
            }},
            { key: 'actions', label: '', width: '80px', render: (row) => {
              const d = row as unknown as Driver;
              return (
                <div className="flex items-center justify-end gap-1.5">
                  <button onClick={() => openEdit(d)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setConfirm(d)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              );
            }},
          ]}
        />
      )}

      <Modal
        open={modal !== null}
        onClose={closeModal}
        title={modal === 'create' ? 'Nuevo conductor' : 'Editar conductor'}
        footer={<><Button variant="outline" onClick={closeModal}>Cancelar</Button><Button loading={isSubmitting} onClick={handleSubmit(onSubmit)}>{modal === 'create' ? 'Crear' : 'Guardar'}</Button></>}
      >
        <form className="grid grid-cols-2 gap-4" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Nombre" placeholder="Juan" error={errors.name?.message} required {...register('name')} />
          <Input label="Apellido" placeholder="Pérez" error={errors.lastname?.message} required {...register('lastname')} />
          <Input label="Cédula de identidad" placeholder="1234567-8" error={errors.document?.message} {...register('document')} />
          <Input label="Categoría de licencia" placeholder="A, B, C..." {...register('licenseCategory')} />
          <Input label="Vencimiento de licencia" type="date" error={errors.licenseExpiry?.message} {...register('licenseExpiry')} className="col-span-2" />
          <Input label="Teléfono" placeholder="+598 98 000 000" {...register('phone')} />
          <Input label="Email" type="email" placeholder="conductor@empresa.com" error={errors.email?.message} {...register('email')} />
        </form>
      </Modal>

      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        loading={deleting}
        title="Eliminar conductor"
        description={`¿Eliminar a ${confirm?.name}?`}
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
