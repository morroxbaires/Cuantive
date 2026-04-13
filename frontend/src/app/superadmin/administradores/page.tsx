'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, ToggleLeft, ToggleRight, Building2, Users } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button }    from '@/components/ui/Button';
import { Input }     from '@/components/ui/Input';
import { Badge }     from '@/components/ui/Badge';
import { Modal }     from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/Spinner';
import { useToast }  from '@/components/ui/Toast';
import { parseError } from '@/lib/handle-error';
import { superadminService } from '@/services/superadmin.service';
import { AdminWithCompany, CreateAdminPayload, UpdateAdminPayload } from '@/types';

// ─── Schema ──────────────────────────────────────────────────────────────────
const createSchema = z.object({
  adminName:          z.string().min(2,  'Nombre requerido'),
  adminEmail:         z.string().email('Email inválido'),
  adminPassword:      z.string().min(8,  'Mínimo 8 caracteres'),
  companyName:        z.string().min(2,  'Nombre de empresa requerido'),
  companyRut:         z.string().optional(),
  companyCity:        z.string().optional(),
  companyPhone:       z.string().optional(),
  companyEmail:       z.union([z.string().email('Email inválido'), z.literal('')]).optional(),
  companyAddress:     z.string().optional(),
  canDownloadMetrics: z.boolean().default(false),
});

const editSchema = createSchema.extend({
  adminPassword: z.string().min(8, 'Mínimo 8 caracteres').optional().or(z.literal('')),
});

