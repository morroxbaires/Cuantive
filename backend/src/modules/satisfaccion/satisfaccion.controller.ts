import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  SatisfaccionService,
  createSatisfaccionSchema,
  updateSatisfaccionSchema,
} from './satisfaccion.service';
import { FileService } from '../files/file.service';
import {
  sendSuccess, sendCreated, sendError, sendNotFound, sendBadRequest,
} from '../../utils/response';

const svc     = new SatisfaccionService();
const fileSvc = new FileService();

async function handleFileUpload(req: Request): Promise<string | undefined> {
  if (!req.file) return undefined;
  const file = await fileSvc.save({
    companyId:    req.tenantId,
    uploadedBy:   req.user.sub,
    originalName: req.file.originalname,
    storedName:   req.file.filename,
    mimeType:     req.file.mimetype,
    sizeBytes:    req.file.size,
  });
  return file.id;
}

export class SatisfaccionController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const result = await svc.findAll(req.tenantId, {
        page:      Number(req.query.page  ?? 1),
        limit:     Number(req.query.limit ?? 20),
        vehicleId: req.query.vehicleId as string | undefined,
        from:      req.query.from      as string | undefined,
        to:        req.query.to        as string | undefined,
      });
      sendSuccess(res, result.data, 'Evaluaciones obtenidas', 200, result.meta);
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const s = await svc.findById(req.params.id, req.tenantId);
      if (!s) { sendNotFound(res, 'Evaluación'); return; }
      sendSuccess(res, s);
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const imageFileId = await handleFileUpload(req);
      const body = createSatisfaccionSchema.parse({
        ...req.body,
        imageFile: imageFileId ?? req.body.imageFile,
        source: 'manual',
      });
      const s = await svc.create(req.tenantId, body);
      sendCreated(res, s, 'Evaluación registrada');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      if (err instanceof Error && err.message === 'Vehículo no encontrado') {
        sendBadRequest(res, err.message); return;
      }
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const imageFileId = await handleFileUpload(req);
      const body = updateSatisfaccionSchema.parse({
        ...req.body,
        ...(imageFileId ? { imageFile: imageFileId } : {}),
      });
      const s = await svc.update(req.params.id, req.tenantId, body);
      sendSuccess(res, s, 'Evaluación actualizada');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      if (err instanceof Error && err.message === 'Satisfacción no encontrada') {
        sendNotFound(res, 'Evaluación'); return;
      }
      next(err);
    }
  }

  async remove(req: Request, res: Response): Promise<void> {
    try {
      await svc.delete(req.params.id, req.tenantId);
      sendSuccess(res, null, 'Evaluación eliminada');
    } catch (err) {
      if (err instanceof Error && err.message === 'Satisfacción no encontrada') {
        sendNotFound(res, 'Evaluación'); return;
      }
      sendError(res, err instanceof Error ? err.message : 'Error');
    }
  }

  async stats(req: Request, res: Response): Promise<void> {
    try {
      const data = await svc.getStats(req.tenantId, {
        from: req.query.from as string | undefined,
        to:   req.query.to   as string | undefined,
      });
      sendSuccess(res, data, 'Estadísticas de satisfacción');
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }
}
