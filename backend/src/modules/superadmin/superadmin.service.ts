import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/api-error';

// ─── Schemas ─────────────────────────────────────────────────────────────────
export const createAdminSchema = z.object({
  adminName:          z.string().min(2,  'Nombre requerido'),
  adminEmail:         z.string().email('Email inválido'),
  adminPassword:      z.string().min(8,  'Mínimo 8 caracteres'),
  companyName:        z.string().min(2,  'Nombre de empresa requerido'),
  companyRut:         z.string().optional(),
  companyCity:        z.string().optional(),
  companyPhone:       z.string().optional(),
  companyEmail:       z.string().email('Email de empresa inválido').optional().or(z.literal('')),
  companyAddress:     z.string().optional(),
  canDownloadMetrics: z.boolean().optional().default(false),
});

export const updateAdminSchema = z.object({
  adminName:          z.string().min(2).optional(),
  adminEmail:         z.string().email().optional(),
  adminPassword:      z.string().min(8).optional(),
  companyName:        z.string().min(2).optional(),
  companyRut:         z.string().optional(),
  companyCity:        z.string().optional(),
  companyPhone:       z.string().optional(),
  companyEmail:       z.string().email().optional().or(z.literal('')),
  companyAddress:     z.string().optional(),
  canDownloadMetrics: z.boolean().optional(),
});

export type CreateAdminDto = z.infer<typeof createAdminSchema>;
export type UpdateAdminDto = z.infer<typeof updateAdminSchema>;

// ─── Admin select fragment ────────────────────────────────────────────────────
const adminSelect = {
  id:                 true,
  name:               true,
  email:              true,
  active:             true,
  lastLogin:          true,
  createdAt:          true,
  canDownloadMetrics: true,
  company: {
    select: {
      id:       true,
      name:     true,
      tradeName: true,
      rut:      true,
      city:     true,
      phone:    true,
      email:    true,
      address:  true,
      active:   true,
      createdAt: true,
      _count: {
        select: {
          vehicles: true,
          drivers:  true,
        },
      },
    },
  },
} as const;

// ─── Service ──────────────────────────────────────────────────────────────────
export class SuperadminService {

