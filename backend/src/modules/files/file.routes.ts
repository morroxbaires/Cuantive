import { Router } from 'express';
import { FileController } from './file.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { onlyAdmin } from '../../middleware/role.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { upload } from '../../config/upload';

const router = Router();
const ctrl   = new FileController();

router.use(authMiddleware, onlyAdmin, tenantMiddleware);

// POST /api/files/upload                       — Sube un archivo genérico
router.post('/upload',
  upload.single('file'),
  (req, res) => ctrl.upload(req, res),
);

// POST /api/files/upload/fuel-load/:id         — Recibo para carga de combustible
router.post('/upload/fuel-load/:id',
  upload.single('file'),
  (req, res) => ctrl.uploadFuelReceipt(req, res),
);

// POST /api/files/upload/maintenance/:id       — Recibo para mantenimiento
router.post('/upload/maintenance/:id',
  upload.single('file'),
  (req, res) => ctrl.uploadMaintenanceReceipt(req, res),
);

// GET    /api/files/:id                        — Descarga/visualiza el archivo
router.get('/:id',    (req, res) => ctrl.download(req, res));

// DELETE /api/files/:id
router.delete('/:id', (req, res) => ctrl.remove(req, res));

export default router;
