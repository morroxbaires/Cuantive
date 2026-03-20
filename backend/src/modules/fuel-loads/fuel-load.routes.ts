import { Router } from 'express';
import { FuelLoadController } from './fuel-load.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { onlyAdmin } from '../../middleware/role.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';

const router = Router();
const ctrl   = new FuelLoadController();

router.use(authMiddleware, onlyAdmin, tenantMiddleware);

// GET  /api/fuel-loads/stats
router.get('/stats',    (req, res)       => ctrl.stats(req, res));

// GET  /api/fuel-loads/catalogs
router.get('/catalogs', (req, res)       => ctrl.catalogs(req, res));

// POST /api/fuel-loads/recalculate — recalcula kmPerUnit de todas las cargas
router.post('/recalculate', (req, res)   => ctrl.recalculate(req, res));

// GET  /api/fuel-loads
router.get('/',         (req, res)       => ctrl.list(req, res));

// GET  /api/fuel-loads/:id
router.get('/:id',      (req, res)       => ctrl.getById(req, res));

// POST /api/fuel-loads
router.post('/',        (req, res, next) => ctrl.create(req, res, next));

// PUT  /api/fuel-loads/:id
router.put('/:id',      (req, res, next) => ctrl.update(req, res, next));

// DELETE /api/fuel-loads/:id
router.delete('/:id',   (req, res)       => ctrl.remove(req, res));

export default router;
