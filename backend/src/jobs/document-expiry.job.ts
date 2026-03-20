import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { Prisma, AlertType, AlertSeverity } from '@prisma/client';
import { prisma } from '../config/database';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dedupKey(companyId: string, vehicleId: string, type: string, extra: string): string {
  return `${companyId}:${vehicleId}:${type}:${extra}`;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  insurance:    'Seguro',
  registration: 'Libreta de propiedad',
  permit:       'Habilitación',
  inspection:   'ITV',
};

const DEDUP_HOURS = 23;

// ─── Core logic ──────────────────────────────────────────────────────────────

export async function runDocumentExpiryJob(): Promise<void> {
  console.log('[DocumentExpiryJob] Iniciando revisión de documentos...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30  = new Date(today.getTime() + 30 * 86_400_000);

  // Query all documents that are expiring within 30 days OR already expired
  const documents = await prisma.vehicleDocument.findMany({
    where: {
      expirationDate: { lte: in30 },
    },
    include: {
      vehicle: { select: { id: true, plate: true, name: true, companyId: true } },
    },
  });

  if (documents.length === 0) {
    console.log('[DocumentExpiryJob] No hay documentos por alertar.');
    return;
  }

  // Load existing unresolved notifications to deduplicate
  const dedupCutoff = new Date(Date.now() - DEDUP_HOURS * 3_600_000);
  const existingNotifs = await prisma.alertNotification.findMany({
    where: {
      type:       AlertType.vehicle_document_expiry,
      resolvedAt: null,
      createdAt:  { gte: dedupCutoff },
    },
    select: { companyId: true, vehicleId: true, metadata: true },
  });

  const existingSet = new Set(
    existingNotifs.map((n: { companyId: string; vehicleId: string | null; metadata: unknown }) => {
      const meta = n.metadata as Record<string, unknown> | null;
      const docId = meta?.documentId as string ?? '';
      return dedupKey(n.companyId, n.vehicleId ?? '', AlertType.vehicle_document_expiry, docId);
    }),
  );

  interface NotifDraft {
    companyId:  string;
    vehicleId:  string;
    type:       AlertType;
    severity:   AlertSeverity;
    message:    string;
    metadata:   Record<string, unknown>;
  }

  const toInsert: NotifDraft[] = [];

  for (const doc of documents) {
    const v = doc.vehicle;
    const companyId = v.companyId;
    const vehicleId = v.id;
    const plate     = v.plate ?? v.name ?? vehicleId;
    const typeLabel = DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType;

    const expDate      = doc.expirationDate as Date;
    const daysRemaining = Math.floor((expDate.getTime() - today.getTime()) / 86_400_000);

    let severity: AlertSeverity;
    let message:  string;

    if (daysRemaining < 0) {
      const daysOverdue = Math.abs(daysRemaining);
      severity = AlertSeverity.critical;
      message  = `❌ ${typeLabel} de ${plate} vencido hace ${daysOverdue} día(s) (venció el ${fmtDate(expDate)}).`;
    } else if (daysRemaining <= 5) {
      severity = AlertSeverity.high;
      message  = `⚠️  ${typeLabel} de ${plate} vence en ${daysRemaining} día(s) (${fmtDate(expDate)}).`;
    } else if (daysRemaining <= 15) {
      severity = AlertSeverity.medium;
      message  = `⚠️  ${typeLabel} de ${plate} vence en ${daysRemaining} días (${fmtDate(expDate)}).`;
    } else {
      severity = AlertSeverity.low;
      message  = `ℹ️  ${typeLabel} de ${plate} vence en ${daysRemaining} días (${fmtDate(expDate)}).`;
    }

    const key = dedupKey(companyId, vehicleId, AlertType.vehicle_document_expiry, doc.id);
    if (existingSet.has(key)) continue;

    toInsert.push({
      companyId,
      vehicleId,
      type:     AlertType.vehicle_document_expiry,
      severity,
      message,
      metadata: {
        documentId:     doc.id,
        documentType:   doc.documentType,
        documentNumber: doc.documentNumber,
        expirationDate: expDate.toISOString(),
        daysRemaining,
      },
    });
  }

  if (toInsert.length === 0) {
    console.log('[DocumentExpiryJob] Todos los documentos ya tienen notificación reciente — ningún insert.');
    return;
  }

  await prisma.alertNotification.createMany({
    data: toInsert.map(n => ({
      id:        uuidv4(),
      companyId: n.companyId,
      vehicleId: n.vehicleId,
      driverId:  null,
      type:      n.type,
      severity:  n.severity,
      message:   n.message,
      metadata:  n.metadata as Prisma.InputJsonValue,
      readAt:    null,
      resolvedAt: null,
    })),
  });

  console.log(`[DocumentExpiryJob] ${toInsert.length} notificación(es) creada(s).`);
}

// ─── Schedule: daily at 08:00 ────────────────────────────────────────────────

export function scheduleDocumentExpiryJob(): void {
  // Run every day at 08:00 AM server time
  cron.schedule('0 8 * * *', async () => {
    try {
      await runDocumentExpiryJob();
    } catch (err) {
      console.error('[DocumentExpiryJob] Error en ejecución:', err);
    }
  });
  console.log('[DocumentExpiryJob] Cron programado → cada día a las 08:00');
}
