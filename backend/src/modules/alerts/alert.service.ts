import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { getPagination, buildMeta } from '../../utils/response';

export const createAlertSchema = z.object({
  name:          z.string().min(1).max(100),
  vehicleId:     z.string().uuid().optional(),
  driverId:      z.string().uuid().optional(),
  type:          z.enum([
    'fuel_excess', 'no_fuel_load', 'maintenance_due_date',
    'maintenance_due_km', 'license_expiry', 'vehicle_document_expiry', 'custom',
  ]),
  threshold:     z.number().optional(),
  thresholdUnit: z.string().max(30).optional(),
  message:       z.string().max(255).optional(),
});

export const updateAlertSchema = createAlertSchema.partial().extend({
  active: z.boolean().optional(),
});

export class AlertService {
  async findAll(
    companyId: string,
    query: { page?: number; limit?: number; active?: string },
  ) {
    const { take, skip } = getPagination(query.page, query.limit);
    const where = {
      companyId,
      ...(query.active !== undefined && { active: query.active === 'true' }),
    };

    const [data, total] = await Promise.all([
      prisma.alert.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: {
          vehicle: { select: { id: true, plate: true, name: true } },
          driver:  { select: { id: true, name: true, lastname: true } },
        },
      }),
      prisma.alert.count({ where }),
    ]);

    return { data, meta: buildMeta(total, query.page ?? 1, take) };
  }

  async create(companyId: string, data: z.infer<typeof createAlertSchema>) {
    return prisma.alert.create({
      data: {
        id:            uuidv4(),
        companyId,
        name:          data.name,
        vehicleId:     data.vehicleId,
        driverId:      data.driverId,
        type:          data.type,
        threshold:     data.threshold,
        thresholdUnit: data.thresholdUnit,
        message:       data.message,
      },
    });
  }

  async update(id: string, companyId: string, data: z.infer<typeof updateAlertSchema>) {
    const alert = await prisma.alert.findFirst({ where: { id, companyId } });
    if (!alert) throw new Error('Alerta no encontrada');

    return prisma.alert.update({
      where: { id },
      data: {
        type:          data.type,
        threshold:     data.threshold,
        thresholdUnit: data.thresholdUnit,
        message:       data.message,
        active:        data.active,
      },
    });
  }

  async delete(id: string, companyId: string) {
    const alert = await prisma.alert.findFirst({ where: { id, companyId } });
    if (!alert) throw new Error('Alerta no encontrada');
    await prisma.alert.delete({ where: { id } });
  }

  /** Notificaciones no leídas */
  async notifications(
    companyId: string,
    query: { page?: number; limit?: number; unreadOnly?: string },
  ) {
    const { take, skip } = getPagination(query.page, query.limit);
    const where = {
      companyId,
      ...(query.unreadOnly === 'true' && { readAt: null }),
    };

    const [data, total] = await Promise.all([
      prisma.alertNotification.findMany({
        where, skip, take, orderBy: { createdAt: 'desc' },
        include: {
          vehicle: { select: { id: true, plate: true } },
          driver:  { select: { id: true, name: true, lastname: true } },
        },
      }),
      prisma.alertNotification.count({ where }),
    ]);

    return { data, meta: buildMeta(total, query.page ?? 1, take) };
  }

  /** Marcar notificación como leída */
  async markRead(id: string, companyId: string) {
    const notif = await prisma.alertNotification.findFirst({ where: { id, companyId } });
    if (!notif) throw new Error('Notificación no encontrada');
    return prisma.alertNotification.update({
      where: { id },
      data:  { readAt: new Date() },
    });
  }

  /** Marcar todas como leídas */
  async markAllRead(companyId: string) {
    return prisma.alertNotification.updateMany({
      where: { companyId, readAt: null },
      data:  { readAt: new Date() },
    });
  }
}
