import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../config/database';
import { env } from '../../config/env';

export class FileService {
  /** Persiste los metadatos del archivo ya guardado por Multer */
  async save(params: {
    companyId:    string;
    uploadedBy:   string;
    originalName: string;
    storedName:   string;
    mimeType:     string;
    sizeBytes:    number;
  }) {
    const storagePath = path.posix.join(env.UPLOAD_DIR, params.storedName);
    return prisma.file.create({
      data: {
        id:           uuidv4(),
        companyId:    params.companyId,
        uploadedBy:   params.uploadedBy,
        originalName: params.originalName,
        storedName:   params.storedName,
        mimeType:     params.mimeType,
        sizeBytes:    params.sizeBytes,
        storagePath,
      },
    });
  }

  async findById(id: string, companyId: string) {
    return prisma.file.findFirst({
      where: { id, companyId },
    });
  }

  async delete(id: string, companyId: string) {
    const file = await prisma.file.findFirst({ where: { id, companyId } });
    if (!file) throw new Error('Archivo no encontrado');

    // Eliminar del disco
    const fullPath = path.resolve(file.storagePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    await prisma.file.delete({ where: { id } });
  }
}
