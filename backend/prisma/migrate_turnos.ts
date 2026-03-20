/**
 * migrate_turnos.ts
 * Crea la tabla `turnos` si no existe.
 * Run: npx ts-node prisma/migrate_turnos.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
    "SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'turnos'",
  );
  if (rows[0].cnt > 0) {
    console.log('ℹ️  Tabla turnos ya existe, sin cambios');
    return;
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE turnos (
      id              CHAR(36)      NOT NULL,
      company_id      CHAR(36)      NOT NULL,
      vehicle_id      CHAR(36)      NOT NULL,
      driver_id       CHAR(36)      NOT NULL,
      shift_date      DATE          NOT NULL,
      shift_number    INT           NOT NULL,
      total_fichas    DECIMAL(10,2) NOT NULL DEFAULT 0,
      km_ocupados     DECIMAL(10,2) NOT NULL DEFAULT 0,
      km_libres       DECIMAL(10,2) NOT NULL DEFAULT 0,
      km_totales      DECIMAL(10,2) NOT NULL DEFAULT 0,
      notes           TEXT              NULL,
      created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      PRIMARY KEY (id),
      KEY idx_turnos_company_date (company_id, shift_date),
      KEY idx_turnos_vehicle_id   (vehicle_id),
      KEY idx_turnos_driver_id    (driver_id),

      CONSTRAINT fk_turnos_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT fk_turnos_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles (id)  ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT fk_turnos_driver  FOREIGN KEY (driver_id)  REFERENCES drivers (id)   ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('✅ Tabla turnos creada');
  console.log('🎉 Migración completada');
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
