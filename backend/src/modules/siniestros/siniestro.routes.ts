import { Router } from 'express';
import multer from 'multer';
import { SiniestroController } from './siniestro.controller';
import { authMiddleware }       from '../../middleware/auth.middleware';
import { onlyAdmin }            from '../../middleware/role.middleware';
import { tenantMiddleware }     from '../../middleware/tenant.middleware';
import { upload }               from '../../config/upload';

const router = Router();
const ctrl   = new SiniestroController();

router.use(authMiddleware, onlyAdmin, tenantMiddleware);

// GET  /api/siniestros/stats
router.get('/stats', (req, res) => ctrl.stats(req, res));

// GET  /api/siniestros
router.get('/', (req, res) => ctrl.list(req, res));

// GET  /api/siniestros/:id
router.get('/:id', (req, res) => ctrl.getById(req, res));

// POST /api/siniestros  (soporta imagen)
router.post('/', upload.single('image'), (req, res, next) => ctrl.create(req, res, next));

// PUT  /api/siniestros/:id  (soporta imagen)
router.put('/:id', upload.single('image'), (req, res, next) => ctrl.update(req, res, next));

// DELETE /api/siniestros/:id
router.delete('/:id', (req, res) => ctrl.remove(req, res));

export default router;
