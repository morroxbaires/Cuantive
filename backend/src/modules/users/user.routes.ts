import { Router } from 'express';
import { UserController } from './user.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { onlySuperroot, onlyAdmin, anyAuthenticated } from '../../middleware/role.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';

const router = Router();
const ctrl   = new UserController();

router.use(authMiddleware);

// GET    /api/users         — Admin lista sus usuarios
router.get('/',
  onlyAdmin, tenantMiddleware,
  (req, res) => ctrl.list(req, res),
);

// GET    /api/users/:id
router.get('/:id',
  onlyAdmin, tenantMiddleware,
  (req, res) => ctrl.getById(req, res),
);

// POST   /api/users/admin   — Superroot crea admin de empresa
router.post('/admin',
  onlySuperroot,
  (req, res, next) => ctrl.createAdmin(req, res, next),
);

// PUT    /api/users/:id
router.put('/:id',
  onlyAdmin, tenantMiddleware,
  (req, res, next) => ctrl.update(req, res, next),
);

// PATCH  /api/users/me — Actualizar propio perfil (nombre)
router.patch('/me',
  anyAuthenticated, tenantMiddleware,
  (req, res, next) => ctrl.updateMe(req, res, next),
);

// PATCH  /api/users/password — Cambiar propia contraseña
router.patch('/password',
  anyAuthenticated, tenantMiddleware,
  (req, res, next) => ctrl.changePassword(req, res, next),
);

// DELETE /api/users/:id
router.delete('/:id',
  onlyAdmin, tenantMiddleware,
  (req, res) => ctrl.remove(req, res),
);

export default router;
