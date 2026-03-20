import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'Operación exitosa',
  statusCode = 200,
  meta?: ApiResponse['meta'],
): Response => {
  return res.status(statusCode).json({ success: true, message, data, meta });
};

export const sendCreated = <T>(
  res: Response,
  data: T,
  message = 'Recurso creado exitosamente',
): Response => sendSuccess(res, data, message, 201);

export const sendError = (
  res: Response,
  message: string,
  statusCode = 500,
  details?: unknown,
): Response => {
  return res.status(statusCode).json({ success: false, message, details });
};

export const sendNotFound = (res: Response, resource = 'Recurso'): Response =>
  sendError(res, `${resource} no encontrado`, 404);

export const sendForbidden = (res: Response, message = 'Acceso denegado'): Response =>
  sendError(res, message, 403);

export const sendUnauthorized = (res: Response, message = 'No autenticado'): Response =>
  sendError(res, message, 401);

export const sendBadRequest = (res: Response, message: string, details?: unknown): Response =>
  sendError(res, message, 400, details);

export const getPagination = (page = 1, limit = 20) => {
  const take = Math.min(Math.max(parseInt(String(limit), 10), 1), 100);
  const skip = (Math.max(parseInt(String(page), 10), 1) - 1) * take;
  return { take, skip };
};

export const buildMeta = (total: number, page: number, limit: number) => ({
  total,
  page: Number(page),
  limit: Number(limit),
  totalPages: Math.ceil(total / limit),
});
