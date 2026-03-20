import { Request, Response, NextFunction } from 'express';
import { superadminService, createAdminSchema, updateAdminSchema } from './superadmin.service';
import { ApiError } from '../../utils/api-error';

export class SuperadminController {

  /** GET /api/superadmin — Dashboard stats */
  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superadminService.getDashboard();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/superadmin/admins — Lista paginada */
  async listAdmins(req: Request, res: Response, next: NextFunction) {
    try {
      const page   = parseInt(req.query['page']   as string) || 1;
      const limit  = parseInt(req.query['limit']  as string) || 20;
      const search = req.query['search'] as string | undefined;

      const result = await superadminService.listAdmins({ page, limit, search });
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/superadmin/admins — Crear admin + empresa */
  async createAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createAdminSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiError(400, parsed.error.errors[0]?.message ?? 'Datos inválidos');
      }
      const admin = await superadminService.createAdminWithCompany(parsed.data);
      res.status(201).json({ success: true, data: admin });
    } catch (err) {
      next(err);
    }
  }

  /** PUT /api/superadmin/admins/:id — Actualizar admin + empresa */
  async updateAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const parsed = updateAdminSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiError(400, parsed.error.errors[0]?.message ?? 'Datos inválidos');
      }
      const admin = await superadminService.updateAdmin(id, parsed.data);
      res.json({ success: true, data: admin });
    } catch (err) {
      next(err);
    }
  }

  /** PATCH /api/superadmin/admins/:id/toggle — Activar/desactivar */
  async toggleAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const admin = await superadminService.toggleAdmin(id);
      res.json({ success: true, data: admin });
    } catch (err) {
      next(err);
    }
  }

  /** DELETE /api/superadmin/admins/:id — Eliminar (soft) */
  async deleteAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await superadminService.deleteAdmin(id);
      res.json({ success: true, message: 'Administrador eliminado' });
    } catch (err) {
      next(err);
    }
  }
}

export const superadminController = new SuperadminController();
