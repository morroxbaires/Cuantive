import Cookies from 'js-cookie';
import api from './api';
import { ApiResponse, AuthUser, LoginResponse } from '@/types';

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await api.post<ApiResponse<LoginResponse>>('/auth/login', { email, password });
    const result = data.data;
    // Guardar access token en cookie (15 min)
    Cookies.set('access_token', result.accessToken, { expires: 1 / 96, sameSite: 'strict' });
    return result;
  },

  async logout(): Promise<void> {
    try { await api.post('/auth/logout'); } catch { /* silent */ }
    Cookies.remove('access_token');
  },

  async logoutAll(): Promise<void> {
    try { await api.post('/auth/logout-all'); } catch { /* silent */ }
    Cookies.remove('access_token');
  },

  async me(): Promise<AuthUser> {
    const { data } = await api.get<ApiResponse<AuthUser>>('/auth/me');
    return data.data;
  },

  async updateProfile(name: string): Promise<AuthUser> {
    const { data } = await api.patch<ApiResponse<AuthUser>>('/users/me', { name });
    return data.data;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.patch('/users/password', { currentPassword, newPassword });
  },
};
