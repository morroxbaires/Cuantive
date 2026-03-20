import { Router } from 'express';
import { VehicleController } from './vehicle.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { onlyAdmin } from '../../middleware/role.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';

const router = Router();
const ctrl   = new VehicleController();

router.use(authMiddleware, onlyAdmin, tenantMiddleware);

// GET    /api/vehicles/catalogs  — tipos de vehículo y combustible
router.get('/catalogs',  (req, res)       => ctrl.catalogs(req, res));

// GET    /api/vehicles
router.get('/',          (req, res)       => ctrl.list(req, res));

// GET    /api/vehicles/:id
router.get('/:id',       (req, res)       => ctrl.getById(req, res));

// POST   /api/vehicles
router.post('/',         (req, res, next) => ctrl.create(req, res, next));

// PUT    /api/vehicles/:id
router.put('/:id',       (req, res, next) => ctrl.update(req, res, next));

// DELETE /api/vehicles/:id
router.delete('/:id',    (req, res)       => ctrl.remove(req, res));

export default router;
