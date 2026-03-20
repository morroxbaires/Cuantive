import { Router }             from 'express';
import { ReportsController }   from './reports.controller';
import { authMiddleware }      from '../../middleware/auth.middleware';
import { onlyAdmin }           from '../../middleware/role.middleware';
import { tenantMiddleware }    from '../../middleware/tenant.middleware';

const router = Router();
const ctrl   = new ReportsController();

// Todas las rutas requieren autenticación + rol admin + contexto de empresa
router.use(authMiddleware, onlyAdmin, tenantMiddleware);

/**
 * GET /api/reports/monthly-expenses?year=2026&month=3
 * Reporte PDF de gastos mensuales (combustible + mantenimiento) de toda la empresa.
 */
router.get('/monthly-expenses', (req, res) => ctrl.monthlyExpenses(req, res));

/**
 * GET /api/reports/vehicle-expenses/:vehicleId?from=2026-01-01&to=2026-03-31
 * Reporte PDF de gastos de un vehículo específico en el rango indicado.
 */
router.get('/vehicle-expenses/:vehicleId', (req, res) => ctrl.vehicleExpenses(req, res));

/**
 * GET /api/reports/fuel-consumption?from=2026-01-01&to=2026-03-31
 * Reporte PDF de consumo de combustible por vehículo con análisis de eficiencia.
 */
router.get('/fuel-consumption', (req, res) => ctrl.fuelConsumption(req, res));

/**
 * GET /api/reports/maintenance?from=2026-01-01&to=2026-03-31
 * Reporte PDF de mantenimientos realizados con resumen y desglose por tipo.
 */
router.get('/maintenance', (req, res) => ctrl.maintenance(req, res));

export default router;
