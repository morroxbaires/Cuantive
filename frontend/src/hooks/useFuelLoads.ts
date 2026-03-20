import { useState, useEffect, useCallback } from 'react';
import { fuelLoadsService, FuelLoadFilters, FuelLoadPayload } from '@/services/fuel-loads.service';
import { FuelLoad, FuelStats, FuelType } from '@/types';

export function useFuelLoads(initialFilters: FuelLoadFilters = {}) {
  const [loads,      setLoads]      = useState<FuelLoad[]>([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats,      setStats]      = useState<FuelStats | null>(null);
  const [fuelTypes,  setFuelTypes]  = useState<FuelType[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [filters,    setFilters]    = useState<FuelLoadFilters>({ page: 1, limit: 10, ...initialFilters });

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [res, statsData, types] = await Promise.all([
        fuelLoadsService.getAll(filters),
        fuelLoadsService.getStats(30),
        fuelLoadsService.getFuelTypes(),
      ]);
      setLoads(res.data);
      setTotal(res.meta.total);
      setTotalPages(res.meta.totalPages);
      setStats(statsData);
      setFuelTypes(types);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Error al cargar cargas de combustible');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(async (payload: FuelLoadPayload) => {
    const fl = await fuelLoadsService.create(payload);
    await fetch();
    return fl;
  }, [fetch]);

  const update = useCallback(async (id: string, payload: Partial<FuelLoadPayload>) => {
    const fl = await fuelLoadsService.update(id, payload);
    await fetch();
    return fl;
  }, [fetch]);

  const remove = useCallback(async (id: string) => {
    await fuelLoadsService.delete(id);
    await fetch();
  }, [fetch]);

  return {
    loads, total, totalPages, stats, fuelTypes, loading, error, filters,
    setFilters, refetch: fetch, create, update, remove,
  };
}
