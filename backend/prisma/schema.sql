-- =============================================================================
--  CUANTIVE — Schema MySQL Completo
--  Plataforma SaaS de Control de Flotas Empresariales
--  Versión 1.0 | Multi-Tenant | Uruguay
-- =============================================================================
--  Convenciones:
--    - IDs:       CHAR(36)  → UUID v4 (previene enumeración de recursos)
--    - Auditoría: created_at, updated_at en todas las tablas
--    - Soft delete: deleted_at DATETIME NULL en entidades principales
--    - Moneda:    DECIMAL(12,2) en pesos uruguayos (UYU)
--    - Multi-tenant: company_id presente (directa o vía JOIN) en cada tabla
--    - charset:   utf8mb4 para soporte de emojis y caracteres especiales
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- =============================================================================
-- BASE DE DATOS
-- =============================================================================

CREATE DATABASE IF NOT EXISTS cuantive
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE cuantive;


-- =============================================================================
-- TABLA: fuel_types  (catálogo global — sin company_id)
-- Tipos de combustible disponibles en el sistema.
-- Administrados por superroot. No son por empresa.
-- =============================================================================
CREATE TABLE fuel_types (
  id            TINYINT UNSIGNED    NOT NULL AUTO_INCREMENT,
  name          VARCHAR(50)         NOT NULL COMMENT 'Ej: Gasoil, Súper 95, Súper 98, Eléctrico',
  unit          ENUM('litros','kwh') NOT NULL DEFAULT 'litros',
  active        TINYINT(1)          NOT NULL DEFAULT 1,
  created_at    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_fuel_types_name (name)

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Catálogo global de tipos de combustible. Gestionado por superroot.';

-- Datos iniciales de catálogo
INSERT INTO fuel_types (name, unit) VALUES
  ('Gasoil',    'litros'),
  ('Súper 95',  'litros'),
  ('Súper 98',  'litros'),
  ('GNC',       'litros'),
  ('Eléctrico', 'kwh');


-- =============================================================================
-- TABLA: vehicle_types  (catálogo global — sin company_id)
-- Tipos de vehículo del sistema. Administrados por superroot.
-- =============================================================================
CREATE TABLE vehicle_types (
  id            TINYINT UNSIGNED    NOT NULL AUTO_INCREMENT,
  name          VARCHAR(60)         NOT NULL COMMENT 'Ej: Automóvil, Camión, Furgón, Camioneta, Bus',
  active        TINYINT(1)          NOT NULL DEFAULT 1,
  created_at    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_vehicle_types_name (name)

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Catálogo global de tipos de vehículo. Gestionado por superroot.';

-- Datos iniciales de catálogo
INSERT INTO vehicle_types (name) VALUES
  ('Automóvil'),
  ('Camioneta'),
  ('Furgón'),
  ('Camión'),
  ('Bus / Ómnibus'),
  ('Moto'),
  ('Vehículo Eléctrico'),
  ('Maquinaria'),
  ('Taxi');


-- =============================================================================
-- TABLA: companies  (tenant principal)
-- Cada fila representa una empresa cliente del SaaS.
-- Es la raíz del modelo multi-tenant.
-- =============================================================================
CREATE TABLE companies (
  id            CHAR(36)            NOT NULL,
  name          VARCHAR(120)        NOT NULL COMMENT 'Razón social',
  trade_name    VARCHAR(120)            NULL COMMENT 'Nombre comercial / fantasía',
  rut           VARCHAR(20)             NULL COMMENT 'RUT empresa Uruguay (formato XX.XXX.XXX/X)',
  logo          VARCHAR(512)            NULL COMMENT 'Ruta relativa del logo almacenado',
  address       VARCHAR(255)            NULL,
  city          VARCHAR(80)             NULL,
  phone         VARCHAR(30)             NULL,
  email         VARCHAR(120)            NULL,
  active        TINYINT(1)          NOT NULL DEFAULT 1 COMMENT '0 = desactivada por superroot',
  created_at    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    DATETIME                NULL COMMENT 'Soft delete — null = activo',

  PRIMARY KEY (id),
  UNIQUE KEY uq_companies_rut (rut),
  KEY idx_companies_active     (active),
  KEY idx_companies_deleted_at (deleted_at)

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Tabla de empresas (tenants). Raíz del modelo multi-tenant.';


-- =============================================================================
-- TABLA: users
-- Usuarios del sistema. Soporta dos roles:
--   superroot → company_id IS NULL  (admin global del SaaS)
--   admin     → company_id NOT NULL (admin de una empresa)
-- =============================================================================
CREATE TABLE users (
  id              CHAR(36)            NOT NULL,
  company_id      CHAR(36)                NULL COMMENT 'NULL solo para superroot',
  name            VARCHAR(100)        NOT NULL,
  email           VARCHAR(120)        NOT NULL,
  password_hash   VARCHAR(255)        NOT NULL COMMENT 'bcrypt hash, cost factor >= 12',
  role            ENUM('superroot','admin') NOT NULL DEFAULT 'admin',
  active          TINYINT(1)          NOT NULL DEFAULT 1,
  last_login      DATETIME                NULL,
  created_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME                NULL COMMENT 'Soft delete',

  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email             (email),
  KEY idx_users_company_id              (company_id),
  KEY idx_users_role                    (role),
  KEY idx_users_active                  (active),
  KEY idx_users_company_active          (company_id, active),
  KEY idx_users_deleted_at              (deleted_at),

  CONSTRAINT fk_users_company
    FOREIGN KEY (company_id)
    REFERENCES companies (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Usuarios del sistema. Superroot tiene company_id NULL.';


-- =============================================================================
-- TABLA: files
-- Almacén central de metadatos de archivos subidos al sistema.
-- Cada registro apunta a un archivo físico (disco local o S3).
-- Relacionado desde fuel_loads, maintenance, companies (logo).
-- =============================================================================
CREATE TABLE files (
  id              CHAR(36)            NOT NULL,
  company_id      CHAR(36)            NOT NULL COMMENT 'Tenant propietario del archivo',
  uploaded_by     CHAR(36)                NULL COMMENT 'Usuario que subió el archivo',
  original_name   VARCHAR(255)        NOT NULL COMMENT 'Nombre original del archivo',
  stored_name     VARCHAR(255)        NOT NULL COMMENT 'Nombre en disco / clave S3',
  mime_type       VARCHAR(100)        NOT NULL,
  size_bytes      INT UNSIGNED        NOT NULL DEFAULT 0,
  storage_path    VARCHAR(512)        NOT NULL COMMENT 'Ruta relativa o key en S3',
  created_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_files_company_id   (company_id),
  KEY idx_files_uploaded_by  (uploaded_by),

  CONSTRAINT fk_files_company
    FOREIGN KEY (company_id)
    REFERENCES companies (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_files_user
    FOREIGN KEY (uploaded_by)
    REFERENCES users (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Repositorio central de archivos adjuntos (recibos, logos, documentos).';


-- =============================================================================
-- TABLA: drivers
-- Conductores habilitados de una empresa.
-- =============================================================================
CREATE TABLE drivers (
  id                  CHAR(36)        NOT NULL,
  company_id          CHAR(36)        NOT NULL,
  name                VARCHAR(80)     NOT NULL,
  lastname            VARCHAR(80)     NOT NULL,
  document            VARCHAR(20)         NULL COMMENT 'Cédula de Identidad Uruguay',
  license_category    VARCHAR(10)         NULL COMMENT 'Categoría libreta: A, B, C, D, E',
  license_expiry      DATE                NULL COMMENT 'Vencimiento de la libreta de conducir',
  phone               VARCHAR(30)         NULL,
  email               VARCHAR(120)        NULL,
  notes               TEXT                NULL,
  active              TINYINT(1)      NOT NULL DEFAULT 1,
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at          DATETIME            NULL COMMENT 'Soft delete',

  PRIMARY KEY (id),
  UNIQUE KEY uq_drivers_document_company      (company_id, document),
  KEY idx_drivers_company_id                  (company_id),
  KEY idx_drivers_active                      (active),
  KEY idx_drivers_license_expiry              (license_expiry)  COMMENT 'Para alertas de vencimiento',
  KEY idx_drivers_company_active              (company_id, active),
  KEY idx_drivers_deleted_at                  (deleted_at),

  CONSTRAINT fk_drivers_company
    FOREIGN KEY (company_id)
    REFERENCES companies (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Conductores por empresa. Incluye datos de libreta para alertas de vencimiento.';


-- =============================================================================
-- TABLA: vehicles
-- Vehículos del parque automotor de una empresa.
-- =============================================================================
CREATE TABLE vehicles (
  id                    CHAR(36)            NOT NULL,
  company_id            CHAR(36)            NOT NULL,
  vehicle_type_id       TINYINT UNSIGNED        NULL,
  fuel_type_id          TINYINT UNSIGNED        NULL,
  plate                 VARCHAR(20)         NOT NULL COMMENT 'Matrícula uruguaya',
  name                  VARCHAR(100)            NULL COMMENT 'Alias / nombre interno',
  brand                 VARCHAR(60)             NULL,
  model                 VARCHAR(60)             NULL,
  year                  SMALLINT UNSIGNED       NULL,
  color                 VARCHAR(40)             NULL,
  coach_number          VARCHAR(20)             NULL COMMENT 'Número de coche (taxi u otros)',
  vin                   VARCHAR(30)             NULL COMMENT 'Número de chasis',
  current_odometer      INT UNSIGNED        NOT NULL DEFAULT 0 COMMENT 'Km actuales (o kWh)',
  efficiency_reference  DECIMAL(6,2)            NULL COMMENT 'km/litro o km/kWh de referencia',
  active                TINYINT(1)          NOT NULL DEFAULT 1,
  created_at            DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at            DATETIME                NULL COMMENT 'Soft delete',

  PRIMARY KEY (id),
  UNIQUE KEY uq_vehicles_plate_company      (company_id, plate),
  KEY idx_vehicles_company_id               (company_id),
  KEY idx_vehicles_vehicle_type_id          (vehicle_type_id),
  KEY idx_vehicles_fuel_type_id             (fuel_type_id),
  KEY idx_vehicles_active                   (active),
  KEY idx_vehicles_company_active           (company_id, active),
  KEY idx_vehicles_deleted_at               (deleted_at),

  CONSTRAINT fk_vehicles_company
    FOREIGN KEY (company_id)
    REFERENCES companies (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_vehicles_vehicle_type
    FOREIGN KEY (vehicle_type_id)
    REFERENCES vehicle_types (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT fk_vehicles_fuel_type
    FOREIGN KEY (fuel_type_id)
    REFERENCES fuel_types (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Vehículos del parque automotor por empresa.';


-- =============================================================================
-- TABLA: fuel_loads
-- Registro de cada carga de combustible (o recarga eléctrica).
-- company_id desnormalizado para queries multi-tenant eficientes.
-- =============================================================================
CREATE TABLE fuel_loads (
  id              CHAR(36)            NOT NULL,
  company_id      CHAR(36)            NOT NULL COMMENT 'Desnormalizado para filtros multi-tenant',
  vehicle_id      CHAR(36)            NOT NULL,
  driver_id       CHAR(36)                NULL COMMENT 'Conductor que realizó la carga',
  date            DATETIME            NOT NULL COMMENT 'Fecha y hora de la carga',
  liters_or_kwh   DECIMAL(10,3)       NOT NULL COMMENT 'Litros o kWh cargados',
  unit_price      DECIMAL(10,4)           NULL COMMENT 'Precio unitario al momento de la carga (UYU)',
  price_total     DECIMAL(12,2)           NULL COMMENT 'Total pagado en UYU',
  odometer        INT UNSIGNED            NULL COMMENT 'Odómetro al momento de la carga',
  km_per_unit     DECIMAL(8,2)            NULL COMMENT 'Calculado: km recorridos / litros|kWh',
  station         VARCHAR(120)            NULL COMMENT 'Nombre de la estación de servicio',
  receipt_file    CHAR(36)                NULL COMMENT 'FK → files.id',
  notes           TEXT                    NULL,
  created_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_fuel_loads_company_id       (company_id),
  KEY idx_fuel_loads_vehicle_id       (vehicle_id),
  KEY idx_fuel_loads_driver_id        (driver_id),
  KEY idx_fuel_loads_date             (date),
  KEY idx_fuel_loads_company_date     (company_id, date) COMMENT 'Filtro por empresa + rango de fechas',
  KEY idx_fuel_loads_vehicle_date     (vehicle_id, date) COMMENT 'Historial por vehículo',

  CONSTRAINT fk_fuel_loads_company
    FOREIGN KEY (company_id)
    REFERENCES companies (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_fuel_loads_vehicle
    FOREIGN KEY (vehicle_id)
    REFERENCES vehicles (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_fuel_loads_driver
    FOREIGN KEY (driver_id)
    REFERENCES drivers (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT fk_fuel_loads_file
    FOREIGN KEY (receipt_file)
    REFERENCES files (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Cargas de combustible o recargas eléctricas por vehículo.';


-- =============================================================================
-- TABLA: maintenance
-- Historial de mantenimientos preventivos y correctivos por vehículo.
-- =============================================================================
CREATE TABLE maintenance (
  id                  CHAR(36)            NOT NULL,
  company_id          CHAR(36)            NOT NULL COMMENT 'Desnormalizado para filtros multi-tenant',
  vehicle_id          CHAR(36)            NOT NULL,
  type                ENUM('preventivo','correctivo') NOT NULL DEFAULT 'preventivo',
  description         VARCHAR(255)        NOT NULL COMMENT 'Descripción del trabajo realizado',
  date                DATE                NOT NULL COMMENT 'Fecha de realización',
  odometer            INT UNSIGNED            NULL COMMENT 'Odómetro al momento del servicio',
  cost                DECIMAL(12,2)           NULL COMMENT 'Costo en UYU',
  next_service_km     INT UNSIGNED            NULL COMMENT 'Km en que se debe hacer el próximo servicio',
  next_service_date   DATE                    NULL COMMENT 'Fecha estimada del próximo servicio',
  provider            VARCHAR(120)            NULL COMMENT 'Taller o proveedor',
  notes               TEXT                    NULL,
  receipt_file        CHAR(36)                NULL COMMENT 'FK → files.id',
  created_at          DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_maintenance_company_id          (company_id),
  KEY idx_maintenance_vehicle_id          (vehicle_id),
  KEY idx_maintenance_date                (date),
  KEY idx_maintenance_next_service_date   (next_service_date) COMMENT 'Alertas de próximo servicio',
  KEY idx_maintenance_next_service_km     (next_service_km),
  KEY idx_maintenance_company_date        (company_id, date),
  KEY idx_maintenance_vehicle_date        (vehicle_id, date),

  CONSTRAINT fk_maintenance_company
    FOREIGN KEY (company_id)
    REFERENCES companies (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_maintenance_vehicle
    FOREIGN KEY (vehicle_id)
    REFERENCES vehicles (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_maintenance_file
    FOREIGN KEY (receipt_file)
    REFERENCES files (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Historial de mantenimientos preventivos y correctivos por vehículo.';


-- =============================================================================
-- TABLA: alerts
-- Reglas de alerta configuradas por empresa.
-- Cada fila define un umbral que dispara una notificación.
-- Los tipos de alerta cubren: combustible, mantenimiento, documentación.
-- =============================================================================
CREATE TABLE alerts (
  id              CHAR(36)            NOT NULL,
  company_id      CHAR(36)            NOT NULL,
  vehicle_id      CHAR(36)                NULL COMMENT 'NULL = aplica a toda la flota',
  driver_id       CHAR(36)                NULL COMMENT 'NULL = aplica a todos los conductores',
  type            ENUM(
                    'fuel_excess',
                    'no_fuel_load',
                    'maintenance_due_date',
                    'maintenance_due_km',
                    'license_expiry',
                    'vehicle_document_expiry',
                    'custom'
                  ) NOT NULL,
  threshold       DECIMAL(10,2)           NULL COMMENT 'Umbral numérico (litros/100km, días, km, etc.)',
  threshold_unit  VARCHAR(30)             NULL COMMENT 'Unidad del umbral: días, km, litros, %',
  message         VARCHAR(255)            NULL COMMENT 'Mensaje personalizado para la alerta',
  active          TINYINT(1)          NOT NULL DEFAULT 1,
  created_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_alerts_company_id       (company_id),
  KEY idx_alerts_vehicle_id       (vehicle_id),
  KEY idx_alerts_driver_id        (driver_id),
  KEY idx_alerts_type             (type),
  KEY idx_alerts_active           (active),
  KEY idx_alerts_company_type     (company_id, type, active),

  CONSTRAINT fk_alerts_company
    FOREIGN KEY (company_id)
    REFERENCES companies (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_alerts_vehicle
    FOREIGN KEY (vehicle_id)
    REFERENCES vehicles (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_alerts_driver
    FOREIGN KEY (driver_id)
    REFERENCES drivers (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Reglas de alerta configuradas por empresa. Umbrales para notificaciones automáticas.';


-- =============================================================================
-- TABLA: alert_notifications
-- Instancias disparadas de alertas (historial de eventos).
-- Separar las REGLAS (alerts) de los EVENTOS (alert_notifications)
-- permite mantener historial sin contaminar la configuración.
-- =============================================================================
CREATE TABLE alert_notifications (
  id              CHAR(36)            NOT NULL,
  company_id      CHAR(36)            NOT NULL,
  alert_id        CHAR(36)                NULL COMMENT 'Regla que generó esta notificación',
  vehicle_id      CHAR(36)                NULL,
  driver_id       CHAR(36)                NULL,
  type            VARCHAR(60)         NOT NULL,
  message         TEXT                NOT NULL,
  read_at         DATETIME                NULL COMMENT 'NULL = no leída',
  created_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_alert_notif_company_id      (company_id),
  KEY idx_alert_notif_alert_id        (alert_id),
  KEY idx_alert_notif_vehicle_id      (vehicle_id),
  KEY idx_alert_notif_driver_id       (driver_id),
  KEY idx_alert_notif_read_at         (read_at)      COMMENT 'Filtrar no leídas',
  KEY idx_alert_notif_company_read    (company_id, read_at),
  KEY idx_alert_notif_created_at      (created_at),

  CONSTRAINT fk_alert_notif_company
    FOREIGN KEY (company_id)
    REFERENCES companies (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_alert_notif_alert
    FOREIGN KEY (alert_id)
    REFERENCES alerts (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT fk_alert_notif_vehicle
    FOREIGN KEY (vehicle_id)
    REFERENCES vehicles (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT fk_alert_notif_driver
    FOREIGN KEY (driver_id)
    REFERENCES drivers (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Historial de notificaciones de alerta disparadas automáticamente.';


-- =============================================================================
-- TABLA: settings
-- Configuración operativa por empresa (un registro por tenant).
-- =============================================================================
CREATE TABLE settings (
  id                          CHAR(36)        NOT NULL,
  company_id                  CHAR(36)        NOT NULL,

  -- Precios de referencia
  fuel_price                  DECIMAL(10,4)       NULL COMMENT 'Precio litro combustible UYU (referencia)',
  electricity_price           DECIMAL(10,4)       NULL COMMENT 'Precio kWh electricidad UYU',

  -- Umbrales para alertas automáticas
  alert_days_before_license   SMALLINT UNSIGNED   NULL DEFAULT 30  COMMENT 'Días antes de generar alerta por venc. libreta',
  alert_days_before_maint     SMALLINT UNSIGNED   NULL DEFAULT 15  COMMENT 'Días antes de generar alerta por mantenimiento',
  alert_km_before_maint       INT UNSIGNED        NULL DEFAULT 500 COMMENT 'Km antes del próximo serv. para alertar',
  alert_fuel_excess_pct       DECIMAL(5,2)        NULL DEFAULT 20  COMMENT '% sobre eficiencia de referencia para alerta',
  alert_no_load_days          SMALLINT UNSIGNED   NULL DEFAULT 7   COMMENT 'Días sin carga combustible para alertar',

  created_at                  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_settings_company      (company_id)  COMMENT 'Un registro por empresa',

  CONSTRAINT fk_settings_company
    FOREIGN KEY (company_id)
    REFERENCES companies (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Configuración operativa y umbrales de alerta por empresa (un registro por tenant).';


-- =============================================================================
-- TABLA: refresh_tokens
-- Gestión de tokens de actualización JWT.
-- Permite invalidar sesiones específicas o de todo un usuario.
-- =============================================================================
CREATE TABLE refresh_tokens (
  id              CHAR(36)            NOT NULL,
  user_id         CHAR(36)            NOT NULL,
  company_id      CHAR(36)                NULL COMMENT 'Desnormalizado para queries de empresa',
  token_hash      CHAR(64)            NOT NULL COMMENT 'SHA-256 del refresh token',
  user_agent      VARCHAR(255)            NULL,
  ip_address      VARCHAR(45)             NULL COMMENT 'IPv4 o IPv6',
  expires_at      DATETIME            NOT NULL,
  revoked_at      DATETIME                NULL COMMENT 'NULL = vigente',
  created_at      DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_tokens_hash       (token_hash),
  KEY idx_refresh_tokens_user_id          (user_id),
  KEY idx_refresh_tokens_company_id       (company_id),
  KEY idx_refresh_tokens_expires_at       (expires_at),
  KEY idx_refresh_tokens_revoked_at       (revoked_at),

  CONSTRAINT fk_refresh_tokens_user
    FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Refresh tokens JWT. Permite revocación individual y auditoría de sesiones.';


-- =============================================================================
-- VISTA: v_fleet_summary
-- Resumen de flota por empresa para el dashboard.
-- Evita queries complejas repetitivas en el backend.
-- =============================================================================
CREATE OR REPLACE VIEW v_fleet_summary AS
  SELECT
    c.id                                        AS company_id,
    c.name                                      AS company_name,
    COUNT(DISTINCT v.id)                        AS total_vehicles,
    SUM(CASE WHEN v.active = 1 AND v.deleted_at IS NULL THEN 1 ELSE 0 END) AS active_vehicles,
    COUNT(DISTINCT d.id)                        AS total_drivers,
    SUM(CASE WHEN d.active = 1 AND d.deleted_at IS NULL THEN 1 ELSE 0 END) AS active_drivers,
    COUNT(DISTINCT an.id)                       AS unread_alerts,
    SUM(CASE WHEN fl.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
             THEN fl.price_total ELSE 0 END)    AS fuel_cost_last_30d
  FROM companies c
  LEFT JOIN vehicles  v  ON v.company_id  = c.id AND v.deleted_at  IS NULL
  LEFT JOIN drivers   d  ON d.company_id  = c.id AND d.deleted_at  IS NULL
  LEFT JOIN alert_notifications an ON an.company_id = c.id AND an.read_at IS NULL
  LEFT JOIN fuel_loads fl ON fl.company_id = c.id
  WHERE c.deleted_at IS NULL
  GROUP BY c.id, c.name;


-- =============================================================================
-- VISTA: v_upcoming_maintenances
-- Próximos mantenimientos ordenados por urgencia.
-- =============================================================================
CREATE OR REPLACE VIEW v_upcoming_maintenances AS
  SELECT
    m.id,
    m.company_id,
    v.plate,
    v.name                                          AS vehicle_name,
    m.description,
    m.next_service_date,
    m.next_service_km,
    v.current_odometer,
    (m.next_service_km - v.current_odometer)        AS km_remaining,
    DATEDIFF(m.next_service_date, CURDATE())        AS days_remaining
  FROM maintenance m
  INNER JOIN vehicles v ON v.id = m.vehicle_id
  WHERE
    (m.next_service_date IS NOT NULL AND m.next_service_date >= CURDATE())
    OR
    (m.next_service_km IS NOT NULL AND m.next_service_km > v.current_odometer)
  ORDER BY days_remaining ASC, km_remaining ASC;


-- =============================================================================
-- VISTA: v_expiring_licenses
-- Conductores con libreta de conducir próxima a vencer.
-- =============================================================================
CREATE OR REPLACE VIEW v_expiring_licenses AS
  SELECT
    d.id,
    d.company_id,
    d.name,
    d.lastname,
    d.document,
    d.license_category,
    d.license_expiry,
    DATEDIFF(d.license_expiry, CURDATE())  AS days_until_expiry
  FROM drivers d
  WHERE
    d.active      = 1
    AND d.deleted_at IS NULL
    AND d.license_expiry IS NOT NULL
    AND d.license_expiry >= CURDATE()
  ORDER BY d.license_expiry ASC;


-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Trigger: generar settings por defecto al crear una empresa
DELIMITER $$
CREATE TRIGGER trg_companies_after_insert
AFTER INSERT ON companies
FOR EACH ROW
BEGIN
  INSERT INTO settings (
    id,
    company_id,
    fuel_price,
    electricity_price,
    alert_days_before_license,
    alert_days_before_maint,
    alert_km_before_maint,
    alert_fuel_excess_pct,
    alert_no_load_days
  ) VALUES (
    UUID(),
    NEW.id,
    NULL,
    NULL,
    30,
    15,
    500,
    20.00,
    7
  );
END$$
DELIMITER ;


-- Trigger: actualizar odómetro del vehículo al registrar carga
DELIMITER $$
CREATE TRIGGER trg_fuel_loads_after_insert
AFTER INSERT ON fuel_loads
FOR EACH ROW
BEGIN
  IF NEW.odometer IS NOT NULL THEN
    UPDATE vehicles
    SET
      current_odometer = NEW.odometer,
      updated_at       = CURRENT_TIMESTAMP
    WHERE
      id = NEW.vehicle_id
      AND current_odometer < NEW.odometer;
  END IF;
END$$
DELIMITER ;


-- Trigger: actualizar odómetro del vehículo al registrar mantenimiento
DELIMITER $$
CREATE TRIGGER trg_maintenance_after_insert
AFTER INSERT ON maintenance
FOR EACH ROW
BEGIN
  IF NEW.odometer IS NOT NULL THEN
    UPDATE vehicles
    SET
      current_odometer = NEW.odometer,
      updated_at       = CURRENT_TIMESTAMP
    WHERE
      id = NEW.vehicle_id
      AND current_odometer < NEW.odometer;
  END IF;
END$$
DELIMITER ;


-- =============================================================================
-- USUARIO DE BASE DE DATOS (producción)
-- Principio de mínimo privilegio: el backend usa un usuario sin SUPER
-- =============================================================================

-- NOTA: Ejecutar con usuario root solo en configuración inicial.
-- Reemplazar 'contraseña_segura' antes de ejecutar en producción.

-- CREATE USER IF NOT EXISTS 'cuantive_app'@'%' IDENTIFIED BY 'contraseña_segura';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON cuantive.* TO 'cuantive_app'@'%';
-- FLUSH PRIVILEGES;


SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- FIN DEL SCHEMA
-- Cuantive v1.0 — Multi-Tenant Fleet Management SaaS — Uruguay
-- =============================================================================
