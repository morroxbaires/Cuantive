import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { getPagination, buildMeta } from '../../utils/response';

export const createAdminSchema = z.object({
  name:      z.string().min(2).max(100),
  email:     z.string().email(),
  password:  z.string().min(8, 'Mínimo 8 caracteres'),
  companyId: z.string().uuid(),
});

export const createUserSchema = z.object({
  name:     z.string().min(2).max(100),
  email:    z.string().email(),
  password: z.string().min(8),
});

export const updateUserSchema = z.object({
  name:   z.string().min(2).max(100).optional(),
  active: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(8),
});

export class UserService {
  async findAll(companyId: string, query: { page?: number; limit?: number }) {
    const { take, skip } = getPagination(query.page, query.limit);
    const where = { companyId, deletedAt: null };

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, role: true,
          active: true, lastLogin: true, createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { data, meta: buildMeta(total, query.page ?? 1, take) };
  }

  async findById(id: string, companyId?: string) {
    return prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(companyId && { companyId }),
      },
      select: {
        id: true, name: true, email: true, role: true,
        active: true, lastLogin: true, createdAt: true,
        company: { select: { id: true, name: true } },
      },
    });
  }

  /** Superroot crea admin para una empresa */
  async createAdmin(data: z.infer<typeof createAdminSchema>) {
    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) throw new Error('El email ya está en uso');

    const company = await prisma.company.findFirst({
      where: { id: data.companyId, deletedAt: null },
    });
    if (!company) throw new Error('Empresa no encontrada');

    const hash = await bcrypt.hash(data.password, 12);
    return prisma.user.create({
      data: {
        id:           uuidv4(),
        companyId:    data.companyId,
        name:         data.name,
        email:        data.email,
        passwordHash: hash,
        role:         'admin',
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
  }

  async update(id: string, companyId: string | null | undefined, data: z.infer<typeof updateUserSchema>) {
    await this.assertBelongsTo(id, companyId);
    return prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, active: true },
    });
  }

  async changePassword(
    id: string,
    companyId: string | null | undefined,
    data: z.infer<typeof changePasswordSchema>,
  ) {
    const user = await this.assertBelongsTo(id, companyId);
    const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!valid) throw new Error('Contraseña actual incorrecta');

    const hash = await bcrypt.hash(data.newPassword, 12);
    await prisma.user.update({ where: { id }, data: { passwordHash: hash } });
  }

  async softDelete(id: string, companyId: string) {
    await this.assertBelongsTo(id, companyId);
    return prisma.user.update({
      where: { id },
      data:  { deletedAt: new Date(), active: false },
    });
  }

  private async assertBelongsTo(id: string, companyId: string | null | undefined) {
    const where = companyId
      ? { id, companyId, deletedAt: null }
      : { id, deletedAt: null };
    const user = await prisma.user.findFirst({ where });
    if (!user) throw new Error('Usuario no encontrado');
    return user;
  }
}
