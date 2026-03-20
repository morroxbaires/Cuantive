import { Router } from 'express';
import { TurnoController } from './turno.controller';
import { authMiddleware }   from '../../middleware/auth.middleware';
import { onlyAdmin }        from '../../middleware/role.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';

const router = Router();
const ctrl   = new TurnoController();

router.use(authMiddleware, onlyAdmin, tenantMiddleware);

// GET  /api/turnos/stats   ← antes que /:id para evitar conflicto de ruta
router.get('/stats',  (req, res)       => ctrl.stats(req, res));

// GET  /api/turnos
router.get('/',       (req, res)       => ctrl.list(req, res));

// GET  /api/turnos/:id
router.get('/:id',    (req, res)       => ctrl.getById(req, res));

// POST /api/turnos
router.post('/',      (req, res, next) => ctrl.create(req, res, next));

// PUT  /api/turnos/:id
router.put('/:id',    (req, res, next) => ctrl.update(req, res, next));

// DELETE /api/turnos/:id
router.delete('/:id', (req, res)       => ctrl.remove(req, res));

export default router;
