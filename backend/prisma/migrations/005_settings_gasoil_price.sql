-- Migration 005: Add gasoil_price to settings table
ALTER TABLE settings
  ADD COLUMN gasoil_price DECIMAL(10, 4) NULL AFTER fuel_price;
