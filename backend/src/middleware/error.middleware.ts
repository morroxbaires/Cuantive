import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';

interface AppError extends Error {
  statusCode?: number;
}

export const errorMiddleware = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // Errores de validación Zod
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Error de validación',
      details: err.errors.map((e) => ({
        campo:   e.path.join('.'),
        mensaje: e.message,
      })),
    });
    return;
  }

  // Errores de Multer (upload)
  if (err.message?.includes('Tipo de archivo') || err.message?.includes('File too large')) {
    res.status(400).json({ success: false, message: err.message });
    return;
  }

  const statusCode = err.statusCode || 500;
  const message    = err.message || 'Error interno del servidor';

  console.error(`[ERROR] ${req.method} ${req.path}:`, err);

  res.status(statusCode).json({
    success: false,
    message,
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export const notFoundMiddleware = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.path}`,
  });
};
