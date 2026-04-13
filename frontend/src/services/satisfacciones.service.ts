import api from './api';
import type { Satisfaccion, SatisfaccionStats } from '@/types';

export interface SatisfaccionFilters {
  page?:      number;
  limit?:     number;
  vehicleId?: string;
  from?:      string;
  to?:        string;
}

export interface SatisfaccionPayload {
  vehicleId?:    string;
  fecha?:        string;
  hora?:         string;
  puntuacion?:   number;
  observaciones?: string;
  imageFile?:    string;
}

const BASE = '/satisfaccion';

export const satisfaccionesService = {
  getAll: (filters: SatisfaccionFilters = {}) => {
    const p = new URLSearchParams();
    if (filters.page)      p.set('page',      String(filters.page));
    if (filters.limit)     p.set('limit',     String(filters.limit));
    if (filters.vehicleId) p.set('vehicleId', filters.vehicleId);
    if (filters.from)      p.set('from',      filters.from);
    if (filters.to)        p.set('to',        filters.to);
    const qs = p.toString();
    return api.get<{
      success: boolean;
      data: Satisfaccion[];
      meta: { total: number; totalPages: number; page: number; limit: number };
    }>(`${BASE}${qs ? `?${qs}` : ''}`).then(r => r.data);
  },

  getById: (id: string) =>
    api.get<{ success: boolean; data: Satisfaccion }>(`${BASE}/${id}`).then(r => r.data.data),

  create: (payload: SatisfaccionPayload, image?: File) => {
    const form = new FormData();
    if (payload.vehicleId)     form.append('vehicleId',     payload.vehicleId);
    if (payload.fecha)         form.append('fecha',         payload.fecha);
    if (payload.hora)          form.append('hora',          payload.hora);
    if (payload.puntuacion != null) form.append('puntuacion', String(payload.puntuacion));
    if (payload.observaciones) form.append('observaciones', payload.observaciones);
    if (image)                 form.append('image',         image);
    return api.post<{ success: boolean; data: Satisfaccion }>(BASE, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data.data);
  },

  update: (id: string, payload: SatisfaccionPayload, image?: File) => {
    const form = new FormData();
    if (payload.vehicleId !== undefined)     form.append('vehicleId',     payload.vehicleId ?? '');
    if (payload.fecha     !== undefined)     form.append('fecha',         payload.fecha     ?? '');
    if (payload.hora      !== undefined)     form.append('hora',          payload.hora      ?? '');
    if (payload.puntuacion != null)          form.append('puntuacion',    String(payload.puntuacion));
    if (payload.observaciones !== undefined) form.append('observaciones', payload.observaciones ?? '');
    if (image)                               form.append('image',         image);
    return api.put<{ success: boolean; data: Satisfaccion }>(`${BASE}/${id}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data.data);
  },

  delete: (id: string) =>
    api.delete<{ success: boolean }>(`${BASE}/${id}`).then(r => r.data),

  getStats: (range?: { from?: string; to?: string }) => {
    const p = new URLSearchParams();
    if (range?.from) p.set('from', range.from);
    if (range?.to)   p.set('to',   range.to);
    const qs = p.toString();
    return api.get<{ success: boolean; data: SatisfaccionStats }>(
      `${BASE}/stats${qs ? `?${qs}` : ''}`,
    ).then(r => r.data.data);
  },
};
