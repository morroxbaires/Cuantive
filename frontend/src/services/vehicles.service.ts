import api from './api';
import { ApiResponse, PaginatedResponse, Vehicle, VehicleType, FuelType } from '@/types';

export interface VehicleFilters {
  page?:          number;
  limit?:         number;
  search?:        string;
  vehicleTypeId?: number;
  active?:        boolean;
}

export interface VehiclePayload {
  plate:                string;
  brand:                string;
  model:                string;
  year:                 number;
  color?:               string;
  coachNumber?:         string;
  vehicleTypeId?:       number;
  fuelTypeId?:          number;
  currentOdometer?:     number;
  efficiencyReference?: number;
  driverIds?:           string[];
}

export const vehiclesService = {
  async getAll(filters: VehicleFilters = {}): Promise<PaginatedResponse<Vehicle>> {
    const { data } = await api.get<PaginatedResponse<Vehicle>>('/vehicles', { params: filters });
    return data;
  },

  async getById(id: string): Promise<Vehicle> {
    const { data } = await api.get<ApiResponse<Vehicle>>(`/vehicles/${id}`);
    return data.data;
  },

  async create(payload: VehiclePayload): Promise<Vehicle> {
    const { data } = await api.post<ApiResponse<Vehicle>>('/vehicles', payload);
    return data.data;
  },

  async update(id: string, payload: Partial<VehiclePayload>): Promise<Vehicle> {
    const { data } = await api.put<ApiResponse<Vehicle>>(`/vehicles/${id}`, payload);
    return data.data;
  },

  async toggleActive(id: string): Promise<Vehicle> {
    const { data } = await api.patch<ApiResponse<Vehicle>>(`/vehicles/${id}/status`);
    return data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/vehicles/${id}`);
  },

  async getCatalogs(): Promise<{ vehicleTypes: VehicleType[]; fuelTypes: FuelType[] }> {
    const { data } = await api.get<ApiResponse<{ vehicleTypes: VehicleType[]; fuelTypes: FuelType[] }>>('/vehicles/catalogs');
    return data.data;
  },
};
