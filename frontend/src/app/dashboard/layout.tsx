'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Header }  from '@/components/dashboard/Header';
import { PageLoader } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, loading, user } = useAuth();
  const router = useRouter();
  const { warning } = useToast();

  useEffect(() => {
    if (!loading && !isLoggedIn) router.replace('/login');
    if (!loading && isLoggedIn && user?.role === 'superroot') router.replace('/superadmin');
  }, [loading, isLoggedIn, user, router]);

  useEffect(() => {
    const handler = () => warning('Sesión expirada', 'Tu sesión ha expirado. Serás redirigido al inicio de sesión.');
    window.addEventListener('auth:session-expired', handler);
    return () => window.removeEventListener('auth:session-expired', handler);
  }, [warning]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <PageLoader />
      </div>
    );
  }

  if (!isLoggedIn || user?.role === 'superroot') return null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  );
}
