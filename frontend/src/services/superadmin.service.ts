import api from './api';
import {
  SuperadminDashboard,
  AdminListResponse,
  AdminWithCompany,
  CreateAdminPayload,
  UpdateAdminPayload,
} from '@/types';

const BASE = '/superadmin';

export const superadminService = {
  /** Dashboard con estadísticas globales */
  async getDashboard(): Promise<SuperadminDashboard> {
    const { data } = await api.get<{ success: boolean; data: SuperadminDashboard }>(BASE);
    return data.data;
  },

  /** Lista paginada de administradores */
  async getAdmins(params?: {
    page?:   number;
    limit?:  number;
    search?: string;
  }): Promise<AdminListResponse> {
    const { data } = await api.get<AdminListResponse & { success: boolean }>(
      `${BASE}/admins`,
      { params },
    );
    return data;
  },

  /** Crear nuevo admin + empresa */
  async createAdmin(payload: CreateAdminPayload): Promise<AdminWithCompany> {
    const { data } = await api.post<{ success: boolean; data: AdminWithCompany }>(
      `${BASE}/admins`,
      payload,
    );
    return data.data;
  },

  /** Actualizar admin + empresa */
  async updateAdmin(id: string, payload: UpdateAdminPayload): Promise<AdminWithCompany> {
    const { data } = await api.put<{ success: boolean; data: AdminWithCompany }>(
      `${BASE}/admins/${id}`,
      payload,
    );
    return data.data;
  },

  /** Activar / desactivar admin */
  async toggleAdmin(id: string): Promise<AdminWithCompany> {
    const { data } = await api.patch<{ success: boolean; data: AdminWithCompany }>(
      `${BASE}/admins/${id}/toggle`,
    );
    return data.data;
  },

  /** Eliminar admin (soft delete) */
  async deleteAdmin(id: string): Promise<void> {
    await api.delete(`${BASE}/admins/${id}`);
  },
};
