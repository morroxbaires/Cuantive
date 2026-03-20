import api from './api';
import { ApiResponse, PaginatedResponse, Maintenance, MaintenanceStatus } from '@/types';

export interface MaintenanceFilters {
  page?:      number;
  limit?:     number;
  vehicleId?: string;
  status?:    MaintenanceStatus;
  from?:      string;
  to?:        string;
}

export interface MaintenancePayload {
  vehicleId:     string;
  driverId?:     string;
  date:          string;
  type:          string;
  description:   string;
  cost:          number;
  odometer?:     number;
  status?:       MaintenanceStatus;
  workshopName?: string;
  nextDate?:     string;
  nextOdometer?: number;
  notes?:        string;
}

export const maintenanceService = {
  async getAll(filters: MaintenanceFilters = {}): Promise<PaginatedResponse<Maintenance>> {
    const { data } = await api.get<PaginatedResponse<Maintenance>>('/maintenance', { params: filters });
    return data;
  },

  async getById(id: string): Promise<Maintenance> {
    const { data } = await api.get<ApiResponse<Maintenance>>(`/maintenance/${id}`);
    return data.data;
  },

  async create(payload: MaintenancePayload): Promise<Maintenance> {
    const { data } = await api.post<ApiResponse<Maintenance>>('/maintenance', payload);
    return data.data;
  },

  async update(id: string, payload: Partial<MaintenancePayload>): Promise<Maintenance> {
    const { data } = await api.put<ApiResponse<Maintenance>>(`/maintenance/${id}`, payload);
    return data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/maintenance/${id}`);
  },

  async getUpcoming(days = 60): Promise<Maintenance[]> {
    const { data } = await api.get<ApiResponse<Maintenance[]>>('/maintenance/upcoming', { params: { days } });
    return data.data;
  },
};
