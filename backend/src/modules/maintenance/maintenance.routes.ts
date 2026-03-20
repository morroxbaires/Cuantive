import { Router } from 'express';
import { MaintenanceController } from './maintenance.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { onlyAdmin } from '../../middleware/role.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';

const router = Router();
const ctrl   = new MaintenanceController();

router.use(authMiddleware, onlyAdmin, tenantMiddleware);

// GET  /api/maintenance/upcoming
router.get('/upcoming', (req, res)       => ctrl.upcoming(req, res));

// GET  /api/maintenance
router.get('/',         (req, res)       => ctrl.list(req, res));

// GET  /api/maintenance/:id
router.get('/:id',      (req, res)       => ctrl.getById(req, res));

// POST /api/maintenance
router.post('/',        (req, res, next) => ctrl.create(req, res, next));

// PUT  /api/maintenance/:id
router.put('/:id',      (req, res, next) => ctrl.update(req, res, next));

// DELETE /api/maintenance/:id
router.delete('/:id',   (req, res)       => ctrl.remove(req, res));

export default router;
