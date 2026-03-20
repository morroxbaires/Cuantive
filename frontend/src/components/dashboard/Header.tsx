'use client';

import { usePathname } from 'next/navigation';
import { Bell, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAlerts } from '@/hooks/useAlerts';
import { cn } from '@/lib/utils';

const breadcrumbLabels: Record<string, string> = {
  dashboard:   'Dashboard',
  vehicles:    'Vehículos',
  drivers:     'Conductores',
  turnos:      'Turnos',
  'fuel-loads': 'Repostaje',
  maintenance: 'Mantenimiento',
  alerts:      'Alertas',
  settings:    'Configuración',
  analytics:   'Análisis de rendimiento',
  profile:     'Mi perfil',
};

export function Header() {
  const pathname     = usePathname();
  const { user }     = useAuth();
  const { unreadCount } = useAlerts();

  const segment   = pathname.split('/').filter(Boolean).pop() ?? 'dashboard';
  const pageTitle = breadcrumbLabels[segment] ?? 'Dashboard';

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-100 bg-white px-6">
      {/* Title */}
      <h1 className="text-sm font-semibold text-slate-900">{pageTitle}</h1>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
          )}
        </button>

        {/* Avatar */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
            {user?.name?.charAt(0).toUpperCase() ?? 'U'}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-medium text-slate-700">{user?.name}</p>
            <p className="text-[10px] text-slate-400">{user?.companyName ?? 'Superroot'}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
