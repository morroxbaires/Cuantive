-- ─── Migración 009: Campos estado y tipo en Siniestros ───────────────────────
-- Agrega campos estado (PENDIENTE/EN_PROCESO/CERRADO/RECHAZADO) y tipo
-- (CHOQUE/RASPADURA/ROBO/VANDALISMO/INCENDIO/OTRO) a la tabla siniestros.

ALTER TABLE `siniestros`
  ADD COLUMN `estado` VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'
    COMMENT 'Estado del siniestro: PENDIENTE, EN_PROCESO, CERRADO, RECHAZADO'
    AFTER `costo`,
  ADD COLUMN `tipo` VARCHAR(20) NULL
    COMMENT 'Tipo de siniestro: CHOQUE, RASPADURA, ROBO, VANDALISMO, INCENDIO, OTRO'
    AFTER `estado`;
