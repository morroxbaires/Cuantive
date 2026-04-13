/**
 * Seed de datos para bri@gmail.com / Brian SAS
 * Genera: 20 vehículos, 20 choferes, 20 repostajes, 10 mantenimientos, 10 siniestros
 * Todos los registros con fechas en marzo 2026
 */
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma   = new PrismaClient();
const COMPANY  = 'af0cf5f5-3171-4732-a515-771c9631929d';

// fuelTypeId: Gasoil=1 | Eléctrico=5 | Nafta=7
// vehicleTypeId: Automóvil=1 | Camioneta=2 | Camión=4 | Taxi=17

function d(day: number, hour = 10, min = 0): Date {
  return new Date(2026, 2, day, hour, min, 0);
}

// ─── DATA DEFINITIONS ─────────────────────────────────────────────────────────

const VEHICLES = [
  { plate: 'MNB0412', name: 'Hilux 1',       brand: 'Toyota',         model: 'Hilux',     year: 2019, vt: 2,  ft: 1, color: 'Blanco',   odo: 87500,  ref: 12.5 },
  { plate: 'LPQ7823', name: 'Amarok 1',      brand: 'Volkswagen',     model: 'Amarok',    year: 2021, vt: 2,  ft: 1, color: 'Negro',    odo: 52300,  ref: 13.0 },
  { plate: 'MRC3156', name: 'Ranger 1',      brand: 'Ford',           model: 'Ranger',    year: 2020, vt: 2,  ft: 1, color: 'Gris',     odo: 71000,  ref: 11.8 },
  { plate: 'RCP5501', name: 'S10 1',         brand: 'Chevrolet',      model: 'S10',       year: 2018, vt: 2,  ft: 1, color: 'Blanco',   odo: 115000, ref: 11.5 },
  { plate: 'SFO2291', name: 'Corolla 1',     brand: 'Toyota',         model: 'Corolla',   year: 2022, vt: 1,  ft: 7, color: 'Plata',    odo: 28400,  ref: 14.2 },
  { plate: 'TLM8834', name: 'Gol 1',         brand: 'Volkswagen',     model: 'Gol',       year: 2017, vt: 1,  ft: 7, color: 'Rojo',     odo: 134000, ref: 13.0 },
  { plate: 'UNP6621', name: 'Sandero 1',     brand: 'Renault',        model: 'Sandero',   year: 2019, vt: 1,  ft: 7, color: 'Azul',     odo: 68000,  ref: 12.5 },
  { plate: 'VBH9943', name: 'Cronos 1',      brand: 'Fiat',           model: 'Cronos',    year: 2021, vt: 1,  ft: 7, color: 'Blanco',   odo: 41200,  ref: 13.8 },
  { plate: 'WCK1174', name: 'Etios Taxi',    brand: 'Toyota',         model: 'Etios',     year: 2018, vt: 17, ft: 1, color: 'Amarillo', odo: 195000, ref: 15.0 },
  { plate: 'XDL4485', name: 'Voyage Taxi',   brand: 'Volkswagen',     model: 'Voyage',    year: 2019, vt: 17, ft: 1, color: 'Amarillo', odo: 162000, ref: 14.5 },
  { plate: 'YEM7796', name: 'Onix Taxi',     brand: 'Chevrolet',      model: 'Onix',      year: 2020, vt: 17, ft: 7, color: 'Amarillo', odo: 89000,  ref: 13.0 },
  { plate: 'ZFN2207', name: 'Fluence Taxi',  brand: 'Renault',        model: 'Fluence',   year: 2017, vt: 17, ft: 1, color: 'Amarillo', odo: 211000, ref: 14.0 },
  { plate: 'AGO5518', name: 'Dolphin 1',     brand: 'BYD',            model: 'Dolphin',   year: 2023, vt: 1,  ft: 5, color: 'Azul',     odo: 18000,  ref: 6.0  },
  { plate: 'BHP8829', name: 'Frontier 1',    brand: 'Nissan',         model: 'Frontier',  year: 2020, vt: 2,  ft: 1, color: 'Gris',     odo: 76500,  ref: 12.0 },
  { plate: 'CIQ1130', name: 'Sprinter 1',    brand: 'Mercedes-Benz',  model: 'Sprinter',  year: 2018, vt: 4,  ft: 1, color: 'Blanco',   odo: 243000, ref: 9.0  },
  { plate: 'DJR4441', name: 'Daily 1',       brand: 'Iveco',          model: 'Daily',     year: 2019, vt: 4,  ft: 1, color: 'Blanco',   odo: 187000, ref: 9.5  },
  { plate: 'EKS7752', name: 'Transit 1',     brand: 'Ford',           model: 'Transit',   year: 2021, vt: 4,  ft: 1, color: 'Blanco',   odo: 63000,  ref: 10.5 },
  { plate: 'FLT1063', name: 'Peugeot 408',   brand: 'Peugeot',        model: '408',       year: 2020, vt: 1,  ft: 7, color: 'Gris',     odo: 57800,  ref: 12.8 },
  { plate: 'GML4374', name: 'Civic 1',       brand: 'Honda',          model: 'Civic',     year: 2022, vt: 1,  ft: 7, color: 'Negro',    odo: 22100,  ref: 14.5 },
  { plate: 'HNM7685', name: 'Kwid 1',        brand: 'Renault',        model: 'Kwid',      year: 2021, vt: 1,  ft: 7, color: 'Rojo',     odo: 44500,  ref: 13.5 },
];

