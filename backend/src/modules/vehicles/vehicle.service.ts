import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { getPagination, buildMeta } from '../../utils/response';

export const createVehicleSchema = z.object({
  plate:               z.string().min(1).max(20),
  name:                z.string().max(100).optional(),
  brand:               z.string().max(60).optional(),
  model:               z.string().max(60).optional(),
  year:                z.number().int().min(1900).max(2100).optional(),
  color:               z.string().max(40).optional(),
  coachNumber:         z.string().max(20).optional().transform(v => v === '' ? undefined : v),
  vin:                 z.string().max(30).optional(),
  vehicleTypeId:       z.number().int().positive().optional(),
  fuelTypeId:          z.number().int().positive().optional(),
  currentOdometer:     z.number().int().min(0).optional(),
  efficiencyReference: z.number().positive().optional(),
  driverIds:           z.array(z.string().uuid()).optional(),
});

export const updateVehicleSchema = createVehicleSchema.partial().extend({
  active: z.boolean().optional(),
});

export class VehicleService {
  async findAll(
    companyId: string,
    query: { page?: number; limit?: number; search?: string; active?: string },
  ) {
    const { take, skip } = getPagination(query.page, query.limit);
    const where = {
      companyId,
      deletedAt: null,
      ...(query.active !== undefined && { active: query.active === 'true' }),
      ...(query.search && {
        OR: [
          { plate: { contains: query.search } },
          { name:  { contains: query.search } },
          { brand: { contains: query.search } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.vehicle.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: {
          vehicleType: { select: { id: true, name: true } },
          fuelType:    { select: { id: true, name: true, unit: true } },
          drivers: {
            select: {
              driver: { select: { id: true, name: true, lastname: true, document: true, active: true } },
            },
          },
        },
      }),
      prisma.vehicle.count({ where }),
    ]);

    // flatten drivers array for easier consumption
    const mapped = data.map((v) => ({
      ...v,
      drivers: v.drivers.map((d) => d.driver),
    }));

    return { data: mapped, meta: buildMeta(total, query.page ?? 1, take) };
  }

  async findById(id: string, companyId: string) {
    const v = await prisma.vehicle.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        vehicleType: true,
        fuelType:    true,
        drivers: {
          select: {
            driver: { select: { id: true, name: true, lastname: true, document: true, active: true } },
          },
        },
        _count: { select: { fuelLoads: true, maintenances: true } },
      },
    });
    if (!v) return null;
    return { ...v, drivers: v.drivers.map((d) => d.driver) };
  }

  async create(companyId: string, data: z.infer<typeof createVehicleSchema>) {
    const exists = await prisma.vehicle.findFirst({
      where: { companyId, plate: data.plate, deletedAt: null },
    });
    if (exists) throw new Error('La matrícula ya está registrada en esta empresa');

    const vehicle = await prisma.vehicle.create({
      data: {
        id:                  uuidv4(),
        companyId,
        plate:               data.plate.toUpperCase(),
        name:                data.name,
        brand:               data.brand,
        model:               data.model,
        year:                data.year,
        color:               data.color,
        coachNumber:         data.coachNumber,
        vin:                 data.vin,
        vehicleTypeId:       data.vehicleTypeId,
        fuelTypeId:          data.fuelTypeId,
        currentOdometer:     data.currentOdometer ?? 0,
        efficiencyReference: data.efficiencyReference,
        ...(data.driverIds?.length && {
          drivers: {
            create: data.driverIds.map((driverId) => ({ driverId })),
          },
        }),
      },
      include: {
        vehicleType: true,
        fuelType: true,
        drivers: { select: { driver: { select: { id: true, name: true, lastname: true, document: true, active: true } } } },
      },
    });
    return { ...vehicle, drivers: vehicle.drivers.map((d) => d.driver) };
  }

  async update(id: string, companyId: string, data: z.infer<typeof updateVehicleSchema>) {
    await this.assertBelongsTo(id, companyId);
    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        plate:               data.plate?.toUpperCase(),
        name:                data.name,
        brand:               data.brand,
        model:               data.model,
        year:                data.year,
        color:               data.color,
        coachNumber:         data.coachNumber,
        vin:                 data.vin,
        vehicleTypeId:       data.vehicleTypeId,
        fuelTypeId:          data.fuelTypeId,
        currentOdometer:     data.currentOdometer,
        efficiencyReference: data.efficiencyReference,
        active:              data.active,
        ...(data.driverIds !== undefined && {
          drivers: {
            deleteMany: {},
            create: (data.driverIds ?? []).map((driverId) => ({ driverId })),
          },
        }),
      },
      include: {
        vehicleType: true,
        fuelType: true,
        drivers: { select: { driver: { select: { id: true, name: true, lastname: true, document: true, active: true } } } },
      },
    });
    return { ...vehicle, drivers: vehicle.drivers.map((d) => d.driver) };
  }

  async softDelete(id: string, companyId: string) {
    await this.assertBelongsTo(id, companyId);
    return prisma.vehicle.update({
      where: { id },
      data:  { deletedAt: new Date(), active: false },
    });
  }

  /** Catálogos globales disponibles para el frontend */
  async getCatalogs() {
    const [vehicleTypes, fuelTypes] = await Promise.all([
      prisma.vehicleType.findMany({ where: { active: true } }),
      prisma.fuelType.findMany({ where: { active: true } }),
    ]);
    return { vehicleTypes, fuelTypes };
  }

  private async assertBelongsTo(id: string, companyId: string) {
    const v = await prisma.vehicle.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!v) throw new Error('Vehículo no encontrado');
    return v;
  }
}
