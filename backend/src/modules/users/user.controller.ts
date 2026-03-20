import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  UserService,
  createAdminSchema,
  updateUserSchema,
  changePasswordSchema,
} from './user.service';
import { sendSuccess, sendCreated, sendError, sendNotFound, sendBadRequest } from '../../utils/response';

const svc = new UserService();

export class UserController {
  /** GET /api/users — lista usuarios de la empresa del token */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const result = await svc.findAll(req.tenantId, {
        page:  Number(req.query.page  ?? 1),
        limit: Number(req.query.limit ?? 20),
      });
      sendSuccess(res, result.data, 'Usuarios obtenidos', 200, result.meta);
    } catch (err) {
      sendError(res, err instanceof Error ? err.message : 'Error');
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const user = await svc.findById(req.params.id, req.tenantId);
      if (!user) { sendNotFound(res, 'Usuario'); return; }
      sendSuccess(res, user);
    } catch (err) {
      sendError(res, err instanceof Error ? err.message : 'Error');
    }
  }

  /** Solo superroot puede crear admins de empresa */
  async createAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = createAdminSchema.parse(req.body);
      const user = await svc.createAdmin(body);
      sendCreated(res, user, 'Administrador creado exitosamente');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = updateUserSchema.parse(req.body);
      const user = await svc.update(req.params.id, req.tenantId, body);
      sendSuccess(res, user, 'Usuario actualizado');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = changePasswordSchema.parse(req.body);
      await svc.changePassword(req.user.sub, req.tenantId ?? null, body);
      sendSuccess(res, null, 'Contraseña actualizada');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }

  /** PATCH /api/users/me — update own profile (name) */
  async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = updateUserSchema.parse(req.body);
      const updated = await svc.update(req.user.sub, req.tenantId ?? null, body);
      sendSuccess(res, updated, 'Perfil actualizado');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }

  async remove(req: Request, res: Response): Promise<void> {
    try {
      await svc.softDelete(req.params.id, req.tenantId);
      sendSuccess(res, null, 'Usuario eliminado');
    } catch (err) {
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }
}