const DRIVERS = [
  { name: 'Juan',      lastname: 'González',   doc: '31874521', lic: 'B', phone: '091234567', expiry: '2027-06-15' },
  { name: 'Carlos',    lastname: 'Rodríguez',  doc: '34956207', lic: 'B', phone: '092345678', expiry: '2026-11-20' },
  { name: 'Diego',     lastname: 'López',      doc: '56781023', lic: 'B', phone: '093456789', expiry: '2027-03-10' },
  { name: 'Miguel',    lastname: 'García',     doc: '78902341', lic: 'C', phone: '094567890', expiry: '2026-08-05' },
  { name: 'Roberto',   lastname: 'Martínez',   doc: '90123456', lic: 'B', phone: '095678901', expiry: '2027-01-22' },
  { name: 'Santiago',  lastname: 'Pérez',      doc: '21345678', lic: 'B', phone: '096789012', expiry: '2026-09-30' },
  { name: 'Marcelo',   lastname: 'Fernández',  doc: '43567890', lic: 'C', phone: '097890123', expiry: '2027-07-14' },
  { name: 'Pablo',     lastname: 'Gómez',      doc: '65789012', lic: 'B', phone: '098901234', expiry: '2026-12-08' },
  { name: 'Lucas',     lastname: 'Díaz',       doc: '87901234', lic: 'B', phone: '091012345', expiry: '2027-04-25' },
  { name: 'Andrés',    lastname: 'Torres',     doc: '19234567', lic: 'B', phone: '092123456', expiry: '2026-07-17' },
  { name: 'Federico',  lastname: 'Sánchez',    doc: '31456789', lic: 'B', phone: '093234567', expiry: '2027-10-02' },
  { name: 'Martín',    lastname: 'Álvarez',    doc: '53678901', lic: 'C', phone: '094345678', expiry: '2026-05-28' },
  { name: 'Javier',    lastname: 'Ramírez',    doc: '75890123', lic: 'B', phone: '095456789', expiry: '2027-02-11' },
  { name: 'Fernando',  lastname: 'Núñez',      doc: '97012345', lic: 'D', phone: '096567890', expiry: '2026-10-19' },
  { name: 'Gustavo',   lastname: 'Vega',       doc: '28234567', lic: 'B', phone: '097678901', expiry: '2027-08-06' },
  { name: 'Ricardo',   lastname: 'Castro',     doc: '40456789', lic: 'B', phone: '098789012', expiry: '2026-06-23' },
  { name: 'Eduardo',   lastname: 'Rojas',      doc: '62678901', lic: 'C', phone: '091890123', expiry: '2027-12-15' },
  { name: 'Héctor',    lastname: 'Morales',    doc: '84890123', lic: 'B', phone: '092901234', expiry: '2026-04-07' },
  { name: 'Damián',    lastname: 'Ortega',     doc: '16012345', lic: 'B', phone: '093012345', expiry: '2027-05-20' },
  { name: 'Nicolás',   lastname: 'Herrera',    doc: '38234567', lic: 'B', phone: '094123456', expiry: '2025-02-14' }, // licencia vencida
];

