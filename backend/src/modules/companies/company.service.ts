import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { getPagination, buildMeta } from '../../utils/response';

export const createCompanySchema = z.object({
  name:      z.string().min(2).max(120),
  tradeName: z.string().max(120).optional(),
  rut:       z.string().max(20).optional(),
  address:   z.string().max(255).optional(),
  city:      z.string().max(80).optional(),
  phone:     z.string().max(30).optional(),
  email:     z.string().email().optional().or(z.literal('')),
});

export const updateCompanySchema = createCompanySchema.partial();

export class CompanyService {
  async findAll(query: { page?: number; limit?: number; search?: string }) {
    const { take, skip } = getPagination(query.page, query.limit);
    const where = {
      deletedAt: null,
      ...(query.search && {
        OR: [
          { name:  { contains: query.search } },
          { rut:   { contains: query.search } },
          { email: { contains: query.search } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.company.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, tradeName: true, rut: true,
          logo: true, city: true, phone: true, email: true,
          active: true, createdAt: true,
          _count: { select: { users: true, vehicles: true } },
        },
      }),
      prisma.company.count({ where }),
    ]);

    return { data, meta: buildMeta(total, query.page ?? 1, take) };
  }

  async findById(id: string) {
    return prisma.company.findFirst({
      where: { id, deletedAt: null },
      include: {
        settings: true,
        _count: { select: { users: true, vehicles: true, drivers: true } },
      },
    });
  }

  async create(data: z.infer<typeof createCompanySchema>) {
    return prisma.company.create({
      data: {
        id:        uuidv4(),
        name:      data.name,
        tradeName: data.tradeName,
        rut:       data.rut,
        address:   data.address,
        city:      data.city,
        phone:     data.phone,
        email:     data.email || null,
        // El trigger del schema.sql crea settings automáticamente.
        // Con Prisma, los creamos aquí manualmente:
        settings: {
          create: {
            id: uuidv4(),
          },
        },
      },
      include: { settings: true },
    });
  }

  async update(id: string, data: z.infer<typeof updateCompanySchema>) {
    await this.assertExists(id);
    return prisma.company.update({
      where: { id },
      data: {
        name:      data.name,
        tradeName: data.tradeName,
        rut:       data.rut,
        address:   data.address,
        city:      data.city,
        phone:     data.phone,
        email:     data.email || null,
      },
    });
  }

  async toggleActive(id: string, active: boolean) {
    await this.assertExists(id);
    return prisma.company.update({
      where: { id },
      data:  { active },
      select: { id: true, name: true, active: true },
    });
  }

  async updateLogo(id: string, logoPath: string) {
    await this.assertExists(id);
    return prisma.company.update({
      where: { id },
      data:  { logo: logoPath },
      select: { id: true, logo: true },
    });
  }

  async softDelete(id: string) {
    await this.assertExists(id);
    return prisma.company.update({
      where: { id },
      data:  { deletedAt: new Date(), active: false },
    });
  }

  private async assertExists(id: string) {
    const company = await prisma.company.findFirst({
      where: { id, deletedAt: null },
    });
    if (!company) throw new Error('Empresa no encontrada');
    return company;
  }
}
