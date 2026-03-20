'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Truck, Pencil, Trash2, ToggleLeft, ToggleRight, Users, X } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useVehicles } from '@/hooks/useVehicles';
import { driversService } from '@/services/drivers.service';
import { Table }       from '@/components/ui/Table';
import { Button }      from '@/components/ui/Button';
import { Badge }       from '@/components/ui/Badge';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input }       from '@/components/ui/Input';
import { Select }      from '@/components/ui/Select';
import { EmptyState }  from '@/components/ui/EmptyState';
import { PageLoader }  from '@/components/ui/Spinner';
import type { Vehicle, Driver } from '@/types';
import { VehiclePayload } from '@/services/vehicles.service';
import { debounce } from '@/lib/utils';

const schema = z.object({
  plate:                z.string().min(1, 'Patente requerida').toUpperCase(),
  brand:                z.string().min(1, 'Marca requerida'),
  model:                z.string().min(1, 'Modelo requerido'),
  year:                 z.coerce.number().min(1900).max(new Date().getFullYear() + 1),
  color:                z.string().optional(),
  coachNumber:          z.string().max(20).optional().transform(v => v === '' ? undefined : v),
  vehicleTypeId:        z.coerce.number().optional(),
  fuelTypeId:           z.coerce.number().optional(),
  currentOdometer:      z.coerce.number().min(0).optional(),
  efficiencyReference:  z.coerce.number().positive('Debe ser mayor a 0').optional().or(z.literal('')).transform(v => v === '' ? undefined : Number(v) || undefined),
});
type FormValues = z.infer<typeof schema>;

