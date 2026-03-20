import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  TurnoService,
  createTurnoSchema,
  updateTurnoSchema,
  TurnoFilters,
} from './turno.service';
import {
  sendSuccess, sendCreated, sendError, sendNotFound, sendBadRequest,
} from '../../utils/response';

const svc = new TurnoService();

export class TurnoController {
  /** GET /api/turnos */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const filters: TurnoFilters = {
        page:      Number(req.query.page  ?? 1),
        limit:     Number(req.query.limit ?? 20),
        search:    req.query.search    as string | undefined,
        vehicleId: req.query.vehicleId as string | undefined,
        driverId:  req.query.driverId  as string | undefined,
        dateFrom:  req.query.dateFrom  as string | undefined,
        dateTo:    req.query.dateTo    as string | undefined,
      };
      const result = await svc.findAll(req.tenantId, filters);
      sendSuccess(res, result.data, 'Turnos obtenidos', 200, result.meta);
    } catch (err) {
      sendError(res, err instanceof Error ? err.message : 'Error');
    }
  }

  /** GET /api/turnos/stats */
  async stats(req: Request, res: Response): Promise<void> {
    try {
      const data = await svc.getStats(req.tenantId, {
        vehicleId: req.query.vehicleId as string | undefined,
        driverId:  req.query.driverId  as string | undefined,
        dateFrom:  req.query.dateFrom  as string | undefined,
        dateTo:    req.query.dateTo    as string | undefined,
      });
      sendSuccess(res, data, 'Estadísticas de turnos');
    } catch (err) {
      sendError(res, err instanceof Error ? err.message : 'Error');
    }
  }

  /** GET /api/turnos/:id */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const t = await svc.findById(req.params.id, req.tenantId);
      if (!t) { sendNotFound(res, 'Turno'); return; }
      sendSuccess(res, t);
    } catch (err) {
      sendError(res, err instanceof Error ? err.message : 'Error');
    }
  }

  /** POST /api/turnos */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = createTurnoSchema.parse(req.body);
      const t    = await svc.create(req.tenantId, body);
      sendCreated(res, t, 'Turno registrado exitosamente');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }

  /** PUT /api/turnos/:id */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = updateTurnoSchema.parse(req.body);
      const t    = await svc.update(req.params.id, req.tenantId, body);
      sendSuccess(res, t, 'Turno actualizado');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }

  /** DELETE /api/turnos/:id */
  async remove(req: Request, res: Response): Promise<void> {
    try {
      await svc.delete(req.params.id, req.tenantId);
      sendSuccess(res, null, 'Turno eliminado');
    } catch (err) {
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }
}