  /** Estadísticas para el dashboard del superroot */
  async getDashboard() {
    const [totalCompanies, totalAdmins, activeAdmins, recentLogins] = await prisma.$transaction([
      prisma.company.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { role: 'admin', deletedAt: null } }),
      prisma.user.count({ where: { role: 'admin', deletedAt: null, active: true } }),
      prisma.user.findMany({
        where:   { role: 'admin', deletedAt: null },
        orderBy: { lastLogin: 'desc' },
        take:    8,
        select:  adminSelect,
      }),
    ]);

    return {
      totalCompanies,
      totalAdmins,
      activeAdmins,
      inactiveAdmins: totalAdmins - activeAdmins,
      recentLogins,
    };
  }

  /** Lista paginada de administradores */
  async listAdmins(params: { page?: number; limit?: number; search?: string }) {
    const page  = Math.max(1, params.page  ?? 1);
    const limit = Math.min(50, params.limit ?? 20);
    const skip  = (page - 1) * limit;

    const search = params.search?.trim();
    const where = {
      role:      'admin' as const,
      deletedAt: null as null,
      ...(search ? {
        OR: [
          { name:  { contains: search } },
          { email: { contains: search } },
          { company: { name: { contains: search } } },
        ],
      } : {}),
    };

    const [total, admins] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take:    limit,
        select:  adminSelect,
      }),
    ]);

    return {
      data:  admins,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  /** Crea empresa + configuración + usuario admin en una transacción */
  async createAdminWithCompany(dto: CreateAdminDto) {
    // Verificar email duplicado
    const exists = await prisma.user.findFirst({ where: { email: dto.adminEmail, deletedAt: null } });
    if (exists) throw new ApiError(409, 'Ya existe un usuario con ese email');

    // Verificar RUT duplicado
    const companyRut = dto.companyRut?.trim() || null;
    if (companyRut) {
      const rutExists = await prisma.company.findUnique({ where: { rut: companyRut } });
      if (rutExists) throw new ApiError(409, 'Ya existe una empresa con ese RUT');
    }

    const companyEmail = dto.companyEmail?.trim() || null;

    const hash = await bcrypt.hash(dto.adminPassword, 12);

    return prisma.$transaction(async (tx) => {
      const companyId = uuidv4();
      const settingsId = uuidv4();
      const userId = uuidv4();

      const company = await tx.company.create({
        data: {
          id:       companyId,
          name:     dto.companyName,
          tradeName: dto.companyName,
          rut:      companyRut,
          city:     dto.companyCity?.trim()    || null,
          phone:    dto.companyPhone?.trim()   || null,
          email:    companyEmail,
          address:  dto.companyAddress?.trim() || null,
          active:   true,
          settings: {
            create: {
              id: settingsId,
            },
          },
        },
      });

      const user = await tx.user.create({
        data: {
          id:                 userId,
          companyId:          company.id,
          name:               dto.adminName,
          email:              dto.adminEmail,
          passwordHash:       hash,
          role:               'admin',
          active:             true,
          canDownloadMetrics: dto.canDownloadMetrics ?? false,
        },
        select: adminSelect,
      });

      return user;
    });
  }

  /** Actualiza datos del admin y/o su empresa */
  async updateAdmin(id: string, dto: UpdateAdminDto) {
    const user = await prisma.user.findFirst({ where: { id, role: 'admin', deletedAt: null } });
    if (!user) throw new ApiError(404, 'Administrador no encontrado');

    if (dto.adminEmail && dto.adminEmail !== user.email) {
      const dup = await prisma.user.findFirst({ where: { email: dto.adminEmail, deletedAt: null } });
      if (dup) throw new ApiError(409, 'Ya existe un usuario con ese email');
    }

    return prisma.$transaction(async (tx) => {
      const userUpdate: Record<string, unknown> = {};
      if (dto.adminName)                       userUpdate.name               = dto.adminName;
      if (dto.adminEmail)                      userUpdate.email              = dto.adminEmail;
      if (dto.adminPassword)                   userUpdate.passwordHash       = await bcrypt.hash(dto.adminPassword, 12);
      if (dto.canDownloadMetrics !== undefined) userUpdate.canDownloadMetrics = dto.canDownloadMetrics;

      if (Object.keys(userUpdate).length > 0) {
        await tx.user.update({ where: { id }, data: userUpdate });
      }

      if (user.companyId) {
        const companyUpdate: Record<string, unknown> = {};
        if (dto.companyName)    companyUpdate.name     = dto.companyName;
        if (dto.companyName)    companyUpdate.tradeName = dto.companyName;
        if (dto.companyRut)     companyUpdate.rut      = dto.companyRut;
        if (dto.companyCity)    companyUpdate.city     = dto.companyCity;
        if (dto.companyPhone)   companyUpdate.phone    = dto.companyPhone;
        if (dto.companyEmail !== undefined) companyUpdate.email = dto.companyEmail;
        if (dto.companyAddress) companyUpdate.address  = dto.companyAddress;

        if (Object.keys(companyUpdate).length > 0) {
          await tx.company.update({ where: { id: user.companyId }, data: companyUpdate });
        }
      }

      return tx.user.findFirst({ where: { id }, select: adminSelect });
    });
  }

  /** Activa / desactiva un admin */
  async toggleAdmin(id: string) {
    const user = await prisma.user.findFirst({ where: { id, role: 'admin', deletedAt: null } });
    if (!user) throw new ApiError(404, 'Administrador no encontrado');

    return prisma.user.update({
      where:  { id },
      data:   { active: !user.active },
      select: adminSelect,
    });
  }

  /** Soft delete del admin */
  async deleteAdmin(id: string) {
    const user = await prisma.user.findFirst({ where: { id, role: 'admin', deletedAt: null } });
    if (!user) throw new ApiError(404, 'Administrador no encontrado');

    await prisma.user.update({
      where: { id },
      data:  { deletedAt: new Date(), active: false },
    });
  }
}

export const superadminService = new SuperadminService();
