'use client';

import { useState } from 'react';
import { Plus, Bell, Pencil, Trash2, CheckCheck, Circle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useAlerts }  from '@/hooks/useAlerts';
import { Table }      from '@/components/ui/Table';
import { Button }     from '@/components/ui/Button';
import { Badge }      from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input }      from '@/components/ui/Input';
import { Select }     from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/Spinner';
import type { Alert, AlertNotification } from '@/types';
import { AlertPayload } from '@/services/alerts.service';
import { formatDate, ALERT_TYPE_LABELS } from '@/lib/utils';
import { cn } from '@/lib/utils';

const schema = z.object({
  name:    z.string().min(1, 'Nombre requerido'),
  type:    z.string().min(1, 'Tipo requerido'),
  channel: z.string().min(1, 'Canal requerido'),
  active:  z.coerce.boolean().default(true),
});
type FormValues = z.infer<typeof schema>;

export default function AlertsPage() {
  const { alerts, notifications, unreadCount, loading, create, update, remove, markRead, markAllRead } = useAlerts();
  const [modal,    setModal]    = useState<'create' | 'edit' | null>(null);
  const [confirm,  setConfirm]  = useState<Alert | null>(null);
  const [selected, setSelected] = useState<Alert | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [tab,      setTab]      = useState<'rules' | 'notifications'>('notifications');

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const openCreate = () => { reset({ active: true }); setSelected(null); setModal('create'); };
  const openEdit   = (a: Alert) => { setSelected(a); reset({ name: a.name, type: a.type, channel: a.channel, active: a.active }); setModal('edit'); };
  const closeModal = () => { setModal(null); setSelected(null); reset(); };
  const onSubmit   = async (data: FormValues) => {
    const payload = { ...data, config: {} } as AlertPayload;
    if (modal === 'create') await create(payload);
    if (modal === 'edit' && selected) await update(selected.id, payload);
    closeModal();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Alertas</h2>
          <p className="text-sm text-slate-500">{unreadCount} notificación{unreadCount !== 1 ? 'es' : ''} sin leer</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Nueva regla</Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100">
        {(['notifications', 'rules'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700',
            )}
          >
            {t === 'notifications' ? `Notificaciones ${unreadCount > 0 ? `(${unreadCount})` : ''}` : 'Reglas de alerta'}
          </button>
        ))}
      </div>

      {loading ? <PageLoader /> : (
        <>
          {/* Notifications panel */}
          {tab === 'notifications' && (
            <div className="space-y-3">
              {notifications.length === 0 ? (
                <EmptyState icon={Bell} title="Sin notificaciones" description="Aquí aparecerán las alertas generadas por el sistema" />
              ) : (
                <>
                  {unreadCount > 0 && (
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" icon={<CheckCheck className="h-3.5 w-3.5" />} onClick={markAllRead}>
                        Marcar todas como leídas
                      </Button>
                    </div>
                  )}
                  <div className="space-y-2">
                    {notifications.map((n: AlertNotification) => (
                      <div
                        key={n.id}
                        className={cn(
                          'flex items-start gap-3 rounded-xl border p-4 transition-colors',
                          n.readAt ? 'border-slate-100 bg-white' : 'border-brand-100 bg-brand-50/40',
                        )}
                      >
                        <div className={cn(
                          'mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full',
                          n.readAt ? 'bg-slate-100' : 'bg-brand-100',
                        )}>
                          <Bell className={cn('h-3.5 w-3.5', n.readAt ? 'text-slate-400' : 'text-brand-600')} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm', n.readAt ? 'text-slate-600' : 'font-medium text-slate-900')}>{n.message}</p>
                          <p className="mt-0.5 text-xs text-slate-400">{formatDate(n.createdAt, 'dd/MM/yyyy HH:mm')}</p>
                        </div>
                        {!n.readAt && (
                          <button
                            onClick={() => markRead(n.id)}
                            className="flex-shrink-0 rounded-lg p-1 text-brand-400 hover:bg-brand-100 hover:text-brand-600 transition-colors"
                            title="Marcar como leída"
                          >
                            <Circle className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Rules panel */}
          {tab === 'rules' && (
            <>
              {alerts.length === 0 ? (
                <EmptyState icon={Bell} title="Sin reglas de alerta" description="Crea reglas para recibir notificaciones automáticas" action={<Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Nueva regla</Button>} />
              ) : (
                <Table
                  data={alerts as unknown as Record<string, unknown>[]}
                  keyField="id"
                  columns={[
                    { key: 'name', label: 'Nombre', render: (row) => <span className="font-medium">{(row as unknown as Alert).name}</span> },
                    { key: 'type', label: 'Tipo', render: (row) => <Badge variant="info">{ALERT_TYPE_LABELS[(row as unknown as Alert).type] ?? (row as unknown as Alert).type}</Badge> },
                    { key: 'channel', label: 'Canal', render: (row) => {
                      const a = row as unknown as Alert;
                      const labels: Record<string, string> = { in_app: 'En app', email: 'Email', sms: 'SMS' };
                      return <Badge variant="default">{labels[a.channel] ?? a.channel}</Badge>;
                    }},
                    { key: 'active', label: 'Estado', render: (row) => {
                      const a = row as unknown as Alert;
                      return <Badge variant={a.active ? 'success' : 'default'} dot>{a.active ? 'Activa' : 'Inactiva'}</Badge>;
                    }},
                    { key: 'actions', label: '', width: '80px', render: (row) => {
                      const a = row as unknown as Alert;
                      return (
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => openEdit(a)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setConfirm(a)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      );
                    }},
                  ]}
                />
              )}
            </>
          )}
        </>
      )}

      <Modal
        open={modal !== null}
        onClose={closeModal}
        title={modal === 'create' ? 'Nueva regla de alerta' : 'Editar regla'}
        footer={<><Button variant="outline" onClick={closeModal}>Cancelar</Button><Button loading={isSubmitting} onClick={handleSubmit(onSubmit)}>{modal === 'create' ? 'Crear' : 'Guardar'}</Button></>}
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Nombre de la regla" placeholder="Vencimiento de licencia 30 días" error={errors.name?.message} required {...register('name')} />
          <Select
            label="Tipo de alerta"
            required
            options={Object.entries(ALERT_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            placeholder="Seleccionar…"
            error={errors.type?.message}
            {...register('type')}
          />
          <Select
            label="Canal de notificación"
            required
            options={[{ value: 'in_app', label: 'En la aplicación' }, { value: 'email', label: 'Email' }, { value: 'sms', label: 'SMS' }]}
            error={errors.channel?.message}
            {...register('channel')}
          />
          <div className="flex items-center gap-3">
            <input type="checkbox" id="active" {...register('active')} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" defaultChecked />
            <label htmlFor="active" className="text-sm font-medium text-slate-700">Regla activa</label>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        loading={deleting}
        title="Eliminar regla"
        description={`¿Eliminar la regla "${confirm?.name}"?`}
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
