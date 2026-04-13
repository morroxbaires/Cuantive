import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  SiniestroService,
  createSiniestroSchema,
  updateSiniestroSchema,
} from './siniestro.service';
import { FileService } from '../files/file.service';
import {
  sendSuccess, sendCreated, sendError, sendNotFound, sendBadRequest,
} from '../../utils/response';

const svc     = new SiniestroService();
const fileSvc = new FileService();

export class SiniestroController {
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
      sendSuccess(res, result.data, 'Siniestros obtenidos', 200, result.meta);
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const s = await svc.findById(req.params.id, req.tenantId);
      if (!s) { sendNotFound(res, 'Siniestro'); return; }
      sendSuccess(res, s);
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Si se adjuntó imagen, guardarla primero y obtener su UUID
      let imageFileId: string | undefined;
      if (req.file) {
        const file = await fileSvc.save({
          companyId:    req.tenantId,
          uploadedBy:   req.user.sub,
          originalName: req.file.originalname,
          storedName:   req.file.filename,
          mimeType:     req.file.mimetype,
          sizeBytes:    req.file.size,
        });
        imageFileId = file.id;
      }

      const body = createSiniestroSchema.parse({ ...req.body, imageFile: imageFileId ?? req.body.imageFile });
      const s = await svc.create(req.tenantId, body);
      sendCreated(res, s, 'Siniestro registrado');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      if (err instanceof Error && (err.message === 'Vehículo no encontrado' || err.message === 'Conductor no encontrado')) {
        sendBadRequest(res, err.message); return;
      }
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let imageFileId: string | undefined;
      if (req.file) {
        const file = await fileSvc.save({
          companyId:    req.tenantId,
          uploadedBy:   req.user.sub,
          originalName: req.file.originalname,
          storedName:   req.file.filename,
          mimeType:     req.file.mimetype,
          sizeBytes:    req.file.size,
        });
        imageFileId = file.id;
      }

      const body = updateSiniestroSchema.parse({ ...req.body, ...(imageFileId ? { imageFile: imageFileId } : {}) });
      const s = await svc.update(req.params.id, req.tenantId, body);
      sendSuccess(res, s, 'Siniestro actualizado');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      if (err instanceof Error && err.message === 'Siniestro no encontrado') {
        sendNotFound(res, 'Siniestro'); return;
      }
      next(err);
    }
  }

  async remove(req: Request, res: Response): Promise<void> {
    try {
      await svc.delete(req.params.id, req.tenantId);
      sendSuccess(res, null, 'Siniestro eliminado');
    } catch (err) { sendBadRequest(res, err instanceof Error ? err.message : 'Error'); }
  }

  async stats(req: Request, res: Response): Promise<void> {
    try {
      const data = await svc.getStats(req.tenantId, {
        from: req.query.from as string | undefined,
        to:   req.query.to   as string | undefined,
      });
      sendSuccess(res, data, 'Estadísticas de siniestros');
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }
}
