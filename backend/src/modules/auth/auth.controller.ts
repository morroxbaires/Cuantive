/**
 * AuthController — Controlador de autenticación para Cuantive
 *
 * Endpoints:
 *   POST /api/auth/login        → login con email + password
 *   POST /api/auth/refresh      → renovar access token (cookie cuantive_refresh)
 *   POST /api/auth/logout       → cerrar sesión actual
 *   POST /api/auth/logout-all   → cerrar todas las sesiones del usuario
 *   GET  /api/auth/me           → perfil del usuario autenticado
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService }      from './auth.service';
import { TOKEN_CONFIG }     from './auth.types';
import {
  sendSuccess, sendError, sendUnauthorized, sendBadRequest,
} from '../../utils/response';

const authService = new AuthService();

// ─── Schemas de validación ────────────────────────────────────────────────────

const loginSchema = z.object({
  email:    z.string().email('Email inválido').toLowerCase().trim(),
  password: z.string().min(1, 'Contraseña requerida'),
});

// ─── Cookie helpers ───────────────────────────────────────────────────────────

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(TOKEN_CONFIG.REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   TOKEN_CONFIG.REFRESH_EXPIRES_SECONDS * 1000,
    path:     '/api/auth',
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(TOKEN_CONFIG.REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path:     '/api/auth',
  });
}

// ─── Controlador ─────────────────────────────────────────────────────────────

export class AuthController {

  /** POST /api/auth/login */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body   = loginSchema.parse(req.body);
      const result = await authService.login({
        email:     body.email,
        password:  body.password,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      setRefreshCookie(res, result.refreshToken);

      sendSuccess(res, {
        accessToken: result.accessToken,
        user:        result.user,
      }, 'Sesión iniciada correctamente');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      sendBadRequest(res, err instanceof Error ? err.message : 'Error al iniciar sesión');
    }
  }

  /** POST /api/auth/refresh */
  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const incomingRefresh = req.cookies?.[TOKEN_CONFIG.REFRESH_COOKIE_NAME];
      if (!incomingRefresh) {
        sendUnauthorized(res, 'Sesión no encontrada. Inicia sesión nuevamente.');
        return;
      }

      const result = await authService.refresh(incomingRefresh);

      // Rotar la cookie con el nuevo refresh token
      setRefreshCookie(res, result.refreshToken);

      sendSuccess(res, { accessToken: result.accessToken }, 'Token renovado');
    } catch (err) {
      clearRefreshCookie(res);
      sendUnauthorized(res, err instanceof Error ? err.message : 'Sesión inválida');
    }
  }

  /** POST /api/auth/logout */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const token = req.cookies?.[TOKEN_CONFIG.REFRESH_COOKIE_NAME];
      if (token) await authService.logout(token);
    } finally {
      clearRefreshCookie(res);
      sendSuccess(res, null, 'Sesión cerrada correctamente');
    }
  }

  /** POST /api/auth/logout-all  (requiere estar autenticado) */
  async logoutAll(req: Request, res: Response): Promise<void> {
    try {
      const { revokedCount } = await authService.logoutAll(req.user.sub);
      clearRefreshCookie(res);
      sendSuccess(res, { revokedCount }, `${revokedCount} sesión(es) cerrada(s)`);
    } catch (err) {
      sendError(res, err instanceof Error ? err.message : 'Error al cerrar sesiones');
    }
  }

  /** GET /api/auth/me */
  async me(req: Request, res: Response): Promise<void> {
    try {
      const user = await authService.me(req.user.sub);
      if (!user) { sendError(res, 'Usuario no encontrado', 404); return; }
      sendSuccess(res, user);
    } catch (err) {
      sendError(res, err instanceof Error ? err.message : 'Error');
    }
  }
}
