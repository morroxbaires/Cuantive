-- Migration: 002_vehicle_documents
-- Adds the vehicle_documents table to track insurance, registration, permits and inspections

ALTER TABLE `companies`   ADD COLUMN IF NOT EXISTS `_vd_placeholder` TINYINT NULL;
ALTER TABLE `companies`   DROP COLUMN IF EXISTS `_vd_placeholder`;

CREATE TABLE IF NOT EXISTS `vehicle_documents` (
  `id`              CHAR(36)    NOT NULL,
  `company_id`      CHAR(36)    NOT NULL,
  `vehicle_id`      CHAR(36)    NOT NULL,
  `document_type`   ENUM('insurance','registration','permit','inspection') NOT NULL,
  `document_number` VARCHAR(80)  NULL,
  `issue_date`      DATE         NULL,
  `expiration_date` DATE         NULL,
  `file_url`        VARCHAR(512) NULL,
  `notes`           TEXT         NULL,
  `created_at`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3)  NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `idx_vd_company_expiry` (`company_id`, `expiration_date`),
  INDEX `idx_vd_vehicle`        (`vehicle_id`),

  CONSTRAINT `fk_vd_company` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`),
  CONSTRAINT `fk_vd_vehicle` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
