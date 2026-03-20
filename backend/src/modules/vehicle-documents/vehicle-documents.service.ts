import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { DocumentType } from '@prisma/client';
import { prisma } from '../../config/database';
import { getPagination, buildMeta } from '../../utils/response';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

export const createVehicleDocumentSchema = z.object({
  vehicleId:      z.string().uuid(),
  documentType:   z.nativeEnum(DocumentType),
  documentNumber: z.string().max(80).optional(),
  issueDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  fileUrl:        z.string().url().max(512).optional().nullable(),
  notes:          z.string().max(2000).optional().nullable(),
});

export const updateVehicleDocumentSchema = createVehicleDocumentSchema.partial().omit({ vehicleId: true });

export type CreateVehicleDocumentDto = z.infer<typeof createVehicleDocumentSchema>;
export type UpdateVehicleDocumentDto = z.infer<typeof updateVehicleDocumentSchema>;

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface VehicleDocumentFilters {
  page?:         number;
  limit?:        number;
  vehicleId?:    string;
  documentType?: DocumentType;
  status?:       'active' | 'expiring' | 'expired';
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class VehicleDocumentService {
  // ── List ────────────────────────────────────────────────────────────────
  async findAll(companyId: string, filters: VehicleDocumentFilters = {}) {
    const { page = 1, limit = 10, vehicleId, documentType, status } = filters;
    const { skip, take } = getPagination(page, limit);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30 = new Date(today);
    in30.setDate(today.getDate() + 30);

    const where: Record<string, unknown> = { companyId };
    if (vehicleId)    where['vehicleId']    = vehicleId;
    if (documentType) where['documentType'] = documentType;
    if (status === 'expired') {
      where['expirationDate'] = { lt: today };
    } else if (status === 'expiring') {
      where['expirationDate'] = { gte: today, lte: in30 };
    } else if (status === 'active') {
      where['expirationDate'] = { gt: in30 };
    }

    const [data, total] = await Promise.all([
      prisma.vehicleDocument.findMany({
        where,
        orderBy: { expirationDate: 'asc' },
        skip,
        take,
        include: { vehicle: { select: { id: true, plate: true, brand: true, model: true } } },
      }),
      prisma.vehicleDocument.count({ where }),
    ]);

    return { data, meta: buildMeta(total, page, limit) };
  }

  // ── Find by ID ───────────────────────────────────────────────────────────
  async findById(id: string, companyId: string) {
    return prisma.vehicleDocument.findFirst({
      where: { id, companyId },
      include: { vehicle: { select: { id: true, plate: true, brand: true, model: true } } },
    });
  }

  // ── Create ──────────────────────────────────────────────────────────────
  async create(companyId: string, dto: CreateVehicleDocumentDto) {
    // Ensure vehicle belongs to tenant
    const vehicle = await prisma.vehicle.findFirst({ where: { id: dto.vehicleId, companyId } });
    if (!vehicle) throw new Error('VEHICLE_NOT_FOUND');

    return prisma.vehicleDocument.create({
      data: {
        id:             uuidv4(),
        companyId,
        vehicleId:      dto.vehicleId,
        documentType:   dto.documentType,
        documentNumber: dto.documentNumber ?? null,
        issueDate:      dto.issueDate      ? new Date(dto.issueDate)      : null,
        expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : null,
        fileUrl:        dto.fileUrl        ?? null,
        notes:          dto.notes          ?? null,
      },
      include: { vehicle: { select: { id: true, plate: true, brand: true, model: true } } },
    });
  }

  // ── Update ──────────────────────────────────────────────────────────────
  async update(id: string, companyId: string, dto: UpdateVehicleDocumentDto) {
    const existing = await prisma.vehicleDocument.findFirst({ where: { id, companyId } });
    if (!existing) return null;

    return prisma.vehicleDocument.update({
      where: { id },
      data: {
        ...(dto.documentType   !== undefined && { documentType:   dto.documentType }),
        ...(dto.documentNumber !== undefined && { documentNumber: dto.documentNumber }),
        ...(dto.issueDate      !== undefined && { issueDate:      dto.issueDate ? new Date(dto.issueDate) : null }),
        ...(dto.expirationDate !== undefined && { expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : null }),
        ...(dto.fileUrl        !== undefined && { fileUrl:        dto.fileUrl }),
        ...(dto.notes          !== undefined && { notes:          dto.notes }),
      },
      include: { vehicle: { select: { id: true, plate: true, brand: true, model: true } } },
    });
  }

  // ── Delete ──────────────────────────────────────────────────────────────
  async delete(id: string, companyId: string) {
    const existing = await prisma.vehicleDocument.findFirst({ where: { id, companyId } });
    if (!existing) return false;
    await prisma.vehicleDocument.delete({ where: { id } });
    return true;
  }

  // ── Documents by vehicle ─────────────────────────────────────────────────
  async findByVehicle(vehicleId: string, companyId: string) {
    const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, companyId } });
    if (!vehicle) return null;
    return prisma.vehicleDocument.findMany({
      where: { vehicleId, companyId },
      orderBy: { expirationDate: 'asc' },
    });
  }
}

export const vehicleDocumentService = new VehicleDocumentService();
