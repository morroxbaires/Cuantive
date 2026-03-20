/**
 * useTurnos.ts
 *
 * React hook that encapsulates all turno state, pagination, and CRUD operations.
 * Follows the same pattern as useVehicles / useDrivers.
 */
import { useState, useEffect, useCallback } from 'react';
import { turnosService, TurnoFilters, TurnoPayload } from '@/services/turnos.service';
import { Turno } from '@/types';

export function useTurnos(initialFilters: TurnoFilters = {}) {
  const [turnos,     setTurnos]     = useState<Turno[]>([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [filters,    setFilters]    = useState<TurnoFilters>({
    page: 1, limit: 15, ...initialFilters,
  });

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await turnosService.getAll(filters);
      setTurnos(res.data);
      setTotal(res.meta.total);
      setTotalPages(res.meta.totalPages);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Error al cargar turnos');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(async (payload: TurnoPayload) => {
    const t = await turnosService.create(payload);
    await fetch();
    return t;
  }, [fetch]);

  const update = useCallback(async (id: string, payload: Partial<TurnoPayload>) => {
    const t = await turnosService.update(id, payload);
    await fetch();
    return t;
  }, [fetch]);

  const remove = useCallback(async (id: string) => {
    await turnosService.delete(id);
    await fetch();
  }, [fetch]);

  return {
    turnos, total, totalPages, loading, error, filters,
    setFilters, refetch: fetch, create, update, remove,
  };
}
