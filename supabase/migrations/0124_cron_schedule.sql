-- ============================================================
-- Forevr Migration 0124 — Daily Scheduler (pg_cron -> /api/cron/tick)
--
-- Ruft einmal taeglich die geschuetzte Route /api/cron/tick auf, die alle
-- faelligen Automatisierungen verarbeitet (Reminder, Bewertungsanfragen,
-- Nachfassen). Logik ist idempotent — der Tick darf gefahrlos oefter laufen.
--
-- VORAUSSETZUNG (einmalig vom Betreiber zu setzen; URL/Secret sind
-- umgebungsspezifisch und gehoeren NICHT in die Migration):
--
--   ALTER DATABASE postgres SET app.cron_url    = 'https://DEINE-APP/api/cron/tick';
--   ALTER DATABASE postgres SET app.cron_secret = 'DASSELBE-WIE-CRON_SECRET-ENV';
--
-- pg_cron + pg_net muessen im Supabase-Projekt aktiviert sein (Dashboard ->
-- Database -> Extensions). Die DO-Bloecke fangen Fehler ab, damit die Migration
-- auch ohne aktivierte Extensions nicht hart fehlschlaegt.
-- Idempotent — safe to re-run.
-- ============================================================

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron nicht verfuegbar — bitte im Supabase-Dashboard aktivieren.';
END $$;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_net nicht verfuegbar — bitte im Supabase-Dashboard aktivieren.';
END $$;

-- Bestehenden Job entfernen, dann neu planen (taeglich 06:00 UTC).
DO $$
BEGIN
  PERFORM cron.unschedule('forevr-daily-tick');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'forevr-daily-tick',
    '0 6 * * *',
    $cron$
    SELECT net.http_post(
      url     := current_setting('app.cron_url', true),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', current_setting('app.cron_secret', true)
      ),
      body    := '{}'::jsonb
    )
    WHERE current_setting('app.cron_url', true) IS NOT NULL
      AND current_setting('app.cron_url', true) <> '';
    $cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cron.schedule fehlgeschlagen — pg_cron/pg_net pruefen und app.cron_url/app.cron_secret setzen.';
END $$;
