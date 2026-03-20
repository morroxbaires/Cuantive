'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { SuperadminSidebar } from '@/components/superadmin/SuperadminSidebar';
import { PageLoader } from '@/components/ui/Spinner';

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoggedIn, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!isLoggedIn) {
      router.replace('/login');
      return;
    }
    if (user?.role !== 'superroot') {
      router.replace('/dashboard');
    }
  }, [loading, isLoggedIn, user, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <PageLoader />
      </div>
    );
  }

  if (!isLoggedIn || user?.role !== 'superroot') return null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <SuperadminSidebar />
      <main className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin">
        {children}
      </main>
    </div>
  );
}
