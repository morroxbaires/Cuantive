import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AlertService, createAlertSchema, updateAlertSchema } from './alert.service';
import { AlertConfigService, upsertConfigSchema, bulkUpsertSchema } from './alert-config.service';
import { AlertEngineService } from './alert-engine.service';
import { sendSuccess, sendCreated, sendError, sendNotFound, sendBadRequest } from '../../utils/response';

const svc       = new AlertService();
const cfgSvc    = new AlertConfigService();
const engineSvc = new AlertEngineService();

export class AlertController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const result = await svc.findAll(req.tenantId, {
        page:   Number(req.query.page  ?? 1),
        limit:  Number(req.query.limit ?? 20),
        active: req.query.active as string | undefined,
      });
      sendSuccess(res, result.data, 'Alertas obtenidas', 200, result.meta);
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = createAlertSchema.parse(req.body);
      const alert = await svc.create(req.tenantId, body);
      sendCreated(res, alert, 'Alerta creada');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = updateAlertSchema.parse(req.body);
      const alert = await svc.update(req.params.id, req.tenantId, body);
      sendSuccess(res, alert, 'Alerta actualizada');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }

  async remove(req: Request, res: Response): Promise<void> {
    try {
      await svc.delete(req.params.id, req.tenantId);
      sendSuccess(res, null, 'Alerta eliminada');
    } catch (err) { sendBadRequest(res, err instanceof Error ? err.message : 'Error'); }
  }

  async notifications(req: Request, res: Response): Promise<void> {
    try {
      const result = await svc.notifications(req.tenantId, {
        page:       Number(req.query.page  ?? 1),
        limit:      Number(req.query.limit ?? 20),
        unreadOnly: req.query.unread as string | undefined,
      });
      sendSuccess(res, result.data, 'Notificaciones obtenidas', 200, result.meta);
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }

  async markRead(req: Request, res: Response): Promise<void> {
    try {
      const notif = await svc.markRead(req.params.id, req.tenantId);
      sendSuccess(res, notif, 'Notificación marcada como leída');
    } catch (err) { sendBadRequest(res, err instanceof Error ? err.message : 'Error'); }
  }

  async markAllRead(req: Request, res: Response): Promise<void> {
    try {
      const result = await svc.markAllRead(req.tenantId);
      sendSuccess(res, result, 'Todas las notificaciones marcadas como leídas');
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }

  // ── Resolve ──────────────────────────────────────────────────────────────

  async resolve(req: Request, res: Response): Promise<void> {
    try {
      const notif = await engineSvc.resolve(req.params.id, req.tenantId);
      sendSuccess(res, notif, 'Notificación resuelta');
    } catch (err) { sendBadRequest(res, err instanceof Error ? err.message : 'Error'); }
  }

  // ── Alert Engine ─────────────────────────────────────────────────────────

  /** POST /api/alerts/engine/run — execute all detection algorithms */
  async runEngine(req: Request, res: Response): Promise<void> {
    try {
      const result = await engineSvc.run(req.tenantId);
      sendSuccess(res, result, `Motor ejecutado: ${result.notificationsCreated} alertas creadas`);
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }

  /** GET /api/alerts/engine/summary — dashboard counts */
  async engineSummary(req: Request, res: Response): Promise<void> {
    try {
      const summary = await engineSvc.getDashboardSummary(req.tenantId);
      sendSuccess(res, summary, 'Resumen de alertas');
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }

  // ── Alert Configs ────────────────────────────────────────────────────────

  /** GET /api/alerts/config */
  async listConfigs(req: Request, res: Response): Promise<void> {
    try {
      const configs = await cfgSvc.getAll(req.tenantId);
      sendSuccess(res, configs, 'Configuración de alertas');
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }

  /** PUT /api/alerts/config — bulk upsert */
  async bulkUpsertConfigs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body    = bulkUpsertSchema.parse(req.body);
      const configs = await cfgSvc.bulkUpsert(req.tenantId, body);
      sendSuccess(res, configs, 'Configuración actualizada');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }

  /** PUT /api/alerts/config/:type — upsert single type */
  async upsertConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body   = upsertConfigSchema.parse({ ...req.body, alertType: req.params.type });
      const config = await cfgSvc.upsert(req.tenantId, body);
      sendSuccess(res, config, 'Configuración actualizada');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }

  /** POST /api/alerts/config/init — seed defaults */
  async initConfigs(req: Request, res: Response): Promise<void> {
    try {
      const result = await cfgSvc.initDefaults(req.tenantId);
      sendSuccess(res, result, `${result.created} configs inicializadas`);
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }
}
