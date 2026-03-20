import api from './api';
import { ApiResponse, Settings } from '@/types';

export const settingsService = {
  async get(): Promise<Settings> {
    const { data } = await api.get<ApiResponse<Settings>>('/settings');
    return data.data;
  },

  async update(payload: Partial<Omit<Settings, 'id' | 'company'>>): Promise<Settings> {
    const { data } = await api.put<ApiResponse<Settings>>('/settings', payload);
    return data.data;
  },
};
