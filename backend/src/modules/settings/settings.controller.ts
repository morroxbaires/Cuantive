import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { SettingsService, updateSettingsSchema } from './settings.service';
import { sendSuccess, sendError, sendBadRequest } from '../../utils/response';

const svc = new SettingsService();

export class SettingsController {
  async get(req: Request, res: Response): Promise<void> {
    try {
      const data = await svc.findByCompany(req.tenantId);
      sendSuccess(res, data, 'Configuración obtenida');
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = updateSettingsSchema.parse(req.body);
      const data = await svc.update(req.tenantId, body);
      sendSuccess(res, data, 'Configuración actualizada');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }
}
