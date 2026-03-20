import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const sql = fs.readFileSync(
    path.join(__dirname, 'migrations/005_settings_gasoil_price.sql'),
    'utf-8',
  );
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log('✅ Columna gasoil_price agregada a settings');
  } catch (e: any) {
    // MySQL error 1060 = column already exists — safe to skip
    if (e?.meta?.code === '1060' || String(e?.message).includes('Duplicate column')) {
      console.log('ℹ️  Columna gasoil_price ya existe, saltando');
    } else {
      throw e;
    }
  }
  console.log('🎉 Migración completada');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
