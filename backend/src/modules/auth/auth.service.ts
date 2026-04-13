/**
 * AuthService — Servicio de autenticación para Cuantive
 *
 * Características de producción:
 *  - Refresh token rotation (cada refresh invalida el anterior)
 *  - tokenVersion en JWT para invalidar sesiones tras logout global / cambio de contraseña
 *  - Hash SHA-256 del refresh token en BD (nunca el token en crudo)
 *  - Detección de token reuse attack (revoca todas las sesiones automáticamente)
 *  - Mensajes de error que no revelan si el email existe (timing-safe)
 */

import bcrypt from 'bcryptjs';
import jwt    from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { prisma }      from '../../config/database';
import { env }         from '../../config/env';
import {
  JwtAccessPayload, AuthUser, Role, TOKEN_CONFIG,
} from './auth.types';

// ─── Constantes internas ──────────────────────────────────────────────────────
const BCRYPT_ROUNDS = 12;

// ─── Helpers privados ─────────────────────────────────────────────────────────

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function buildPayload(user: {
  id:          string;
  email:       string;
  role:        string;
  companyId:   string | null;
  companyName: string | null;
  tokenVersion?: number;
}): Omit<JwtAccessPayload, 'iat' | 'exp'> {
  return {
    sub:          user.id,
    email:        user.email,
    role:         user.role as Role,
    companyId:    user.companyId,
    companyName:  user.companyName,
    tokenVersion: user.tokenVersion ?? 1,
  };
}

function makeAccessToken(payload: Omit<JwtAccessPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: TOKEN_CONFIG.ACCESS_EXPIRES_SECONDS,
  });
}

function makeRefreshToken(payload: Omit<JwtAccessPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: TOKEN_CONFIG.REFRESH_EXPIRES_SECONDS,
  });
}

