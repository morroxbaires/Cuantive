import { Router } from 'express';
import { vehicleDocumentController } from './vehicle-documents.controller';
import { authMiddleware }   from '../../middleware/auth.middleware';
import { onlyAdmin }        from '../../middleware/role.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';

const router = Router();

router.use(authMiddleware, onlyAdmin, tenantMiddleware);

// GET  /api/vehicle-documents
router.get('/',    (req, res)       => vehicleDocumentController.list(req, res));

// GET /api/vehicle-documents/vehicle/:vehicleId  — must be BEFORE /:id
router.get('/vehicle/:vehicleId', (req, res) => vehicleDocumentController.listByVehicle(req, res));

// GET  /api/vehicle-documents/:id
router.get('/:id', (req, res)       => vehicleDocumentController.getById(req, res));

// POST /api/vehicle-documents
router.post('/',   (req, res, next) => vehicleDocumentController.create(req, res, next));

// PUT  /api/vehicle-documents/:id
router.put('/:id', (req, res, next) => vehicleDocumentController.update(req, res, next));

// DELETE /api/vehicle-documents/:id
router.delete('/:id', (req, res)   => vehicleDocumentController.remove(req, res));

export default router;
