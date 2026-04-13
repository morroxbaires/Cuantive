'use client';

import { useState, useEffect, useCallback } from 'react';
import { satisfaccionesService, SatisfaccionFilters, SatisfaccionPayload } from '@/services/satisfacciones.service';
import type { Satisfaccion, SatisfaccionStats } from '@/types';

interface State {
  items:       Satisfaccion[];
  total:       number;
  totalPages:  number;
  stats:       SatisfaccionStats | null;
  loading:     boolean;
  filters:     SatisfaccionFilters;
}

const defaultFilters: SatisfaccionFilters = { page: 1, limit: 20 };

export function useSatisfacciones() {
  const [state, setState] = useState<State>({
    items: [], total: 0, totalPages: 1, stats: null, loading: true, filters: defaultFilters,
  });

  const fetchAll = useCallback(async (f: SatisfaccionFilters) => {
    setState(s => ({ ...s, loading: true }));
    try {
      const [listRes, statsRes] = await Promise.all([
        satisfaccionesService.getAll(f),
        satisfaccionesService.getStats({ from: f.from, to: f.to }),
      ]);
      setState(s => ({
        ...s,
        loading:    false,
        items:      listRes.data,
        total:      listRes.meta.total,
        totalPages: listRes.meta.totalPages,
        stats:      statsRes,
      }));
    } catch {
      setState(s => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => { fetchAll(state.filters); }, [state.filters, fetchAll]);

  const setFilters = useCallback((f: Partial<SatisfaccionFilters>) => {
    setState(s => ({ ...s, filters: { ...s.filters, ...f, page: 1 } }));
  }, []);

  const create = useCallback(async (payload: SatisfaccionPayload, image?: File) => {
    const s = await satisfaccionesService.create(payload, image);
    await fetchAll(state.filters);
    return s;
  }, [state.filters, fetchAll]);

  const update = useCallback(async (id: string, payload: SatisfaccionPayload, image?: File) => {
    const s = await satisfaccionesService.update(id, payload, image);
    await fetchAll(state.filters);
    return s;
  }, [state.filters, fetchAll]);

  const remove = useCallback(async (id: string) => {
    await satisfaccionesService.delete(id);
    await fetchAll(state.filters);
  }, [state.filters, fetchAll]);

  return {
    ...state,
    setFilters,
    refetch: () => fetchAll(state.filters),
    create,
    update,
    remove,
  };
}
