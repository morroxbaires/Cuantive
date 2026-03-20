import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { FileService } from './file.service';
import { FuelLoadService } from '../fuel-loads/fuel-load.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { sendSuccess, sendCreated, sendError, sendNotFound, sendBadRequest } from '../../utils/response';
import { env } from '../../config/env';

const fileSvc        = new FileService();
const fuelLoadSvc    = new FuelLoadService();
const maintenanceSvc = new MaintenanceService();

export class FileController {
  /** POST /api/files/upload — Sube un archivo y devuelve su metadata */
  async upload(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) { sendBadRequest(res, 'No se proporcionó archivo'); return; }

      const file = await fileSvc.save({
        companyId:    req.tenantId,
        uploadedBy:   req.user.sub,
        originalName: req.file.originalname,
        storedName:   req.file.filename,
        mimeType:     req.file.mimetype,
        sizeBytes:    req.file.size,
      });

      sendCreated(res, file, 'Archivo subido exitosamente');
    } catch (err) {
      sendError(res, err instanceof Error ? err.message : 'Error al subir archivo');
    }
  }

  /** POST /api/files/upload/fuel-load/:id — Sube recibo para una carga */
  async uploadFuelReceipt(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) { sendBadRequest(res, 'No se proporcionó archivo'); return; }

      const file = await fileSvc.save({
        companyId:    req.tenantId,
        uploadedBy:   req.user.sub,
        originalName: req.file.originalname,
        storedName:   req.file.filename,
        mimeType:     req.file.mimetype,
        sizeBytes:    req.file.size,
      });

      await fuelLoadSvc.attachFile(req.params.id, req.tenantId, file.id);
      sendCreated(res, file, 'Recibo de combustible adjuntado');
    } catch (err) {
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }

  /** POST /api/files/upload/maintenance/:id — Sube recibo para un mantenimiento */
  async uploadMaintenanceReceipt(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) { sendBadRequest(res, 'No se proporcionó archivo'); return; }

      const file = await fileSvc.save({
        companyId:    req.tenantId,
        uploadedBy:   req.user.sub,
        originalName: req.file.originalname,
        storedName:   req.file.filename,
        mimeType:     req.file.mimetype,
        sizeBytes:    req.file.size,
      });

      await maintenanceSvc.attachFile(req.params.id, req.tenantId, file.id);
      sendCreated(res, file, 'Recibo de mantenimiento adjuntado');
    } catch (err) {
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }

  /** GET /api/files/:id — Sirve el archivo directamente */
  async download(req: Request, res: Response): Promise<void> {
    try {
      const file = await fileSvc.findById(req.params.id, req.tenantId);
      if (!file) { sendNotFound(res, 'Archivo'); return; }

      const fullPath = path.resolve(file.storagePath);
      if (!fs.existsSync(fullPath)) {
        sendNotFound(res, 'Archivo en disco'); return;
      }

      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
      res.sendFile(fullPath);
    } catch (err) {
      sendError(res, err instanceof Error ? err.message : 'Error');
    }
  }

  /** DELETE /api/files/:id */
  async remove(req: Request, res: Response): Promise<void> {
    try {
      await fileSvc.delete(req.params.id, req.tenantId);
      sendSuccess(res, null, 'Archivo eliminado');
    } catch (err) {
      sendBadRequest(res, err instanceof Error ? err.message : 'Error');
    }
  }
}
