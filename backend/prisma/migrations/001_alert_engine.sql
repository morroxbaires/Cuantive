-- ============================================================
-- Cuantive · Alert Engine Migration
-- Run once against the target database.
-- ============================================================

-- 1. Extend AlertType enum (MySQL: re-declare the column)
ALTER TABLE `alerts`
  MODIFY COLUMN `type` ENUM(
    'fuel_excess',
    'no_fuel_load',
    'maintenance_due_date',
    'maintenance_due_km',
    'maintenance_overdue',
    'no_maintenance',
    'odometer_mismatch',
    'license_expiry',
    'vehicle_document_expiry',
    'custom'
  ) NOT NULL;

-- 2. Add severity, resolved_at, metadata to alert_notifications
ALTER TABLE `alert_notifications`
  ADD COLUMN `severity`    ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium' AFTER `type`,
  ADD COLUMN `metadata`    JSON                                              AFTER `message`,
  ADD COLUMN `resolved_at` DATETIME(3)                                       AFTER `read_at`;

-- 3. Add composite index for deduplication lookups
ALTER TABLE `alert_notifications`
  ADD INDEX `idx_notif_dedup` (`company_id`, `type`(60), `vehicle_id`, `resolved_at`);

-- 4. Create AlertConfig table
CREATE TABLE `alert_configs` (
  `id`             CHAR(36)        NOT NULL,
  `company_id`     CHAR(36)        NOT NULL,
  `alert_type`     ENUM(
    'fuel_excess',
    'no_fuel_load',
    'maintenance_due_date',
    'maintenance_due_km',
    'maintenance_overdue',
    'no_maintenance',
    'odometer_mismatch',
    'license_expiry',
    'vehicle_document_expiry',
    'custom'
  )                NOT NULL,
  `enabled`        TINYINT(1)      NOT NULL DEFAULT 1,
  `threshold`      DECIMAL(10,2)   NULL,
  `threshold_unit` VARCHAR(30)     NULL,
  `window_days`    SMALLINT UNSIGNED NULL,
  `created_at`     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_company_alert_type` (`company_id`, `alert_type`),
  INDEX          `idx_company_enabled` (`company_id`, `enabled`),
  CONSTRAINT `fk_alert_configs_company`
    FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
