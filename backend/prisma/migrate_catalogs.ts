import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  // ── Fuel types: keep only Nafta, Gasoil, Eléctrico ──────────────────────
  await prisma.fuelType.updateMany({
    where: { name: { in: ['Súper 95', 'Súper 98', 'GNC', 'Diesel'] } },
    data:  { active: false },
  });
  await prisma.fuelType.upsert({
    where:  { name: 'Nafta' },
    create: { name: 'Nafta', unit: 'litros', active: true },
    update: { active: true },
  });
  await prisma.fuelType.updateMany({
    where: { name: { in: ['Gasoil', 'Eléctrico'] } },
    data:  { active: true },
  });

  // ── Vehicle types: keep only Taxi, Automóvil, Camión, Camioneta ──────────
  await prisma.vehicleType.updateMany({
    where: { name: { in: ['Furgón', 'Bus / Ómnibus', 'Moto', 'Vehículo Eléctrico', 'Maquinaria'] } },
    data:  { active: false },
  });
  for (const name of ['Taxi', 'Automóvil', 'Camión', 'Camioneta']) {
    await prisma.vehicleType.upsert({
      where:  { name },
      create: { name, active: true },
      update: { active: true },
    });
  }

  const fuelTypes    = await prisma.fuelType.findMany({ where: { active: true } });
  const vehicleTypes = await prisma.vehicleType.findMany({ where: { active: true } });

  console.log('✅ Combustibles activos:', fuelTypes.map((f) => f.name).join(', '));
  console.log('✅ Tipos de vehículo activos:', vehicleTypes.map((v) => v.name).join(', '));
  await prisma.$disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
