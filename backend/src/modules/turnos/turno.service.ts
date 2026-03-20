/**
 * turno.service.ts
 *
 * CRUD + KPI-ready queries for the Turnos module.
 *
 * Design:
 *  - kmTotales is always derived from kmOcupados + kmLibres on write.
 *  - All monetary/distance fields stored as Decimal (serialised as string by
 *    Prisma); the service normalises them to numbers before returning.
 *  - getStats() returns aggregated KPI data ready for future analytics.
 */
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../config/database';
import { getPagination, buildMeta } from '../../utils/response';

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const createTurnoSchema = z.object({
  vehicleId:   z.string().uuid('vehicleId inválido'),
  driverId:    z.string().uuid('driverId inválido'),
  shiftDate:   z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Fecha inválida' }),
  shiftNumber: z.coerce.number().int().positive('Número de turno debe ser positivo'),
  totalFichas: z.coerce.number().min(0, 'Fichas no puede ser negativo'),
  kmOcupados:  z.coerce.number().min(0, 'Km ocupados no puede ser negativo'),
  kmLibres:    z.coerce.number().min(0, 'Km libres no puede ser negativo'),
  notes:       z.string().optional(),
});

export const updateTurnoSchema = createTurnoSchema.partial();

export type CreateTurnoInput = z.infer<typeof createTurnoSchema>;
export type UpdateTurnoInput = z.infer<typeof updateTurnoSchema>;

// ─── Filters ──────────────────────────────────────────────────────────────────

