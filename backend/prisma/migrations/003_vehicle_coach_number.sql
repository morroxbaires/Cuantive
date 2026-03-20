-- Migration: 003_vehicle_coach_number
-- Adds optional coach_number field to vehicles (Número de coche, used for taxis and licensed vehicles)

ALTER TABLE vehicles
  ADD COLUMN coach_number VARCHAR(20) NULL AFTER color;
