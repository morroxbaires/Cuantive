'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, LogOut, ChevronRight, Zap, Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { label: 'Dashboard',        href: '/superadmin',                   icon: LayoutDashboard },
  { label: 'Administradores',  href: '/superadmin/administradores',   icon: Building2 },
];

export function SuperadminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isActive = (href: string) =>
    href === '/superadmin' ? pathname === href : pathname.startsWith(href);

  return (
    <aside className="flex h-screen w-[220px] flex-shrink-0 flex-col bg-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <span className="text-base font-semibold text-white tracking-tight">Cuantive</span>
      </div>

      {/* Badge */}
      <div className="px-5 py-2.5 border-b border-white/5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-600/20 px-2.5 py-1 text-[11px] font-medium text-brand-300">
          <Users className="h-3 w-3" />
          Super Administrador
        </span>
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
              {active && <ChevronRight className="h-3.5 w-3.5 text-white/40" />}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-white/5 px-3 py-4">
        <div className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2.5">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
            {user?.name?.charAt(0).toUpperCase() ?? 'S'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-white">{user?.name}</p>
            <p className="truncate text-[10px] text-white/40">Sistema</p>
          </div>
        </div>
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
