import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { onlySuperroot }  from '../../middleware/role.middleware';
import { superadminController } from './superadmin.controller';

const router = Router();

// Todas las rutas requieren token válido + rol superroot
router.use(authMiddleware, onlySuperroot);

// Dashboard stats
router.get('/', (req, res, next) => superadminController.getDashboard(req, res, next));

// CRUD de administradores
router.get('/admins',               (req, res, next) => superadminController.listAdmins(req, res, next));
router.post('/admins',              (req, res, next) => superadminController.createAdmin(req, res, next));
router.put('/admins/:id',           (req, res, next) => superadminController.updateAdmin(req, res, next));
router.patch('/admins/:id/toggle',  (req, res, next) => superadminController.toggleAdmin(req, res, next));
router.delete('/admins/:id',        (req, res, next) => superadminController.deleteAdmin(req, res, next));

export default router;
