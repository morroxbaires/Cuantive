import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';

import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware';

// Routers
import authRoutes        from './modules/auth/auth.routes';
import companyRoutes     from './modules/companies/company.routes';
import userRoutes        from './modules/users/user.routes';
import vehicleRoutes     from './modules/vehicles/vehicle.routes';
import driverRoutes      from './modules/drivers/driver.routes';
import fuelLoadRoutes    from './modules/fuel-loads/fuel-load.routes';
import maintenanceRoutes from './modules/maintenance/maintenance.routes';
import alertRoutes       from './modules/alerts/alert.routes';
import settingsRoutes    from './modules/settings/settings.routes';
import fileRoutes        from './modules/files/file.routes';
import analyticsRoutes        from './modules/analytics/analytics.routes';
import reportsRoutes          from './modules/reports/reports.routes';
import vehicleDocumentRoutes  from './modules/vehicle-documents/vehicle-documents.routes';
import superadminRoutes        from './modules/superadmin/superadmin.routes';
import turnoRoutes             from './modules/turnos/turno.routes';
import siniestroRoutes         from './modules/siniestros/siniestro.routes';
import satisfaccionRoutes      from './modules/satisfaccion/satisfaccion.routes';
import publicRoutes            from './modules/public/public.routes';

import { scheduleDocumentExpiryJob } from './jobs/document-expiry.job';

const app = express();

// ─── SEGURIDAD ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin:      env.FRONTEND_URL,
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting global
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max:      200,
  message:  { success: false, message: 'Demasiadas solicitudes, intenta más tarde' },
  standardHeaders: true,
  legacyHeaders:   false,
}));

// Rate limiting estricto solo para login
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  message:  { success: false, message: 'Demasiados intentos de login' },
}));

// ─── PARSERS Y UTILIDADES ────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());
app.use(compression());

// Logger — solo en desarrollo
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Servir archivos estáticos de uploads (logos, recibos)
app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)));

// ─── RUTAS API ────────────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/companies',    companyRoutes);
app.use('/api/users',        userRoutes);
app.use('/api/vehicles',     vehicleRoutes);
app.use('/api/drivers',      driverRoutes);
app.use('/api/fuel-loads',   fuelLoadRoutes);
app.use('/api/maintenance',  maintenanceRoutes);
app.use('/api/alerts',       alertRoutes);
app.use('/api/settings',     settingsRoutes);
app.use('/api/files',        fileRoutes);
app.use('/api/reports',            reportsRoutes);
app.use('/api/analytics',          analyticsRoutes);
app.use('/api/vehicle-documents',  vehicleDocumentRoutes);
app.use('/api/superadmin',         superadminRoutes);
app.use('/api/turnos',             turnoRoutes);
app.use('/api/siniestros',         siniestroRoutes);
app.use('/api/satisfaccion',       satisfaccionRoutes);
app.use('/api/public',             publicRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: env.NODE_ENV });
});

// ─── MANEJO DE ERRORES ────────────────────────────────────────────────────────
app.use(notFoundMiddleware);
app.use(errorMiddleware);

// ─── INICIO DEL SERVIDOR ─────────────────────────────────────────────────────
async function bootstrap() {
  await connectDatabase();

  // Schedule cron jobs
  scheduleDocumentExpiryJob();

  const server = app.listen(env.PORT, () => {
    console.log(`🚀 Cuantive API corriendo en http://localhost:${env.PORT}`);
    console.log(`🌍 Entorno: ${env.NODE_ENV}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n⚠️  ${signal} recibido. Cerrando servidor...`);
    server.close(async () => {
      await disconnectDatabase();
      console.log('✅ Servidor cerrado correctamente');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('❌ Error al iniciar el servidor:', err);
  process.exit(1);
});

export default app;
