import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { getPagination, buildMeta } from '../../utils/response';

export const createSiniestroSchema = z.object({
  vehicleId:    z.string().uuid().optional(),
  driverId:     z.string().uuid().optional(),
  fecha:        z.string().refine((v) => !v || !isNaN(Date.parse(v)), { message: 'Fecha inválida' }).optional(),
  hora:         z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Hora inválida (HH:MM)').optional(),
  observaciones: z.string().optional(),
  costo:        z.coerce.number().min(0).optional(),
  estado:       z.enum(['PENDIENTE', 'EN_PROCESO', 'CERRADO', 'RECHAZADO']).default('PENDIENTE'),
  tipo:         z.enum(['CHOQUE', 'RASPADURA', 'ROBO', 'VANDALISMO', 'INCENDIO', 'OTRO']).optional(),
  imageFile:    z.string().uuid().optional(),
});

export const updateSiniestroSchema = createSiniestroSchema.partial();

export class SiniestroService {
  async findAll(
    companyId: string,
    query: {
      page?: number;
      limit?: number;
      vehicleId?: string;
      driverId?: string;
      from?: string;
      to?: string;
    },
  ) {
    const { take, skip } = getPagination(query.page, query.limit);

    const where = {
      companyId,
      ...(query.vehicleId && { vehicleId: query.vehicleId }),
      ...(query.driverId  && { driverId: query.driverId }),
      ...((query.from || query.to) && {
        fecha: {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to   && { lte: new Date(query.to)   }),
        },
      }),
    };

    const [data, total] = await Promise.all([
      prisma.siniestro.findMany({
        where, skip, take,
        orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
        include: {
          vehicle: { select: { id: true, plate: true, name: true } },
          driver:  { select: { id: true, name: true, lastname: true } },
          image:   { select: { id: true, originalName: true, storagePath: true } },
        },
      }),
      prisma.siniestro.count({ where }),
    ]);

