import api from './api';
import { ApiResponse, PaginatedResponse, Driver } from '@/types';

export interface DriverFilters {
  page?:   number;
  limit?:  number;
  search?: string;
  active?: boolean;
}

export interface DriverPayload {
  name:             string;
  lastname:         string;
  document?:        string;
  licenseCategory?: string;
  licenseExpiry?:   string;
  phone?:           string;
  email?:           string;
  notes?:           string;
}

export const driversService = {
  async getAll(filters: DriverFilters = {}): Promise<PaginatedResponse<Driver>> {
    const { data } = await api.get<PaginatedResponse<Driver>>('/drivers', { params: filters });
    return data;
  },

  async getById(id: string): Promise<Driver> {
    const { data } = await api.get<ApiResponse<Driver>>(`/drivers/${id}`);
    return data.data;
  },

  async create(payload: DriverPayload): Promise<Driver> {
    const { data } = await api.post<ApiResponse<Driver>>('/drivers', payload);
    return data.data;
  },

  async update(id: string, payload: Partial<DriverPayload>): Promise<Driver> {
    const { data } = await api.put<ApiResponse<Driver>>(`/drivers/${id}`, payload);
    return data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/drivers/${id}`);
  },

  async getExpiringLicenses(days = 30): Promise<Driver[]> {
    const { data } = await api.get<ApiResponse<Driver[]>>('/drivers/expiring-licenses', { params: { days } });
    return data.data;
  },
};
