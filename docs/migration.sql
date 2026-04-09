-- ============================================================
-- SiteLog Migration: Travel Time + Device Transfer
-- Run each statement individually in the Cloudflare D1 console
-- ============================================================

-- 1. Travel columns on visits table
ALTER TABLE visits ADD COLUMN travel_in_miles REAL;
ALTER TABLE visits ADD COLUMN travel_in_mins INTEGER;
ALTER TABLE visits ADD COLUMN travel_out_miles REAL;
ALTER TABLE visits ADD COLUMN travel_out_mins INTEGER;
ALTER TABLE visits ADD COLUMN is_first_of_day INTEGER DEFAULT 0;

-- 2. Travel settings on people/engineers table
ALTER TABLE people ADD COLUMN travel_status TEXT DEFAULT 'not_configured';
ALTER TABLE people ADD COLUMN travel_cap_type TEXT;
ALTER TABLE people ADD COLUMN travel_cap_value REAL;

-- 3. Flag for temporary transfer-pending people records
ALTER TABLE people ADD COLUMN is_transfer_pending INTEGER DEFAULT 0;

-- 4. Device transfer requests table
CREATE TABLE IF NOT EXISTS device_transfers (
  id                TEXT PRIMARY KEY,
  new_device_token  TEXT NOT NULL,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  company           TEXT NOT NULL,
  status            TEXT DEFAULT 'pending',
  temp_person_id    TEXT,
  target_person_id  TEXT,
  requested_at      TEXT NOT NULL,
  resolved_at       TEXT
);
