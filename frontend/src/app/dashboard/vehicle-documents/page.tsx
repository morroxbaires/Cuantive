'use client';

import { useState } from 'react';
import { Plus, Search, FileText, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useVehicleDocuments }          from '@/hooks/useVehicleDocuments';
import { useVehicles }                  from '@/hooks/useVehicles';
import { Table }                        from '@/components/ui/Table';
import { Button }                       from '@/components/ui/Button';
import { Badge }                        from '@/components/ui/Badge';
import { Modal, ConfirmModal }          from '@/components/ui/Modal';
import { Input }                        from '@/components/ui/Input';
import { Select }                       from '@/components/ui/Select';
import { EmptyState }                   from '@/components/ui/EmptyState';
import { PageLoader }                   from '@/components/ui/Spinner';
import type { VehicleDocument }         from '@/types';
import type { VehicleDocumentPayload, DocumentType, DocumentStatus } from '@/services/vehicle-documents.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const DOC_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: 'insurance',    label: 'Seguro' },
  { value: 'registration', label: 'Libreta de propiedad' },
  { value: 'permit',       label: 'Habilitación' },
  { value: 'inspection',   label: 'ITV' },
];

const STATUS_OPTIONS: { value: DocumentStatus; label: string }[] = [
  { value: 'active',   label: 'Vigente' },
  { value: 'expiring', label: 'Vence pronto' },
  { value: 'expired',  label: 'Vencido' },
];

function docTypeLabel(type: DocumentType) {
  return DOC_TYPE_OPTIONS.find(o => o.value === type)?.label ?? type;
}

function computeStatus(expirationDate?: string): DocumentStatus {
  if (!expirationDate) return 'active';
  const today  = new Date(); today.setHours(0, 0, 0, 0);
  const expDate = new Date(expirationDate);
  const days   = Math.floor((expDate.getTime() - today.getTime()) / 86_400_000);
  if (days < 0)  return 'expired';
  if (days <= 30) return 'expiring';
  return 'active';
}

function daysLabel(expirationDate?: string): string {
  if (!expirationDate) return '—';
  const today  = new Date(); today.setHours(0, 0, 0, 0);
  const expDate = new Date(expirationDate);
  const days   = Math.floor((expDate.getTime() - today.getTime()) / 86_400_000);
  if (days < 0)   return `Vencido hace ${Math.abs(days)}d`;
  if (days === 0) return 'Vence hoy';
  if (days === 1) return 'Vence mañana';
  return `${days} días`;
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return iso.slice(0, 10);
}

