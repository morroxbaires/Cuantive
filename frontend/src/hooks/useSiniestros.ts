import { useState, useEffect, useCallback } from 'react';
import { siniestrosService, SiniestroFilters, SiniestroPayload } from '@/services/siniestros.service';
import type { Siniestro, SiniestroStats } from '@/types';

interface UseSiniestrosState {
  siniestros:  Siniestro[];
  total:       number;
  totalPages:  number;
  stats:       SiniestroStats | null;
  loading:     boolean;
  error:       string | null;
  filters:     SiniestroFilters;
}

export function useSiniestros() {
  const [state, setState] = useState<UseSiniestrosState>({
    siniestros:  [],
    total:       0,
    totalPages:  1,
    stats:       null,
    loading:     true,
    error:       null,
    filters:     { page: 1, limit: 20 },
  });

  const fetchAll = useCallback(async (filters: SiniestroFilters) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const [res, stats] = await Promise.all([
        siniestrosService.getAll(filters),
        siniestrosService.getStats({ from: filters.from, to: filters.to }),
      ]);
      setState(s => ({
        ...s,
        siniestros: res.data,
        total:      res.meta?.total      ?? 0,
        totalPages: res.meta?.totalPages ?? 1,
        stats,
        loading:    false,
      }));
    } catch {
      setState(s => ({ ...s, loading: false, error: 'Error al cargar siniestros' }));
    }
  }, []);

  useEffect(() => { fetchAll(state.filters); }, [state.filters, fetchAll]);

  const setFilters = useCallback((partial: Partial<SiniestroFilters>) => {
    setState(s => ({ ...s, filters: { ...s.filters, page: 1, ...partial } }));
  }, []);

  const refetch = useCallback(() => fetchAll(state.filters), [state.filters, fetchAll]);

  const create = useCallback(async (payload: SiniestroPayload, image?: File) => {
    const s = await siniestrosService.create(payload, image);
    await fetchAll(state.filters);
    return s;
  }, [state.filters, fetchAll]);

  const update = useCallback(async (id: string, payload: SiniestroPayload, image?: File) => {
    const s = await siniestrosService.update(id, payload, image);
    await fetchAll(state.filters);
    return s;
  }, [state.filters, fetchAll]);

  const remove = useCallback(async (id: string) => {
    await siniestrosService.delete(id);
    await fetchAll(state.filters);
  }, [state.filters, fetchAll]);

  return {
    ...state,
    setFilters,
    refetch,
    create,
    update,
    remove,
  };
}
