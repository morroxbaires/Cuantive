import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { getPagination, buildMeta } from '../../utils/response';

export const createSatisfaccionSchema = z.object({
  vehicleId:    z.string().uuid().optional(),
  fecha:        z.string().refine(v => !v || !isNaN(Date.parse(v)), { message: 'Fecha inválida' }).optional(),
  hora:         z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Hora inválida (HH:MM)').optional(),
  puntuacion:   z.coerce.number().int().min(1).max(10).optional(),
  observaciones: z.string().optional(),
  imageFile:    z.string().uuid().optional(),
  source:       z.enum(['manual', 'qr']).default('manual'),
});

export const updateSatisfaccionSchema = createSatisfaccionSchema.partial();

function parseHora(hora?: string): Date | null {
  if (!hora) return null;
  const [hh, mm, ss = '00'] = hora.split(':');
  return new Date(`2000-01-01T${hh.padStart(2,'0')}:${mm.padStart(2,'0')}:${ss.padStart(2,'0')}Z`);
}

const include = {
  vehicle: { select: { id: true, plate: true, name: true } },
  image:   { select: { id: true, originalName: true, storagePath: true } },
};

export class SatisfaccionService {
  async findAll(
    companyId: string,
    query: { page?: number; limit?: number; vehicleId?: string; from?: string; to?: string },
  ) {
    const { take, skip } = getPagination(query.page, query.limit);
    const where = {
      companyId,
      ...(query.vehicleId && { vehicleId: query.vehicleId }),
      ...((query.from || query.to) && {
        fecha: {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to   && { lte: new Date(query.to) }),
        },
      }),
    };
    const [data, total] = await Promise.all([
      prisma.satisfaccion.findMany({
        where, skip, take,
        orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
        include,
      }),
      prisma.satisfaccion.count({ where }),
    ]);
    return { data, meta: buildMeta(total, query.page ?? 1, take) };
  }

  async findById(id: string, companyId: string) {
    return prisma.satisfaccion.findFirst({ where: { id, companyId }, include });
  }

  async create(companyId: string, data: z.infer<typeof createSatisfaccionSchema>) {
    if (data.vehicleId) {
      const v = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, companyId, deletedAt: null } });
      if (!v) throw new Error('Vehículo no encontrado');
    }
    return prisma.satisfaccion.create({
      data: {
        id:           uuidv4(),
        companyId,
        vehicleId:    data.vehicleId ?? null,
        fecha:        data.fecha ? new Date(data.fecha) : null,
        hora:         parseHora(data.hora),
        puntuacion:   data.puntuacion ?? null,
        observaciones: data.observaciones ?? null,
        imageFile:    data.imageFile ?? null,
        source:       data.source ?? 'manual',
      },
      include,
    });
  }

  async update(id: string, companyId: string, data: z.infer<typeof updateSatisfaccionSchema>) {
    const record = await prisma.satisfaccion.findFirst({ where: { id, companyId } });
    if (!record) throw new Error('Satisfacción no encontrada');
    return prisma.satisfaccion.update({
      where: { id },
      data: {
        vehicleId:    data.vehicleId     !== undefined ? (data.vehicleId || null)     : undefined,
        fecha:        data.fecha         !== undefined ? (data.fecha ? new Date(data.fecha) : null) : undefined,
        hora:         data.hora          !== undefined ? parseHora(data.hora) : undefined,
        puntuacion:   data.puntuacion    !== undefined ? (data.puntuacion ?? null)    : undefined,
        observaciones: data.observaciones !== undefined ? (data.observaciones ?? null) : undefined,
        imageFile:    data.imageFile     !== undefined ? (data.imageFile || null)     : undefined,
      },
      include,
    });
  }

  async delete(id: string, companyId: string) {
    const record = await prisma.satisfaccion.findFirst({ where: { id, companyId } });
    if (!record) throw new Error('Satisfacción no encontrada');
    return prisma.satisfaccion.delete({ where: { id } });
  }

  async getStats(companyId: string, range?: { from?: string; to?: string }) {
    const where = {
      companyId,
      puntuacion: { not: null },
      ...((range?.from || range?.to) && {
        fecha: {
          ...(range?.from && { gte: new Date(range.from) }),
          ...(range?.to   && { lte: new Date(range.to) }),
        },
      }),
    };

    // Overall aggregate
    const overall = await prisma.satisfaccion.aggregate({
      where,
      _avg:   { puntuacion: true },
      _count: { id: true },
    });

    // Per-vehicle averages via raw SQL for efficiency
    const byVehicle = await prisma.$queryRawUnsafe<{
      vehicleId: string;
      plate:     string;
      name:      string | null;
      avgScore:  string;
      count:     string;
    }[]>(`
      SELECT
        v.id                         AS vehicleId,
        v.plate,
        COALESCE(v.name, v.plate)    AS name,
        ROUND(AVG(s.puntuacion), 2)  AS avgScore,
        COUNT(s.id)                  AS count
      FROM satisfacciones s
      INNER JOIN vehicles v ON v.id = s.vehicle_id
      WHERE s.company_id = ?
        AND s.puntuacion IS NOT NULL
        ${range?.from ? 'AND s.fecha >= ?' : ''}
        ${range?.to   ? 'AND s.fecha <= ?' : ''}
      GROUP BY v.id, v.plate, v.name
      ORDER BY AVG(s.puntuacion) DESC
    `, companyId, ...(range?.from ? [range.from] : []), ...(range?.to ? [range.to] : []));

    const vehicles = byVehicle.map(r => ({
      vehicleId: r.vehicleId,
      plate:     r.plate,
      name:      r.name ?? r.plate,
      avgScore:  Number(r.avgScore),
      count:     Number(r.count),
    }));

    return {
      overallAvg:    overall._avg.puntuacion ? Number(overall._avg.puntuacion.toFixed(2)) : null,
      totalReviews:  overall._count.id,
      bestVehicle:   vehicles[0] ?? null,
      worstVehicle:  vehicles.length > 1 ? vehicles[vehicles.length - 1] : null,
      byVehicle:     vehicles,
    };
  }

  /** Usado por el endpoint público del QR — no requiere companyId del tenant */
  async createPublic(vehicleId: string, data: {
    fecha?: string;
    hora?: string;
    puntuacion?: number;
    observaciones?: string;
    imageFile?: string;
  }) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, deletedAt: null, active: true },
      select: { id: true, companyId: true, plate: true, name: true },
    });
    if (!vehicle) throw new Error('Vehículo no encontrado');

    return prisma.satisfaccion.create({
      data: {
        id:           uuidv4(),
        companyId:    vehicle.companyId,
        vehicleId:    vehicle.id,
        fecha:        data.fecha ? new Date(data.fecha) : null,
        hora:         parseHora(data.hora),
        puntuacion:   data.puntuacion ?? null,
        observaciones: data.observaciones ?? null,
        imageFile:    data.imageFile ?? null,
        source:       'qr',
      },
      include: {
        vehicle: { select: { id: true, plate: true, name: true } },
      },
    });
  }
}