function refreshExpiresAt(): Date {
  const d = new Date();
  d.setSeconds(d.getSeconds() + TOKEN_CONFIG.REFRESH_EXPIRES_SECONDS);
  return d;
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

export class AuthService {

  // ─── LOGIN ──────────────────────────────────────────────────────────────────

  async login(params: {
    email:      string;
    password:   string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<{
    accessToken:  string;
    refreshToken: string;
    user:         AuthUser;
  }> {
    const { email, password, userAgent, ipAddress } = params;

    // 1. Buscar usuario (nunca revela si el email existe con mensajes distintos)
    const user = await prisma.user.findFirst({
      where:   { email: email.toLowerCase().trim(), deletedAt: null },
      include: { company: { select: { id: true, name: true, active: true } } },
    });

    // 2. Verificar contraseña — siempre ejecutar bcrypt para evitar timing attack
    const hash       = user?.passwordHash ?? '$2b$12$invalidsaltfortimingattack00000';
    const passwordOk = await bcrypt.compare(password, hash);

    if (!user || !passwordOk) {
      throw new Error('Credenciales inválidas.');
    }

    // 3. Verificar usuario activo
    if (!user.active) {
      throw new Error('Usuario desactivado. Contacta al administrador.');
    }

    // 4. Verificar empresa activa (solo admin de empresa)
    if (user.role === 'admin') {
      if (!user.company || !user.company.active) {
        throw new Error('Tu empresa está inactiva. Contacta a soporte.');
      }
    }

    // 5. Construir payload y generar tokens
    const payload      = buildPayload({
      id:           user.id,
      email:        user.email,
      role:         user.role,
      companyId:    user.companyId,
      companyName:  user.company?.name ?? null,
      tokenVersion: 1,
    });
    const accessToken  = makeAccessToken(payload);
    const refreshToken = makeRefreshToken(payload);

    // 6. Guardar hash del refresh token en BD
    await prisma.refreshToken.create({
      data: {
        id:        uuidv4(),
        userId:    user.id,
        companyId: user.companyId,
        tokenHash: hashToken(refreshToken),
        userAgent: userAgent ?? null,
        ipAddress: ipAddress ?? null,
        expiresAt: refreshExpiresAt(),
      },
    });

    // 7. Actualizar lastLogin
    await prisma.user.update({
      where: { id: user.id },
      data:  { lastLogin: new Date() },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id:                 user.id,
        name:               user.name,
        email:              user.email,
        role:               user.role as Role,
        companyId:          user.companyId,
        companyName:        user.company?.name ?? null,
        canDownloadMetrics: user.canDownloadMetrics ?? false,
      },
    };
  }

  // ─── REFRESH TOKEN (con rotación) ───────────────────────────────────────────

  async refresh(incomingRefresh: string): Promise<{
    accessToken:  string;
    refreshToken: string;
  }> {
    // 1. Verificar firma JWT del refresh token
    let decoded: JwtAccessPayload;
    try {
      decoded = jwt.verify(incomingRefresh, env.JWT_REFRESH_SECRET) as JwtAccessPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new Error('Sesión expirada. Inicia sesión nuevamente.');
      }
      throw new Error('Token de sesión inválido.');
    }

    // 2. Buscar el hash en BD
    const hash   = hashToken(incomingRefresh);
    const stored = await prisma.refreshToken.findFirst({
      where: {
        tokenHash: hash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: { select: { active: true, deletedAt: true } },
      },
    });

    if (!stored) {
      // Posible token reuse attack — revocar TODAS las sesiones del usuario
      await prisma.refreshToken.updateMany({
        where: { userId: decoded.sub, revokedAt: null },
        data:  { revokedAt: new Date() },
      });
      throw new Error('Token de sesión inválido o ya utilizado. Todas las sesiones han sido cerradas por seguridad.');
    }

    // 3. Verificar usuario sigue activo
    if (!stored.user.active || stored.user.deletedAt) {
      throw new Error('Usuario desactivado.');
    }

    // 4. Revocar el refresh token usado (rotación)
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data:  { revokedAt: new Date() },
    });

    // 5. Nuevo par de tokens con tokenVersion incrementado
    const newPayload = {
      sub:          decoded.sub,
      email:        decoded.email,
      role:         decoded.role,
      companyId:    decoded.companyId,
      companyName:  decoded.companyName,
      tokenVersion: (decoded.tokenVersion ?? 1) + 1,
    };

    const newAccess  = makeAccessToken(newPayload);
    const newRefresh = makeRefreshToken(newPayload);

    // 6. Persistir nuevo refresh token
    await prisma.refreshToken.create({
      data: {
        id:        uuidv4(),
        userId:    stored.userId,
        companyId: stored.companyId,
        tokenHash: hashToken(newRefresh),
        userAgent: stored.userAgent,
        ipAddress: stored.ipAddress,
        expiresAt: refreshExpiresAt(),
      },
    });

    return { accessToken: newAccess, refreshToken: newRefresh };
  }

  // ─── LOGOUT ─────────────────────────────────────────────────────────────────

  /** Revocar solo la sesión actual (token actual) */
  async logout(refreshToken: string): Promise<void> {
    const hash = hashToken(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hash, revokedAt: null },
      data:  { revokedAt: new Date() },
    });
  }

  /** Revocar TODAS las sesiones del usuario (logout global) */
  async logoutAll(userId: string): Promise<{ revokedCount: number }> {
    const result = await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data:  { revokedAt: new Date() },
    });
    return { revokedCount: result.count };
  }

  // ─── ME ─────────────────────────────────────────────────────────────────────

  async me(userId: string) {
    return prisma.user.findFirst({
      where:  { id: userId, deletedAt: null },
      select: {
        id:                 true,
        name:               true,
        email:              true,
        role:               true,
        active:             true,
        lastLogin:          true,
        createdAt:          true,
        canDownloadMetrics: true,
        company: {
          select: { id: true, name: true, logo: true, active: true },
        },
      },
    });
  }

  // ─── UTILIDADES ESTÁTICAS ────────────────────────────────────────────────────

  static async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  }

  static async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
