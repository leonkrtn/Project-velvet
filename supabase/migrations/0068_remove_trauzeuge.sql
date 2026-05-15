-- 0068_remove_trauzeuge.sql
-- Entfernt die Trauzeuge-Rolle vollständig aus der Datenbank.
-- WICHTIG: Alle bestehenden event_members mit role='trauzeuge' werden gelöscht.
-- Führe diese Migration manuell im Supabase SQL-Editor aus.

BEGIN;

-- 1. Trauzeugen-Einladungscodes löschen
DELETE FROM invite_codes WHERE role = 'trauzeuge';

-- 2. Trauzeugen aus event_members entfernen
DELETE FROM event_members WHERE role = 'trauzeuge';

-- 3. trauzeuge_permissions-Tabelle leeren und RLS deaktivieren
DROP POLICY IF EXISTS "tz_perm_select" ON trauzeuge_permissions;
DROP POLICY IF EXISTS "tz_perm_write"  ON trauzeuge_permissions;
TRUNCATE TABLE trauzeuge_permissions;

-- 4. user_role ENUM ohne 'trauzeuge' neu erstellen
--    PostgreSQL erlaubt kein direktes DROP ENUM VALUE, daher:
--    a) Neuen ENUM erstellen
--    b) Spalten updaten
--    c) Alten ENUM löschen

-- Neuen ENUM erstellen
CREATE TYPE user_role_new AS ENUM ('veranstalter', 'brautpaar', 'dienstleister', 'mitarbeiter');

-- event_members.role migrieren
ALTER TABLE event_members
  ALTER COLUMN role TYPE user_role_new
  USING role::text::user_role_new;

-- 5. Alten ENUM durch neuen ersetzen
DROP TYPE user_role;
ALTER TYPE user_role_new RENAME TO user_role;

-- 6. trauzeuge_permissions-Tabelle droppen (keine Daten mehr, keine Referenzen)
DROP TABLE IF EXISTS trauzeuge_permissions;

-- 7. RLS-Policy auf conversations aktualisieren (trauzeuge entfernen)
DROP POLICY IF EXISTS "conv_insert" ON conversations;
DO $$ BEGIN
  CREATE POLICY "conv_insert" ON conversations FOR INSERT
    WITH CHECK (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. Guests-Policies aktualisieren
DROP POLICY IF EXISTS "guests_insert" ON guests;
DROP POLICY IF EXISTS "guests_update" ON guests;
DO $$ BEGIN
  CREATE POLICY "guests_insert" ON guests FOR INSERT
    WITH CHECK (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]) AND NOT is_event_frozen(event_id));
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "guests_update" ON guests FOR UPDATE
    USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]) AND NOT is_event_frozen(event_id));
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 9. Seating-Policy aktualisieren
DROP POLICY IF EXISTS "seating_write" ON seating_tables;
DO $$ BEGIN
  CREATE POLICY "seating_write" ON seating_tables FOR ALL
    USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]) AND NOT is_event_frozen(event_id));
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