const FUEL_LOADS = [
  { vi: 0,  day:  3, qty: 65.0,  unitPrice: 1.92, odo: 87650,  station: 'ANCAP Norte',                 kmPerUnit: 2.31 },
  { vi: 1,  day:  5, qty: 70.5,  unitPrice: 1.89, odo: 52450,  station: 'PETROBRAS Rambla',            kmPerUnit: 2.13 },
  { vi: 2,  day:  6, qty: 58.0,  unitPrice: 1.93, odo: 71180,  station: 'SHELL Paso Carrasco',         kmPerUnit: 3.10 },
  { vi: 3,  day:  7, qty: 72.0,  unitPrice: 1.88, odo: 115280, station: 'YPF Pocitos',                 kmPerUnit: 3.89 },
  { vi: 4,  day:  8, qty: 45.0,  unitPrice: 2.18, odo: 28520,  station: 'ANCAP Tres Cruces',           kmPerUnit: 2.67 },
  { vi: 5,  day:  9, qty: 50.0,  unitPrice: 2.15, odo: 134250, station: 'PETROBRAS Ciudad Vieja',      kmPerUnit: 5.00 },
  { vi: 6,  day: 10, qty: 42.0,  unitPrice: 2.21, odo: 68160,  station: 'SHELL Malvín',               kmPerUnit: 3.81 },
  { vi: 7,  day: 11, qty: 38.5,  unitPrice: 2.19, odo: 41320,  station: 'ANCAP Carrasco',              kmPerUnit: 3.12 },
  { vi: 8,  day: 12, qty: 55.0,  unitPrice: 1.91, odo: 195220, station: 'ANCAP Norte',                 kmPerUnit: 4.00 },
  { vi: 9,  day: 13, qty: 60.0,  unitPrice: 1.90, odo: 162180, station: 'PETROBRAS Rambla',            kmPerUnit: 3.00 },
  { vi: 10, day: 14, qty: 48.0,  unitPrice: 2.17, odo: 89150,  station: 'SHELL Paso Carrasco',         kmPerUnit: 3.13 },
  { vi: 11, day: 15, qty: 62.0,  unitPrice: 1.91, odo: 211200, station: 'YPF Pocitos',                 kmPerUnit: 3.23 },
  { vi: 12, day: 16, qty: 55.0,  unitPrice: 0.19, odo: 18110,  station: 'Electrolinera UTE Pocitos',   kmPerUnit: 2.00 },
  { vi: 13, day: 17, qty: 68.0,  unitPrice: 1.90, odo: 76680,  station: 'ANCAP Tres Cruces',           kmPerUnit: 2.65 },
  { vi: 14, day: 18, qty: 80.0,  unitPrice: 1.89, odo: 243200, station: 'PETROBRAS Ciudad Vieja',      kmPerUnit: 2.50 },
  { vi: 15, day: 19, qty: 75.0,  unitPrice: 1.88, odo: 187150, station: 'SHELL Malvín',               kmPerUnit: 2.00 },
  { vi: 16, day: 20, qty: 78.0,  unitPrice: 1.92, odo: 63150,  station: 'ANCAP Carrasco',              kmPerUnit: 1.92 },
  { vi: 17, day: 21, qty: 43.0,  unitPrice: 2.20, odo: 57930,  station: 'ANCAP Norte',                 kmPerUnit: 3.02 },
  { vi: 18, day: 22, qty: 36.0,  unitPrice: 2.23, odo: 22250,  station: 'PETROBRAS Rambla',            kmPerUnit: 4.17 },
  { vi: 19, day: 23, qty: 40.0,  unitPrice: 2.16, odo: 44620,  station: 'SHELL Paso Carrasco',         kmPerUnit: 3.00 },
];

