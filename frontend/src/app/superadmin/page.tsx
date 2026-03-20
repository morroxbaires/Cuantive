'use client';

import { useEffect, useState, useCallback } from 'react';
import { Building2, Users, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { StatCard }  from '@/components/dashboard/StatCard';
import { Badge }     from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/Spinner';
import { superadminService } from '@/services/superadmin.service';
import { SuperadminDashboard, AdminWithCompany } from '@/types';

function timeAgo(date: string | null): string {
  if (!date) return 'Nunca';
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 2)   return 'Hace un momento';
  if (m < 60)  return `Hace ${m} min`;
  if (h < 24)  return `Hace ${h} h`;
  if (d < 30)  return `Hace ${d} días`;
  return new Date(date).toLocaleDateString('es-UY', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SuperadminDashboardPage() {
  const [data,    setData]    = useState<SuperadminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await superadminService.getDashboard();
      setData(d);
    } catch {
      setError('No se pudo cargar el dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <PageLoader />
    </div>
  );

  if (error || !data) return (
    <div className="flex h-full items-center justify-center">
      <p className="text-slate-500">{error ?? 'Error desconocido'}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Dashboard del sistema</h1>
        <p className="text-sm text-slate-500 mt-0.5">Visión general de todas las empresas y administradores</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total empresas"
          value={data.totalCompanies}
          icon={Building2}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
        />
        <StatCard
          title="Total administradores"
          value={data.totalAdmins}
          icon={Users}
          iconBg="bg-brand-50"
          iconColor="text-brand-600"
        />
        <StatCard
          title="Admins activos"
          value={data.activeAdmins}
          icon={CheckCircle2}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          title="Admins inactivos"
          value={data.inactiveAdmins}
          icon={XCircle}
          iconBg="bg-red-50"
          iconColor="text-red-500"
        />
      </div>

      {/* Recent logins */}
      <div className="rounded-xl bg-white border border-slate-100 shadow-card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <Clock className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700">Últimos accesos</h2>
        </div>

        {data.recentLogins.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">
            Sin accesos registrados
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {data.recentLogins.map((admin: AdminWithCompany) => (
              <div key={admin.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                {/* Avatar */}
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-600">
                  {admin.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">{admin.name}</p>
                  <p className="text-xs text-slate-400 truncate">{admin.email}</p>
                </div>

                {/* Empresa */}
                <div className="hidden sm:block min-w-0 w-40">
                  <p className="text-xs font-medium text-slate-700 truncate">{admin.company?.name ?? '—'}</p>
                  <p className="text-[11px] text-slate-400 truncate">{admin.company?.city ?? ''}</p>
                </div>

                {/* Vehículos / Conductores */}
                <div className="hidden md:flex items-center gap-3 text-xs text-slate-500">
                  <span className="tabular-nums">{admin.company?._count.vehicles ?? 0} veh.</span>
                  <span className="tabular-nums">{admin.company?._count.drivers  ?? 0} cond.</span>
                </div>

                {/* Último acceso */}
                <div className="text-right">
                  <p className="text-xs text-slate-500 whitespace-nowrap">{timeAgo(admin.lastLogin)}</p>
                </div>

                {/* Estado */}
                <Badge variant={admin.active ? 'success' : 'danger'} dot>
                  {admin.active ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
