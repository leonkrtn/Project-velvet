-- ============================================================
-- Velvet Migration 0002 — Dienstleister Planning Schema
-- Catering menu items, Fotograf schedule/deliverables,
-- Band tech requirements / set list, and guest-count /
-- allergy aggregation views.
-- Idempotent — safe to re-run.
-- ============================================================


-- ════════════════════════════════════════════════════════════════════════════
-- CATERING: structured menu items
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS catering_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  event_dienstleister_id UUID REFERENCES event_dienstleister(id) ON DELETE SET NULL,
  course TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  allergens TEXT[] NOT NULL DEFAULT '{}',
  dietary_tags TEXT[] NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catering_menu_items_event_id ON catering_menu_items(event_id);
CREATE INDEX IF NOT EXISTS idx_catering_menu_items_ed_id   ON catering_menu_items(event_dienstleister_id);

ALTER TABLE catering_menu_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "catering_menu_select" ON catering_menu_items
    FOR SELECT USING (is_event_member(event_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "catering_menu_write" ON catering_menu_items
    FOR ALL
    USING (
      is_event_member(event_id, ARRAY['veranstalter','brautpaar','dienstleister']::user_role[])
      AND NOT is_event_frozen(event_id)
    )
    WITH CHECK (
      is_event_member(event_id, ARRAY['veranstalter','brautpaar','dienstleister']::user_role[])
      AND NOT is_event_frozen(event_id)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- FOTOGRAF: schedule + deliverables
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fotograf_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  event_dienstleister_id UUID REFERENCES event_dienstleister(id) ON DELETE SET NULL,
  session_type TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fotograf_schedule_time_check CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_fotograf_schedule_event_id ON fotograf_schedule(event_id);
CREATE INDEX IF NOT EXISTS idx_fotograf_schedule_ed_id   ON fotograf_schedule(event_dienstleister_id);

ALTER TABLE fotograf_schedule ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "fotograf_schedule_select" ON fotograf_schedule
    FOR SELECT USING (is_event_member(event_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "fotograf_schedule_write" ON fotograf_schedule
    FOR ALL
    USING (
      is_event_member(event_id, ARRAY['veranstalter','brautpaar','dienstleister']::user_role[])
      AND NOT is_event_frozen(event_id)
    )
    WITH CHECK (
      is_event_member(event_id, ARRAY['veranstalter','brautpaar','dienstleister']::user_role[])
      AND NOT is_event_frozen(event_id)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


CREATE TABLE IF NOT EXISTS fotograf_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  event_dienstleister_id UUID REFERENCES event_dienstleister(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'ausstehend',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fotograf_deliverables_event_id ON fotograf_deliverables(event_id);
CREATE INDEX IF NOT EXISTS idx_fotograf_deliverables_ed_id   ON fotograf_deliverables(event_dienstleister_id);

ALTER TABLE fotograf_deliverables ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "fotograf_deliverables_select" ON fotograf_deliverables
    FOR SELECT USING (is_event_member(event_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "fotograf_deliverables_write" ON fotograf_deliverables
    FOR ALL
    USING (
      is_event_member(event_id, ARRAY['veranstalter','brautpaar','dienstleister']::user_role[])
      AND NOT is_event_frozen(event_id)
    )
    WITH CHECK (
      is_event_member(event_id, ARRAY['veranstalter','brautpaar','dienstleister']::user_role[])
      AND NOT is_event_frozen(event_id)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- BAND / MUSIK: tech rider + set list
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS band_tech_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  event_dienstleister_id UUID REFERENCES event_dienstleister(id) ON DELETE SET NULL,
  genres TEXT[] NOT NULL DEFAULT '{}',
  power_needs_w INT,
  stage_area_m2 NUMERIC,
  equipment TEXT[] NOT NULL DEFAULT '{}',
  soundcheck_starts_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_band_tech_requirements_event_id ON band_tech_requirements(event_id);
CREATE INDEX IF NOT EXISTS idx_band_tech_requirements_ed_id   ON band_tech_requirements(event_dienstleister_id);

ALTER TABLE band_tech_requirements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "band_tech_select" ON band_tech_requirements
    FOR SELECT USING (is_event_member(event_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "band_tech_write" ON band_tech_requirements
    FOR ALL
    USING (
      is_event_member(event_id, ARRAY['veranstalter','brautpaar','dienstleister']::user_role[])
      AND NOT is_event_frozen(event_id)
    )
    WITH CHECK (
      is_event_member(event_id, ARRAY['veranstalter','brautpaar','dienstleister']::user_role[])
      AND NOT is_event_frozen(event_id)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


CREATE TABLE IF NOT EXISTS band_set_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  event_dienstleister_id UUID REFERENCES event_dienstleister(id) ON DELETE SET NULL,
  slot_name TEXT,
  slot_starts_at TIMESTAMPTZ,
  slot_ends_at TIMESTAMPTZ,
  song_title TEXT,
  artist TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_band_set_list_event_id ON band_set_list(event_id);
CREATE INDEX IF NOT EXISTS idx_band_set_list_ed_id   ON band_set_list(event_dienstleister_id);

ALTER TABLE band_set_list ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "band_set_list_select" ON band_set_list
    FOR SELECT USING (is_event_member(event_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "band_set_list_write" ON band_set_list
    FOR ALL
    USING (
      is_event_member(event_id, ARRAY['veranstalter','brautpaar','dienstleister']::user_role[])
      AND NOT is_event_frozen(event_id)
    )
    WITH CHECK (
      is_event_member(event_id, ARRAY['veranstalter','brautpaar','dienstleister']::user_role[])
      AND NOT is_event_frozen(event_id)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- AGGREGATION VIEWS (derived from guests / begleitpersonen — no duplication)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_event_guest_counts AS
SELECT
  g.event_id,
  COUNT(*) FILTER (WHERE g.status = 'zugesagt') AS confirmed_guests,
  COUNT(*) FILTER (WHERE g.status = 'abgesagt') AS declined_guests,
  COUNT(*) FILTER (WHERE g.status IN ('angelegt','eingeladen','vielleicht')) AS pending_guests,
  (
    SELECT COUNT(*) FROM begleitpersonen b
    JOIN guests g2 ON g2.id = b.guest_id
    WHERE g2.event_id = g.event_id AND g2.status = 'zugesagt'
  ) AS confirmed_plus_ones
FROM guests g
GROUP BY g.event_id;

CREATE OR REPLACE VIEW v_event_allergy_aggregate AS
SELECT event_id, tag, SUM(occurrences)::int AS occurrences
FROM (
  SELECT g.event_id, unnest(g.allergy_tags) AS tag, 1 AS occurrences
    FROM guests g
   WHERE g.status = 'zugesagt' AND g.allergy_tags IS NOT NULL
  UNION ALL
  SELECT g.event_id, unnest(b.allergy_tags) AS tag, 1 AS occurrences
    FROM begleitpersonen b
    JOIN guests g ON g.id = b.guest_id
   WHERE g.status = 'zugesagt' AND b.allergy_tags IS NOT NULL
) sub
WHERE tag IS NOT NULL AND tag <> ''
GROUP BY event_id, tag;

-- Views inherit RLS from underlying tables.
GRANT SELECT ON v_event_guest_counts     TO authenticated;
GRANT SELECT ON v_event_allergy_aggregate TO authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- GRANTS (authenticated inherits via default privileges, but be explicit for new tables)
-- ════════════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE, DELETE ON
  catering_menu_items,
  fotograf_schedule,
  fotograf_deliverables,
  band_tech_requirements,
  band_set_list
TO authenticated;

GRANT ALL ON
  catering_menu_items,
  fotograf_schedule,
  fotograf_deliverables,
  band_tech_requirements,
  band_set_list
TO service_role;
