-- 002_role_refactor.sql
-- Rollenmodell-Umbau: organizer→veranstalter, caterer→dienstleister, guest entfernt
-- PostgreSQL kann Enum-Werte nicht umbenennen → neuer Typ, Spalten casten, alten Typ droppen

-- Step 1: Neuen Enum-Typ erstellen
CREATE TYPE user_role_new AS ENUM ('veranstalter', 'brautpaar', 'trauzeuge', 'dienstleister');

-- Step 2: Alle 3 Spalten migrieren
ALTER TABLE profiles ALTER COLUMN role TYPE user_role_new
  USING (
    CASE role::text
      WHEN 'organizer' THEN 'veranstalter'::user_role_new
      WHEN 'caterer'   THEN 'dienstleister'::user_role_new
      WHEN 'guest'     THEN 'brautpaar'::user_role_new
      ELSE role::text::user_role_new
    END
  );

ALTER TABLE event_members ALTER COLUMN role TYPE user_role_new
  USING (
    CASE role::text
      WHEN 'organizer' THEN 'veranstalter'::user_role_new
      WHEN 'caterer'   THEN 'dienstleister'::user_role_new
      WHEN 'guest'     THEN 'brautpaar'::user_role_new
      ELSE role::text::user_role_new
    END
  );

ALTER TABLE invite_codes ALTER COLUMN role TYPE user_role_new
  USING (
    CASE role::text
      WHEN 'organizer' THEN 'veranstalter'::user_role_new
      WHEN 'caterer'   THEN 'dienstleister'::user_role_new
      WHEN 'guest'     THEN 'brautpaar'::user_role_new
      ELSE role::text::user_role_new
    END
  );

-- Step 3: Alten Typ droppen, neuen umbenennen
DROP TYPE user_role;
ALTER TYPE user_role_new RENAME TO user_role;

-- Step 4: Neue Spalten zu profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_approved_organizer BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS application_status TEXT DEFAULT NULL;

-- Step 5: data_freeze_at zu events
ALTER TABLE events ADD COLUMN IF NOT EXISTS data_freeze_at TIMESTAMPTZ DEFAULT NULL;

-- Step 6: metadata zu invite_codes (für Trauzeuge-Permissions bei Einlösung)
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

-- Step 7: Alle alten RLS-Policies droppen (referenzieren alte Enum-Werte)
DROP POLICY IF EXISTS "events_insert"    ON events;
DROP POLICY IF EXISTS "events_update"    ON events;
DROP POLICY IF EXISTS "events_delete"    ON events;
DROP POLICY IF EXISTS "members_delete"   ON event_members;
DROP POLICY IF EXISTS "invite_insert"    ON invite_codes;
DROP POLICY IF EXISTS "guests_insert"    ON guests;
DROP POLICY IF EXISTS "guests_update"    ON guests;
DROP POLICY IF EXISTS "guests_delete"    ON guests;
DROP POLICY IF EXISTS "hotels_write"     ON hotels;
DROP POLICY IF EXISTS "budget_write"     ON budget_items;
DROP POLICY IF EXISTS "vendors_write"    ON vendors;
DROP POLICY IF EXISTS "reminders_all"    ON reminders;
DROP POLICY IF EXISTS "subevents_write"  ON sub_events;
DROP POLICY IF EXISTS "seating_write"    ON seating_tables;
DROP POLICY IF EXISTS "catering_select"  ON catering_plans;
DROP POLICY IF EXISTS "catering_write"   ON catering_plans;
DROP POLICY IF EXISTS "ft_write"         ON feature_toggles;
DROP POLICY IF EXISTS "org_vendor_w"     ON organizer_vendor_suggestions;
DROP POLICY IF EXISTS "org_hotel_w"      ON organizer_hotel_suggestions;
DROP POLICY IF EXISTS "org_cater_w"      ON organizer_catering_suggestions;
DROP POLICY IF EXISTS "deko_sug_write"   ON deko_suggestions;
DROP POLICY IF EXISTS "deko_wish_all"    ON deko_wishes;
DROP POLICY IF EXISTS "loc_img_write"    ON location_images;
DROP POLICY IF EXISTS "guest_photos_delete" ON guest_photos;
DROP POLICY IF EXISTS "timeline_write"   ON timeline_entries;

