-- ─────────────────────────────────────────────────────────────────────────────
-- 0092: Admin-Flag für die interne Verwaltung (/admin)
--
-- profiles.is_admin steuert den Zugang zur Verwaltungsoberfläche, in der
-- Veranstalter-Registrierungen freigeschaltet/abgelehnt und Veranstalter-
-- Accounts angelegt/entzogen/gelöscht werden.
--
-- Keine RLS-Änderung nötig: Die Verwaltung läuft über Server-API-Routen,
-- die den Aufrufer per Service-Role gegen profiles.is_admin prüfen.
--
-- WICHTIG — danach den eigenen Account zum Admin machen:
--   UPDATE public.profiles SET is_admin = true WHERE email = 'deine@email.de';
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