const MAINTENANCES = [
  { vi: 0,  day:  4, type: 'preventivo', desc: 'Cambio de aceite y filtros',                  odo: 87600,  cost: 185.00,  nextOdo: 97600,  nextDate: '2026-09-04', workshop: 'Taller Central Toyota',           notes: 'Aceite 5W40 sintético' },
  { vi: 1,  day:  6, type: 'preventivo', desc: 'Revisión de frenos y pastillas',               odo: 52350,  cost: 320.00,  nextOdo: 72350,  nextDate: '2026-09-06', workshop: 'AutoFreno Montevideo',            notes: 'Pastillas delanteras y traseras sustituidas' },
  { vi: 2,  day:  8, type: 'correctivo', desc: 'Reparación de suspensión delantera',           odo: 71050,  cost: 890.00,  nextOdo: null,   nextDate: null,         workshop: 'Mecánica Rangers SRL',            notes: 'Amortiguadores y bujes delanteros reemplazados' },
  { vi: 3,  day: 10, type: 'preventivo', desc: 'Rotación y equilibrado de neumáticos',         odo: 115100, cost:  95.00,  nextOdo: 135100, nextDate: '2026-09-10', workshop: 'Neumáticos del Sur',              notes: null },
  { vi: 4,  day: 11, type: 'preventivo', desc: 'Cambio de aceite y filtro de aire',            odo: 28450,  cost: 145.00,  nextOdo: 38450,  nextDate: '2026-09-11', workshop: 'Toyota Service Center',           notes: 'Primer servicio — aceite 0W20' },
  { vi: 5,  day: 13, type: 'correctivo', desc: 'Reparación de alternador',                     odo: 134100, cost: 650.00,  nextOdo: null,   nextDate: null,         workshop: 'Electricidad Automotriz Norte',   notes: 'Alternador reconstruido en taller' },
  { vi: 6,  day: 15, type: 'preventivo', desc: 'Cambio de correa de distribución',             odo: 68050,  cost: 480.00,  nextOdo: 118050, nextDate: '2026-09-15', workshop: 'Renault Service Oficial',         notes: 'Kit completo correa + tensor + polea' },
  { vi: 7,  day: 17, type: 'preventivo', desc: 'Alineación y balanceo',                        odo: 41250,  cost:  75.00,  nextOdo: 61250,  nextDate: '2026-09-17', workshop: 'Neumáticos del Sur',              notes: null },
  { vi: 8,  day: 19, type: 'preventivo', desc: 'Cambio de aceite, filtros y bujías de encendido', odo: 195070, cost: 210.00, nextOdo: 205070, nextDate: '2026-09-19', workshop: 'Taller Central Toyota', notes: 'Mantenimiento preventivo 195.000 km' },
  { vi: 9,  day: 21, type: 'correctivo', desc: 'Limpieza y calibración de inyectores',         odo: 162100, cost: 1150.00, nextOdo: null,   nextDate: null,         workshop: 'Diesel Tech Uruguay',            notes: 'Inyectores desmontados y calibrados en banco' },
];

