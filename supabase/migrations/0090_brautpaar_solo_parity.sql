-- 0090_brautpaar_solo_parity.sql
-- ════════════════════════════════════════════════════════════════════════════
-- RLS-Parität für brautpaar_solo + Setup-Vervollständigung für Solo-Events
-- ════════════════════════════════════════════════════════════════════════════
-- Drei Policies aus der Zeit VOR der Solo-Rolle prüfen event_members.role
-- direkt (statt über is_event_member()) und schließen brautpaar_solo damit
-- aus, obwohl 0087 die Rolle als vollwertigen Event-Admin definiert:
--
--   1. event_room_configs (0038): Write-Policy nur role = 'veranstalter'
--      → Solo-Paar kann keine Raumkonfiguration anlegen/ändern, der
--        Sitzplan bleibt dauerhaft leer.
--   2. organizer_room_configs (0050): Read-Policy listet nur
--      brautpaar + trauzeuge → Solo-Paar sieht keine Organizer-Vorlagen.
--   3. dienstleister_permissions (0040): Manage-Policy nur
--      role = 'veranstalter' → Solo-Paar kann eingeladenen Dienstleistern
--      keine Tab-Rechte zuweisen (Vendor sieht dann gar nichts).
--
-- Zusätzlich: create_event_as_brautpaar_solo() legte — anders als der
-- Veranstalter-Flow (/api/events/create) — keine feature_toggles-Defaults
-- an und war nicht gegen parallele Doppel-Aufrufe gesichert.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. event_room_configs: Write über is_event_member() ──────────────────────
-- is_event_member(…, ARRAY['veranstalter']) matcht via 0087 auch brautpaar_solo.

DROP POLICY IF EXISTS "event_room_configs_veranstalter" ON event_room_configs;
CREATE POLICY "event_room_configs_admin"
  ON event_room_configs FOR ALL
  USING      (is_event_member(event_id, ARRAY['veranstalter']::user_role[]))
  WITH CHECK (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

-- ── 2. organizer_room_configs: brautpaar_solo darf lesen ─────────────────────

DROP POLICY IF EXISTS "organizer_room_configs_member_read" ON organizer_room_configs;
CREATE POLICY "organizer_room_configs_member_read"
  ON organizer_room_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM events e
      JOIN event_members em ON em.event_id = e.id
      WHERE e.created_by = organizer_room_configs.user_id
        AND em.user_id   = auth.uid()
        AND em.role      IN ('brautpaar', 'brautpaar_solo', 'trauzeuge')
    )
  );

-- ── 3. dienstleister_permissions: Verwaltung über is_event_member() ──────────

DROP POLICY IF EXISTS "veranstalter_manage_dienstleister_permissions" ON dienstleister_permissions;
CREATE POLICY "admin_manage_dienstleister_permissions"
  ON dienstleister_permissions
  FOR ALL
  USING      (is_event_member(event_id, ARRAY['veranstalter']::user_role[]))
  WITH CHECK (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

-- ── 4. create_event_as_brautpaar_solo(): Feature-Toggles + Lock ───────────────
-- Gleiche Signatur wie 0088 (kein Overload-Problem), zwei Ergänzungen:
--   a) pg_advisory_xact_lock pro User — schließt das Race-Window zwischen
--      Existenz-Check und INSERT (Doppelklick beim Signup, paralleler
--      Login-Fallback nach E-Mail-Bestätigung).
--   b) feature_toggles-Defaults — Spiegel von DEFAULT_FEATURE_TOGGLES in
--      lib/store.ts (Stand 0090). Bei Änderung dort hier nachziehen.

