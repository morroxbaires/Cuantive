/**
 * Cuantive — Reports Service
 * Genera PDFs con PDFKit para los 4 tipos de reporte de flota.
 */
import { PrismaClient }  from '@prisma/client';
import PDFDocument        from 'pdfkit';
import { Response }       from 'express';
import path               from 'path';
import fs                 from 'fs';
import { env }            from '../../config/env';

const prisma = new PrismaClient();

// ─── Constantes de diseño ────────────────────────────────────────────────────

const C = {
  primary:   '#1E40AF',   // azul oscuro
  secondary: '#3B82F6',   // azul medio
  dark:      '#1E293B',   // slate-800
  mid:       '#475569',   // slate-600
  light:     '#94A3B8',   // slate-400
  line:      '#E2E8F0',   // slate-200
  rowEven:   '#EFF6FF',   // azul muy pálido
  white:     '#FFFFFF',
  success:   '#166534',
  danger:    '#991B1B',
};

const PAGE = {
  margin:   40,
  width:    595.28,   // A4
  height:   841.89,
  get contentW() { return this.width - this.margin * 2; },
};

// ─── Utilidades de formato ───────────────────────────────────────────────────

function fmt(amount: number | null | undefined): string {
  if (amount == null) return '$0';
  return new Intl.NumberFormat('es-CL', {
    style:                 'currency',
    currency:              'CLP',
    minimumFractionDigits: 0,
  }).format(Math.round(amount));
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function fmtNum(n: number | null | undefined, decimals = 2): string {
  if (n == null || isNaN(n)) return '—';
  return n.toFixed(decimals);
}

// ─── Helpers de PDF ──────────────────────────────────────────────────────────

/** Crea el doc, setea cabeceras HTTP y lo piped a res. */
function preparePdf(res: Response, filename: string): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: PAGE.margin, bufferPages: true });
  res.setHeader('Content-Type',        'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control',       'no-store');
  doc.pipe(res);
  return doc;
}

/** Resuelve la ruta absoluta del logo de la empresa en disco. */
function resolveLogoPath(logo: string | null | undefined): string | null {
  if (!logo) return null;
  const abs = path.resolve(env.UPLOAD_DIR, logo);
  return fs.existsSync(abs) ? abs : null;
}

/** Dibuja la banda de cabecera azul con logo, nombre de empresa y título. */
function drawHeader(
  doc:        PDFKit.PDFDocument,
  company:    string,
  logoPath:   string | null,
  title:      string,
  periodLabel: string,
): void {
  // Banda de fondo azul
  doc.rect(0, 0, PAGE.width, 105).fill(C.primary);

  // Logo
  if (logoPath) {
    try {
      doc.image(logoPath, PAGE.margin, 18, { width: 58, height: 58, fit: [58, 58] });
    } catch { /* ignora si la imagen no puede leerse */ }
  }

  const textX = PAGE.margin + (logoPath ? 72 : 0);
  const textW = PAGE.contentW - (logoPath ? 72 : 0);

  doc
    .fillColor(C.white).font('Helvetica-Bold').fontSize(17)
    .text(company, textX, 22, { width: textW, lineBreak: false });

  doc
    .fillColor('#BFDBFE').font('Helvetica').fontSize(11)
    .text(title, textX, 46, { width: textW });

  doc
    .fillColor('#93C5FD').fontSize(8.5)
    .text(`Período: ${periodLabel}`, textX, 66, { width: textW });

  const now = new Date().toLocaleString('es-CL');
  doc
    .fillColor('#93C5FD').fontSize(7.5)
    .text(`Generado: ${now}`, PAGE.margin, 88, { width: PAGE.contentW, align: 'right' });

  // Dejar cursor debajo de la cabecera
  doc.y = 120;
}

/** Dibuja una banda de título de sección. */
function drawSectionTitle(doc: PDFKit.PDFDocument, text: string): void {
  doc.moveDown(0.4);
  const y = doc.y;
  doc.rect(PAGE.margin, y, PAGE.contentW, 19).fill(C.dark);
  doc
    .fillColor(C.white).font('Helvetica-Bold').fontSize(8.5)
    .text(text.toUpperCase(), PAGE.margin + 8, y + 5, { width: PAGE.contentW - 16, lineBreak: false });
  doc.y = y + 23;
}