// ─── Zod schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  vehicleId:      z.string().min(1, 'Selecciona un vehículo'),
  documentType:   z.enum(['insurance', 'registration', 'permit', 'inspection'], {
    required_error: 'Tipo de documento requerido',
  }),
  documentNumber: z.string().max(80).optional(),
  issueDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  fileUrl:        z.string().url('URL inválida').optional().or(z.literal('')),
  notes:          z.string().max(2000).optional(),
});
type FormValues = z.infer<typeof schema>;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VehicleDocumentsPage() {
  const {
    documents, total, totalPages, loading, filters,
    setFilters, create, update, remove,
  } = useVehicleDocuments();

  const { vehicles } = useVehicles({ limit: 200 });

  const [modal,         setModal]         = useState<'create' | 'edit' | null>(null);
  const [confirm,       setConfirm]       = useState<VehicleDocument | null>(null);
  const [selected,      setSelected]      = useState<VehicleDocument | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const {
    register, handleSubmit, reset, formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const openCreate = () => { reset(); setSelected(null); setModal('create'); };
  const openEdit   = (doc: VehicleDocument) => {
    setSelected(doc);
    reset({
      vehicleId:      doc.vehicleId,
      documentType:   doc.documentType,
      documentNumber: doc.documentNumber ?? '',
      issueDate:      fmtDate(doc.issueDate),
      expirationDate: fmtDate(doc.expirationDate),
      fileUrl:        doc.fileUrl ?? '',
      notes:          doc.notes ?? '',
    });
    setModal('edit');
  };
  const closeModal = () => { setModal(null); setSelected(null); reset(); };

  const onSubmit = async (data: FormValues) => {
    const payload: VehicleDocumentPayload = {
      vehicleId:      data.vehicleId,
      documentType:   data.documentType as DocumentType,
      documentNumber: data.documentNumber || undefined,
      issueDate:      data.issueDate      || null,
      expirationDate: data.expirationDate || null,
      fileUrl:        data.fileUrl        || null,
      notes:          data.notes          || null,
    };
    if (modal === 'create') await create(payload);
    if (modal === 'edit' && selected) await update(selected.id, payload);
    closeModal();
  };

  // ─── Status badge helper ──────────────────────────────────────────────
  const statusBadge = (doc: VehicleDocument) => {
    const st = computeStatus(doc.expirationDate);
    if (st === 'expired')  return <Badge variant="danger" dot>Vencido</Badge>;
    if (st === 'expiring') return <Badge variant="warning" dot>Vence pronto</Badge>;
    return <Badge variant="success" dot>Vigente</Badge>;
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Documentos de vehículos</h2>
          <p className="text-sm text-slate-500">
            {total} documento{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}
          </p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
          Nuevo documento
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <select
            onChange={(e) => setFilters((f) => ({
              ...f, vehicleId: e.target.value || undefined, page: 1,
            }))}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Todos los vehículos</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</option>
            ))}
          </select>
        </div>
        <select
          onChange={(e) => setFilters((f) => ({
            ...f, documentType: (e.target.value || undefined) as DocumentType | undefined, page: 1,
          }))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none w-full sm:w-48"
        >
          <option value="">Todos los tipos</option>
          {DOC_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          onChange={(e) => setFilters((f) => ({
            ...f, status: (e.target.value || undefined) as DocumentStatus | undefined, page: 1,
          }))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none w-full sm:w-44"
        >
          <option value="">Todos los estados</option>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? <PageLoader /> : documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Sin documentos registrados"
          description="Agrega el primer documento de tu flota para controlar vencimientos"
          action={
            <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Nuevo documento
            </Button>
          }
        />
      ) : (
        <Table
          data={documents as unknown as Record<string, unknown>[]}
          keyField="id"
          page={filters.page}
          totalPages={totalPages}
          onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
          columns={[
            {
              key: 'vehicle', label: 'Vehículo',
              render: (row) => {
                const d = row as unknown as VehicleDocument;
                return (
                  <span className="font-mono font-semibold text-slate-900">
                    {d.vehicle?.plate ?? '—'}
                    {d.vehicle?.brand && (
                      <span className="ml-1 font-sans font-normal text-slate-500 text-xs">
                        {d.vehicle.brand} {d.vehicle.model}
                      </span>
                    )}
                  </span>
                );
              },
            },
            {
              key: 'documentType', label: 'Tipo',
              render: (row) => {
                const d = row as unknown as VehicleDocument;
                return <Badge variant="info">{docTypeLabel(d.documentType)}</Badge>;
              },
            },
            {
              key: 'documentNumber', label: 'N° Documento',
              render: (row) => {
                const d = row as unknown as VehicleDocument;
                return <span className="text-slate-600">{d.documentNumber ?? '—'}</span>;
              },
            },
            {
              key: 'expirationDate', label: 'Vencimiento',
              render: (row) => {
                const d = row as unknown as VehicleDocument;
                return (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-slate-700">{fmtDate(d.expirationDate)}</span>
                    <span className="text-xs text-slate-400">{daysLabel(d.expirationDate)}</span>
                  </div>
                );
              },
            },
            {
              key: 'status', label: 'Estado',
              render: (row) => statusBadge(row as unknown as VehicleDocument),
            },
            {
              key: 'actions', label: '', width: '100px',
              render: (row) => {
                const d = row as unknown as VehicleDocument;
                return (
                  <div className="flex items-center justify-end gap-1.5">
                    {d.fileUrl && (
                      <a
                        href={d.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 transition-colors"
                        title="Ver archivo"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => openEdit(d)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirm(d)}
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

      {/* Create / Edit Modal */}
      <Modal
        open={modal !== null}
        onClose={closeModal}
        title={modal === 'create' ? 'Nuevo documento' : 'Editar documento'}
        subtitle={modal === 'edit' && selected ? docTypeLabel(selected.documentType) : undefined}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button loading={isSubmitting} onClick={handleSubmit(onSubmit)}>
              {modal === 'create' ? 'Crear documento' : 'Guardar cambios'}
            </Button>
          </>
        }
      >
        <form className="grid grid-cols-2 gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="col-span-2">
            <Select
              label="Vehículo"
              required
              options={vehicles.map((v) => ({
                value: v.id,
                label: `${v.plate} — ${v.brand ?? ''} ${v.model ?? ''}`.trim(),
              }))}
              placeholder="Seleccionar vehículo…"
              error={errors.vehicleId?.message}
              {...register('vehicleId')}
            />
          </div>
          <div className="col-span-2">
            <Select
              label="Tipo de documento"
              required
              options={DOC_TYPE_OPTIONS}
              placeholder="Seleccionar tipo…"
              error={errors.documentType?.message}
              {...register('documentType')}
            />
          </div>
          <Input
            label="N° de documento"
            placeholder="Ej: 001234-5"
            error={errors.documentNumber?.message}
            {...register('documentNumber')}
          />
          <Input
            label="URL del archivo"
            placeholder="https://…"
            error={errors.fileUrl?.message}
            {...register('fileUrl')}
          />
          <Input
            label="Fecha de emisión"
            type="date"
            error={errors.issueDate?.message}
            {...register('issueDate')}
          />
          <Input
            label="Fecha de vencimiento"
            type="date"
            error={errors.expirationDate?.message}
            {...register('expirationDate')}
          />
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
            <textarea
              rows={3}
              placeholder="Observaciones opcionales…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              {...register('notes')}
            />
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        loading={actionLoading}
        title="Eliminar documento"
        description={
          confirm
            ? `¿Estás seguro de eliminar el ${docTypeLabel(confirm.documentType)} del vehículo ${confirm.vehicle?.plate ?? ''}? Esta acción no se puede deshacer.`
            : ''
        }
        onConfirm={async () => {
          if (!confirm) return;
          setActionLoading(true);
          await remove(confirm.id);
          setActionLoading(false);
          setConfirm(null);
        }}
      />
    </div>
  );
}
