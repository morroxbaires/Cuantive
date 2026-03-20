import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { FuelLoadService, createFuelLoadSchema, updateFuelLoadSchema } from './fuel-load.service';
import {
  sendSuccess, sendCreated, sendError, sendNotFound, sendBadRequest,
} from '../../utils/response';

const svc = new FuelLoadService();

export class FuelLoadController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const result = await svc.findAll(req.tenantId, {
        page:      Number(req.query.page  ?? 1),
        limit:     Number(req.query.limit ?? 20),
        vehicleId: req.query.vehicleId as string | undefined,
        driverId:  req.query.driverId  as string | undefined,
        from:      req.query.from      as string | undefined,
        to:        req.query.to        as string | undefined,
      });
      sendSuccess(res, result.data, 'Cargas obtenidas', 200, result.meta);
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const fl = await svc.findById(req.params.id, req.tenantId);
      if (!fl) { sendNotFound(res, 'Carga de combustible'); return; }
      sendSuccess(res, fl);
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = createFuelLoadSchema.parse(req.body);
      const fl = await svc.create(req.tenantId, body);
      sendCreated(res, fl, 'Carga de combustible registrada');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }

  async remove(req: Request, res: Response): Promise<void> {
    try {
      await svc.delete(req.params.id, req.tenantId);
      sendSuccess(res, null, 'Registro eliminado');
    } catch (err) { sendBadRequest(res, err instanceof Error ? err.message : 'Error'); }
  }

  async stats(req: Request, res: Response): Promise<void> {
    try {
      const days = Number(req.query.days ?? 30);
      const vehicleId = typeof req.query.vehicleId === 'string' ? req.query.vehicleId : undefined;
      const data = await svc.stats(req.tenantId, days, vehicleId);
      sendSuccess(res, data, 'Estadísticas de combustible');
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = updateFuelLoadSchema.parse(req.body);
      const fl = await svc.update(req.params.id, req.tenantId, body);
      sendSuccess(res, fl, 'Carga actualizada');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }

  async catalogs(req: Request, res: Response): Promise<void> {
    try {
      const data = await svc.getCatalogs();
      sendSuccess(res, data.fuelTypes, 'Catálogos obtenidos');
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }

  async recalculate(req: Request, res: Response): Promise<void> {
    try {
      const result = await svc.recalculateAllKmPerUnit(req.tenantId);
      sendSuccess(res, result, result.message);
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }
}
