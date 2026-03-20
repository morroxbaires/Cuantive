-- Migration: 004_turnos
-- Tabla de turnos de taxi/transporte para control de KPIs operativos.

CREATE TABLE turnos (
  id              CHAR(36)         NOT NULL,
  company_id      CHAR(36)         NOT NULL,
  vehicle_id      CHAR(36)         NOT NULL,
  driver_id       CHAR(36)         NOT NULL,
  shift_date      DATE             NOT NULL COMMENT 'Fecha del turno',
  shift_number    INT              NOT NULL COMMENT 'Número de turno del día',
  total_fichas    DECIMAL(10,2)    NOT NULL DEFAULT 0 COMMENT 'Fichas totales del turno',
  km_ocupados     DECIMAL(10,2)    NOT NULL DEFAULT 0 COMMENT 'Kilómetros con pasajero',
  km_libres       DECIMAL(10,2)    NOT NULL DEFAULT 0 COMMENT 'Kilómetros sin pasajero',
  km_totales      DECIMAL(10,2)    NOT NULL DEFAULT 0 COMMENT 'km_ocupados + km_libres',
  notes           TEXT                 NULL,
  created_at      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_turnos_company_date   (company_id, shift_date),
  KEY idx_turnos_vehicle_id     (vehicle_id),
  KEY idx_turnos_driver_id      (driver_id),

  CONSTRAINT fk_turnos_company
    FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_turnos_vehicle
    FOREIGN KEY (vehicle_id) REFERENCES vehicles (id)  ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_turnos_driver
    FOREIGN KEY (driver_id)  REFERENCES drivers (id)   ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