export interface TurnoFilters {
  page?:      number;
  limit?:     number;
  search?:    string;   // Placa de vehículo o nombre de conductor
  vehicleId?: string;
  driverId?:  string;
  dateFrom?:  string;   // YYYY-MM-DD
  dateTo?:    string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toNum = (v: Decimal | null | undefined): number =>
  v == null ? 0 : parseFloat(v.toString());

const turnoInclude = {
  vehicle: { select: { id: true, plate: true, brand: true, model: true } },
  driver:  { select: { id: true, name: true, lastname: true, document: true } },
} as const;

function mapTurno(t: Record<string, unknown>) {
  return {
    ...t,
    totalFichas: toNum(t.totalFichas as Decimal),
    kmOcupados:  toNum(t.kmOcupados  as Decimal),
    kmLibres:    toNum(t.kmLibres    as Decimal),
    kmTotales:   toNum(t.kmTotales   as Decimal),
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class TurnoService {
  // ── List / search ────────────────────────────────────────────────────────

  async findAll(companyId: string, filters: TurnoFilters) {
    const { take, skip } = getPagination(filters.page, filters.limit);

    const where: Record<string, unknown> = { companyId };

    if (filters.vehicleId) where.vehicleId = filters.vehicleId;
    if (filters.driverId)  where.driverId  = filters.driverId;

    if (filters.dateFrom || filters.dateTo) {
      where.shiftDate = {
        ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
        ...(filters.dateTo   && { lte: new Date(filters.dateTo)   }),
      };
    }

    if (filters.search) {
      const q = filters.search;
      where.OR = [
        { vehicle: { plate:    { contains: q } } },
        { vehicle: { brand:    { contains: q } } },
        { driver:  { name:     { contains: q } } },
        { driver:  { lastname: { contains: q } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.turno.findMany({
        where: where as Prisma.TurnoWhereInput,
        skip,
        take,
        orderBy: [{ shiftDate: 'desc' }, { shiftNumber: 'desc' }],
        include: turnoInclude,
      }),
      prisma.turno.count({
        where: where as Prisma.TurnoWhereInput,
      }),
    ]);

    return {
      data: data.map((t) => mapTurno(t as unknown as Record<string, unknown>)),
      meta: buildMeta(total, filters.page ?? 1, take),
    };
  }

  // ── Single ────────────────────────────────────────────────────────────────

  async findById(id: string, companyId: string) {
    const t = await prisma.turno.findFirst({
      where:   { id, companyId },
      include: turnoInclude,
    });
    if (!t) return null;
    return mapTurno(t as unknown as Record<string, unknown>);
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(companyId: string, data: CreateTurnoInput) {
    // Validate vehicle & driver belong to company
    const [vehicle, driver] = await Promise.all([
      prisma.vehicle.findFirst({ where: { id: data.vehicleId, companyId, deletedAt: null } }),
      prisma.driver.findFirst({ where: { id: data.driverId,  companyId, deletedAt: null } }),
    ]);
    if (!vehicle) throw new Error('Vehículo no encontrado en esta empresa');
    if (!driver)  throw new Error('Conductor no encontrado en esta empresa');

    const kmTotales = (data.kmOcupados ?? 0) + (data.kmLibres ?? 0);

    const turno = await prisma.turno.create({
      data: {
        id:          uuidv4(),
        companyId,
        vehicleId:   data.vehicleId,
        driverId:    data.driverId,
        shiftDate:   new Date(data.shiftDate),
        shiftNumber: data.shiftNumber,
        totalFichas: data.totalFichas,
        kmOcupados:  data.kmOcupados,
        kmLibres:    data.kmLibres,
        kmTotales,
        notes:       data.notes,
      },
      include: turnoInclude,
    });
    return mapTurno(turno as unknown as Record<string, unknown>);
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(id: string, companyId: string, data: UpdateTurnoInput) {
    await this.assertBelongsTo(id, companyId);

    if (data.vehicleId) {
      const v = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, companyId, deletedAt: null } });
      if (!v) throw new Error('Vehículo no encontrado en esta empresa');
    }
    if (data.driverId) {
      const d = await prisma.driver.findFirst({ where: { id: data.driverId, companyId, deletedAt: null } });
      if (!d) throw new Error('Conductor no encontrado en esta empresa');
    }

    // Re-derive kmTotales when either km field changes
    const existing = await prisma.turno.findFirst({ where: { id } });
    const kmOcupados  = data.kmOcupados  ?? toNum(existing!.kmOcupados);
    const kmLibres    = data.kmLibres    ?? toNum(existing!.kmLibres);
    const kmTotales   = kmOcupados + kmLibres;

    const turno = await prisma.turno.update({
      where: { id },
      data: {
        ...(data.vehicleId   !== undefined && { vehicleId:   data.vehicleId }),
        ...(data.driverId    !== undefined && { driverId:    data.driverId  }),
        ...(data.shiftDate   !== undefined && { shiftDate:   new Date(data.shiftDate) }),
        ...(data.shiftNumber !== undefined && { shiftNumber: data.shiftNumber }),
        ...(data.totalFichas !== undefined && { totalFichas: data.totalFichas }),
        kmOcupados,
        kmLibres,
        kmTotales,
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      include: turnoInclude,
    });
    return mapTurno(turno as unknown as Record<string, unknown>);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async delete(id: string, companyId: string) {
    await this.assertBelongsTo(id, companyId);
    return prisma.turno.delete({ where: { id } });
  }

  // ── KPI Aggregations (escalable para analytics) ───────────────────────────

  async getStats(
    companyId: string,
    filters: Pick<TurnoFilters, 'dateFrom' | 'dateTo' | 'vehicleId' | 'driverId'> = {},
  ) {
    const where: Record<string, unknown> = { companyId };
    if (filters.vehicleId) where.vehicleId = filters.vehicleId;
    if (filters.driverId)  where.driverId  = filters.driverId;
    if (filters.dateFrom || filters.dateTo) {
      where.shiftDate = {
        ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
        ...(filters.dateTo   && { lte: new Date(filters.dateTo)   }),
      };
    }

    const agg = await prisma.turno.aggregate({
      where: where as Prisma.TurnoWhereInput,
      _count: { id: true },
      _sum:   { kmOcupados: true, kmLibres: true, kmTotales: true, totalFichas: true },
      _avg:   { kmOcupados: true, kmLibres: true, kmTotales: true, totalFichas: true },
    });

    const totalKm  = toNum(agg._sum.kmTotales);
    const ocupados = toNum(agg._sum.kmOcupados);

    return {
      totalTurnos:     agg._count.id,
      totalFichas:     toNum(agg._sum.totalFichas),
      totalKmOcupados: ocupados,
      totalKmLibres:   toNum(agg._sum.kmLibres),
      totalKmTotales:  totalKm,
      avgFichas:       toNum(agg._avg.totalFichas),
      avgKmTotales:    toNum(agg._avg.kmTotales),
      /** Porcentaje de km productivos (ocupados/totales) */
      eficienciaKm:    totalKm > 0 ? Math.round((ocupados / totalKm) * 10000) / 100 : 0,
    };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async assertBelongsTo(id: string, companyId: string) {
    const t = await prisma.turno.findFirst({ where: { id, companyId } });
    if (!t) throw new Error('Turno no encontrado');
    return t;
  }
}
