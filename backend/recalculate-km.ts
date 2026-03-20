/**
 * Script para recalcular kmPerUnit de todas las cargas existentes
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function calculateKmPerUnit(
  vehicleId: string,
  currentOdometer: number,
  currentLiters: number,
  companyId: string,
): Promise<number | null> {
  const previousLoad = await prisma.fuelLoad.findFirst({
    where: {
      companyId,
      vehicleId,
      odometer: { lt: currentOdometer, not: null },
    },
    orderBy: { odometer: 'desc' },
    select: { odometer: true },
  });

  if (!previousLoad?.odometer) return null;

  const kmTraveled = currentOdometer - previousLoad.odometer;
  if (kmTraveled <= 0) return null;

  return kmTraveled / currentLiters;
}

async function main() {
  console.log('🔄 Recalculando kmPerUnit para todas las cargas...\n');

  const loads = await prisma.fuelLoad.findMany({
    where: {
      odometer: { not: null },
    },
    orderBy: [{ vehicleId: 'asc' }, { odometer: 'asc' }],
    select: {
      id: true,
      companyId: true,
      vehicleId: true,
      odometer: true,
      litersOrKwh: true,
      date: true,
      vehicle: { select: { plate: true } },
    },
  });

  console.log(`📊 Total de cargas con odómetro: ${loads.length}\n`);

  let updated = 0;
  for (const load of loads) {
    if (!load.odometer) continue;

    const kmPerUnit = await calculateKmPerUnit(
      load.vehicleId,
      load.odometer,
      Number(load.litersOrKwh),
      load.companyId,
    );

    if (kmPerUnit !== null) {
      await prisma.fuelLoad.update({
        where: { id: load.id },
        data: { kmPerUnit },
      });
      console.log(`✅ ${load.vehicle.plate} - Odómetro: ${load.odometer} → ${kmPerUnit.toFixed(2)} km/L`);
      updated++;
    } else {
      console.log(`⚠️  ${load.vehicle.plate} - Odómetro: ${load.odometer} → Sin carga previa, no se puede calcular`);
    }
  }

  console.log(`\n✨ Recalculados ${updated} registros de ${loads.length} totales`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
