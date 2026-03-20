import { Request, Response, NextFunction } from 'express';
import { sendForbidden } from '../utils/response';

type Role = 'superroot' | 'admin';

/**
 * Middleware de control de roles.
 * Uso: router.get('/ruta', authMiddleware, requireRole('superroot'), controller)
 */
export const requireRole = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendForbidden(res, 'No autenticado');
      return;
    }
    if (!roles.includes(req.user.role as Role)) {
      sendForbidden(res, 'No tienes permisos para realizar esta acción');
      return;
    }
    next();
  };
};

/** Solo para rutas de superroot */
export const onlySuperroot = requireRole('superroot');

/** Solo para admins de empresa */
export const onlyAdmin = requireRole('admin');

/** Superroot o Admin */
export const anyAuthenticated = requireRole('superroot', 'admin');
