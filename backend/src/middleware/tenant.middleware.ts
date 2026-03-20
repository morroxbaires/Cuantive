import { Request, Response, NextFunction } from 'express';
import { sendForbidden } from '../utils/response';

/**
 * Garantiza que req.tenantId esté presente.
 * Protege rutas que requieren contexto de empresa.
 * Debe usarse después de authMiddleware.
 */
export const tenantMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (req.user?.role === 'superroot') {
    next();
    return;
  }

  if (!req.tenantId) {
    sendForbidden(res, 'Contexto de empresa no disponible');
    return;
  }

  next();
};

/**
 * Extrae el tenantId para endpoints de empresa.
 * Para admin: usa su propio tenantId.
 * Para superroot: puede usar el parámetro :companyId de la ruta.
 */
export const resolveTenant = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (req.user?.role === 'superroot' && req.params.companyId) {
    req.tenantId = req.params.companyId;
  }
  next();
};
