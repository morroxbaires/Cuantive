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
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, fmt, { locale: es });
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