interface ColDef {
  header: string;
  key:    string;
  width:  number;
  align?: 'left' | 'right' | 'center';
}

/** Dibuja una tabla completa a partir de definición de columnas + filas. */
function drawTable(
  doc:  PDFKit.PDFDocument,
  cols: ColDef[],
  rows: Record<string, string>[],
): void {
  const m       = PAGE.margin;
  const rowH    = 18;
  const headerH = 22;

  const ensureSpace = (needed: number, y: number): number => {
    if (y + needed > PAGE.height - PAGE.margin - 20) {
      doc.addPage();
      return PAGE.margin + 10;
    }
    return y;
  };

  let y = ensureSpace(headerH + rowH, doc.y + 4);

  // ── Cabecera de la tabla ───────────────────────────────────────────────
  doc.rect(m, y, PAGE.contentW, headerH).fill(C.secondary);
  let x = m;
  cols.forEach(col => {
    doc
      .fillColor(C.white).font('Helvetica-Bold').fontSize(7.5)
      .text(col.header.toUpperCase(), x + 4, y + 7, {
        width:     col.width - 8,
        align:     col.align ?? 'left',
        lineBreak: false,
      });
    x += col.width;
  });
  y += headerH;

  // ── Filas de datos ────────────────────────────────────────────────────
  rows.forEach((row, i) => {
    y = ensureSpace(rowH, y);

    // Fondo alternante
    doc.rect(m, y, PAGE.contentW, rowH).fill(i % 2 === 0 ? C.rowEven : C.white);
    // Línea inferior
    doc.moveTo(m, y + rowH).lineTo(m + PAGE.contentW, y + rowH)
      .strokeColor(C.line).lineWidth(0.4).stroke();

    x = m;
    cols.forEach(col => {
      doc
        .fillColor(C.dark).font('Helvetica').fontSize(7.2)
        .text(String(row[col.key] ?? '—'), x + 4, y + 5, {
          width:     col.width - 8,
          align:     col.align ?? 'left',
          lineBreak: false,
        });
      x += col.width;
    });
    y += rowH;
  });

  doc.y = y + 8;
}

interface TotalItem {
  label:     string;
  value:     string;
  highlight?: boolean;
}

