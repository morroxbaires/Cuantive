-- ─── Migración 006: Módulo Siniestros / Daños ─────────────────────────────
-- Crear tabla de siniestros/daños para el control de flota.
-- Todos los campos son opcionales excepto companyId (tenant).

CREATE TABLE IF NOT EXISTS `siniestros` (
  `id`             CHAR(36)       NOT NULL,
  `company_id`     CHAR(36)       NOT NULL,
  `vehicle_id`     CHAR(36)           NULL,
  `driver_id`      CHAR(36)           NULL,
  `fecha`          DATE               NULL,
  `hora`           TIME               NULL,
  `observaciones`  TEXT               NULL,
  `costo`          DECIMAL(12, 2)     NULL  COMMENT 'Costo en pesos uruguayos',
  `image_file`     CHAR(36)           NULL  COMMENT 'FK a files.id',
  `created_at`     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  CONSTRAINT `fk_siniestros_company`
    FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`),

  CONSTRAINT `fk_siniestros_vehicle`
    FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`)
    ON DELETE SET NULL,

  CONSTRAINT `fk_siniestros_driver`
    FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`)
    ON DELETE SET NULL,

  CONSTRAINT `fk_siniestros_file`
    FOREIGN KEY (`image_file`) REFERENCES `files` (`id`)
    ON DELETE SET NULL,

  INDEX `idx_siniestros_company_fecha` (`company_id`, `fecha`),
  INDEX `idx_siniestros_vehicle`       (`vehicle_id`),
  INDEX `idx_siniestros_driver`        (`driver_id`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