type CreateForm = z.infer<typeof createSchema>;
type EditForm   = z.infer<typeof editSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(date: string | null): string {
  if (!date) return 'Nunca';
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 2)  return 'Hace un momento';
  if (m < 60) return `Hace ${m} min`;
  if (h < 24) return `Hace ${h} h`;
  if (d < 30) return `Hace ${d} días`;
  return new Date(date).toLocaleDateString('es-UY', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Create/Edit Form ─────────────────────────────────────────────────────────
interface AdminFormProps {
  open:       boolean;
  onClose:    () => void;
  onSaved:    () => void;
  editing?:   AdminWithCompany | null;
}

function AdminFormModal({ open, onClose, onSaved, editing }: AdminFormProps) {
  const isEdit = !!editing;
  const { success, error } = useToast();

  const schema = isEdit ? editSchema : createSchema;

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateForm | EditForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      adminName:          '',
      adminEmail:         '',
      adminPassword:      '',
      companyName:        '',
      companyRut:         '',
      companyCity:        '',
      companyPhone:       '',
      companyEmail:       '',
      companyAddress:     '',
      canDownloadMetrics: false,
    },
  });

  // Pre-fill when editing
  useEffect(() => {
    if (open && editing) {
      reset({
        adminName:          editing.name,
        adminEmail:         editing.email,
        adminPassword:      '',
        companyName:        editing.company?.name    ?? '',
        companyRut:         editing.company?.rut      ?? '',
        companyCity:        editing.company?.city     ?? '',
        companyPhone:       editing.company?.phone    ?? '',
        companyEmail:       editing.company?.email    ?? '',
        companyAddress:     editing.company?.address  ?? '',
        canDownloadMetrics: editing.canDownloadMetrics ?? false,
      });
    } else if (open) {
      reset({
        adminName: '', adminEmail: '', adminPassword: '',
        companyName: '', companyRut: '', companyCity: '',
        companyPhone: '', companyEmail: '', companyAddress: '',
        canDownloadMetrics: false,
      });
    }
  }, [open, editing, reset]);

  const onSubmit = async (values: CreateForm | EditForm) => {
    try {
      if (isEdit && editing) {
        const payload: UpdateAdminPayload = { ...values };
        if (!payload.adminPassword) delete payload.adminPassword;
        await superadminService.updateAdmin(editing.id, payload);
        success('Administrador actualizado', `Los datos de ${values.adminName} fueron guardados.`);
      } else {
        await superadminService.createAdmin(values as CreateAdminPayload);
        success('Administrador creado', `Se creó la cuenta de ${values.adminName} correctamente.`);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const { title, detail } = parseError(err);
      error(title, detail);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar administrador' : 'Nuevo administrador'}
      subtitle={isEdit ? 'Modifica los datos del administrador y su empresa' : 'Crea una cuenta de administrador con su empresa asociada'}
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button
            variant="primary"
            loading={isSubmitting}
            onClick={handleSubmit(onSubmit)}
          >
            {isEdit ? 'Guardar cambios' : 'Crear administrador'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Datos del administrador */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-brand-600" />
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Administrador</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Nombre completo"
              required
              placeholder="Juan Pérez"
              error={errors.adminName?.message}
              {...register('adminName')}
            />
            <Input
              label="Email"
              type="email"
              required
              placeholder="admin@empresa.com"
              error={errors.adminEmail?.message}
              {...register('adminEmail')}
            />
            <div className="sm:col-span-2">
              <Input
                label={isEdit ? 'Nueva contraseña (dejar en blanco para no cambiar)' : 'Contraseña'}
                type="password"
                required={!isEdit}
                placeholder={isEdit ? '••••••••' : 'Mínimo 8 caracteres'}
                error={errors.adminPassword?.message}
                {...register('adminPassword')}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 accent-brand-600 cursor-pointer"
                  {...register('canDownloadMetrics')}
                />
                <div>
                  <p className="text-sm font-medium text-slate-700">Permitir descarga de métricas en CSV</p>
                  <p className="text-xs text-slate-400 mt-0.5">El administrador podrá exportar datos del dashboard y análisis en formato CSV</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* Datos de la empresa */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Empresa</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Nombre de empresa"
              required
              placeholder="Mi Empresa S.A."
              error={errors.companyName?.message}
              {...register('companyName')}
            />
            <Input
              label="RUT"
              placeholder="123456789012"
              {...register('companyRut')}
            />
            <Input
              label="Ciudad"
              placeholder="Montevideo"
              {...register('companyCity')}
            />
            <Input
              label="Teléfono"
              placeholder="+598 2 000 0000"
              {...register('companyPhone')}
            />
            <Input
              label="Email de empresa"
              type="email"
              placeholder="contacto@empresa.com"
              error={errors.companyEmail?.message}
              {...register('companyEmail')}
            />
            <Input
              label="Dirección"
              placeholder="Av. 18 de Julio 1234"
              {...register('companyAddress')}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────
interface DeleteModalProps {
  open:    boolean;
  admin:   AdminWithCompany | null;
  onClose: () => void;
  onSaved: () => void;
}

function DeleteModal({ open, admin, onClose, onSaved }: DeleteModalProps) {
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  const handleDelete = async () => {
    if (!admin) return;
    setLoading(true);
    try {
      await superadminService.deleteAdmin(admin.id);
      success('Administrador eliminado', `La cuenta de ${admin.name} fue eliminada.`);
      onSaved();
      onClose();
    } catch (err: unknown) {
      const { title, detail } = parseError(err);
      error(title, detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Eliminar administrador"
      size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button variant="danger" loading={loading} onClick={handleDelete}>Eliminar</Button>
        </div>
      }
    >
      <p className="text-sm text-slate-600">
        ¿Estás seguro de que deseas eliminar a{' '}
        <span className="font-semibold text-slate-800">{admin?.name}</span>?
        Esta acción no se puede deshacer.
      </p>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdministradoresPage() {
  const [admins,   setAdmins]   = useState<AdminWithCompany[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [editAdmin,  setEditAdmin]  = useState<AdminWithCompany | null>(null);
  const [deleteAdmin, setDeleteAdmin] = useState<AdminWithCompany | null>(null);
  const [toggling,   setToggling]   = useState<string | null>(null);

  const { success, error } = useToast();
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await superadminService.getAdmins({ page, limit, search: search || undefined });
      setAdmins(result.data);
      setTotal(result.total);
    } catch (err: unknown) {
      const { title, detail } = parseError(err);
      error(title, detail);
    } finally {
      setLoading(false);
    }
  }, [page, search, error]);

  useEffect(() => { load(); }, [load]);

  // Reset page on search change
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleToggle = async (admin: AdminWithCompany) => {
    setToggling(admin.id);
    try {
      const updated = await superadminService.toggleAdmin(admin.id);
      setAdmins(prev => prev.map(a => a.id === admin.id ? updated : a));
      const label = updated.active ? 'activado' : 'desactivado';
      success(`Administrador ${label}`, `La cuenta de ${admin.name} fue ${label}.`);
    } catch (err: unknown) {
      const { title, detail } = parseError(err);
      error(title, detail);
    } finally {
      setToggling(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Administradores</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {total} {total === 1 ? 'empresa registrada' : 'empresas registradas'}
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setCreateOpen(true)}
        >
          Nuevo administrador
        </Button>
      </div>

      {/* Search */}
      <div className="max-w-sm">
        <Input
          placeholder="Buscar por nombre, email o empresa…"
          leading={<Search className="h-4 w-4" />}
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl bg-white border border-slate-100 shadow-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <PageLoader />
          </div>
        ) : admins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="mb-3 h-10 w-10 text-slate-200" />
            <p className="text-sm font-medium text-slate-500">
              {search ? 'Sin resultados para esa búsqueda' : 'No hay administradores creados'}
            </p>
            {!search && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setCreateOpen(true)}
              >
                Crear el primero
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Administrador</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Empresa</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Veh.</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Cond.</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Último acceso</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {admins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Admin */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">
                          {admin.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 truncate">{admin.name}</p>
                          <p className="text-xs text-slate-400 truncate">{admin.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Empresa */}
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-700 truncate max-w-[160px]">{admin.company?.name ?? '—'}</p>
                      {admin.company?.city && (
                        <p className="text-[11px] text-slate-400">{admin.company.city}</p>
                      )}
                    </td>

                    {/* Vehicles / Drivers */}
                    <td className="px-5 py-3.5 text-center text-slate-600">{admin.company?._count.vehicles ?? 0}</td>
                    <td className="px-5 py-3.5 text-center text-slate-600">{admin.company?._count.drivers  ?? 0}</td>

                    {/* Last Login */}
                    <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">{timeAgo(admin.lastLogin)}</td>

                    {/* Status */}
                    <td className="px-5 py-3.5 text-center">
                      <Badge variant={admin.active ? 'success' : 'danger'} dot>
                        {admin.active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Toggle */}
                        <button
                          title={admin.active ? 'Desactivar' : 'Activar'}
                          disabled={toggling === admin.id}
                          onClick={() => handleToggle(admin)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-40"
                        >
                          {admin.active
                            ? <ToggleRight className="h-4 w-4 text-emerald-500" />
                            : <ToggleLeft  className="h-4 w-4" />
                          }
                        </button>

                        {/* Edit */}
                        <button
                          title="Editar"
                          onClick={() => setEditAdmin(admin)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        {/* Delete */}
                        <button
                          title="Eliminar"
                          onClick={() => setDeleteAdmin(admin)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
            <p className="text-xs text-slate-500">
              Mostrando {(page - 1) * limit + 1}–{Math.min(page * limit, total)} de {total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                Anterior
              </Button>
              <span className="text-xs text-slate-500 px-1">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AdminFormModal
        open={createOpen || !!editAdmin}
        onClose={() => { setCreateOpen(false); setEditAdmin(null); }}
        onSaved={load}
        editing={editAdmin}
      />

      <DeleteModal
        open={!!deleteAdmin}
        admin={deleteAdmin}
        onClose={() => setDeleteAdmin(null)}
        onSaved={load}
      />
    </div>
  );
}