export default function VehiclesPage() {
  const {
    vehicles, total, totalPages, loading, filters,
    types, fuelTypes, setFilters, create, update, remove, toggleActive,
  } = useVehicles();

  const [modal,   setModal]   = useState<'create' | 'edit' | null>(null);
  const [confirm, setConfirm] = useState<{ type: 'delete' | 'toggle'; vehicle: Vehicle } | null>(null);
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Driver multi-select state
  const [availableDrivers,  setAvailableDrivers]  = useState<Driver[]>([]);
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const [driverSearch,      setDriverSearch]      = useState('');

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const watchedFuelTypeId = useWatch({ control, name: 'fuelTypeId' });
  const selectedFuelType  = fuelTypes.find(t => t.id === Number(watchedFuelTypeId));
  const effUnit           = selectedFuelType?.unit === 'kwh' ? 'kWh' : 'L';

  // Load drivers when modal opens
  useEffect(() => {
    if (modal !== null) {
      driversService.getAll({ limit: 200, active: true })
        .then((res) => setAvailableDrivers(res.data))
        .catch(() => {});
    }
  }, [modal]);

  const openCreate = () => {
    reset();
    setSelected(null);
    setSelectedDriverIds([]);
    setDriverSearch('');
    setModal('create');
  };

  const openEdit = (v: Vehicle) => {
    setSelected(v);
    reset({
      plate: v.plate, brand: v.brand, model: v.model, year: v.year,
      color: v.color ?? '', coachNumber: v.coachNumber ?? '',
      vehicleTypeId: v.vehicleTypeId, fuelTypeId: v.fuelTypeId,
      currentOdometer: v.currentOdometer,
      efficiencyReference: v.efficiencyReference ?? undefined,
    });
    setSelectedDriverIds((v.drivers ?? []).map((d) => d.id));
    setDriverSearch('');
    setModal('edit');
  };

  const closeModal = () => { setModal(null); setSelected(null); reset(); setSelectedDriverIds([]); setDriverSearch(''); };

  const onSubmit = async (data: FormValues) => {
    const payload: VehiclePayload = { ...data, driverIds: selectedDriverIds };
    if (modal === 'create') await create(payload);
    if (modal === 'edit' && selected) await update(selected.id, { ...payload });
    closeModal();
  };

  const toggleDriver = (id: string) => {
    setSelectedDriverIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  };

  const filteredDrivers = availableDrivers.filter((d) => {
    const q = driverSearch.toLowerCase();
    return !q || `${d.name} ${d.lastname}`.toLowerCase().includes(q) || d.document?.includes(q);
  });

  const handleSearch = debounce((q: string) =>
    setFilters((f) => ({ ...f, search: q, page: 1 })), 350);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Vehículos</h2>
          <p className="text-sm text-slate-500">{total} vehículo{total !== 1 ? 's' : ''} en flota</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          Nuevo vehículo
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por patente, marca, modelo…"
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500 hover:border-slate-300"
          />
        </div>
        <select
          onChange={(e) => setFilters((f) => ({ ...f, vehicleTypeId: e.target.value ? Number(e.target.value) : undefined, page: 1 }))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none w-full sm:w-44"
        >
          <option value="">Todos los tipos</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? <PageLoader /> : vehicles.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="Sin vehículos registrados"
          description="Agrega el primer vehículo de tu flota"
          action={<Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Nuevo vehículo</Button>}
        />
      ) : (
        <Table
          data={vehicles as unknown as Record<string, unknown>[]}
          keyField="id"
          page={filters.page}
          totalPages={totalPages}
          onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
          columns={[
            { key: 'plate', label: 'Patente', render: (row) => {
              const v = row as unknown as Vehicle;
              return <span className="font-semibold text-slate-900 font-mono tracking-wide">{v.plate}</span>;
            }},
            { key: 'brand', label: 'Vehículo', render: (row) => {
              const v = row as unknown as Vehicle;
              return <span>{v.brand} {v.model} <span className="text-slate-400">({v.year})</span></span>;
            }},
            { key: 'type', label: 'Tipo', render: (row) => {
              const v = row as unknown as Vehicle;
              return v.vehicleType ? <Badge variant="info">{v.vehicleType.name}</Badge> : <span className="text-slate-400">—</span>;
            }},
            { key: 'currentOdometer', label: 'Odómetro', render: (row) => {
              const v = row as unknown as Vehicle;
              return <span>{v.currentOdometer?.toLocaleString('es-UY')} km</span>;
            }},
            { key: 'efficiencyReference', label: 'Rendimiento esperado', render: (row) => {
              const v = row as unknown as Vehicle;
              const unit = v.fuelType?.unit === 'kwh' ? 'kWh' : 'L';
              return v.efficiencyReference
                ? <span className="font-medium text-slate-700">{v.efficiencyReference} km/{unit}</span>
                : <span className="text-slate-400">—</span>;
            }},
            { key: 'drivers', label: 'Conductores', render: (row) => {
              const v = row as unknown as Vehicle;
              const ds = v.drivers ?? [];
              if (ds.length === 0) return <span className="text-slate-400">—</span>;
              return (
                <div className="flex flex-wrap gap-1">
                  {ds.slice(0, 2).map((d) => (
                    <span key={d.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      <Users className="h-2.5 w-2.5" />{d.name} {d.lastname}
                    </span>
                  ))}
                  {ds.length > 2 && <span className="text-xs text-slate-400">+{ds.length - 2}</span>}
                </div>
              );
            }},
            { key: 'active', label: 'Estado', render: (row) => {
              const v = row as unknown as Vehicle;
              return <Badge variant={v.active ? 'success' : 'default'} dot>{v.active ? 'Activo' : 'Inactivo'}</Badge>;
            }},
            { key: 'actions', label: '', width: '120px', render: (row) => {
              const v = row as unknown as Vehicle;
              return (
                <div className="flex items-center justify-end gap-1.5">
                  <button onClick={() => openEdit(v)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setConfirm({ type: 'toggle', vehicle: v })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-amber-500 transition-colors">
                    {v.active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  </button>
                  <button onClick={() => setConfirm({ type: 'delete', vehicle: v })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            }},
          ]}
        />
      )}

      <Modal
        open={modal !== null}
        onClose={closeModal}
        title={modal === 'create' ? 'Nuevo vehículo' : 'Editar vehículo'}
        subtitle={modal === 'edit' ? selected?.plate : undefined}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button loading={isSubmitting} onClick={handleSubmit(onSubmit)}>
              {modal === 'create' ? 'Crear vehículo' : 'Guardar cambios'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <form className="grid grid-cols-2 gap-4" onSubmit={handleSubmit(onSubmit)}>
            <Input label="Patente" placeholder="ABC 1234" error={errors.plate?.message} required {...register('plate')} className="uppercase" />
            <Select
              label="Tipo de vehículo"
              options={types.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="Seleccionar…"
              {...register('vehicleTypeId')}
            />
            <Input label="Marca" placeholder="Toyota" error={errors.brand?.message} required {...register('brand')} />
            <Input label="Modelo" placeholder="Hilux" error={errors.model?.message} required {...register('model')} />
            <Input label="Año" type="number" placeholder="2022" error={errors.year?.message} required {...register('year')} />
            <Input label="Color" placeholder="Blanco" {...register('color')} />
            <Input label="Número de coche" placeholder="Ej: 1234" {...register('coachNumber')} />
            <Input label="Odómetro actual (km)" type="number" placeholder="0" {...register('currentOdometer')} />
            <Select
              label="Tipo de combustible"
              options={fuelTypes.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="Seleccionar…"
              {...register('fuelTypeId')}
            />
            <Input
              label={`Rendimiento esperado (km/${effUnit})`}
              type="number"
              step="0.01"
              placeholder="Ej: 12.5"
              hint={`Kilómetros esperados por ${effUnit}`}
              error={errors.efficiencyReference?.message}
              {...register('efficiencyReference')}
            />
          </form>

          {/* Driver multi-select */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Users className="h-4 w-4 text-slate-400" />
                Conductores asignados
              </label>
              {selectedDriverIds.length > 0 && (
                <span className="text-xs text-brand-600 font-medium">{selectedDriverIds.length} seleccionado{selectedDriverIds.length > 1 ? 's' : ''}</span>
              )}
            </div>

            {/* Selected chips */}
            {selectedDriverIds.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {selectedDriverIds.map((id) => {
                  const d = availableDrivers.find((dr) => dr.id === id);
                  if (!d) return null;
                  return (
                    <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-2.5 py-1 text-xs font-medium text-brand-700">
                      {d.name} {d.lastname}
                      <button type="button" onClick={() => toggleDriver(id)} className="ml-0.5 text-brand-400 hover:text-brand-700">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Search + dropdown */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar conductor..."
                value={driverSearch}
                onChange={(e) => setDriverSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="mt-1.5 max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-white">
              {filteredDrivers.length === 0 ? (
                <div className="px-4 py-3 text-center text-xs text-slate-400">
                  {availableDrivers.length === 0 ? 'No hay conductores activos' : 'Sin resultados'}
                </div>
              ) : (
                filteredDrivers.map((d) => {
                  const checked = selectedDriverIds.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDriver(d.id)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 ${checked ? 'bg-brand-50/50' : ''}`}
                    >
                      <div className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${checked ? 'border-brand-600 bg-brand-600' : 'border-slate-300'}`}>
                        {checked && <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-800 truncate">{d.name} {d.lastname}</p>
                        {d.document && <p className="text-xs text-slate-400">{d.document}</p>}
                      </div>
                      {checked && <span className="text-[10px] font-medium text-brand-600">✓ Asignado</span>}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Confirm modals */}
      <ConfirmModal
        open={confirm?.type === 'delete'}
        onClose={() => setConfirm(null)}
        loading={actionLoading}
        title="Eliminar vehículo"
        description={`¿Estás seguro de eliminar ${confirm?.vehicle.plate}? Esta acción no se puede deshacer.`}
        onConfirm={async () => {
          if (!confirm) return;
          setActionLoading(true);
          await remove(confirm.vehicle.id);
          setActionLoading(false);
          setConfirm(null);
        }}
      />
      <ConfirmModal
        open={confirm?.type === 'toggle'}
        onClose={() => setConfirm(null)}
        loading={actionLoading}
        title={confirm?.vehicle.active ? 'Desactivar vehículo' : 'Activar vehículo'}
        description={`¿Cambiar el estado de ${confirm?.vehicle.plate}?`}
        variant="primary"
        onConfirm={async () => {
          if (!confirm) return;
          setActionLoading(true);
          await toggleActive(confirm.vehicle.id);
          setActionLoading(false);
          setConfirm(null);
        }}
      />
    </div>
  );
}