CREATE OR REPLACE FUNCTION public.create_event_as_brautpaar_solo(
  p_title               TEXT,
  p_date                DATE        DEFAULT NULL,
  p_couple_name         TEXT        DEFAULT NULL,
  p_venue               TEXT        DEFAULT NULL,
  p_venue_address       TEXT        DEFAULT NULL,
  p_dresscode           TEXT        DEFAULT NULL,
  p_children_allowed    BOOLEAN     DEFAULT true,
  p_children_note       TEXT        DEFAULT NULL,
  p_meal_options        TEXT[]      DEFAULT NULL,
  p_max_begleitpersonen INT         DEFAULT 1,
  p_ceremony_start      TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID;
  v_event_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: not authenticated' USING ERRCODE = 'P0001';
  END IF;

  -- Serialisierung pro User: verhindert zwei Events bei parallelen Aufrufen
  PERFORM pg_advisory_xact_lock(hashtext('brautpaar_solo_create:' || v_user_id::text));

  -- Genau ein Event pro Solo-Brautpaar: existierendes Event zurückgeben
  SELECT event_id INTO v_event_id
  FROM   event_members
  WHERE  user_id = v_user_id
    AND  role    = 'brautpaar_solo'
  ORDER BY joined_at DESC
  LIMIT 1;

  IF v_event_id IS NOT NULL THEN
    RETURN v_event_id;
  END IF;

  INSERT INTO events (
    title, couple_name, date, venue, venue_address, dresscode,
    children_allowed, children_note, meal_options,
    max_begleitpersonen, ceremony_start, created_by
  ) VALUES (
    p_title, p_couple_name, p_date, p_venue, p_venue_address, p_dresscode,
    p_children_allowed, p_children_note, p_meal_options,
    p_max_begleitpersonen, p_ceremony_start, v_user_id
  )
  RETURNING id INTO v_event_id;

  INSERT INTO event_members (event_id, user_id, role, invite_status, joined_at)
  VALUES (v_event_id, v_user_id, 'brautpaar_solo', 'confirmed', NOW());

  -- Feature-Toggle-Defaults (Parität zum Veranstalter-Flow /api/events/create)
  INSERT INTO feature_toggles (event_id, key, enabled)
  VALUES
    (v_event_id, 'budget',               true),
    (v_event_id, 'vendors',              true),
    (v_event_id, 'tasks',                true),
    (v_event_id, 'reminders',            true),
    (v_event_id, 'seating',              true),
    (v_event_id, 'catering',             true),
    (v_event_id, 'sub-events',           true),
    (v_event_id, 'invite',               true),
    (v_event_id, 'deko',                 true),
    (v_event_id, 'gaeste-fotos',         true),
    (v_event_id, 'messaging',            false),
    (v_event_id, 'bp-gaeste',            true),
    (v_event_id, 'bp-sitzplan',          true),
    (v_event_id, 'bp-ablaufplan',        true),
    (v_event_id, 'bp-catering',          true),
    (v_event_id, 'bp-dekoration',        true),
    (v_event_id, 'bp-musik',             true),
    (v_event_id, 'bp-medien',            true),
    (v_event_id, 'bp-budget',            true),
    (v_event_id, 'bp-aufgaben',          true),
    (v_event_id, 'bp-nachrichten',       true),
    (v_event_id, 'bp-dateien',           true),
    (v_event_id, 'rsvp-musikwunsch',     true),
    (v_event_id, 'rsvp-geschenke',       true),
    (v_event_id, 'rsvp-hotel',           true),
    (v_event_id, 'rsvp-begleitpersonen', true),
    (v_event_id, 'rsvp-menu',            true)
  ON CONFLICT (event_id, key) DO NOTHING;

  RETURN v_event_id;
END;
$$;

-- Bestehende Solo-Events ohne Toggles nachziehen (idempotent)
INSERT INTO feature_toggles (event_id, key, enabled)
SELECT em.event_id, t.key, t.enabled
FROM   (SELECT DISTINCT event_id FROM event_members WHERE role = 'brautpaar_solo') em
CROSS JOIN (VALUES
  ('budget', true), ('vendors', true), ('tasks', true), ('reminders', true),
  ('seating', true), ('catering', true), ('sub-events', true), ('invite', true),
  ('deko', true), ('gaeste-fotos', true), ('messaging', false),
  ('bp-gaeste', true), ('bp-sitzplan', true), ('bp-ablaufplan', true),
  ('bp-catering', true), ('bp-dekoration', true), ('bp-musik', true),
  ('bp-medien', true), ('bp-budget', true), ('bp-aufgaben', true),
  ('bp-nachrichten', true), ('bp-dateien', true),
  ('rsvp-musikwunsch', true), ('rsvp-geschenke', true), ('rsvp-hotel', true),
  ('rsvp-begleitpersonen', true), ('rsvp-menu', true)
) AS t(key, enabled)
ON CONFLICT (event_id, key) DO NOTHING;