/** Dibuja un cuadro de resumen/totales alineado a la derecha. */
function drawTotalsBox(doc: PDFKit.PDFDocument, totals: TotalItem[]): void {
  const m   = PAGE.margin;
  const bW  = 230;
  const bH  = totals.length * 20 + 30;
  const bX  = m + PAGE.contentW - bW;
  let   bY  = doc.y + 10;

  if (bY + bH > PAGE.height - PAGE.margin) {
    doc.addPage();
    bY = PAGE.margin + 10;
  }

  doc.rect(bX, bY, bW, bH).fill(C.rowEven);
  doc.rect(bX, bY, bW, 20).fill(C.primary);
  doc
    .fillColor(C.white).font('Helvetica-Bold').fontSize(8)
    .text('RESUMEN', bX + 10, bY + 6, { width: bW - 20, lineBreak: false });

  let ty = bY + 26;
  totals.forEach(t => {
    doc
      .fillColor(t.highlight ? C.primary : C.dark)
      .font(t.highlight ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(t.highlight ? 9 : 7.5)
      .text(t.label, bX + 10, ty, { width: 110, lineBreak: false });

    doc
      .fillColor(t.highlight ? C.primary : C.mid)
      .font('Helvetica-Bold')
      .text(t.value, bX + 122, ty, { width: bW - 132, align: 'right', lineBreak: false });

    ty += 20;
  });

  doc.y = ty + 14;
}

/**
 * Gráfico de barras horizontales simple.
 * labels/values deben tener la misma longitud.
 */
function drawBarChart(
  doc:    PDFKit.PDFDocument,
  title:  string,
  labels: string[],
  values: number[],
  unit    = '',
): void {
  if (!values.length || !labels.length) return;

  const m      = PAGE.margin;
  const rowH   = 20;
  const needed = labels.length * rowH + 45;

  if (doc.y + needed > PAGE.height - PAGE.margin) doc.addPage();

  const startY   = doc.y + 8;
  const maxValue = Math.max(...values, 1);
  const barMaxW  = PAGE.contentW - 200;

  doc.fillColor(C.dark).font('Helvetica-Bold').fontSize(9)
    .text(title, m, startY);

  const y0 = startY + 20;
  labels.forEach((label, i) => {
    const val  = values[i] ?? 0;
    const barW = Math.max((val / maxValue) * barMaxW, 2);
    const ry   = y0 + i * rowH;

    doc.fillColor(C.light).font('Helvetica').fontSize(7.5)
      .text(label.length > 16 ? label.slice(0, 15) + '…' : label, m, ry + 4, {
        width: 110, lineBreak: false,
      });

    doc.rect(m + 115, ry + 2, barW, 13).fill(C.secondary);

    doc.fillColor(C.dark).font('Helvetica-Bold').fontSize(7)
      .text(`${fmtNum(val, 0)}${unit}`, m + 115 + barW + 6, ry + 4, { lineBreak: false });
  });

  doc.y = y0 + labels.length * rowH + 10;
}

// ─── Helpers de datos ────────────────────────────────────────────────────────

async function fetchCompany(companyId: string) {
  return prisma.company.findUniqueOrThrow({ where: { id: companyId } });
}

// ─── REPORTE 1: Gastos Mensuales ─────────────────────────────────────────────

export interface MonthlyExpensesOptions {
  year:  number;
  month: number;   // 1–12
}

/**
 * Genera un PDF con el resumen de gastos (combustible + mantenimiento)
 * para todo el mes indicado, agrupado por vehículo.
 *
 * Consultas Prisma:
 *   prisma.fuelLoad.findMany({ where: { companyId, date: { gte, lte } } })
 *   prisma.maintenance.findMany({ where: { companyId, date: { gte, lte } } })
 *
 * Ejemplo de uso:
 *   GET /api/reports/monthly-expenses?year=2026&month=3
 */
export async function generateMonthlyExpensesReport(
  companyId: string,
  opts:      MonthlyExpensesOptions,
  res:       Response,
): Promise<void> {
  const { year, month } = opts;
  const from = new Date(year, month - 1, 1);
  const to   = new Date(year, month,     0, 23, 59, 59);

  const [company, fuelLoads, maintenances] = await Promise.all([
    fetchCompany(companyId),

    // Todas las cargas del mes con datos de vehículo y conductor
    prisma.fuelLoad.findMany({
      where:   { companyId, date: { gte: from, lte: to } },
      include: {
        vehicle: { select: { plate: true, name: true } },
        driver:  { select: { name: true, lastname: true } },
      },
      orderBy: { date: 'asc' },
    }),

    // Todos los mantenimientos del mes con datos de vehículo
    prisma.maintenance.findMany({
      where:   { companyId, date: { gte: from, lte: to } },
      include: { vehicle: { select: { plate: true, name: true } } },
      orderBy: { date: 'asc' },
    }),
  ]);

  // Totales globales
  const totalFuel  = fuelLoads.reduce((s, l) => s + Number(l.priceTotal ?? 0), 0);
  const totalMaint = maintenances.reduce((s, m) => s + Number(m.cost ?? 0), 0);
  const totalGrand = totalFuel + totalMaint;

  // Agrupación por vehículo para el gráfico
  const byVehicle: Record<string, { plate: string; fuel: number; maint: number }> = {};
  fuelLoads.forEach(l => {
    if (!byVehicle[l.vehicleId])
      byVehicle[l.vehicleId] = { plate: l.vehicle.plate, fuel: 0, maint: 0 };
    byVehicle[l.vehicleId].fuel += Number(l.priceTotal ?? 0);
  });
  maintenances.forEach(m => {
    if (!byVehicle[m.vehicleId])
      byVehicle[m.vehicleId] = { plate: m.vehicle.plate, fuel: 0, maint: 0 };
    byVehicle[m.vehicleId].maint += Number(m.cost ?? 0);
  });

  const monthName = from.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  const filename  = `gastos-mensuales-${year}-${String(month).padStart(2, '0')}.pdf`;

  // ── Construir PDF ───────────────────────────────────────────────────────
  const doc = preparePdf(res, filename);
  drawHeader(doc, company.name, resolveLogoPath(company.logo),
    'REPORTE DE GASTOS MENSUALES', monthName.toUpperCase());

  // Tabla cargas de combustible
  drawSectionTitle(doc, `Cargas de Combustible — ${fuelLoads.length} registros`);
  drawTable(doc,
    [
      { header: 'Fecha',     key: 'date',      width: 60  },
      { header: 'Vehículo',  key: 'vehicle',   width: 105 },
      { header: 'Conductor', key: 'driver',    width: 110 },
      { header: 'Litros',    key: 'liters',    width: 55, align: 'right' },
      { header: 'Precio/L',  key: 'unitPrice', width: 65, align: 'right' },
      { header: 'Total',     key: 'total',     width: 80, align: 'right' },
    ],
    fuelLoads.map(l => ({
      date:      fmtDate(l.date),
      vehicle:   `${l.vehicle.plate}${l.vehicle.name ? ' · ' + l.vehicle.name : ''}`,
      driver:    l.driver ? `${l.driver.name} ${l.driver.lastname}` : '—',
      liters:    `${fmtNum(Number(l.litersOrKwh), 2)} L`,
      unitPrice: l.unitPrice ? `$${Number(l.unitPrice).toFixed(2)}` : '—',
      total:     fmt(Number(l.priceTotal ?? 0)),
    })),
  );

  // Tabla mantenimientos
  drawSectionTitle(doc, `Mantenimientos — ${maintenances.length} registros`);
  drawTable(doc,
    [
      { header: 'Fecha',       key: 'date',        width: 60  },
      { header: 'Vehículo',    key: 'vehicle',     width: 115 },
      { header: 'Descripción', key: 'description', width: 170 },
      { header: 'Tipo',        key: 'type',        width: 75  },
      { header: 'Costo',       key: 'cost',        width: 80, align: 'right' },
    ],
    maintenances.map(m => ({
      date:        fmtDate(m.date),
      vehicle:     `${m.vehicle.plate}${m.vehicle.name ? ' · ' + m.vehicle.name : ''}`,
      description: m.description,
      type:        m.type,
      cost:        fmt(Number(m.cost ?? 0)),
    })),
  );

  // Gráfico gasto total por vehículo
  const chartRows = Object.values(byVehicle).sort((a, b) => (b.fuel + b.maint) - (a.fuel + a.maint));
  drawBarChart(doc,
    'Gasto Total por Vehículo',
    chartRows.map(v => v.plate),
    chartRows.map(v => v.fuel + v.maint),
  );

  drawTotalsBox(doc, [
    { label: 'Cargas de combustible', value: fmt(totalFuel) },
    { label: 'Mantenimientos',        value: fmt(totalMaint) },
    { label: 'TOTAL DEL MES',         value: fmt(totalGrand), highlight: true },
  ]);

  doc.end();
}

// ─── REPORTE 2: Gastos por Vehículo ──────────────────────────────────────────

export interface VehicleExpensesOptions {
  vehicleId: string;
  from?:     Date;
  to?:       Date;
}

/**
 * Genera un PDF completo de gastos (combustible + mantenimiento) para
 * un único vehículo en el rango de fechas indicado.
 *
 * Consultas Prisma:
 *   prisma.vehicle.findFirstOrThrow({ where: { id, companyId } })
 *   prisma.fuelLoad.findMany({ where: { companyId, vehicleId, date: { gte, lte } } })
 *   prisma.maintenance.findMany({ where: { companyId, vehicleId, date: { gte, lte } } })
 *
 * Ejemplo de uso:
 *   GET /api/reports/vehicle-expenses/abc123?from=2026-01-01&to=2026-03-31
 */
export async function generateVehicleExpensesReport(
  companyId: string,
  opts:      VehicleExpensesOptions,
  res:       Response,
): Promise<void> {
  const from = opts.from ?? new Date(new Date().getFullYear(), 0, 1);
  const to   = opts.to   ?? new Date();

  const [company, vehicle, fuelLoads, maintenances] = await Promise.all([
    fetchCompany(companyId),

    prisma.vehicle.findFirstOrThrow({
      where: { id: opts.vehicleId, companyId },
    }),

    prisma.fuelLoad.findMany({
      where:   { companyId, vehicleId: opts.vehicleId, date: { gte: from, lte: to } },
      include: { driver: { select: { name: true, lastname: true } } },
      orderBy: { date: 'asc' },
    }),

    prisma.maintenance.findMany({
      where:   { companyId, vehicleId: opts.vehicleId, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    }),
  ]);

  // ── Métricas ──────────────────────────────────────────────────────────────
  const totalFuel    = fuelLoads.reduce((s, l) => s + Number(l.priceTotal ?? 0), 0);
  const totalMaint   = maintenances.reduce((s, m) => s + Number(m.cost ?? 0), 0);
  const totalLiters  = fuelLoads.reduce((s, l) => s + Number(l.litersOrKwh), 0);
  const kmLvals      = fuelLoads.filter(l => l.kmPerUnit != null).map(l => Number(l.kmPerUnit));
  const avgKmL       = kmLvals.length ? kmLvals.reduce((a, b) => a + b, 0) / kmLvals.length : 0;

  const vehicleLabel = `${vehicle.plate}${vehicle.name ? ' — ' + vehicle.name : ''}`;
  const periodLabel  = `${fmtDate(from)} al ${fmtDate(to)}`;
  const filename     = `gastos-vehiculo-${vehicle.plate}-${Date.now()}.pdf`;

  // ── Construir PDF ─────────────────────────────────────────────────────────
  const doc = preparePdf(res, filename);
  drawHeader(doc, company.name, resolveLogoPath(company.logo),
    `REPORTE DE GASTOS: ${vehicleLabel}`, periodLabel);

  // Ficha del vehículo
  doc.moveDown(0.3);
  const infoY = doc.y;
  doc.rect(PAGE.margin, infoY, PAGE.contentW, 46).fill(C.rowEven);
  doc.fillColor(C.primary).font('Helvetica-Bold').fontSize(8.5)
    .text('Información del Vehículo', PAGE.margin + 8, infoY + 6);

  const infoFields: [string, string][] = [
    ['Patente', vehicle.plate],
    ['Marca / Modelo', `${vehicle.brand ?? '—'} ${vehicle.model ?? ''}`],
    ['Año', String(vehicle.year ?? '—')],
    ['Odómetro actual', `${vehicle.currentOdometer.toLocaleString('es-CL')} km`],
  ];
  let infoX = PAGE.margin + 8;
  infoFields.forEach(([label, value]) => {
    doc.fillColor(C.mid).font('Helvetica').fontSize(7)
      .text(label, infoX, infoY + 22, { lineBreak: false });
    doc.fillColor(C.dark).font('Helvetica-Bold').fontSize(7.5)
      .text(value, infoX, infoY + 33, { lineBreak: false });
    infoX += 128;
  });
  doc.y = infoY + 58;

  // Tabla cargas
  drawSectionTitle(doc, `Cargas de Combustible — ${fuelLoads.length} registros`);
  drawTable(doc,
    [
      { header: 'Fecha',    key: 'date',      width: 65  },
      { header: 'Conductor',key: 'driver',    width: 125 },
      { header: 'Litros',   key: 'liters',    width: 60, align: 'right' },
      { header: 'Km/L',     key: 'kmPerUnit', width: 55, align: 'right' },
      { header: 'Estación', key: 'station',   width: 115 },
      { header: 'Total',    key: 'total',     width: 75, align: 'right' },
    ],
    fuelLoads.map(l => ({
      date:      fmtDate(l.date),
      driver:    l.driver ? `${l.driver.name} ${l.driver.lastname}` : '—',
      liters:    `${fmtNum(Number(l.litersOrKwh), 2)} L`,
      kmPerUnit: l.kmPerUnit ? fmtNum(Number(l.kmPerUnit), 2) : '—',
      station:   l.station ?? '—',
      total:     fmt(Number(l.priceTotal ?? 0)),
    })),
  );

  // Tabla mantenimientos
  drawSectionTitle(doc, `Mantenimientos — ${maintenances.length} registros`);
  drawTable(doc,
    [
      { header: 'Fecha',       key: 'date',        width: 65  },
      { header: 'Tipo',        key: 'type',        width: 80  },
      { header: 'Descripción', key: 'description', width: 175 },
      { header: 'Proveedor',   key: 'provider',    width: 100 },
      { header: 'Costo',       key: 'cost',        width: 75, align: 'right' },
    ],
    maintenances.map(m => ({
      date:        fmtDate(m.date),
      type:        m.type,
      description: m.description,
      provider:    m.workshopName ?? '—',
      cost:        fmt(Number(m.cost ?? 0)),
    })),
  );

  drawTotalsBox(doc, [
    { label: 'Total combustible',   value: fmt(totalFuel) },
    { label: 'Total litros',        value: `${fmtNum(totalLiters, 2)} L` },
    { label: 'Promedio km/L',       value: avgKmL ? fmtNum(avgKmL, 2) : '—' },
    { label: 'Total mantenimiento', value: fmt(totalMaint) },
    { label: 'COSTO TOTAL',         value: fmt(totalFuel + totalMaint), highlight: true },
  ]);

  doc.end();
}

// ─── REPORTE 3: Consumo de Combustible ───────────────────────────────────────

export interface FuelConsumptionOptions {
  from?: Date;
  to?:   Date;
}

/**
 * Genera un PDF de consumo de combustible por empresa con desglose
 * por vehículo, comparación con rendimiento de referencia y detalle completo.
 *
 * Consultas Prisma:
 *   prisma.fuelLoad.findMany({
 *     where: { companyId, date: { gte, lte } },
 *     include: { vehicle: {...}, driver: {...}, fuelType: {...} },
 *   })
 *
 * El campo `kmPerUnit` ya viene calculado en la carga al momento del registro.
 *
 * Ejemplo de uso:
 *   GET /api/reports/fuel-consumption?from=2026-01-01&to=2026-03-31
 */
export async function generateFuelConsumptionReport(
  companyId: string,
  opts:      FuelConsumptionOptions,
  res:       Response,
): Promise<void> {
  const from = opts.from ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to   = opts.to   ?? new Date();

  const [company, fuelLoads] = await Promise.all([
    fetchCompany(companyId),

    prisma.fuelLoad.findMany({
      where:   { companyId, date: { gte: from, lte: to } },
      include: {
        vehicle:  { select: { plate: true, name: true, efficiencyReference: true } },
        driver:   { select: { name: true, lastname: true } },
        fuelType: { select: { name: true } },
      },
      orderBy: [{ vehicleId: 'asc' }, { date: 'asc' }],
    }),
  ]);

  // ── Estadísticas por vehículo ─────────────────────────────────────────────
  interface VehicleStat {
    plate:     string;
    name:      string;
    ref:       number | null;
    loads:     number;
    totalL:    number;
    totalCost: number;
    kmLvals:   number[];
  }

  const stats: Record<string, VehicleStat> = {};
  fuelLoads.forEach(l => {
    if (!stats[l.vehicleId]) {
      stats[l.vehicleId] = {
        plate:     l.vehicle.plate,
        name:      l.vehicle.name ?? '',
        ref:       l.vehicle.efficiencyReference ? Number(l.vehicle.efficiencyReference) : null,
        loads:     0,
        totalL:    0,
        totalCost: 0,
        kmLvals:   [],
      };
    }
    const s = stats[l.vehicleId];
    s.loads++;
    s.totalL    += Number(l.litersOrKwh);
    s.totalCost += Number(l.priceTotal ?? 0);
    if (l.kmPerUnit != null) s.kmLvals.push(Number(l.kmPerUnit));
  });

  const statRows = Object.values(stats).sort((a, b) => b.totalL - a.totalL);
  const totalLiters = statRows.reduce((s, v) => s + v.totalL, 0);
  const totalCost   = statRows.reduce((s, v) => s + v.totalCost, 0);
  const periodLabel = `${fmtDate(from)} al ${fmtDate(to)}`;
  const filename    = `consumo-combustible-${Date.now()}.pdf`;

  // ── Construir PDF ─────────────────────────────────────────────────────────
  const doc = preparePdf(res, filename);
  drawHeader(doc, company.name, resolveLogoPath(company.logo),
    'REPORTE DE CONSUMO DE COMBUSTIBLE', periodLabel);

  drawSectionTitle(doc, 'Resumen por Vehículo');
  drawTable(doc,
    [
      { header: 'Vehículo',   key: 'vehicle', width: 100 },
      { header: 'Cargas',     key: 'loads',   width: 45, align: 'right' },
      { header: 'Total L',    key: 'totalL',  width: 70, align: 'right' },
      { header: 'Costo',      key: 'cost',    width: 90, align: 'right' },
      { header: 'Prom km/L',  key: 'avgKmL',  width: 65, align: 'right' },
      { header: 'Ref km/L',   key: 'refKmL',  width: 65, align: 'right' },
      { header: 'Δ Eficienc.',key: 'delta',   width: 60, align: 'right' },
    ],
    statRows.map(s => {
      const avg   = s.kmLvals.length ? s.kmLvals.reduce((a, b) => a + b, 0) / s.kmLvals.length : 0;
      const delta = (s.ref && avg) ? ((avg - s.ref) / s.ref * 100) : null;
      return {
        vehicle: `${s.plate}${s.name ? ' · ' + s.name : ''}`,
        loads:   String(s.loads),
        totalL:  `${fmtNum(s.totalL, 2)} L`,
        cost:    fmt(s.totalCost),
        avgKmL:  avg  ? fmtNum(avg, 2)   : '—',
        refKmL:  s.ref ? fmtNum(s.ref, 2) : '—',
        delta:   delta != null ? `${delta >= 0 ? '+' : ''}${fmtNum(delta, 1)}%` : '—',
      };
    }),
  );

  // Gráfico: litros por vehículo
  drawBarChart(doc,
    'Litros Consumidos por Vehículo',
    statRows.map(s => s.plate),
    statRows.map(s => s.totalL),
    ' L',
  );

  // Detalle completo de cargas
  drawSectionTitle(doc, `Detalle Completo — ${fuelLoads.length} cargas`);
  drawTable(doc,
    [
      { header: 'Fecha',     key: 'date',      width: 60 },
      { header: 'Vehículo',  key: 'vehicle',   width: 80 },
      { header: 'Conductor', key: 'driver',    width: 105 },
      { header: 'Tipo',      key: 'fuelType',  width: 60 },
      { header: 'Litros',    key: 'liters',    width: 55, align: 'right' },
      { header: 'km/L',      key: 'kmPerUnit', width: 55, align: 'right' },
      { header: 'Estación',  key: 'station',   width: 80 },
    ],
    fuelLoads.map(l => ({
      date:     fmtDate(l.date),
      vehicle:  l.vehicle.plate,
      driver:   l.driver ? `${l.driver.name} ${l.driver.lastname}` : '—',
      fuelType: l.fuelType?.name ?? '—',
      liters:   `${fmtNum(Number(l.litersOrKwh), 2)} L`,
      kmPerUnit:l.kmPerUnit ? fmtNum(Number(l.kmPerUnit), 2) : '—',
      station:  l.station ?? '—',
    })),
  );

  drawTotalsBox(doc, [
    { label: 'Total cargas',    value: String(fuelLoads.length) },
    { label: 'Total litros',    value: `${fmtNum(totalLiters, 2)} L` },
    { label: 'Costo total',     value: fmt(totalCost) },
    { label: 'Costo por litro', value: totalLiters ? `$${fmtNum(totalCost / totalLiters, 2)}` : '—' },
  ]);

  doc.end();
}

// ─── REPORTE 4: Mantenimientos ────────────────────────────────────────────────

export interface MaintenanceReportOptions {
  from?: Date;
  to?:   Date;
}

/**
 * Genera un PDF con todos los mantenimientos realizados en el período,
 * con resumen por vehículo, desglose por tipo y detalle completo.
 *
 * Consultas Prisma:
 *   prisma.maintenance.findMany({
 *     where:   { companyId, date: { gte, lte } },
 *     include: { vehicle: { select: { plate, name } } },
 *     orderBy: [{ vehicleId: 'asc' }, { date: 'asc' }],
 *   })
 *
 * Ejemplo de uso:
 *   GET /api/reports/maintenance?from=2026-01-01&to=2026-03-31
 */
export async function generateMaintenanceReport(
  companyId: string,
  opts:      MaintenanceReportOptions,
  res:       Response,
): Promise<void> {
  const from = opts.from ?? new Date(new Date().getFullYear(), 0, 1);
  const to   = opts.to   ?? new Date();

  const [company, maintenances] = await Promise.all([
    fetchCompany(companyId),

    prisma.maintenance.findMany({
      where:   { companyId, date: { gte: from, lte: to } },
      include: { vehicle: { select: { plate: true, name: true } } },
      orderBy: [{ vehicleId: 'asc' }, { date: 'asc' }],
    }),
  ]);

  // ── Métricas ──────────────────────────────────────────────────────────────
  const totalCost = maintenances.reduce((s, m) => s + Number(m.cost ?? 0), 0);

  // Por tipo
  const byType: Record<string, number> = {};
  maintenances.forEach(m => {
    byType[m.type] = (byType[m.type] ?? 0) + Number(m.cost ?? 0);
  });

  // Por vehículo
  const byVehicle: Record<string, { plate: string; count: number; cost: number }> = {};
  maintenances.forEach(m => {
    if (!byVehicle[m.vehicleId])
      byVehicle[m.vehicleId] = { plate: m.vehicle.plate, count: 0, cost: 0 };
    byVehicle[m.vehicleId].count++;
    byVehicle[m.vehicleId].cost += Number(m.cost ?? 0);
  });

  const vRows       = Object.values(byVehicle).sort((a, b) => b.cost - a.cost);
  const typeRows    = Object.entries(byType).sort(([, a], [, b]) => b - a);
  const countPrev   = maintenances.filter(m => m.type === 'preventivo').length;
  const countCorr   = maintenances.filter(m => m.type === 'correctivo').length;
  const periodLabel = `${fmtDate(from)} al ${fmtDate(to)}`;
  const filename    = `mantenimientos-${Date.now()}.pdf`;

  // ── Construir PDF ─────────────────────────────────────────────────────────
  const doc = preparePdf(res, filename);
  drawHeader(doc, company.name, resolveLogoPath(company.logo),
    'REPORTE DE MANTENIMIENTOS', periodLabel);

  // Resumen por vehículo
  drawSectionTitle(doc, 'Resumen por Vehículo');
  drawTable(doc,
    [
      { header: 'Vehículo',    key: 'plate', width: 130 },
      { header: 'Cantidad',    key: 'count', width: 85,  align: 'right' },
      { header: 'Costo Total', key: 'cost',  width: 110, align: 'right' },
      { header: '% del Total', key: 'pct',   width: 85,  align: 'right' },
    ],
    vRows.map(v => ({
      plate: v.plate,
      count: String(v.count),
      cost:  fmt(v.cost),
      pct:   totalCost ? `${fmtNum((v.cost / totalCost) * 100, 1)} %` : '0 %',
    })),
  );

  // Gráfico costo por vehículo
  drawBarChart(doc,
    'Costo de Mantenimiento por Vehículo',
    vRows.map(v => v.plate),
    vRows.map(v => v.cost),
  );

  // Desglose por tipo
  drawSectionTitle(doc, 'Desglose por Tipo de Mantenimiento');
  drawTable(doc,
    [
      { header: 'Tipo',        key: 'type', width: 160 },
      { header: 'Costo',       key: 'cost', width: 130, align: 'right' },
      { header: '% del Total', key: 'pct',  width: 110, align: 'right' },
    ],
    typeRows.map(([type, cost]) => ({
      type,
      cost: fmt(cost),
      pct:  `${fmtNum((cost / totalCost) * 100, 1)} %`,
    })),
  );

  // Detalle completo
  drawSectionTitle(doc, `Detalle Completo — ${maintenances.length} registros`);
  drawTable(doc,
    [
      { header: 'Fecha',       key: 'date',        width: 60  },
      { header: 'Vehículo',    key: 'vehicle',     width: 80  },
      { header: 'Tipo',        key: 'type',        width: 80  },
      { header: 'Descripción', key: 'description', width: 155 },
      { header: 'Proveedor',   key: 'provider',    width: 80  },
      { header: 'Costo',       key: 'cost',        width: 75, align: 'right' },
    ],
    maintenances.map(m => ({
      date:        fmtDate(m.date),
      vehicle:     m.vehicle.plate,
      type:        m.type,
      description: m.description,
      provider:    m.workshopName ?? '—',
      cost:        fmt(Number(m.cost ?? 0)),
    })),
  );

  drawTotalsBox(doc, [
    { label: 'Total registros', value: String(maintenances.length) },
    { label: 'Preventivos',     value: String(countPrev) },
    { label: 'Correctivos',     value: String(countCorr) },
    { label: 'COSTO TOTAL',     value: fmt(totalCost), highlight: true },
  ]);

  doc.end();
}
