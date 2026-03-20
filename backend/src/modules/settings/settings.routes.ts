import { Router } from 'express';
import { SettingsController } from './settings.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { onlyAdmin } from '../../middleware/role.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';

const router = Router();
const ctrl   = new SettingsController();

router.use(authMiddleware, onlyAdmin, tenantMiddleware);

// GET  /api/settings
router.get('/',  (req, res)       => ctrl.get(req, res));

// PUT  /api/settings
router.put('/',  (req, res, next) => ctrl.update(req, res, next));

export default router;