const SINIESTROS = [
  { vi: 10, di: 10, day:  2, h:  7, m: 45, obs: 'Colisión leve por detrás en semáforo en Av. 18 de Julio. Daños en paragolpe trasero y sensor de estacionamiento.',     cost: 850.00   },
  { vi: 11, di: 11, day:  5, h: 14, m: 20, obs: 'Impacto lateral en estacionamiento de shopping. Abolladuras y rayones profundos en puerta del conductor.',               cost: 1200.00  },
  { vi: 12, di: 12, day:  7, h:  9, m: 10, obs: 'Choque menor con barrera de mediana en maniobra de ingreso a depósito. Daño en paragolpe delantero.',                   cost: 650.00   },
  { vi: 13, di: 13, day:  9, h: 18, m: 30, obs: 'Pérdida de control en curva bajo lluvia. Volcadura parcial. Daños en techo, pilares y paneles laterales.',               cost: 4800.00  },
  { vi: 14, di: 14, day: 11, h: 11, m: 55, obs: 'Colisión frontal leve en intersección sin semáforo. Daños en capó, faro izquierdo y parrilla delantera.',                cost: 2300.00  },
  { vi: 15, di: 15, day: 14, h: 16, m: 40, obs: 'Rotura de parabrisas por impacto de piedra proyectada por camión en Ruta 1. Vidrio frontal con fractura total.',         cost: 320.00   },
  { vi: 16, di: 16, day: 17, h:  8, m:  5, obs: 'Golpe en maniobra de retroceso contra plataforma logística. Paragolpe trasero deformado y portalón doblado.',            cost: 580.00   },
  { vi: 17, di: 17, day: 19, h: 12, m: 15, obs: 'Vandalismo nocturno: rayones profundos en ambos costados del vehículo y espejo retrovisor derecho roto.',                cost: 450.00   },
  { vi: 18, di: 18, day: 21, h: 20, m:  0, obs: 'Golpe en espejo retrovisor derecho al pasar por angostura en obra de construcción. Espejo roto y soporte doblado.',     cost: 185.00   },
  { vi: 19, di: 19, day: 23, h: 15, m: 30, obs: 'Colisión múltiple en Av. Italia. Daños en paragolpe delantero, guardabarro izquierdo y faro antiniebla.',               cost: 1750.00  },
];

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Generando datos demo para Brian SAS (bri@gmail.com)...\n');

  // ── Vehículos ──────────────────────────────────────────────────────────────
  const vehicleIds: string[] = [];
  for (const v of VEHICLES) {
    const id = uuidv4();
    vehicleIds.push(id);
    await prisma.vehicle.create({
      data: {
        id,
        companyId:           COMPANY,
        plate:               v.plate,
        name:                v.name,
        brand:               v.brand,
        model:               v.model,
        year:                v.year,
        vehicleTypeId:       v.vt,
        fuelTypeId:          v.ft,
        color:               v.color,
        currentOdometer:     v.odo,
        efficiencyReference: v.ref,
        active:              true,
        createdAt:           d(1),
        updatedAt:           d(1),
      },
    });
  }
  console.log(`✅ ${vehicleIds.length} vehículos creados`);

  // ── Choferes ───────────────────────────────────────────────────────────────
  const driverIds: string[] = [];
  for (const dr of DRIVERS) {
    const id = uuidv4();
    driverIds.push(id);
    await prisma.driver.create({
      data: {
        id,
        companyId:       COMPANY,
        name:            dr.name,
        lastname:        dr.lastname,
        document:        dr.doc,
        licenseCategory: dr.lic,
        licenseExpiry:   new Date(dr.expiry),
        phone:           dr.phone,
        active:          true,
        createdAt:       d(1),
        updatedAt:       d(1),
      },
    });
  }
  console.log(`✅ ${driverIds.length} choferes creados`);

  // ── Asignaciones vehículo–chofer ───────────────────────────────────────────
  for (let i = 0; i < 20; i++) {
    await prisma.vehicleDriver.create({
      data: {
        vehicleId:  vehicleIds[i],
        driverId:   driverIds[i],
        assignedAt: d(1),
      },
    });
  }
  console.log('✅ 20 asignaciones vehículo–chofer creadas');

  // ── Repostajes ─────────────────────────────────────────────────────────────
  for (const fl of FUEL_LOADS) {
    const v = VEHICLES[fl.vi];
    await prisma.fuelLoad.create({
      data: {
        id:           uuidv4(),
        companyId:    COMPANY,
        vehicleId:    vehicleIds[fl.vi],
        driverId:     driverIds[fl.vi],
        fuelTypeId:   v.ft,
        date:         d(fl.day, 8, 30),
        litersOrKwh:  fl.qty,
        unitPrice:    fl.unitPrice,
        priceTotal:   parseFloat((fl.qty * fl.unitPrice).toFixed(2)),
        odometer:     fl.odo,
        kmPerUnit:    fl.kmPerUnit,
        station:      fl.station,
        notes:        null,
      },
    });
  }
  console.log('✅ 20 repostajes creados');

  // ── Mantenimientos ─────────────────────────────────────────────────────────
  for (const m of MAINTENANCES) {
    await prisma.maintenance.create({
      data: {
        id:           uuidv4(),
        companyId:    COMPANY,
        vehicleId:    vehicleIds[m.vi],
        type:         m.type,
        status:       'completed',
        description:  m.desc,
        date:         d(m.day),
        odometer:     m.odo,
        cost:         m.cost,
        nextOdometer: m.nextOdo ?? undefined,
        nextDate:     m.nextDate ? new Date(m.nextDate) : undefined,
        workshopName: m.workshop,
        notes:        m.notes ?? undefined,
      },
    });
  }
  console.log('✅ 10 mantenimientos creados');

  // ── Siniestros ─────────────────────────────────────────────────────────────
  for (const s of SINIESTROS) {
    await prisma.siniestro.create({
      data: {
        id:            uuidv4(),
        companyId:     COMPANY,
        vehicleId:     vehicleIds[s.vi],
        driverId:      driverIds[s.di],
        fecha:         d(s.day),
        hora:          d(s.day, s.h, s.m),
        observaciones: s.obs,
        costo:         s.cost,
      },
    });
  }
  console.log('✅ 10 siniestros creados');

  console.log('\n🎉 Seed completado para Brian SAS (bri@gmail.com)');
  console.log('   20 vehículos · 20 choferes · 20 repostajes · 10 mantenimientos · 10 siniestros');
  console.log('   Todos los registros con fechas en marzo 2026');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
