import api from './api';
import { ApiResponse, PaginatedResponse, VehicleDocument } from '@/types';

export type DocumentType = 'insurance' | 'registration' | 'permit' | 'inspection';
export type DocumentStatus = 'active' | 'expiring' | 'expired';

export interface VehicleDocumentFilters {
  page?:         number;
  limit?:        number;
  vehicleId?:    string;
  documentType?: DocumentType;
  status?:       DocumentStatus;
}

export interface VehicleDocumentPayload {
  vehicleId:      string;
  documentType:   DocumentType;
  documentNumber?: string;
  issueDate?:      string | null;
  expirationDate?: string | null;
  fileUrl?:        string | null;
  notes?:          string | null;
}

export const vehicleDocumentsService = {
  async getAll(filters: VehicleDocumentFilters = {}): Promise<PaginatedResponse<VehicleDocument>> {
    const { data } = await api.get<PaginatedResponse<VehicleDocument>>('/vehicle-documents', { params: filters });
    return data;
  },

  async getById(id: string): Promise<VehicleDocument> {
    const { data } = await api.get<ApiResponse<VehicleDocument>>(`/vehicle-documents/${id}`);
    return data.data;
  },

  async getByVehicle(vehicleId: string): Promise<VehicleDocument[]> {
    const { data } = await api.get<ApiResponse<VehicleDocument[]>>(`/vehicle-documents/vehicle/${vehicleId}`);
    return data.data;
  },

  async create(payload: VehicleDocumentPayload): Promise<VehicleDocument> {
    const { data } = await api.post<ApiResponse<VehicleDocument>>('/vehicle-documents', payload);
    return data.data;
  },

  async update(id: string, payload: Partial<VehicleDocumentPayload>): Promise<VehicleDocument> {
    const { data } = await api.put<ApiResponse<VehicleDocument>>(`/vehicle-documents/${id}`, payload);
    return data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/vehicle-documents/${id}`);
  },
};