-- Step 8: Helper-Funktionen mit neuem Enum updaten
CREATE OR REPLACE FUNCTION is_event_member(eid UUID, required_roles user_role[] DEFAULT NULL)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM event_members
    WHERE event_id = eid
      AND user_id = auth.uid()
      AND (required_roles IS NULL OR role = ANY(required_roles))
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_event_role(eid UUID)
RETURNS user_role AS $$
  SELECT role FROM event_members
  WHERE event_id = eid AND user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_event_frozen(eid UUID)
RETURNS boolean AS $$
  SELECT COALESCE(data_freeze_at IS NOT NULL AND data_freeze_at <= NOW(), false)
  FROM events WHERE id = eid;
$$ LANGUAGE sql SECURITY DEFINER;

-- Step 9: Alle Policies mit neuen Rollennamen neu erstellen

-- events: nur approved veranstalter darf Events erstellen
CREATE POLICY "events_insert" ON events FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_approved_organizer = true)
  );

-- events: veranstalter + brautpaar updaten (nur wenn nicht eingefroren)
CREATE POLICY "events_update" ON events FOR UPDATE
  USING (
    is_event_member(id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(id)
  );

-- events: nur veranstalter darf löschen
CREATE POLICY "events_delete" ON events FOR DELETE
  USING (is_event_member(id, ARRAY['veranstalter']::user_role[]));

-- event_members: veranstalter oder selbst darf löschen
CREATE POLICY "members_delete" ON event_members FOR DELETE
  USING (
    is_event_member(event_id, ARRAY['veranstalter']::user_role[])
    OR user_id = auth.uid()
  );

-- invite_codes: veranstalter + brautpaar können einladen
CREATE POLICY "invite_insert" ON invite_codes FOR INSERT
  WITH CHECK (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));

-- guests: mit Freeze-Check
CREATE POLICY "guests_insert" ON guests FOR INSERT
  WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    AND NOT is_event_frozen(event_id)
  );
CREATE POLICY "guests_update" ON guests FOR UPDATE
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    AND NOT is_event_frozen(event_id)
  );
CREATE POLICY "guests_delete" ON guests FOR DELETE
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

-- hotels, budget, vendors: veranstalter + brautpaar mit Freeze-Check
CREATE POLICY "hotels_write" ON hotels FOR ALL
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );
CREATE POLICY "budget_write" ON budget_items FOR ALL
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );
CREATE POLICY "vendors_write" ON vendors FOR ALL
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

-- reminders: veranstalter + brautpaar
CREATE POLICY "reminders_all" ON reminders FOR ALL
  USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));

-- sub_events, seating: mit Freeze-Check
CREATE POLICY "subevents_write" ON sub_events FOR ALL
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );
CREATE POLICY "seating_write" ON seating_tables FOR ALL
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

-- catering: dienstleister kann lesen (statt caterer)
CREATE POLICY "catering_select" ON catering_plans FOR SELECT
  USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar','dienstleister']::user_role[]));
CREATE POLICY "catering_write" ON catering_plans FOR ALL
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

-- feature_toggles: NUR veranstalter darf schreiben
CREATE POLICY "ft_write" ON feature_toggles FOR ALL
  USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

-- organizer-Suggestions: veranstalter (war organizer)
CREATE POLICY "org_vendor_w" ON organizer_vendor_suggestions FOR ALL
  USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));
CREATE POLICY "org_hotel_w" ON organizer_hotel_suggestions FOR ALL
  USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));
CREATE POLICY "org_cater_w" ON organizer_catering_suggestions FOR ALL
  USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

-- deko: veranstalter schreibt Suggestions; brautpaar+trauzeuge schreiben Wishes
CREATE POLICY "deko_sug_write" ON deko_suggestions FOR ALL
  USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));
CREATE POLICY "deko_wish_all" ON deko_wishes FOR ALL
  USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[]));

-- location_images: veranstalter (war organizer)
CREATE POLICY "loc_img_write" ON location_images FOR ALL
  USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

-- guest_photos_delete: veranstalter + brautpaar
CREATE POLICY "guest_photos_delete" ON guest_photos FOR DELETE
  USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));

-- timeline: veranstalter + brautpaar mit Freeze-Check
CREATE POLICY "timeline_write" ON timeline_entries FOR ALL
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

-- Step 10: handle_new_user Trigger updaten
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, is_approved_organizer)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
