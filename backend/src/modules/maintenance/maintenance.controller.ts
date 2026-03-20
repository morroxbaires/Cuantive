import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { MaintenanceService, createMaintenanceSchema, updateMaintenanceSchema } from './maintenance.service';
import {
  sendSuccess, sendCreated, sendError, sendNotFound, sendBadRequest,
} from '../../utils/response';

const svc = new MaintenanceService();

export class MaintenanceController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const result = await svc.findAll(req.tenantId, {
        page:      Number(req.query.page  ?? 1),
        limit:     Number(req.query.limit ?? 20),
        vehicleId: req.query.vehicleId as string | undefined,
        type:      req.query.type      as string | undefined,
        from:      req.query.from      as string | undefined,
        to:        req.query.to        as string | undefined,
      });
      sendSuccess(res, result.data, 'Mantenimientos obtenidos', 200, result.meta);
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const m = await svc.findById(req.params.id, req.tenantId);
      if (!m) { sendNotFound(res, 'Mantenimiento'); return; }
      sendSuccess(res, m);
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = createMaintenanceSchema.parse(req.body);
      const m = await svc.create(req.tenantId, body);
      sendCreated(res, m, 'Mantenimiento registrado');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = updateMaintenanceSchema.parse(req.body);
      const m = await svc.update(req.params.id, req.tenantId, body);
      sendSuccess(res, m, 'Mantenimiento actualizado');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }

  async remove(req: Request, res: Response): Promise<void> {
    try {
      await svc.delete(req.params.id, req.tenantId);
      sendSuccess(res, null, 'Mantenimiento eliminado');
    } catch (err) { sendBadRequest(res, err instanceof Error ? err.message : 'Error'); }
  }

  async upcoming(req: Request, res: Response): Promise<void> {
    try {
      const data = await svc.upcoming(req.tenantId);
      sendSuccess(res, data, 'Próximos mantenimientos');
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }
}
