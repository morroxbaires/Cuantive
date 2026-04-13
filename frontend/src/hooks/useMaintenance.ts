import { useState, useEffect, useCallback } from 'react';
import { maintenanceService, MaintenanceFilters, MaintenancePayload } from '@/services/maintenance.service';
import { Maintenance } from '@/types';

export function useMaintenance(initialFilters: MaintenanceFilters = {}) {
  const [records,    setRecords]    = useState<Maintenance[]>([]);
  const [upcoming,   setUpcoming]   = useState<Maintenance[]>([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [filters,    setFilters]    = useState<MaintenanceFilters>({ page: 1, limit: 10, ...initialFilters });

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [res, upcomingData] = await Promise.all([
        maintenanceService.getAll(filters),
        maintenanceService.getUpcoming(365),
      ]);
      setRecords(res.data);
      setTotal(res.meta.total);
      setTotalPages(res.meta.totalPages);
      setUpcoming(upcomingData);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Error al cargar mantenimientos');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(async (payload: MaintenancePayload) => {
    const m = await maintenanceService.create(payload);
    await fetch();
    return m;
  }, [fetch]);

  const update = useCallback(async (id: string, payload: Partial<MaintenancePayload>) => {
    const m = await maintenanceService.update(id, payload);
    await fetch();
    return m;
  }, [fetch]);

  const remove = useCallback(async (id: string) => {
    await maintenanceService.delete(id);
    await fetch();
  }, [fetch]);

  return {
    records, upcoming, total, totalPages, loading, error, filters,
    setFilters, refetch: fetch, create, update, remove,
  };
}
