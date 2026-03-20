import { Router } from 'express';
import { DriverController } from './driver.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { onlyAdmin } from '../../middleware/role.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';

const router = Router();
const ctrl   = new DriverController();

router.use(authMiddleware, onlyAdmin, tenantMiddleware);

// GET    /api/drivers/expiring-licenses
router.get('/expiring-licenses', (req, res) => ctrl.expiringLicenses(req, res));

// GET    /api/drivers
router.get('/',          (req, res)       => ctrl.list(req, res));

// GET    /api/drivers/:id
router.get('/:id',       (req, res)       => ctrl.getById(req, res));

// POST   /api/drivers
router.post('/',         (req, res, next) => ctrl.create(req, res, next));

// PUT    /api/drivers/:id
router.put('/:id',       (req, res, next) => ctrl.update(req, res, next));

// DELETE /api/drivers/:id
router.delete('/:id',    (req, res)       => ctrl.remove(req, res));

export default router;
