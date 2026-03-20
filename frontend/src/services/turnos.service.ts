/**
 * turnos.service.ts
 *
 * Frontend API client for the Turnos module.
 * Mirrors turno.service.ts (backend) payload shapes.
 */
import api from './api';
import { ApiResponse, PaginatedResponse, Turno, TurnoStats } from '@/types';

export interface TurnoFilters {
  page?:      number;
  limit?:     number;
  search?:    string;
  vehicleId?: string;
  driverId?:  string;
  dateFrom?:  string;   // YYYY-MM-DD
  dateTo?:    string;
}

export interface TurnoPayload {
  vehicleId:   string;
  driverId:    string;
  shiftDate:   string;   // YYYY-MM-DD
  shiftNumber: number;
  totalFichas: number;
  kmOcupados:  number;
  kmLibres:    number;
  notes?:      string;
}

export const turnosService = {
  async getAll(filters: TurnoFilters = {}): Promise<PaginatedResponse<Turno>> {
    const { data } = await api.get<PaginatedResponse<Turno>>('/turnos', { params: filters });
    return data;
  },

  async getById(id: string): Promise<Turno> {
    const { data } = await api.get<ApiResponse<Turno>>(`/turnos/${id}`);
    return data.data!;
  },

  async create(payload: TurnoPayload): Promise<Turno> {
    const { data } = await api.post<ApiResponse<Turno>>('/turnos', payload);
    return data.data!;
  },

  async update(id: string, payload: Partial<TurnoPayload>): Promise<Turno> {
    const { data } = await api.put<ApiResponse<Turno>>(`/turnos/${id}`, payload);
    return data.data!;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/turnos/${id}`);
  },

  async getStats(filters: Omit<TurnoFilters, 'page' | 'limit' | 'search'> = {}): Promise<TurnoStats> {
    const { data } = await api.get<ApiResponse<TurnoStats>>('/turnos/stats', { params: filters });
    return data.data!;
  },
};
