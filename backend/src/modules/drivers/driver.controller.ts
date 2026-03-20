import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { DriverService, createDriverSchema, updateDriverSchema } from './driver.service';
import { sendSuccess, sendCreated, sendError, sendNotFound, sendBadRequest } from '../../utils/response';

const svc = new DriverService();

export class DriverController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const result = await svc.findAll(req.tenantId, {
        page:   Number(req.query.page  ?? 1),
        limit:  Number(req.query.limit ?? 20),
        search: req.query.search as string | undefined,
        active: req.query.active as string | undefined,
      });
      sendSuccess(res, result.data, 'Conductores obtenidos', 200, result.meta);
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const d = await svc.findById(req.params.id, req.tenantId);
      if (!d) { sendNotFound(res, 'Conductor'); return; }
      sendSuccess(res, d);
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = createDriverSchema.parse(req.body);
      const d = await svc.create(req.tenantId, body);
      sendCreated(res, d, 'Conductor registrado exitosamente');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = updateDriverSchema.parse(req.body);
      const d = await svc.update(req.params.id, req.tenantId, body);
      sendSuccess(res, d, 'Conductor actualizado');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }

  async remove(req: Request, res: Response): Promise<void> {
    try {
      await svc.softDelete(req.params.id, req.tenantId);
      sendSuccess(res, null, 'Conductor dado de baja');
    } catch (err) { sendBadRequest(res, err instanceof Error ? err.message : 'Error'); }
  }

  async expiringLicenses(req: Request, res: Response): Promise<void> {
    try {
      const days = Number(req.query.days ?? 30);
      const data = await svc.expiringLicenses(req.tenantId, days);
      sendSuccess(res, data, `Licencias próximas a vencer (${days} días)`);
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }
}
