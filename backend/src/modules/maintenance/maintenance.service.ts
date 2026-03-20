import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { getPagination, buildMeta } from '../../utils/response';

export const createMaintenanceSchema = z.object({
  vehicleId:    z.string().uuid(),
  driverId:     z.string().optional(),          // accepted, not stored
  type:         z.string().min(1).max(100).default('preventivo'),
  status:       z.string().optional(),
  description:  z.string().min(1).max(255),
  date:         z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Fecha inválida' }),
  odometer:     z.coerce.number().int().min(0).optional(),
  cost:         z.coerce.number().min(0).optional(),
  nextOdometer: z.coerce.number().int().min(0).optional(),
  nextDate:     z.string().optional().refine(
    (v) => !v || !isNaN(Date.parse(v)), { message: 'Fecha inválida' },
  ),
  workshopName: z.string().max(120).optional(),
  notes:        z.string().optional(),
});

export const updateMaintenanceSchema = createMaintenanceSchema.partial();

export class MaintenanceService {
  async findAll(
    companyId: string,
    query: {
      page?: number;
      limit?: number;
      vehicleId?: string;
      type?: string;
      from?: string;
      to?: string;
    },
  ) {
    const { take, skip } = getPagination(query.page, query.limit);
    const where = {
      companyId,
      ...(query.vehicleId && { vehicleId: query.vehicleId }),
      ...(query.type      && { type: query.type as 'preventivo' | 'correctivo' }),
      ...((query.from || query.to) && {
        date: {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to   && { lte: new Date(query.to)   }),
        },
      }),
    };

    const [data, total] = await Promise.all([
      prisma.maintenance.findMany({
        where, skip, take,
        orderBy: { date: 'desc' },
        include: {
          vehicle: { select: { id: true, plate: true, name: true } },
          file:    { select: { id: true, originalName: true, storagePath: true } },
        },
      }),
      prisma.maintenance.count({ where }),
    ]);

    return { data, meta: buildMeta(total, query.page ?? 1, take) };
  }

  async findById(id: string, companyId: string) {
    return prisma.maintenance.findFirst({
      where: { id, companyId },
      include: { vehicle: true, file: true },
    });
  }

  async create(companyId: string, data: z.infer<typeof createMaintenanceSchema>) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: data.vehicleId, companyId, deletedAt: null },
    });
    if (!vehicle) throw new Error('Vehículo no encontrado');

    const record = await prisma.maintenance.create({
      data: {
        id:          uuidv4(),
        companyId,
        vehicleId:   data.vehicleId,
        type:        data.type,
        status:      data.status ?? 'completed',
        description: data.description,
        date:        new Date(data.date),
        odometer:    data.odometer,
        cost:        data.cost,
        nextOdometer: data.nextOdometer,
        nextDate:    data.nextDate ? new Date(data.nextDate) : null,
        workshopName: data.workshopName,
        notes:       data.notes,
      },
      include: { vehicle: true },
    });

    // Actualizar odómetro si aplica
    if (data.odometer && data.odometer > vehicle.currentOdometer) {
      await prisma.vehicle.update({
        where: { id: data.vehicleId },
        data:  { currentOdometer: data.odometer },
      });
    }

    return record;
  }

  async update(id: string, companyId: string, data: z.infer<typeof updateMaintenanceSchema>) {
    const record = await prisma.maintenance.findFirst({ where: { id, companyId } });
    if (!record) throw new Error('Mantenimiento no encontrado');

    return prisma.maintenance.update({
      where: { id },
      data: {
        type:         data.type,
        status:       data.status,
        description:  data.description,
        date:         data.date ? new Date(data.date) : undefined,
        odometer:     data.odometer,
        cost:         data.cost,
        nextOdometer: data.nextOdometer,
        nextDate:     data.nextDate ? new Date(data.nextDate) : undefined,
        workshopName: data.workshopName,
        notes:        data.notes,
      },
    });
  }

  async attachFile(id: string, companyId: string, fileId: string) {
    const record = await prisma.maintenance.findFirst({ where: { id, companyId } });
    if (!record) throw new Error('Registro no encontrado');
    return prisma.maintenance.update({ where: { id }, data: { receiptFile: fileId } });
  }

  async delete(id: string, companyId: string) {
    const record = await prisma.maintenance.findFirst({ where: { id, companyId } });
    if (!record) throw new Error('Registro no encontrado');
    await prisma.maintenance.delete({ where: { id } });
  }

  /** Próximos mantenimientos (por fecha o por km) */
  async upcoming(companyId: string) {
    const today = new Date();
    const in60days = new Date();
    in60days.setDate(in60days.getDate() + 60);

    return prisma.maintenance.findMany({
      where: {
        companyId,
        OR: [
          { nextDate:     { gte: today, lte: in60days } },
          { nextOdometer: { not: null } },
        ],
      },
      include: {
        vehicle: { select: { id: true, plate: true, name: true, currentOdometer: true } },
      },
      orderBy: { nextDate: 'asc' },
      take: 20,
    });
  }
}
