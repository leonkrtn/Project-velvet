-- 0108_remove_deko_system.sql
-- ════════════════════════════════════════════════════════════════════════════
-- Entfernt das Dekorations-System (Free-Canvas, Migration 0064) vollständig.
-- ════════════════════════════════════════════════════════════════════════════
-- Der Dekorations-Reiter samt zugehöriger Struktur wurde aus dem Produkt
-- entfernt (Frontend, Vendor-Datenfreigabe, PDF-Export, Budget-Freeze-Links,
-- Organizer-Vorlagen, Feature-Toggles). Diese Migration räumt das DB-Schema auf:
--   1. Trigger + Trigger-Funktion des Deko-Systems
--   2. Alle deko_* Tabellen (inkl. RLS-Policies und Realtime via CASCADE)
--   3. Defunkte Feature-Toggle-Zeilen ('deko', 'bp-dekoration')
--   4. create_event_as_brautpaar_solo() ohne die entfernten Toggles
--
-- Hinweis: budget_items, die früher per Deko-Freeze erzeugt wurden, bleiben als
-- generische Budgetposten erhalten — nur die Verknüpfung (deko_budget_links)
-- wird mit den Deko-Tabellen entfernt.
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Trigger + Trigger-Funktion ----------------------------------------------
DROP TRIGGER IF EXISTS deko_items_updated_at ON deko_items;
DROP FUNCTION IF EXISTS update_deko_items_updated_at();

-- 2. Tabellen (CASCADE entfernt FKs, RLS-Policies und Realtime-Publication) ---
DROP TABLE IF EXISTS deko_budget_links          CASCADE;
DROP TABLE IF EXISTS deko_votes                 CASCADE;
DROP TABLE IF EXISTS deko_comment_replies       CASCADE;
DROP TABLE IF EXISTS deko_comments              CASCADE;
DROP TABLE IF EXISTS deko_items                 CASCADE;
DROP TABLE IF EXISTS deko_canvases              CASCADE;
DROP TABLE IF EXISTS deko_areas                 CASCADE;
DROP TABLE IF EXISTS deko_catalog_items         CASCADE;
DROP TABLE IF EXISTS deko_flat_rates            CASCADE;
DROP TABLE IF EXISTS deko_template_items        CASCADE;
DROP TABLE IF EXISTS deko_template_areas        CASCADE;
DROP TABLE IF EXISTS deko_organizer_flat_rates  CASCADE;
DROP TABLE IF EXISTS deko_organizer_templates   CASCADE;

-- 3. Defunkte Feature-Toggles entfernen --------------------------------------
DELETE FROM feature_toggles WHERE key IN ('deko', 'bp-dekoration');

-- 4. Solo-Onboarding-Funktion ohne entfernte Toggles -------------------------
CREATE OR REPLACE FUNCTION public.create_event_as_brautpaar_solo(
  p_title               TEXT,
  p_date                DATE        DEFAULT NULL,
  p_couple_name         TEXT        DEFAULT NULL,
  p_venue               TEXT        DEFAULT NULL,
  p_venue_address       TEXT        DEFAULT NULL,
  p_dresscode           TEXT        DEFAULT NULL,
  p_children_allowed    BOOLEAN     DEFAULT true,
  p_children_note       TEXT        DEFAULT NULL,
  p_meal_options        TEXT[]      DEFAULT '{fleisch,fisch,vegetarisch,vegan}',
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
    (v_event_id, 'gaeste-fotos',         true),
    (v_event_id, 'messaging',            false),
    (v_event_id, 'bp-gaeste',            true),
    (v_event_id, 'bp-sitzplan',          true),
    (v_event_id, 'bp-ablaufplan',        true),
    (v_event_id, 'bp-catering',          true),
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
