-- ============================================================
-- Forevr Migration 0133 — Vendor Videos + Hörprobe
--
-- Marktplatz-Listing: Dienstleister können bis zu 3 YouTube-Videos
-- (video_urls, swipebarer Embed-Player auf der Anbieter-Detailseite)
-- und genau EINE Hörprobe (audio_r2_key, MP3-Upload via R2, eigener
-- Audio-Player) hinterlegen — z. B. DJs/Bands, aber für alle Kategorien.
-- Limits (max. 3 Videos, 1 Hörprobe) werden in der API erzwungen.
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE dienstleister_profiles
  ADD COLUMN IF NOT EXISTS video_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS audio_r2_key TEXT,
  ADD COLUMN IF NOT EXISTS audio_title TEXT;

COMMENT ON COLUMN dienstleister_profiles.video_urls IS 'Bis zu 3 YouTube-Links fuer den Embed-Player im Marktplatz-Listing (API-validiert)';
COMMENT ON COLUMN dienstleister_profiles.audio_r2_key IS 'R2-Key der Hoerprobe (max. 1, z. B. MP3); Wiedergabe via presigned URL, NIE public';
COMMENT ON COLUMN dienstleister_profiles.audio_title IS 'Anzeigetitel der Hoerprobe (optional)';
