import { Request, Response } from 'express';
import {
  generateMonthlyExpensesReport,
  generateVehicleExpensesReport,
  generateFuelConsumptionReport,
  generateMaintenanceReport,
} from './reports.service';
import { sendBadRequest, sendNotFound, sendError } from '../../utils/response';

// ─── Utilidad de parseo de fechas ────────────────────────────────────────────

function parseDate(val: unknown): Date | undefined {
  if (!val || typeof val !== 'string') return undefined;
  const d = new Date(val);
  return isNaN(d.getTime()) ? undefined : d;
}

// ─── Controlador ─────────────────────────────────────────────────────────────

export class ReportsController {
  /**
   * GET /api/reports/monthly-expenses
   * Query params:
   *   year  – número de año (ej. 2026)  [default: año actual]
   *   month – número de mes 1-12        [default: mes actual]
   *
   * Genera PDF con gastos de combustible + mantenimiento del mes completo.
   * Incluye tabla de cargas, tabla de mantenimientos y gráfico por vehículo.
   */
  async monthlyExpenses(req: Request, res: Response): Promise<void> {
    try {
      const now   = new Date();
      const year  = parseInt(String(req.query.year  ?? now.getFullYear()), 10);
      const month = parseInt(String(req.query.month ?? now.getMonth() + 1), 10);

      if (isNaN(year) || year < 2000 || year > 2100) {
        sendBadRequest(res, 'Parámetro year inválido (2000-2100)');
        return;
      }
      if (isNaN(month) || month < 1 || month > 12) {
        sendBadRequest(res, 'Parámetro month inválido (1-12)');
        return;
      }

      await generateMonthlyExpensesReport(req.tenantId, { year, month }, res);
    } catch (err) {
      if (!res.headersSent)
        sendError(res, err instanceof Error ? err.message : 'Error generando reporte');
    }
  }

  /**
   * GET /api/reports/vehicle-expenses/:vehicleId
   * Route params:
   *   vehicleId – ID del vehículo
   * Query params:
   *   from – fecha inicio ISO (ej. 2026-01-01)  [default: 1 ene año actual]
   *   to   – fecha fin   ISO (ej. 2026-03-31)   [default: hoy]
   *
   * Genera PDF con historial completo de gastos de un vehículo específico.
   * Incluye ficha técnica, cargas, mantenimientos y totales.
   */
  async vehicleExpenses(req: Request, res: Response): Promise<void> {
    try {
      const { vehicleId } = req.params;
      if (!vehicleId?.trim()) {
        sendBadRequest(res, 'vehicleId es requerido');
        return;
      }

      await generateVehicleExpensesReport(
        req.tenantId,
        { vehicleId, from: parseDate(req.query.from), to: parseDate(req.query.to) },
        res,
      );
    } catch (err: unknown) {
      if (!res.headersSent) {
        const msg = err instanceof Error ? err.message : 'Error generando reporte';
        // PrismaClientKnownRequestError P2025 = record not found
        if (msg.includes('No ') || msg.includes('P2025') || msg.includes('not found'))
          sendNotFound(res, 'Vehículo');
        else
          sendError(res, msg);
      }
    }
  }

  /**
   * GET /api/reports/fuel-consumption
   * Query params:
   *   from – fecha inicio ISO  [default: 1 del mes actual]
   *   to   – fecha fin   ISO   [default: hoy]
   *
   * Genera PDF con consumo de combustible por empresa.
   * Incluye resumen por vehículo con Δ de eficiencia frente a referencia,
   * gráfico de barras y detalle completo de todas las cargas.
   */
  async fuelConsumption(req: Request, res: Response): Promise<void> {
    try {
      await generateFuelConsumptionReport(
        req.tenantId,
        { from: parseDate(req.query.from), to: parseDate(req.query.to) },
        res,
      );
    } catch (err) {
      if (!res.headersSent)
        sendError(res, err instanceof Error ? err.message : 'Error generando reporte');
    }
  }

  /**
   * GET /api/reports/maintenance
   * Query params:
   *   from – fecha inicio ISO  [default: 1 ene año actual]
   *   to   – fecha fin   ISO   [default: hoy]
   *
   * Genera PDF con mantenimientos realizados en el período.
   * Incluye resumen por vehículo, gráfico de costos, desglose por tipo
   * (preventivo/correctivo) y detalle completo.
   */
  async maintenance(req: Request, res: Response): Promise<void> {
    try {
      await generateMaintenanceReport(
        req.tenantId,
        { from: parseDate(req.query.from), to: parseDate(req.query.to) },
        res,
      );
    } catch (err) {
      if (!res.headersSent)
        sendError(res, err instanceof Error ? err.message : 'Error generando reporte');
    }
  }
}
