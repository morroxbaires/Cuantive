import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const COMPANY_ID = 'af0cf5f5-3171-4732-a515-771c9631929d';

async function main() {
  const [vehicles, drivers, fuelLoads, maintenances, siniestros] = await Promise.all([
    prisma.vehicle.count({ where: { companyId: COMPANY_ID } }),
    prisma.driver.count({ where: { companyId: COMPANY_ID } }),
    prisma.fuelLoad.count({ where: { companyId: COMPANY_ID } }),
    prisma.maintenance.count({ where: { companyId: COMPANY_ID } }),
    prisma.siniestro.count({ where: { companyId: COMPANY_ID } }),
  ]);
  console.log({ vehicles, drivers, fuelLoads, maintenances, siniestros });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
