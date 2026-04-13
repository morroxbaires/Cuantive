import api from './api';
import type { Siniestro, SiniestroStats } from '@/types';

export interface SiniestroFilters {
  page?:      number;
  limit?:     number;
  vehicleId?: string;
  driverId?:  string;
  from?:      string;
  to?:        string;
}

export interface SiniestroPayload {
  vehicleId?:    string;
  driverId?:     string;
  fecha?:        string;
  hora?:         string;
  observaciones?: string;
  costo?:        number | string;
  estado?:       string;
  tipo?:         string;
  imageFile?:    string;
}

const BASE = '/siniestros';

export const siniestrosService = {
  getAll: (filters: SiniestroFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.page)      params.set('page',      String(filters.page));
    if (filters.limit)     params.set('limit',     String(filters.limit));
    if (filters.vehicleId) params.set('vehicleId', filters.vehicleId);
    if (filters.driverId)  params.set('driverId',  filters.driverId);
    if (filters.from)      params.set('from',       filters.from);
    if (filters.to)        params.set('to',         filters.to);
    const qs = params.toString();
    return api.get<{ success: boolean; data: Siniestro[]; meta: { total: number; totalPages: number; page: number; limit: number } }>(
      `${BASE}${qs ? `?${qs}` : ''}`,
    ).then(r => r.data);
  },

  getById: (id: string) =>
    api.get<{ success: boolean; data: Siniestro }>(`${BASE}/${id}`).then(r => r.data.data),

  create: (payload: SiniestroPayload, image?: File) => {
    const form = new FormData();
    if (payload.vehicleId)    form.append('vehicleId',    payload.vehicleId);
    if (payload.driverId)     form.append('driverId',     payload.driverId);
    if (payload.fecha)        form.append('fecha',        payload.fecha);
    if (payload.hora)         form.append('hora',         payload.hora);
    if (payload.observaciones) form.append('observaciones', payload.observaciones);
    if (payload.costo !== undefined && payload.costo !== '') form.append('costo', String(payload.costo));
    if (image)                form.append('image', image);
    return api.post<{ success: boolean; data: Siniestro }>(`${BASE}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data.data);
  },

  update: (id: string, payload: SiniestroPayload, image?: File) => {
    const form = new FormData();
    if (payload.vehicleId !== undefined)    form.append('vehicleId',    payload.vehicleId ?? '');
    if (payload.driverId  !== undefined)    form.append('driverId',     payload.driverId  ?? '');
    if (payload.fecha     !== undefined)    form.append('fecha',        payload.fecha     ?? '');
    if (payload.hora      !== undefined)    form.append('hora',         payload.hora      ?? '');
    if (payload.observaciones !== undefined) form.append('observaciones', payload.observaciones ?? '');
    if (payload.costo     !== undefined)    form.append('costo',        String(payload.costo ?? ''));
    if (image)                              form.append('image', image);
    return api.put<{ success: boolean; data: Siniestro }>(`${BASE}/${id}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data.data);
  },

  delete: (id: string) =>
    api.delete<{ success: boolean }>(`${BASE}/${id}`).then(r => r.data),

  getStats: (range?: { from?: string; to?: string }) => {
    const params = new URLSearchParams();
    if (range?.from) params.set('from', range.from);
    if (range?.to)   params.set('to',   range.to);
    const qs = params.toString();
    return api.get<{ success: boolean; data: SiniestroStats }>(
      `/siniestros/stats${qs ? `?${qs}` : ''}`,
    ).then(r => r.data.data);
  },
};
