'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Truck, Users, Fuel, Wrench,
  Bell, Settings, LogOut, ChevronRight, Zap, BarChart2, ClipboardList, UserCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useAlerts } from '@/hooks/useAlerts';

const navItems = [
  { label: 'Dashboard',     href: '/dashboard',             icon: LayoutDashboard },
  { label: 'Análisis',      href: '/dashboard/analytics',   icon: BarChart2 },
  { label: 'Vehículos',     href: '/dashboard/vehicles',    icon: Truck },
  { label: 'Conductores',   href: '/dashboard/drivers',     icon: Users },
  { label: 'Turnos',        href: '/dashboard/turnos',      icon: ClipboardList },
  { label: 'Repostaje',     href: '/dashboard/fuel-loads',  icon: Fuel },
  { label: 'Mantenimiento', href: '/dashboard/maintenance', icon: Wrench },
  { label: 'Alertas',       href: '/dashboard/alerts',      icon: Bell },
  { label: 'Configuración', href: '/dashboard/settings',    icon: Settings },
];

export function Sidebar() {
  const pathname  = usePathname();
  const { user, logout } = useAuth();
  const { unreadCount }  = useAlerts();

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href);

  return (
    <aside className="flex h-screen w-[220px] flex-shrink-0 flex-col bg-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <span className="text-base font-semibold text-white tracking-tight">Cuantive</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-white/10 text-white'
                  : 'text-white/55 hover:bg-white/5 hover:text-white/90',
              )}
            >
              <Icon className={cn('h-4 w-4 flex-shrink-0', active ? 'text-white' : 'text-white/50 group-hover:text-white/80')} />
              <span className="flex-1">{label}</span>
              {label === 'Alertas' && unreadCount > 0 && (
                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              {active && <ChevronRight className="h-3.5 w-3.5 text-white/40" />}
            </Link>
          );
        })}
      </nav>

      {/* User chip → links to profile */}
      <div className="border-t border-white/5 px-3 py-4">
        <Link
          href="/dashboard/profile"
          className={cn(
            'mb-2 flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/5',
            pathname.startsWith('/dashboard/profile') && 'bg-white/10',
          )}
        >
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
            {user?.name?.charAt(0).toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-white">{user?.name}</p>
            <p className="truncate text-[10px] text-white/40 capitalize">{user?.role}</p>
          </div>
          <UserCircle className="h-3.5 w-3.5 flex-shrink-0 text-white/30" />
        </Link>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white/80"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
