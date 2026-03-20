import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import path from 'path';
import { CompanyService, createCompanySchema, updateCompanySchema } from './company.service';
import {
  sendSuccess, sendCreated, sendError, sendNotFound, sendBadRequest,
} from '../../utils/response';

const svc = new CompanyService();

export class CompanyController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const result = await svc.findAll({
        page:   Number(req.query.page  ?? 1),
        limit:  Number(req.query.limit ?? 20),
        search: req.query.search as string | undefined,
      });
      sendSuccess(res, result.data, 'Empresas obtenidas', 200, result.meta);
    } catch (err) {
      sendError(res, err instanceof Error ? err.message : 'Error');
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const company = await svc.findById(req.params.id);
      if (!company) { sendNotFound(res, 'Empresa'); return; }
      sendSuccess(res, company);
    } catch (err) {
      sendError(res, err instanceof Error ? err.message : 'Error');
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = createCompanySchema.parse(req.body);
      const company = await svc.create(body);
      sendCreated(res, company, 'Empresa creada exitosamente');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = updateCompanySchema.parse(req.body);
      const company = await svc.update(req.params.id, body);
      sendSuccess(res, company, 'Empresa actualizada');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }

  async toggleActive(req: Request, res: Response): Promise<void> {
    try {
      const { active } = req.body;
      if (typeof active !== 'boolean') {
        sendBadRequest(res, 'El campo "active" debe ser boolean'); return;
      }
      const result = await svc.toggleActive(req.params.id, active);
      sendSuccess(res, result, active ? 'Empresa activada' : 'Empresa desactivada');
    } catch (err) {
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }

  async uploadLogo(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) { sendBadRequest(res, 'No se proporcionó archivo'); return; }
      const logoPath = path.posix.join('uploads', req.file.filename);
      const result = await svc.updateLogo(req.params.id, logoPath);
      sendSuccess(res, result, 'Logo actualizado');
    } catch (err) {
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }

  async remove(req: Request, res: Response): Promise<void> {
    try {
      await svc.softDelete(req.params.id);
      sendSuccess(res, null, 'Empresa eliminada');
    } catch (err) {
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }
}
