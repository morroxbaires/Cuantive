import dotenv from 'dotenv';
dotenv.config();

export const env = {
  NODE_ENV:            process.env.NODE_ENV || 'development',
  PORT:                parseInt(process.env.PORT || '4000', 10),
  DATABASE_URL:        process.env.DATABASE_URL || '',
  FRONTEND_URL:        process.env.FRONTEND_URL || 'http://localhost:3000',
  JWT_ACCESS_SECRET:   process.env.JWT_ACCESS_SECRET || 'fallback_access_secret',
  JWT_REFRESH_SECRET:  process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret',
  JWT_ACCESS_EXPIRES:  process.env.JWT_ACCESS_EXPIRES  || '15m',
  JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES || '7d',
  UPLOAD_DIR:          process.env.UPLOAD_DIR || 'uploads',
  MAX_FILE_SIZE_MB:    parseInt(process.env.MAX_FILE_SIZE_MB || '3', 10),
} as const;

if (env.NODE_ENV === 'production') {
  if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT secrets no configurados en producción');
  }
}
