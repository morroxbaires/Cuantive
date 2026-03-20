import { Router } from 'express';
import { AlertController } from './alert.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { onlyAdmin } from '../../middleware/role.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';

const router = Router();
const ctrl   = new AlertController();

router.use(authMiddleware, onlyAdmin, tenantMiddleware);

// ── Notifications ─────────────────────────────────────────────────────────────
// GET   /api/alerts/notifications
router.get('/notifications',                (req, res)       => ctrl.notifications(req, res));
// PATCH /api/alerts/notifications/read-all
router.patch('/notifications/read-all',     (req, res)       => ctrl.markAllRead(req, res));
// PATCH /api/alerts/notifications/:id/read
router.patch('/notifications/:id/read',     (req, res)       => ctrl.markRead(req, res));
// PATCH /api/alerts/notifications/:id/resolve
router.patch('/notifications/:id/resolve',  (req, res)       => ctrl.resolve(req, res));

// ── Engine ────────────────────────────────────────────────────────────────────
// POST  /api/alerts/engine/run     → execute all detection algorithms
router.post('/engine/run',                  (req, res)       => ctrl.runEngine(req, res));
// GET   /api/alerts/engine/summary → unread counts by severity + type
router.get('/engine/summary',               (req, res)       => ctrl.engineSummary(req, res));

// ── Per-company configuration ─────────────────────────────────────────────────
// GET   /api/alerts/config               → all alert type configs
router.get('/config',                       (req, res)       => ctrl.listConfigs(req, res));
// POST  /api/alerts/config/init          → seed defaults (idempotent)
router.post('/config/init',                 (req, res)       => ctrl.initConfigs(req, res));
// PUT   /api/alerts/config               → bulk upsert
router.put('/config',                       (req, res, next) => ctrl.bulkUpsertConfigs(req, res, next));
// PUT   /api/alerts/config/:type         → upsert single alert type
router.put('/config/:type',                 (req, res, next) => ctrl.upsertConfig(req, res, next));

// ── Manual alert rules ────────────────────────────────────────────────────────
// GET   /api/alerts
router.get('/',                             (req, res)       => ctrl.list(req, res));
// POST  /api/alerts
router.post('/',                            (req, res, next) => ctrl.create(req, res, next));
// PUT   /api/alerts/:id
router.put('/:id',                          (req, res, next) => ctrl.update(req, res, next));
// DELETE /api/alerts/:id
router.delete('/:id',                       (req, res)       => ctrl.remove(req, res));

// Aliases under /rules (used by frontend)
router.get('/rules',                        (req, res)       => ctrl.list(req, res));
router.post('/rules',                       (req, res, next) => ctrl.create(req, res, next));
router.put('/rules/:id',                    (req, res, next) => ctrl.update(req, res, next));
router.delete('/rules/:id',                 (req, res)       => ctrl.remove(req, res));

export default router;
