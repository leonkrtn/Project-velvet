-- ============================================================
-- Forevr Migration 0122 — Vendor Brand Color
--
-- Einheitliches Dienstleister-Branding: eine Markenfarbe (Hex), die in den
-- Vendor-Dokumenten (Angebots-PDF) und in den an das Brautpaar gerichteten
-- Vendor-Mails als Akzent verwendet wird. Logo existiert bereits (logo_r2_key).
-- Leerer Wert = Forevr-Standardfarbe.
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE dienstleister_profiles
  ADD COLUMN IF NOT EXISTS brand_color TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN dienstleister_profiles.brand_color IS 'Markenfarbe (Hex, z. B. #B89968) fuer Vendor-PDF + Vendor-Mails; leer = Forevr-Standard';
