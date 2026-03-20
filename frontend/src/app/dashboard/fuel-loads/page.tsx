'use client';

import { useState, useEffect } from 'react';
import { Plus, Fuel, Pencil, Trash2 } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useFuelLoads }  from '@/hooks/useFuelLoads';
import { vehiclesService } from '@/services/vehicles.service';
import { driversService  } from '@/services/drivers.service';
import { settingsService } from '@/services/settings.service';
import { Table }           from '@/components/ui/Table';
import { Button }          from '@/components/ui/Button';
import { Badge }           from '@/components/ui/Badge';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input }           from '@/components/ui/Input';
import { Select }          from '@/components/ui/Select';
import { EmptyState }      from '@/components/ui/EmptyState';
import { PageLoader }      from '@/components/ui/Spinner';
import type { FuelLoad, Vehicle, Driver, Settings } from '@/types';
import { FuelLoadPayload } from '@/services/fuel-loads.service';
import { formatDate, formatCurrency, formatNumber } from '@/lib/utils';
import { Tooltip, InfoIcon } from '@/components/ui/Tooltip';

const schema = z.object({
  vehicleId:   z.string().min(1, 'Vehículo requerido'),
  driverId:    z.string().optional().transform((v) => (v === '' ? undefined : v)),
  fuelTypeId:  z.coerce.number().min(1, 'Tipo de combustible requerido'),
  date:        z.string().min(1, 'Fecha requerida'),
  litersOrKwh: z.coerce.number().positive('Debe ser mayor a 0'),
  unitPrice:   z.coerce.number().positive('Debe ser mayor a 0'),
  odometer:    z.coerce.number().min(0).optional(),
  station:     z.string().optional(),
  notes:       z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function FuelLoadsPage() {
  const { loads, total, totalPages, stats, fuelTypes, loading, filters, setFilters, create, update, remove } = useFuelLoads();
  const [vehicles,  setVehicles]  = useState<Vehicle[]>([]);
  const [drivers,   setDrivers]   = useState<Driver[]>([]);
  const [settings,  setSettings]  = useState<Settings | null>(null);
  const [modal,     setModal]     = useState<'create' | 'edit' | null>(null);
  const [confirm,   setConfirm]   = useState<FuelLoad | null>(null);
  const [selected,  setSelected]  = useState<FuelLoad | null>(null);
  const [deleting,  setDeleting]  = useState(false);

  useEffect(() => {
    vehiclesService.getAll({ active: true, limit: 100 }).then((r) => setVehicles(r.data)).catch(() => {});
    driversService.getAll({ active: true, limit: 100 }).then((r) => setDrivers(r.data)).catch(() => {});
    settingsService.get().then(setSettings).catch(() => {});
  }, []);

  const { register, handleSubmit, reset, control, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().slice(0, 10) },
  });

  // Watch fuelTypeId to determine unit labels dynamically
  const watchedFuelTypeId = useWatch({ control, name: 'fuelTypeId' });
  const watchedVehicleId  = useWatch({ control, name: 'vehicleId' });
  const selectedFuelType  = fuelTypes.find((t) => t.id === Number(watchedFuelTypeId));
  const isElectric        = selectedFuelType?.unit === 'kwh';
  const unitLabel         = isElectric ? 'kWh' : 'Litros';
  const priceLabel        = isElectric ? 'Precio por kWh' : 'Precio por litro';

  // Auto-populate fuelTypeId from selected vehicle (only on create)
  useEffect(() => {
    if (modal !== 'create') return;
    const vehicle = vehicles.find((v) => v.id === watchedVehicleId);
    if (vehicle?.fuelTypeId) {
      setValue('fuelTypeId', vehicle.fuelTypeId);
    }
  }, [watchedVehicleId, modal, vehicles, setValue]);

  // Auto-populate unitPrice from settings when fuel type changes (only on create)
  useEffect(() => {
    if (!settings || !selectedFuelType || modal !== 'create') return;
    let price: number | undefined;
    if (selectedFuelType.unit === 'kwh') {
      price = settings.electricityPrice ?? undefined;
    } else if (selectedFuelType.name.toLowerCase().includes('gasoil')) {
      price = settings.gasoilPrice ?? undefined;
    } else {
      price = settings.fuelPrice ?? undefined;
    }
    if (price !== undefined && price > 0) setValue('unitPrice', price as number);
  }, [watchedFuelTypeId, selectedFuelType, settings, modal, setValue]);

  const openCreate = () => {
    reset({ date: new Date().toISOString().slice(0, 10) });
    setSelected(null);
    setModal('create');
  };
  const openEdit = (fl: FuelLoad) => {
    setSelected(fl);
    reset({
      vehicleId:   fl.vehicleId,
      driverId:    fl.driverId ?? '',
      fuelTypeId:  fl.fuelTypeId ?? undefined,
      date:        fl.date.slice(0, 10),
      litersOrKwh: fl.litersOrKwh,
      unitPrice:   fl.unitPrice ?? undefined,
      odometer:    fl.odometer ?? undefined,
      station:     fl.station ?? '',
      notes:       fl.notes ?? '',
    });
    setModal('edit');
  };
  const closeModal = () => { setModal(null); setSelected(null); reset(); };

  const onSubmit = async (data: FormValues) => {
    const payload: FuelLoadPayload = {
      ...data,
      priceTotal: data.litersOrKwh * data.unitPrice,
      driverId:  data.driverId  || undefined,
      station:   data.station   || undefined,
      notes:     data.notes     || undefined,
    };
    if (modal === 'create') await create(payload);
    if (modal === 'edit' && selected) await update(selected.id, payload);
    closeModal();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Repostaje</h2>
          <p className="text-sm text-slate-500">{total} registro{total !== 1 ? 's' : ''}</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Nuevo repostaje</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          className="w-full sm:w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filters.vehicleId ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, page: 1, vehicleId: e.target.value || undefined }))}
        >
          <option value="">Todos los vehículos</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</option>
          ))}
        </select>
        <select
          className="w-full sm:w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filters.driverId ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, page: 1, driverId: e.target.value || undefined }))}
        >
          <option value="">Todos los conductores</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>{d.name} {d.lastname}</option>
          ))}
        </select>
        {(filters.vehicleId || filters.driverId) && (
          <button
            className="text-xs text-slate-500 hover:text-slate-700 underline whitespace-nowrap"
            onClick={() => setFilters((f) => ({ ...f, page: 1, vehicleId: undefined, driverId: undefined }))}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Stats mini row */}
      {stats && (
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            {
              label: 'Costo total',
              value: formatCurrency(stats.totalCost),
              tip:   'Suma de (litros × precio/unidad) de todas las cargas en el período y filtros activos.',
            },
            {
              label: 'Consumo total',
              value: `${formatNumber(stats.totalLiters, 0)} L/kWh`,
              tip:   'Suma de litros (combustible) o kWh (eléctrico) de todas las cargas filtradas.',
            },
            {
              label: 'Promedio km/L',
              value: `${formatNumber(stats.avgKmPerLiter)} km/L`,
              tip:   'Promedio del campo km/unidad de todas las cargas del período. Cada carga calcula: (odómetro_actual − odómetro_carga_previa) ÷ litros_cargados. Solo incluye cargas con odómetro registrado.',
            },
            { label: 'Cargas', value: String(stats.loadsCount) },
          ].map(({ label, value, tip }) => (
            <div key={label} className="rounded-xl bg-white border border-slate-100 shadow-card px-4 py-3">
              {tip ? (
                <Tooltip text={tip}>
                  <p className="text-xs text-slate-500">{label}</p>
                  <InfoIcon />
                </Tooltip>
              ) : (
                <p className="text-xs text-slate-500">{label}</p>
              )}
              <p className="mt-0.5 text-base font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? <PageLoader /> : loads.length === 0 ? (
        <EmptyState icon={Fuel} title="Sin repostajes registrados" description="Registra el primer repostaje" action={<Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Nuevo repostaje</Button>} />
      ) : (
        <Table
          data={loads as unknown as Record<string, unknown>[]}
          keyField="id"
          page={filters.page}
          totalPages={totalPages}
          onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
          columns={[
            { key: 'date',     label: 'Fecha',      render: (row) => formatDate((row as unknown as FuelLoad).date) },
            { key: 'odometer', label: 'Odómetro',   render: (row) => { const fl = row as unknown as FuelLoad; return fl.odometer != null ? <span className="text-sm font-medium text-slate-700">{fl.odometer.toLocaleString('es-AR')} km</span> : <span className="text-slate-400">—</span>; } },
            { key: 'vehicle',  label: 'Vehículo',   render: (row) => {
              const fl = row as unknown as FuelLoad;
              return <span className="font-medium font-mono">{fl.vehicle?.plate ?? '—'}</span>;
            }},
            { key: 'fuelType', label: 'Combustible', render: (row) => {
              const fl = row as unknown as FuelLoad;
              return <span>{fl.fuelType?.name ?? '—'}</span>;
            }},
            { key: 'litersOrKwh', label: 'Cantidad', render: (row) => {
              const fl = row as unknown as FuelLoad;
              const unit = fl.fuelType?.unit === 'kwh' ? 'kWh' : 'L';
              return `${formatNumber(Number(fl.litersOrKwh), 1)} ${unit}`;
            }},
            { key: 'unitPrice', label: 'Precio/unidad', render: (row) => {
              const fl = row as unknown as FuelLoad;
              return fl.unitPrice ? formatCurrency(Number(fl.unitPrice)) : '—';
            }},
            { key: 'priceTotal', label: 'Total', render: (row) => {
              const fl = row as unknown as FuelLoad;
              return <span className="font-semibold">{fl.priceTotal ? formatCurrency(Number(fl.priceTotal)) : '—'}</span>;
            }},
            { key: 'kmPerUnit', label: 'Rendimiento', render: (row) => {
              const fl = row as unknown as FuelLoad;
              if (!fl.kmPerUnit) return <span className="text-slate-400">—</span>;

              const kmNum = Number(fl.kmPerUnit);
              const ref   = fl.vehicle?.efficiencyReference != null ? Number(fl.vehicle.efficiencyReference) : null;
              const unit  = fl.fuelType?.unit === 'kwh' ? 'kWh' : 'L';
              const kmVal = `${formatNumber(kmNum, 2)} km/${unit}`;

              if (!ref) {
                return (
                  <span className="text-sm font-medium text-slate-600">{kmVal}</span>
                );
              }

              let variant: 'success' | 'info' | 'danger';
              let label: string;
              if (kmNum > ref + 2) {
                variant = 'success'; label = 'Óptimo';
              } else if (kmNum >= ref - 2) {
                variant = 'info'; label = 'Esperado';
              } else {
                variant = 'danger'; label = 'EXCESO';
              }

              return (
                <Tooltip
                  text={`Rendimiento: ${kmVal} — Referencia: ${ref} km/${unit} (±2 margen)`}
                  position="top"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-600">{kmVal}</span>
                    <Badge variant={variant} size="sm">{label}</Badge>
                  </div>
                </Tooltip>
              );
            }},
            { key: 'actions', label: '', width: '80px', render: (row) => {
              const fl = row as unknown as FuelLoad;
              return (
                <div className="flex items-center justify-end gap-1.5">
                  <button onClick={() => openEdit(fl)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setConfirm(fl)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              );
            }},
          ]}
        />
      )}

      <Modal
        open={modal !== null}
        onClose={closeModal}
        title={modal === 'create' ? 'Nuevo repostaje' : 'Editar repostaje'}
        footer={<><Button variant="outline" onClick={closeModal}>Cancelar</Button><Button loading={isSubmitting} onClick={handleSubmit(onSubmit)}>{modal === 'create' ? 'Registrar' : 'Guardar'}</Button></>}
      >
        <form className="grid grid-cols-2 gap-4" onSubmit={handleSubmit(onSubmit)}>
          <Select label="Vehículo" required options={vehicles.map((v) => ({ value: v.id, label: `${v.plate} — ${v.brand} ${v.model}` }))} placeholder="Seleccionar…" error={errors.vehicleId?.message} {...register('vehicleId')} className="col-span-2" />
          <Select label="Conductor" options={drivers.map((d) => ({ value: d.id, label: `${d.name} ${d.lastname}` }))} placeholder="Sin asignar" {...register('driverId')} />
          {modal === 'create' ? (
            <>
              <input type="hidden" {...register('fuelTypeId')} />
              <Input
                label="Combustible"
                value={selectedFuelType?.name ?? ''}
                readOnly
                className="bg-slate-50 cursor-not-allowed"
              />
            </>
          ) : (
            <Select
              label="Combustible"
              required
              options={fuelTypes.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="Seleccionar…"
              error={errors.fuelTypeId?.message}
              {...register('fuelTypeId')}
            />
          )}
          <Input label="Fecha" type="date" required error={errors.date?.message} {...register('date')} />
          <Input label="Odómetro (km)" type="number" placeholder="0" error={errors.odometer?.message} {...register('odometer')} />
          <Input
            label={unitLabel}
            type="number"
            step="0.01"
            placeholder="0.00"
            required
            error={errors.litersOrKwh?.message}
            {...register('litersOrKwh')}
          />
          <Input
            label={priceLabel}
            type="number"
            step="0.0001"
            placeholder="0.00"
            required
            readOnly
            hint="Precio configurado en Configuración → Precios de referencia"
            error={errors.unitPrice?.message}
            {...register('unitPrice')}
          />
          <Input label="Estación" placeholder="Ancap Pocitos" {...register('station')} className="col-span-2" />
          <Input label="Notas" placeholder="Observaciones…" {...register('notes')} className="col-span-2" />
        </form>
      </Modal>

      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        loading={deleting}
        title="Eliminar carga"
        description={`¿Eliminar la carga del ${confirm ? formatDate(confirm.date) : ''}?`}
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
