/**
 * authMiddleware — Verifica el JWT de acceso en el header Authorization.
 * Inyecta req.user (JwtAccessPayload) y req.tenantId en cada request autenticado.
 *
 * Validaciones:
 *  1. Header Authorization: Bearer <token>
 *  2. Firma y expiración del JWT
 *  3. Usuario activo en BD
 *  4. Empresa activa en BD (solo si rol = admin)
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env }            from '../config/env';
import { prisma }         from '../config/database';
import { sendUnauthorized } from '../utils/response';
import { JwtAccessPayload } from '../modules/auth/auth.types';

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // 1. Extraer Bearer token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      sendUnauthorized(res, 'Token de acceso no proporcionado');
      return;
    }

    const token = authHeader.split(' ')[1];

    // 2. Verificar firma y expiración
    let payload: JwtAccessPayload;
    try {
      payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtAccessPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        sendUnauthorized(res, 'Token expirado. Renueva tu sesión.');
      } else {
        sendUnauthorized(res, 'Token inválido.');
      }
      return;
    }

    // 3. Verificar usuario activo en BD
    const user = await prisma.user.findFirst({
      where:  { id: payload.sub, active: true, deletedAt: null },
      select: { id: true, companyId: true, role: true },
    });

    if (!user) {
      sendUnauthorized(res, 'Usuario no encontrado o inactivo.');
      return;
    }

    // 4. Si tiene empresa (rol admin), verificar que esté activa
    if (user.companyId) {
      const company = await prisma.company.findFirst({
        where:  { id: user.companyId, active: true, deletedAt: null },
        select: { id: true },
      });
      if (!company) {
        sendUnauthorized(res, 'Empresa inactiva o suspendida.');
        return;
      }
      req.tenantId = user.companyId;
    }

    // 5. Inyectar payload en req.user
    req.user = payload;
    next();
  } catch (err) {
    sendUnauthorized(res, 'Error de autenticación.');
  }
};
