-- ─── Migración 007: Módulo Satisfacción ────────────────────────────────────
-- Tabla para registrar evaluaciones de satisfacción por vehículo.
-- La puntuación va del 1 (pésimo) al 10 (excelente).
-- El campo `source` distingue si fue ingresada manualmente o vía QR.

CREATE TABLE IF NOT EXISTS `satisfacciones` (
  `id`             CHAR(36)              NOT NULL,
  `company_id`     CHAR(36)              NOT NULL,
  `vehicle_id`     CHAR(36)                  NULL,
  `fecha`          DATE                      NULL,
  `hora`           TIME                      NULL,
  `puntuacion`     TINYINT UNSIGNED          NULL  COMMENT '1 = pésimo, 10 = excelente',
  `observaciones`  TEXT                      NULL,
  `image_file`     CHAR(36)                  NULL  COMMENT 'FK a files.id',
  `source`         VARCHAR(10)   NOT NULL DEFAULT 'manual' COMMENT 'manual | qr',
  `created_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  CONSTRAINT `fk_satisfacciones_company`
    FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`),

  CONSTRAINT `fk_satisfacciones_vehicle`
    FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`)
    ON DELETE SET NULL,

  CONSTRAINT `fk_satisfacciones_file`
    FOREIGN KEY (`image_file`) REFERENCES `files` (`id`)
    ON DELETE SET NULL,

  INDEX `idx_satisfacciones_company_fecha` (`company_id`, `fecha`),
  INDEX `idx_satisfacciones_vehicle`       (`vehicle_id`)

) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
