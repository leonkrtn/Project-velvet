-- ============================================================
-- Forevr Migration 0127 — Allgemeine Firmenadresse (Dienstleister)
--
-- Bisher gibt es nur EIN Ortsfeld pro Dienstleister (street/zip/city aus
-- Migration 0099) — das ist der marktplatz-spezifische Ort, gepflegt im
-- Marktplatz-Listing-Editor (VendorListingClient.tsx).
--
-- Diese Migration fuegt einen zweiten, allgemeinen Adress-Block hinzu, der
-- NICHT Teil des Marktplatz-Listings ist, sondern als allgemeine Firmen-/
-- Stammdaten gilt (z.B. fuer Rechnungsadresse, interne Verwaltung).
--
-- Anzeige-Logik (siehe lib/vendor/location.ts -> resolveVendorLocation()):
-- Ist im Marktplatz-Listing (street/zip/city) ein Ort hinterlegt, wird DIESER
-- ueberall angezeigt. Ist dort NICHTS hinterlegt, aber die allgemeine
-- Firmenadresse gesetzt, wird automatisch DIESE als Fallback angezeigt.
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE dienstleister_profiles
  ADD COLUMN IF NOT EXISTS company_street TEXT;
ALTER TABLE dienstleister_profiles
  ADD COLUMN IF NOT EXISTS company_zip    TEXT;
ALTER TABLE dienstleister_profiles
  ADD COLUMN IF NOT EXISTS company_city   TEXT;

COMMENT ON COLUMN dienstleister_profiles.company_street IS 'Allgemeine Firmenadresse (Strasse) — Stammdaten, NICHT Teil des Marktplatz-Listings. Fallback fuer street, wenn dort nichts hinterlegt ist.';
COMMENT ON COLUMN dienstleister_profiles.company_zip    IS 'Allgemeine Firmenadresse (PLZ) — Stammdaten, NICHT Teil des Marktplatz-Listings. Fallback fuer zip, wenn dort nichts hinterlegt ist.';
COMMENT ON COLUMN dienstleister_profiles.company_city   IS 'Allgemeine Firmenadresse (Ort) — Stammdaten, NICHT Teil des Marktplatz-Listings. Fallback fuer city, wenn dort nichts hinterlegt ist.';
