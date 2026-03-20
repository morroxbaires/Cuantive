import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { VehicleService, createVehicleSchema, updateVehicleSchema } from './vehicle.service';
import { sendSuccess, sendCreated, sendError, sendNotFound, sendBadRequest } from '../../utils/response';

const svc = new VehicleService();

export class VehicleController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const result = await svc.findAll(req.tenantId, {
        page:   Number(req.query.page  ?? 1),
        limit:  Number(req.query.limit ?? 20),
        search: req.query.search as string | undefined,
        active: req.query.active as string | undefined,
      });
      sendSuccess(res, result.data, 'Vehículos obtenidos', 200, result.meta);
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const v = await svc.findById(req.params.id, req.tenantId);
      if (!v) { sendNotFound(res, 'Vehículo'); return; }
      sendSuccess(res, v);
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = createVehicleSchema.parse(req.body);
      const v = await svc.create(req.tenantId, body);
      sendCreated(res, v, 'Vehículo registrado exitosamente');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = updateVehicleSchema.parse(req.body);
      const v = await svc.update(req.params.id, req.tenantId, body);
      sendSuccess(res, v, 'Vehículo actualizado');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }

  async remove(req: Request, res: Response): Promise<void> {
    try {
      await svc.softDelete(req.params.id, req.tenantId);
      sendSuccess(res, null, 'Vehículo dado de baja');
    } catch (err) { sendBadRequest(res, err instanceof Error ? err.message : 'Error'); }
  }

  async catalogs(_req: Request, res: Response): Promise<void> {
    try {
      const data = await svc.getCatalogs();
      sendSuccess(res, data);
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }
}
