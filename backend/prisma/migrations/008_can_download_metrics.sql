-- Migration 008: add can_download_metrics permission to users
ALTER TABLE users
  ADD COLUMN can_download_metrics BOOLEAN NOT NULL DEFAULT FALSE;
