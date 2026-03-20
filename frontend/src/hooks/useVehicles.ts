import { useState, useEffect, useCallback } from 'react';
import { vehiclesService, VehicleFilters, VehiclePayload } from '@/services/vehicles.service';
import { Vehicle, VehicleType, FuelType } from '@/types';

export function useVehicles(initialFilters: VehicleFilters = {}) {
  const [vehicles,   setVehicles]   = useState<Vehicle[]>([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [filters,    setFilters]    = useState<VehicleFilters>({ page: 1, limit: 10, ...initialFilters });
  const [types,      setTypes]      = useState<VehicleType[]>([]);
  const [fuelTypes,  setFuelTypes]  = useState<FuelType[]>([]);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await vehiclesService.getAll(filters);
      setVehicles(res.data);
      setTotal(res.meta.total);
      setTotalPages(res.meta.totalPages);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Error al cargar vehículos');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    vehiclesService.getCatalogs().then((c) => {
      setTypes(c.vehicleTypes);
      setFuelTypes(c.fuelTypes ?? []);
    }).catch(() => {});
  }, []);

  const create = useCallback(async (payload: VehiclePayload) => {
    const v = await vehiclesService.create(payload);
    await fetch();
    return v;
  }, [fetch]);

  const update = useCallback(async (id: string, payload: Partial<VehiclePayload>) => {
    const v = await vehiclesService.update(id, payload);
    await fetch();
    return v;
  }, [fetch]);

  const remove = useCallback(async (id: string) => {
    await vehiclesService.delete(id);
    await fetch();
  }, [fetch]);

  const toggleActive = useCallback(async (id: string) => {
    await vehiclesService.toggleActive(id);
    await fetch();
  }, [fetch]);

  return {
    vehicles, total, totalPages, loading, error, filters, types, fuelTypes,
    setFilters, refetch: fetch, create, update, remove, toggleActive,
  };
}
