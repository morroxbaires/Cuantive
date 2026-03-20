import api from './api';
import { ApiResponse, PaginatedResponse, Alert, AlertNotification } from '@/types';

export interface AlertPayload {
  name:       string;
  type:       string;
  channel:    string;
  active?:    boolean;
  vehicleId?: string;
  config:     Record<string, unknown>;
}

export const alertsService = {
  async getAll(): Promise<PaginatedResponse<Alert>> {
    const { data } = await api.get<PaginatedResponse<Alert>>('/alerts/rules');
    return data;
  },

  async create(payload: AlertPayload): Promise<Alert> {
    const { data } = await api.post<ApiResponse<Alert>>('/alerts/rules', payload);
    return data.data;
  },

  async update(id: string, payload: Partial<AlertPayload>): Promise<Alert> {
    const { data } = await api.put<ApiResponse<Alert>>(`/alerts/rules/${id}`, payload);
    return data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/alerts/rules/${id}`);
  },

  async getNotifications(unreadOnly = false): Promise<PaginatedResponse<AlertNotification>> {
    const { data } = await api.get<PaginatedResponse<AlertNotification>>('/alerts/notifications', {
      params: { unreadOnly },
    });
    return data;
  },

  async markRead(id: string): Promise<void> {
    await api.patch(`/alerts/notifications/${id}/read`);
  },

  async markAllRead(): Promise<void> {
    await api.patch('/alerts/notifications/read-all');
  },
};
