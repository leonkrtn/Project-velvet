-- Self-Service-Kontolöschung (Snapchat-Modell):
--   1. Nutzer klickt "Account löschen" → profiles.deleted_at + scheduled_purge_at
--      werden gesetzt, der Nutzer wird sofort ausgeloggt. Alle Daten bleiben
--      unangetastet (Wiederherstellung möglich).
--   2. Meldet sich der Nutzer vor scheduled_purge_at erneut an, wird der Account
--      automatisch reaktiviert (deleted_at/scheduled_purge_at auf NULL) — siehe
--      /api/account/restore, aufgerufen vom Login-Flow.
--   3. Ist die Frist ohne erneute Anmeldung abgelaufen, entfernt der tägliche
--      Cron-Tick (lib/account/purge.ts) endgültig: Event-Mitgliedschaften,
--      CRM-Einträge bei allen Dienstleistern (per E-Mail-Abgleich) und zuletzt
--      den Auth-User selbst.
alter table profiles
  add column if not exists deleted_at timestamptz,
  add column if not exists scheduled_purge_at timestamptz;

create index if not exists idx_profiles_scheduled_purge
  on profiles(scheduled_purge_at)
  where scheduled_purge_at is not null;
