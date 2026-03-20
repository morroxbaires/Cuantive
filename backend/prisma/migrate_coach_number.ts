/**
 * migrate_coach_number.ts
 * Agrega coach_number a vehicles e inserta Taxi en vehicle_types.
 * Run: npx ts-node prisma/migrate_coach_number.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Agregar columna coach_number si no existe
  const cols = await prisma.$queryRawUnsafe<{ Field: string }[]>(
    "SHOW COLUMNS FROM `vehicles` LIKE 'coach_number'",
  );
  if (cols.length === 0) {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `vehicles` ADD COLUMN `coach_number` VARCHAR(20) NULL AFTER `color`",
    );
    console.log('✅ Columna coach_number agregada a vehicles');
  } else {
    console.log('ℹ️  Columna coach_number ya existe, sin cambios');
  }

  // 2. Insertar Taxi en vehicle_types si no existe
  const taxi = await prisma.vehicleType.findFirst({ where: { name: 'Taxi' } });
  if (!taxi) {
    await prisma.vehicleType.create({ data: { name: 'Taxi', active: true } });
    console.log('✅ Tipo de vehículo Taxi insertado');
  } else {
    console.log('ℹ️  Tipo Taxi ya existe (id=' + taxi.id + '), sin cambios');
  }

  console.log('🎉 Migración completada');
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
