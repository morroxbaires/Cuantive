import { Router } from 'express';
import { SatisfaccionController } from './satisfaccion.controller';
import { authMiddleware }         from '../../middleware/auth.middleware';
import { onlyAdmin }              from '../../middleware/role.middleware';
import { tenantMiddleware }       from '../../middleware/tenant.middleware';
import { upload }                 from '../../config/upload';

const router = Router();
const ctrl   = new SatisfaccionController();

router.use(authMiddleware, onlyAdmin, tenantMiddleware);

/** GET  /api/satisfaccion/stats */
router.get('/stats', (req, res) => ctrl.stats(req, res));

/** GET  /api/satisfaccion */
router.get('/', (req, res) => ctrl.list(req, res));

/** GET  /api/satisfaccion/:id */
router.get('/:id', (req, res) => ctrl.getById(req, res));

/** POST /api/satisfaccion  (soporta imagen) */
router.post('/', upload.single('image'), (req, res, next) => ctrl.create(req, res, next));

/** PUT  /api/satisfaccion/:id  (soporta imagen) */
router.put('/:id', upload.single('image'), (req, res, next) => ctrl.update(req, res, next));

/** DELETE /api/satisfaccion/:id */
router.delete('/:id', (req, res) => ctrl.remove(req, res));

export default router;
