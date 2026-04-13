// ─── Roles del sistema ────────────────────────────────────────────────────────
export const ROLES = {
  SUPERROOT:     'superroot',
  ADMIN_COMPANY: 'admin',      // alias semántico: admin de empresa
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// ─── Duración de tokens ───────────────────────────────────────────────────────
export const TOKEN_CONFIG = {
  ACCESS_EXPIRES_SECONDS:  15 * 60,           // 15 min
  REFRESH_EXPIRES_SECONDS: 7  * 24 * 60 * 60, // 7 días
  REFRESH_COOKIE_NAME:    'cuantive_refresh',
} as const;

// ─── Payload contenido en el JWT ─────────────────────────────────────────────
export interface JwtAccessPayload {
  /** user.id  */
  sub:           string;
  email:         string;
  role:          Role;
  companyId:     string | null;
  companyName:   string | null;
  /** Incrementa en cada rotación de refresh token — invalida tokens viejos */
  tokenVersion:  number;
  iat:           number;
  exp:           number;
}

// ─── Datos que viajan en la respuesta de login / refresh ─────────────────────
export interface AuthTokens {
  accessToken:  string;
  /** Solo se devuelve en login, en refresh va en cookie */
  refreshToken?: string;
}

export interface AuthUser {
  id:                 string;
  name:               string;
  email:              string;
  role:               Role;
  companyId:          string | null;
  companyName:        string | null;
  canDownloadMetrics: boolean;
}

export interface LoginResponse {
  tokens: Omit<AuthTokens, 'refreshToken'>;
  user:   AuthUser;
}

// ─── Extensión del tipo Request de Express ───────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      /** Disponible después de authMiddleware */
      user:     JwtAccessPayload;
      /** Disponible después de authMiddleware (para admin) o tenantMiddleware (superroot) */
      tenantId: string;
    }
  }
}
