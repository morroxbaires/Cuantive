import { Router } from 'express';
import { PublicController } from './public.controller';
import { upload }           from '../../config/upload';

const router = Router();
const ctrl   = new PublicController();

/**
 * Endpoints públicos (sin autenticación).
 * Usados por la página QR de encuesta de satisfacción.
 */

/** GET /api/public/survey/:vehicleId — info del vehículo para mostrar en el form */
router.get('/survey/:vehicleId', (req, res) => ctrl.getVehicle(req, res));

/** POST /api/public/survey — envío de encuesta desde QR */
router.post('/survey', upload.single('image'), (req, res) => ctrl.submitSurvey(req, res));

export default router;
