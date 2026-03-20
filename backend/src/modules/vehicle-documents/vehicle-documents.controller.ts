import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { DocumentType } from '@prisma/client';
import {
  vehicleDocumentService,
  createVehicleDocumentSchema,
  updateVehicleDocumentSchema,
} from './vehicle-documents.service';
import {
  sendSuccess, sendCreated, sendError, sendNotFound, sendBadRequest,
} from '../../utils/response';

export class VehicleDocumentController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const result = await vehicleDocumentService.findAll(req.tenantId, {
        page:         Number(req.query.page  ?? 1),
        limit:        Number(req.query.limit ?? 20),
        vehicleId:    req.query.vehicleId    as string | undefined,
        documentType: req.query.documentType as DocumentType | undefined,
        status:       req.query.status       as 'active' | 'expiring' | 'expired' | undefined,
      });
      sendSuccess(res, result.data, 'Documentos obtenidos', 200, result.meta);
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const doc = await vehicleDocumentService.findById(req.params.id, req.tenantId);
      if (!doc) { sendNotFound(res, 'Documento'); return; }
      sendSuccess(res, doc);
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = createVehicleDocumentSchema.parse(req.body);
      const doc  = await vehicleDocumentService.create(req.tenantId, body);
      sendCreated(res, doc, 'Documento registrado');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      if (err instanceof Error && err.message === 'VEHICLE_NOT_FOUND') {
        sendNotFound(res, 'Vehículo'); return;
      }
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = updateVehicleDocumentSchema.parse(req.body);
      const doc  = await vehicleDocumentService.update(req.params.id, req.tenantId, body);
      if (!doc) { sendNotFound(res, 'Documento'); return; }
      sendSuccess(res, doc, 'Documento actualizado');
    } catch (err) {
      if (err instanceof z.ZodError) { next(err); return; }
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }

  async remove(req: Request, res: Response): Promise<void> {
    try {
      const deleted = await vehicleDocumentService.delete(req.params.id, req.tenantId);
      if (!deleted) { sendNotFound(res, 'Documento'); return; }
      sendSuccess(res, null, 'Documento eliminado');
    } catch (err) { sendBadRequest(res, err instanceof Error ? err.message : 'Error'); }
  }

  async listByVehicle(req: Request, res: Response): Promise<void> {
    try {
      const docs = await vehicleDocumentService.findByVehicle(req.params.vehicleId, req.tenantId);
      if (!docs) { sendNotFound(res, 'Vehículo'); return; }
      sendSuccess(res, docs, 'Documentos del vehículo');
    } catch (err) { sendError(res, err instanceof Error ? err.message : 'Error'); }
  }
}

export const vehicleDocumentController = new VehicleDocumentController();