    return { data, meta: buildMeta(total, query.page ?? 1, take) };
  }

  async findById(id: string, companyId: string) {
    return prisma.siniestro.findFirst({
      where: { id, companyId },
      include: {
        vehicle: true,
        driver:  true,
        image:   true,
      },
    });
  }

  async create(companyId: string, data: z.infer<typeof createSiniestroSchema>) {
    // Validar que el vehículo pertenece a la empresa si se proporciona
    if (data.vehicleId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: { id: data.vehicleId, companyId, deletedAt: null },
      });
      if (!vehicle) throw new Error('Vehículo no encontrado');
    }

    // Validar que el conductor pertenece a la empresa si se proporciona
    if (data.driverId) {
      const driver = await prisma.driver.findFirst({
        where: { id: data.driverId, companyId, deletedAt: null },
      });
      if (!driver) throw new Error('Conductor no encontrado');
    }

    // Convertir hora string "HH:MM" a DateTime (2000-01-01T HH:MM:00Z como base)
    let horaDate: Date | null = null;
    if (data.hora) {
      const [hh, mm, ss = '00'] = data.hora.split(':');
      horaDate = new Date(`2000-01-01T${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:${ss.padStart(2, '0')}Z`);
    }

    return prisma.siniestro.create({
      data: {
        id:            uuidv4(),
        companyId,
        vehicleId:     data.vehicleId ?? null,
        driverId:      data.driverId  ?? null,
        fecha:         data.fecha ? new Date(data.fecha) : null,
        hora:          horaDate,
        observaciones: data.observaciones ?? null,
        costo:         data.costo ?? null,
        estado:        data.estado ?? 'PENDIENTE',
        tipo:          data.tipo ?? null,
        imageFile:     data.imageFile ?? null,
      },
      include: {
        vehicle: { select: { id: true, plate: true, name: true } },
        driver:  { select: { id: true, name: true, lastname: true } },
        image:   { select: { id: true, originalName: true, storagePath: true } },
      },
    });
  }

  async update(id: string, companyId: string, data: z.infer<typeof updateSiniestroSchema>) {
    const record = await prisma.siniestro.findFirst({ where: { id, companyId } });
    if (!record) throw new Error('Siniestro no encontrado');

    let horaDate: Date | undefined = undefined;
    if (data.hora !== undefined) {
      if (data.hora) {
        const [hh, mm, ss = '00'] = data.hora.split(':');
        horaDate = new Date(`2000-01-01T${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:${ss.padStart(2, '0')}Z`);
      } else {
        horaDate = undefined;
      }
    }

    return prisma.siniestro.update({
      where: { id },
      data: {
        vehicleId:     data.vehicleId     !== undefined ? (data.vehicleId || null)     : undefined,
        driverId:      data.driverId      !== undefined ? (data.driverId  || null)     : undefined,
        fecha:         data.fecha         !== undefined ? (data.fecha ? new Date(data.fecha) : null) : undefined,
        hora:          data.hora          !== undefined ? horaDate ?? null : undefined,
        observaciones: data.observaciones !== undefined ? (data.observaciones ?? null) : undefined,
        costo:         data.costo         !== undefined ? (data.costo ?? null) : undefined,
        estado:        data.estado        !== undefined ? data.estado : undefined,
        tipo:          data.tipo          !== undefined ? (data.tipo || null) : undefined,
        imageFile:     data.imageFile     !== undefined ? (data.imageFile || null) : undefined,
      },
      include: {
        vehicle: { select: { id: true, plate: true, name: true } },
        driver:  { select: { id: true, name: true, lastname: true } },
        image:   { select: { id: true, originalName: true, storagePath: true } },
      },
    });
  }

  async delete(id: string, companyId: string) {
    const record = await prisma.siniestro.findFirst({ where: { id, companyId } });
    if (!record) throw new Error('Siniestro no encontrado');
    return prisma.siniestro.delete({ where: { id } });
  }

  async getStats(companyId: string, range?: { from?: string; to?: string }) {
    const where = {
      companyId,
      ...((range?.from || range?.to) && {
        fecha: {
          ...(range?.from && { gte: new Date(range.from) }),
          ...(range?.to   && { lte: new Date(range.to)   }),
        },
      }),
    };

    const [totals, byVehicle, byDriver] = await Promise.all([
      prisma.siniestro.aggregate({
        where,
        _sum:   { costo: true },
        _count: { id: true },
      }),
      prisma.$queryRawUnsafe<{
        vehicleId: string;
        plate:     string;
        count:     number | string;
        total:     string;
      }[]>(`
        SELECT v.id AS vehicleId, v.plate,
               COUNT(s.id) AS \`count\`,
               ROUND(COALESCE(SUM(s.costo), 0), 2) AS total
        FROM siniestros s
        JOIN vehicles v ON v.id = s.vehicle_id
        WHERE s.company_id = ?
          ${range?.from ? 'AND s.fecha >= ?' : ''}
          ${range?.to   ? 'AND s.fecha <= ?' : ''}
        GROUP BY v.id, v.plate
        ORDER BY total DESC
        LIMIT 10
      `, companyId, ...(range?.from ? [new Date(range.from)] : []), ...(range?.to ? [new Date(range.to)] : [])),

      prisma.$queryRawUnsafe<{
        driverId: string;
        name:     string;
        count:    number | string;
        total:    string;
      }[]>(`
        SELECT d.id AS driverId,
               CONCAT(d.name, ' ', d.lastname) AS name,
               COUNT(s.id) AS \`count\`,
               ROUND(COALESCE(SUM(s.costo), 0), 2) AS total
        FROM siniestros s
        JOIN drivers d ON d.id = s.driver_id
        WHERE s.company_id = ?
          ${range?.from ? 'AND s.fecha >= ?' : ''}
          ${range?.to   ? 'AND s.fecha <= ?' : ''}
        GROUP BY d.id, d.name, d.lastname
        ORDER BY total DESC
        LIMIT 10
      `, companyId, ...(range?.from ? [new Date(range.from)] : []), ...(range?.to ? [new Date(range.to)] : [])),
    ]);

    return {
      totalCost:   Number(totals._sum.costo ?? 0),
      totalCount:  totals._count.id,
      byVehicle:   byVehicle.map(r => ({ vehicleId: r.vehicleId, plate: r.plate, count: Number(r.count), total: Number(r.total) })),
      byDriver:    byDriver.map(r  => ({ driverId: r.driverId,   name: r.name,   count: Number(r.count), total: Number(r.total) })),
    };
  }
}
