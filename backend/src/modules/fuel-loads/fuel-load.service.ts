import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { getPagination, buildMeta } from '../../utils/response';

export const createFuelLoadSchema = z.object({
  vehicleId:  z.string().uuid(),
  driverId:   z.string().uuid().optional(),
  fuelTypeId: z.number().int().positive().optional(),
  date:       z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Fecha inválida' }),
  litersOrKwh: z.number().positive(),
  unitPrice:  z.number().positive().optional(),
  priceTotal: z.number().positive().optional(),
  odometer:   z.number().int().min(0).optional(),
  station:    z.string().max(120).optional(),
  notes:      z.string().optional(),
});

export const updateFuelLoadSchema = createFuelLoadSchema.partial();

export class FuelLoadService {
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
      ...(query.driverId  && { driverId:  query.driverId  }),
      ...((query.from || query.to) && {
        date: {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to   && { lte: new Date(query.to)   }),
        },
      }),
    };

    const [data, total] = await Promise.all([
      prisma.fuelLoad.findMany({
        where, skip, take,
        orderBy: [{ date: 'desc' }, { odometer: 'desc' }],
        include: {
          vehicle:  { select: { id: true, plate: true, name: true, efficiencyReference: true, fuelTypeId: true } },
          driver:   { select: { id: true, name: true, lastname: true } },
          fuelType: { select: { id: true, name: true, unit: true } },
          file:     { select: { id: true, originalName: true, storagePath: true } },
        },
      }),
      prisma.fuelLoad.count({ where }),
    ]);

    return { data, meta: buildMeta(total, query.page ?? 1, take) };
  }

  async findById(id: string, companyId: string) {
    return prisma.fuelLoad.findFirst({
      where: { id, companyId },
      include: {
        vehicle:  true,
        driver:   true,
        fuelType: true,
        file:     true,
      },
    });
  }

  /**
   * Calcula km/unidad de combustible buscando la última carga previa del vehículo.
   * Si no existe carga previa y el vehículo tiene odómetro inicial > 0, lo usa como base.
   * Formula: (odómetro_actual - odómetro_previo) / litros_cargados_actuales
   */
  private async calculateKmPerUnit(
    vehicleId: string,
    currentOdometer: number,
    currentLiters: number,
    currentDate: Date,
    companyId: string,
    vehicleInitialOdometer?: number,
  ): Promise<number | null> {
    // Buscar la última carga del mismo vehículo con odómetro menor al actual
    const previousLoad = await prisma.fuelLoad.findFirst({
      where: {
        companyId,
        vehicleId,
        odometer: { lt: currentOdometer, not: null },
      },
      orderBy: { odometer: 'desc' },
      select: { odometer: true },
    });

    // Odómetro de referencia: carga previa o, si es la primera carga, el odómetro inicial del vehículo
    const prevOdometer: number | null =
      previousLoad?.odometer != null
        ? Number(previousLoad.odometer)
        : (vehicleInitialOdometer != null && vehicleInitialOdometer > 0 && vehicleInitialOdometer < currentOdometer)
          ? vehicleInitialOdometer
          : null;

    if (prevOdometer === null) return null;

    const kmTraveled = currentOdometer - prevOdometer;
    if (kmTraveled <= 0) return null;

    // km/unidad = km recorridos desde última referencia / unidad cargada ahora
    // Aplica tanto para combustible (km/L) como eléctrico (km/kWh)
    return kmTraveled / currentLiters;
  }

  async create(companyId: string, data: z.infer<typeof createFuelLoadSchema>) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: data.vehicleId, companyId, deletedAt: null },
    });
    if (!vehicle) throw new Error('Vehículo no encontrado');

    // Calcular km/unidad si hay odómetro
    let kmPerUnit: number | null = null;
    if (data.odometer) {
      kmPerUnit = await this.calculateKmPerUnit(
        data.vehicleId,
        data.odometer,
        data.litersOrKwh,
        new Date(data.date),
        companyId,
        vehicle.currentOdometer != null ? Number(vehicle.currentOdometer) : undefined,
      );
    }

    const fuelLoad = await prisma.fuelLoad.create({
      data: {
        id:          uuidv4(),
        companyId,
        vehicleId:   data.vehicleId,
        driverId:    data.driverId,
        fuelTypeId:  data.fuelTypeId,
        date:        new Date(data.date),
        litersOrKwh: data.litersOrKwh,
        unitPrice:   data.unitPrice,
        priceTotal:  data.priceTotal,
        odometer:    data.odometer,
        kmPerUnit:   kmPerUnit ?? undefined,
        station:     data.station,
        notes:       data.notes,
      },
      include: { vehicle: true, driver: true, fuelType: true },
    });

    // Actualizar odómetro del vehículo si es mayor al actual
    if (data.odometer && (!vehicle.currentOdometer || data.odometer > vehicle.currentOdometer)) {
      await prisma.vehicle.update({
        where: { id: data.vehicleId },
        data:  { currentOdometer: data.odometer },
      });
    }

    return fuelLoad;
  }

  async attachFile(id: string, companyId: string, fileId: string) {
    const record = await prisma.fuelLoad.findFirst({ where: { id, companyId } });
    if (!record) throw new Error('Registro no encontrado');
    return prisma.fuelLoad.update({
      where: { id },
      data:  { receiptFile: fileId },
    });
  }

  async delete(id: string, companyId: string) {
    const record = await prisma.fuelLoad.findFirst({ where: { id, companyId } });
    if (!record) throw new Error('Registro no encontrado');
    await prisma.fuelLoad.delete({ where: { id } });
  }

  /** Estadísticas de consumo por empresa — últimos N días */
  async stats(companyId: string, days = 30, vehicleId?: string) {
    const from = new Date();
    from.setDate(from.getDate() - days);

    const loads = await prisma.fuelLoad.findMany({
      where: {
        companyId,
        date: { gte: from },
        ...(vehicleId ? { vehicleId } : {}),
      },
      include: {
        vehicle:  { select: { id: true, plate: true, name: true } },
        fuelType: { select: { unit: true } },
      },
    });

    const byVehicle: Record<string, { vehicleId: string; plate: string; totalLiters: number; totalCost: number; loads: number }> = {};

    for (const l of loads) {
      const key = l.vehicleId;
      if (!byVehicle[key]) {
        byVehicle[key] = { vehicleId: key, plate: l.vehicle.plate, totalLiters: 0, totalCost: 0, loads: 0 };
      }
      byVehicle[key].totalLiters += Number(l.litersOrKwh);
      byVehicle[key].totalCost   += Number(l.priceTotal ?? 0);
      byVehicle[key].loads       += 1;
    }

    const totalCost   = loads.reduce((s, l) => s + Number(l.priceTotal ?? 0), 0);
    const totalLiters = loads.reduce((s, l) => s + Number(l.litersOrKwh), 0);

    // Separate fuel (litros) vs electric (kwh)
    const fuelLoads = loads.filter((l) => l.fuelType?.unit !== 'kwh');
    const elecLoads = loads.filter((l) => l.fuelType?.unit === 'kwh');

    const totalLitersFuel = fuelLoads.reduce((s, l) => s + Number(l.litersOrKwh), 0);
    const totalKwhElec    = elecLoads.reduce((s, l) => s + Number(l.litersOrKwh), 0);

    const fuelLoadsWithKm = fuelLoads.filter((l) => l.kmPerUnit);
    const elecLoadsWithKm = elecLoads.filter((l) => l.kmPerUnit);
    const allLoadsWithKm  = loads.filter((l) => l.kmPerUnit);

    const avgKmPerLiter = allLoadsWithKm.length
      ? allLoadsWithKm.reduce((s, l) => s + Number(l.kmPerUnit), 0) / allLoadsWithKm.length
      : 0;

    const avgKmPerLiterFuel = fuelLoadsWithKm.length
      ? fuelLoadsWithKm.reduce((s, l) => s + Number(l.kmPerUnit), 0) / fuelLoadsWithKm.length
      : 0;

    const avgKmPerKwhElec = elecLoadsWithKm.length
      ? elecLoadsWithKm.reduce((s, l) => s + Number(l.kmPerUnit), 0) / elecLoadsWithKm.length
      : 0;

    return {
      totalCost,
      totalLiters,
      totalLitersFuel,
      totalKwhElec,
      loadsCount:       loads.length,
      avgKmPerLiter,
      avgKmPerLiterFuel,
      avgKmPerKwhElec,
      costByVehicle:    Object.values(byVehicle),
      monthlyTrend:     [],
    };
  }

  async update(id: string, companyId: string, data: z.infer<typeof updateFuelLoadSchema>) {
    const record = await prisma.fuelLoad.findFirst({ where: { id, companyId } });
    if (!record) throw new Error('Carga no encontrada');

    // Recalcular kmPerUnit si se actualiza odómetro o litros
    let kmPerUnit: number | null | undefined = undefined;
    if (data.odometer !== undefined || data.litersOrKwh !== undefined) {
      const finalOdometer = data.odometer ?? record.odometer;
      const finalLiters   = data.litersOrKwh ?? record.litersOrKwh;
      const finalDate     = data.date ? new Date(data.date) : record.date;
      const finalVehicle  = data.vehicleId ?? record.vehicleId;

      if (finalOdometer) {
        kmPerUnit = await this.calculateKmPerUnit(
          finalVehicle,
          finalOdometer,
          Number(finalLiters),
          finalDate,
          companyId,
        );
      }
    }

    return prisma.fuelLoad.update({
      where: { id },
      data: {
        vehicleId:   data.vehicleId,
        driverId:    data.driverId,
        fuelTypeId:  data.fuelTypeId,
        date:        data.date ? new Date(data.date) : undefined,
        litersOrKwh: data.litersOrKwh,
        unitPrice:   data.unitPrice,
        priceTotal:  data.priceTotal,
        odometer:    data.odometer,
        station:     data.station,
        notes:       data.notes,
        ...(kmPerUnit !== undefined ? { kmPerUnit } : {}),
      },
      include: { vehicle: true, driver: true, fuelType: true },
    });
  }

  /**
   * Recalcula el campo kmPerUnit para todas las cargas de una empresa
   * que tienen odómetro pero kmPerUnit = null
   */
  async recalculateAllKmPerUnit(companyId: string) {
    const loads = await prisma.fuelLoad.findMany({
      where: {
        companyId,
        odometer: { not: null },
      },
      orderBy: [{ vehicleId: 'asc' }, { odometer: 'asc' }],
      select: { id: true, vehicleId: true, odometer: true, litersOrKwh: true, date: true },
    });

    let updated = 0;
    for (const load of loads) {
      if (!load.odometer) continue;

      const kmPerUnit = await this.calculateKmPerUnit(
        load.vehicleId,
        load.odometer,
        Number(load.litersOrKwh),
        load.date,
        companyId,
      );

      if (kmPerUnit !== null) {
        await prisma.fuelLoad.update({
          where: { id: load.id },
          data:  { kmPerUnit },
        });
        updated++;
      }
    }

    return { message: `Recalculados ${updated} registros de ${loads.length}`, updated, total: loads.length };
  }

  async getCatalogs() {
    const fuelTypes = await prisma.fuelType.findMany({
      where:   { active: true },
      orderBy: { id: 'asc' },
      select:  { id: true, name: true, unit: true },
    });
    return { fuelTypes };
  }
}
