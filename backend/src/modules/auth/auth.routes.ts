/**
 * Auth Routes — /api/auth
 *
 *   POST /api/auth/login         Iniciar sesión
 *   POST /api/auth/refresh       Renovar access token (cookie cuantive_refresh)
 *   POST /api/auth/logout        Cerrar sesión actual
 *   POST /api/auth/logout-all    Cerrar todas las sesiones  [auth requerida]
 *   GET  /api/auth/me            Perfil del usuario activo  [auth requerida]
 */

import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();
const ctrl   = new AuthController();

router.post('/login',       (req, res, next) => ctrl.login(req, res, next));
router.post('/refresh',     (req, res)        => ctrl.refresh(req, res));
router.post('/logout',      (req, res)        => ctrl.logout(req, res));
router.post('/logout-all',  authMiddleware,   (req, res) => ctrl.logoutAll(req, res));
router.get ('/me',          authMiddleware,   (req, res) => ctrl.me(req, res));

export default router;
