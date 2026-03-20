import api from './api';
import { ApiResponse, PaginatedResponse, FuelLoad, FuelStats, FuelType } from '@/types';

export interface FuelLoadFilters {
  page?:      number;
  limit?:     number;
  vehicleId?: string;
  driverId?:  string;
  from?:      string;
  to?:        string;
}

export interface FuelLoadPayload {
  vehicleId:      string;
  driverId?:      string;
  fuelTypeId:     number;
  date:           string;
  litersOrKwh:    number;
  unitPrice?:     number;
  priceTotal?:    number;
  odometer?:      number;
  station?:       string;
  notes?:         string;
}

export const fuelLoadsService = {
  async getAll(filters: FuelLoadFilters = {}): Promise<PaginatedResponse<FuelLoad>> {
    const { data } = await api.get<PaginatedResponse<FuelLoad>>('/fuel-loads', { params: filters });
    return data;
  },

  async getById(id: string): Promise<FuelLoad> {
    const { data } = await api.get<ApiResponse<FuelLoad>>(`/fuel-loads/${id}`);
    return data.data;
  },

  async create(payload: FuelLoadPayload): Promise<FuelLoad> {
    const { data } = await api.post<ApiResponse<FuelLoad>>('/fuel-loads', payload);
    return data.data;
  },

  async update(id: string, payload: Partial<FuelLoadPayload>): Promise<FuelLoad> {
    const { data } = await api.put<ApiResponse<FuelLoad>>(`/fuel-loads/${id}`, payload);
    return data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/fuel-loads/${id}`);
  },

  async getStats(days = 30, vehicleId?: string): Promise<FuelStats> {
    const { data } = await api.get<ApiResponse<FuelStats>>('/fuel-loads/stats', {
      params: { days, ...(vehicleId ? { vehicleId } : {}) },
    });
    return data.data;
  },

  async getFuelTypes(): Promise<FuelType[]> {
    const { data } = await api.get<ApiResponse<FuelType[]>>('/fuel-loads/catalogs');
    return data.data;
  },
};
