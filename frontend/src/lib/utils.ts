import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, differenceInDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null | undefined, fmt = 'dd/MM/yyyy'): string {
  if (!date) return '—';
  try {
    // Always extract the YYYY-MM-DD part and parse at local noon to avoid UTC midnight
    // crossing into the previous day in negative-offset timezones (e.g. UTC-3).
    if (typeof date === 'string') {
      const datePart = date.slice(0, 10); // "2026-04-10"
      const d = new Date(`${datePart}T12:00:00`);
      return format(d, fmt, { locale: es });
    }
    return format(date, fmt, { locale: es });
  } catch {
    return '—';
  }
}

export function formatCurrency(value: number, currency = 'UYU'): string {
  return new Intl.NumberFormat('es-UY', {
    style:    'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Like formatCurrency but preserves up to 4 decimal places (for unit prices like $/L). */
export function formatUnitPrice(value: number): string {
  // Trim trailing zeros but keep at least 2 decimal places
  const formatted = new Intl.NumberFormat('es-UY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
  return `$ ${formatted}`;
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('es-UY', { maximumFractionDigits: decimals }).format(value);
}

export function daysUntil(dateStr: string): number {
  try {
    return differenceInDays(parseISO(dateStr), new Date());
  } catch {
    return 0;
  }
}

export function licenseExpiryStatus(daysLeft: number): 'ok' | 'warning' | 'danger' {
  if (daysLeft < 0)  return 'danger';
  if (daysLeft < 30) return 'warning';
  return 'ok';
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export function debounce<T extends (...args: any[]) => void>(fn: T, ms = 300): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function buildQueryString(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
  });
  return q.toString();
}

export const MAINTENANCE_TYPES = [
  'Cambio de aceite',
  'Cambio de filtros',
  'Alineación y balanceo',
  'Frenos',
  'Neumáticos',
  'Batería',
  'Revisión general',
  'Correa de distribución',
  'Refrigerante',
  'Transmisión',
  'Otro',
];

export const STATUS_LABELS: Record<string, string> = {
  pending:     'Pendiente',
  in_progress: 'En progreso',
  completed:   'Completado',
  cancelled:   'Cancelado',
};

export const ALERT_TYPE_LABELS: Record<string, string> = {
  license_expiry:       'Vencimiento de licencia',
  maintenance_due:      'Mantenimiento próximo',
  odometer_threshold:   'Umbral de odómetro',
  fuel_anomaly:         'Anomalía de combustible',
  custom:               'Personalizada',
};
