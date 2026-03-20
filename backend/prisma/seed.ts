import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Ejecutando seed...');

  // Catálogo de tipos de combustible
  await prisma.fuelType.createMany({
    skipDuplicates: true,
    data: [
      { name: 'Nafta',     unit: 'litros' },
      { name: 'Gasoil',    unit: 'litros' },
      { name: 'Eléctrico', unit: 'kwh'    },
    ],
  });
  // Desactivar tipos obsoletos
  await prisma.fuelType.updateMany({
    where: { name: { in: ['Súper 95', 'Súper 98', 'GNC', 'Diesel'] } },
    data:  { active: false },
  });

  // Catálogo de tipos de vehículo
  await prisma.vehicleType.createMany({
    skipDuplicates: true,
    data: [
      { name: 'Taxi'      },
      { name: 'Automóvil' },
      { name: 'Camión'    },
      { name: 'Camioneta' },
    ],
  });
  // Desactivar tipos obsoletos
  await prisma.vehicleType.updateMany({
    where: { name: { in: ['Furgón', 'Bus / Ómnibus', 'Moto', 'Vehículo Eléctrico', 'Maquinaria'] } },
    data:  { active: false },
  });

  // Usuario superroot — upsert so credentials can be updated
  const superrootHash = await bcrypt.hash('asdasdasd', 12);
  await prisma.user.upsert({
    where:  { email: 'bverdier@gmail.com' },
    update: { passwordHash: superrootHash, name: 'Brian Verdier', role: 'superroot' },
    create: {
      id:           uuidv4(),
      name:         'Brian Verdier',
      email:        'bverdier@gmail.com',
      passwordHash: superrootHash,
      role:         'superroot',
      companyId:    null,
    },
  });
  // Update old superroot email if it exists
  await prisma.user.updateMany({
    where: { email: 'superroot@cuantive.com' },
    data:  { email: 'bverdier@gmail.com', passwordHash: superrootHash, name: 'Brian Verdier' },
  }).catch(() => {});
  console.log('✅ Superroot: bverdier@gmail.com / asdasdasd');

  console.log('✅ Seed completado.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
