import { Router } from 'express';
import { CompanyController } from './company.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { onlySuperroot } from '../../middleware/role.middleware';
import { upload } from '../../config/upload';

const router = Router();
const ctrl   = new CompanyController();

// Todas las rutas requieren estar autenticado como superroot
router.use(authMiddleware, onlySuperroot);

// GET    /api/companies
router.get('/',            (req, res)       => ctrl.list(req, res));

// GET    /api/companies/:id
router.get('/:id',         (req, res)       => ctrl.getById(req, res));

// POST   /api/companies
router.post('/',           (req, res, next) => ctrl.create(req, res, next));

// PUT    /api/companies/:id
router.put('/:id',         (req, res, next) => ctrl.update(req, res, next));

// PATCH  /api/companies/:id/status
router.patch('/:id/status', (req, res)      => ctrl.toggleActive(req, res));

// POST   /api/companies/:id/logo
router.post('/:id/logo',   upload.single('logo'), (req, res) => ctrl.uploadLogo(req, res));

// DELETE /api/companies/:id
router.delete('/:id',      (req, res)       => ctrl.remove(req, res));

export default router;
