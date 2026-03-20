import { useState, useEffect, useCallback } from 'react';
import { driversService, DriverFilters, DriverPayload } from '@/services/drivers.service';
import { Driver } from '@/types';

export function useDrivers(initialFilters: DriverFilters = {}) {
  const [drivers,    setDrivers]    = useState<Driver[]>([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [filters,    setFilters]    = useState<DriverFilters>({ page: 1, limit: 10, ...initialFilters });

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await driversService.getAll(filters);
      setDrivers(res.data);
      setTotal(res.meta.total);
      setTotalPages(res.meta.totalPages);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Error al cargar conductores');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(async (payload: DriverPayload) => {
    const d = await driversService.create(payload);
    await fetch();
    return d;
  }, [fetch]);

  const update = useCallback(async (id: string, payload: Partial<DriverPayload>) => {
    const d = await driversService.update(id, payload);
    await fetch();
    return d;
  }, [fetch]);

  const remove = useCallback(async (id: string) => {
    await driversService.delete(id);
    await fetch();
  }, [fetch]);

  return {
    drivers, total, totalPages, loading, error, filters,
    setFilters, refetch: fetch, create, update, remove,
  };
}
