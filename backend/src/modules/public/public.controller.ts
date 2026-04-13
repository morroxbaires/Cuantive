import { Request, Response } from 'express';
import { z } from 'zod';
import { SatisfaccionService } from '../satisfaccion/satisfaccion.service';
import { FileService }         from '../files/file.service';
import { prisma }              from '../../config/database';
import { sendSuccess, sendCreated, sendBadRequest, sendNotFound } from '../../utils/response';

const svc     = new SatisfaccionService();
const fileSvc = new FileService();

const publicSchema = z.object({
  fecha:        z.string().optional(),
  hora:         z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Hora inválida').optional(),
  puntuacion:   z.coerce.number().int().min(1).max(10).optional(),
  observaciones: z.string().optional(),
});

export class PublicController {
  /** GET /api/public/survey/:vehicleId — devuelve nombre/placa del vehículo */
  async getVehicle(req: Request, res: Response): Promise<void> {
    const { vehicleId } = req.params;
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, deletedAt: null, active: true },
      select: { id: true, plate: true, name: true },
    });
    if (!vehicle) { sendNotFound(res, 'Vehículo'); return; }
    sendSuccess(res, vehicle, 'Vehículo encontrado');
  }

  /** POST /api/public/survey — envío desde el QR (sin autenticación) */
  async submitSurvey(req: Request, res: Response): Promise<void> {
    try {
      const { vehicleId } = req.body;
      if (!vehicleId) { sendBadRequest(res, 'vehicleId requerido'); return; }

      // Manejar imagen opcional
      let imageFileId: string | undefined;
      if (req.file) {
        const vehicle = await prisma.vehicle.findFirst({
          where: { id: vehicleId, deletedAt: null },
          select: { companyId: true },
        });
        if (vehicle) {
          const file = await fileSvc.save({
            companyId:    vehicle.companyId,
            uploadedBy:   undefined as unknown as string,
            originalName: req.file.originalname,
            storedName:   req.file.filename,
            mimeType:     req.file.mimetype,
            sizeBytes:    req.file.size,
          });
          imageFileId = file.id;
        }
      }

      const data = publicSchema.parse(req.body);
      const s = await svc.createPublic(vehicleId, { ...data, imageFile: imageFileId });
      sendCreated(res, s, 'Evaluación enviada. ¡Gracias por tu opinión!');
    } catch (err) {
      if (err instanceof z.ZodError) {
        sendBadRequest(res, err.errors.map(e => e.message).join(', ')); return;
      }
      sendBadRequest(res, err instanceof Error ? err.message : 'Error al enviar evaluación');
    }
  }
}
