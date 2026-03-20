import { useState, useEffect, useCallback } from 'react';
import {
  vehicleDocumentsService,
  VehicleDocumentFilters,
  VehicleDocumentPayload,
} from '@/services/vehicle-documents.service';
import { VehicleDocument } from '@/types';

export function useVehicleDocuments(initialFilters: VehicleDocumentFilters = {}) {
  const [documents,  setDocuments]  = useState<VehicleDocument[]>([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [filters,    setFilters]    = useState<VehicleDocumentFilters>({
    page: 1, limit: 10, ...initialFilters,
  });

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await vehicleDocumentsService.getAll(filters);
      setDocuments(res.data);
      setTotal(res.meta.total);
      setTotalPages(res.meta.totalPages);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Error al cargar documentos');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(async (payload: VehicleDocumentPayload) => {
    const doc = await vehicleDocumentsService.create(payload);
    await fetch();
    return doc;
  }, [fetch]);

  const update = useCallback(async (id: string, payload: Partial<VehicleDocumentPayload>) => {
    const doc = await vehicleDocumentsService.update(id, payload);
    await fetch();
    return doc;
  }, [fetch]);

  const remove = useCallback(async (id: string) => {
    await vehicleDocumentsService.delete(id);
    await fetch();
  }, [fetch]);

  return {
    documents, total, totalPages, loading, error, filters,
    setFilters, refetch: fetch, create, update, remove,
  };
}
