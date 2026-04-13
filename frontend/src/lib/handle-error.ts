import { AxiosError } from 'axios';

interface BackendError {
  success: boolean;
  message?: string;
  details?: { campo: string; mensaje: string }[];
}

/**
 * Extracts a human-friendly error title + optional detail message from any
 * thrown value (AxiosError, generic Error, unknown).
 *
 * Rules (in order of priority):
 *  1. Network / timeout  → connectivity message
 *  2. HTTP 400 with Zod details → lists field errors
 *  3. HTTP 400 / 409 with known backend message → specific copy
 *  4. HTTP status fallback map
 *  5. Unknown → generic
 */
export function parseError(err: unknown): { title: string; detail?: string } {
  // ── Network / timeout ────────────────────────────────────────────────────
  if (err instanceof AxiosError) {
    if (err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK') {
      return {
        title:  'Sin conexión al servidor',
        detail: 'Verificá tu conexión a internet e intentá de nuevo.',
      };
    }

    const status = err.response?.status;
    const body   = err.response?.data as BackendError | undefined;
    const msg    = body?.message ?? '';

    // ── 400 with Zod validation details ────────────────────────────────────
    if (status === 400 && body?.details?.length) {
      const lines = body.details
        .map((d) => `• ${fieldLabel(d.campo)}: ${d.mensaje}`)
        .join('\n');
      return {
        title:  'Datos inválidos',
        detail: lines,
      };
    }

    // ── 400 generic ─────────────────────────────────────────────────────────
    if (status === 400) {
      return {
        title:  'Datos inválidos',
        detail: msg || 'Revisá los campos e intentá de nuevo.',
      };
    }

    // ── 401 ─────────────────────────────────────────────────────────────────
    if (status === 401) {
      return {
        title:  'Sesión expirada',
        detail: 'Tu sesión venció. Vas a ser redirigido al login.',
      };
    }

    // ── 403 ─────────────────────────────────────────────────────────────────
    if (status === 403) {
      return {
        title:  'Sin permisos',
        detail: 'No tenés autorización para realizar esta acción.',
      };
    }

    // ── 404 ─────────────────────────────────────────────────────────────────
    if (status === 404) {
      return {
        title:  'No encontrado',
        detail: msg || 'El recurso que buscás ya no existe.',
      };
    }

    // ── 409 conflicts — map known backend messages to specific copy ──────────
    if (status === 409) {
      if (/rut/i.test(msg)) {
        return {
          title:  'RUT duplicado',
          detail: 'Ya existe una empresa registrada con ese RUT.',
        };
      }
      if (/email/i.test(msg)) {
        return {
          title:  'Email duplicado',
          detail: 'Ya existe un usuario con ese correo electrónico.',
        };
      }
      return {
        title:  'Registro duplicado',
        detail: msg || 'Ya existe un registro con esos datos.',
      };
    }

    // ── 422 ─────────────────────────────────────────────────────────────────
    if (status === 422) {
      return {
        title:  'Datos no procesables',
        detail: msg || 'El servidor no pudo procesar los datos enviados.',
      };
    }

    // ── 429 ─────────────────────────────────────────────────────────────────
    if (status === 429) {
      return {
        title:  'Demasiadas solicitudes',
        detail: 'Esperá unos segundos antes de intentar de nuevo.',
      };
    }

    // ── 5xx ─────────────────────────────────────────────────────────────────
    if (status && status >= 500) {
      return {
        title:  'Error en el servidor',
        detail: 'Algo salió mal en el servidor. Intentá de nuevo en unos momentos.',
      };
    }

    // ── Any other HTTP error with a backend message ──────────────────────────
    if (msg) {
      return { title: msg };
    }
  }

  // ── Generic JS error ──────────────────────────────────────────────────────
  if (err instanceof Error && err.message) {
    return { title: err.message };
  }

  // ── Unknown ───────────────────────────────────────────────────────────────
  return {
    title:  'Error inesperado',
    detail: 'Ocurrió algo inesperado. Recargá la página si el problema persiste.',
  };
}

// ─── Map Prisma/camelCase field names to readable Spanish labels ──────────────
function fieldLabel(campo: string): string {
  const labels: Record<string, string> = {
    adminName:          'Nombre del admin',
    adminEmail:         'Email del admin',
    adminPassword:      'Contraseña',
    companyName:        'Nombre de empresa',
    companyRut:         'RUT',
    companyCity:        'Ciudad',
    companyPhone:       'Teléfono',
    companyEmail:       'Email de empresa',
    companyAddress:     'Dirección',
    name:               'Nombre',
    email:              'Email',
    password:           'Contraseña',
    rut:                'RUT',
    phone:              'Teléfono',
    address:            'Dirección',
    city:               'Ciudad',
    plate:              'Patente',
    brand:              'Marca',
    model:              'Modelo',
    year:               'Año',
    km:                 'Kilometraje',
    liters:             'Litros',
    amount:             'Importe',
    date:               'Fecha',
    dueDate:            'Fecha de vencimiento',
    documentType:       'Tipo de documento',
    fuelType:           'Tipo de combustible',
  };
  return labels[campo] ?? campo;
}
