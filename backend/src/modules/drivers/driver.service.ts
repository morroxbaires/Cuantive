import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { getPagination, buildMeta } from '../../utils/response';

export const createDriverSchema = z.object({
  name:            z.string().min(2).max(80),
  lastname:        z.string().min(2).max(80),
  document:        z.string().max(20).optional(),
  licenseCategory: z.string().max(10).optional(),
  licenseExpiry:   z.string().optional().refine(
    (v) => !v || !isNaN(Date.parse(v)),
    { message: 'Fecha de vencimiento inválida' },
  ),
  phone:           z.string().max(30).optional(),
  email:           z.string().email().optional().or(z.literal('')),
  notes:           z.string().optional(),
});

export const updateDriverSchema = createDriverSchema.partial().extend({
  active: z.boolean().optional(),
});

export class DriverService {
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
          { name:     { contains: query.search } },
          { lastname: { contains: query.search } },
          { document: { contains: query.search } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.driver.findMany({
        where, skip, take,
        orderBy: { lastname: 'asc' },
        select: {
          id: true, name: true, lastname: true, document: true,
          licenseCategory: true, licenseExpiry: true,
          phone: true, email: true, active: true, createdAt: true,
        },
      }),
      prisma.driver.count({ where }),
    ]);

    return { data, meta: buildMeta(total, query.page ?? 1, take) };
  }

  async findById(id: string, companyId: string) {
    return prisma.driver.findFirst({
      where: { id, companyId, deletedAt: null },
    });
  }

  async create(companyId: string, data: z.infer<typeof createDriverSchema>) {
    if (data.document) {
      const exists = await prisma.driver.findFirst({
        where: { companyId, document: data.document, deletedAt: null },
      });
      if (exists) throw new Error('Ya existe un conductor con ese documento');
    }

    return prisma.driver.create({
      data: {
        id:              uuidv4(),
        companyId,
        name:            data.name,
        lastname:        data.lastname,
        document:        data.document,
        licenseCategory: data.licenseCategory,
        licenseExpiry:   data.licenseExpiry ? new Date(data.licenseExpiry) : null,
        phone:           data.phone,
        email:           data.email || null,
        notes:           data.notes,
      },
    });
  }

  async update(id: string, companyId: string, data: z.infer<typeof updateDriverSchema>) {
    await this.assertBelongsTo(id, companyId);
    return prisma.driver.update({
      where: { id },
      data: {
        name:            data.name,
        lastname:        data.lastname,
        document:        data.document,
        licenseCategory: data.licenseCategory,
        licenseExpiry:   data.licenseExpiry ? new Date(data.licenseExpiry) : undefined,
        phone:           data.phone,
        email:           data.email || null,
        notes:           data.notes,
        active:          data.active,
      },
    });
  }

  async softDelete(id: string, companyId: string) {
    await this.assertBelongsTo(id, companyId);
    return prisma.driver.update({
      where: { id },
      data:  { deletedAt: new Date(), active: false },
    });
  }

  /** Conductores con licencia próxima a vencer (próximos N días) */
  async expiringLicenses(companyId: string, days = 30) {
    const future = new Date();
    future.setDate(future.getDate() + days);

    return prisma.driver.findMany({
      where: {
        companyId,
        active:        true,
        deletedAt:     null,
        licenseExpiry: { lte: future, gte: new Date() },
      },
      orderBy: { licenseExpiry: 'asc' },
      select: {
        id: true, name: true, lastname: true,
        document: true, licenseExpiry: true, licenseCategory: true,
      },
    });
  }

  private async assertBelongsTo(id: string, companyId: string) {
    const d = await prisma.driver.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!d) throw new Error('Conductor no encontrado');
    return d;
  }
}
