-- ════════════════════════════════════════════════════════════════════════════
-- 0051_brautpaar_portal.sql
-- Brautpaar Portal: onboarding tracking, RSVP settings, brautpaar tasks,
-- invite_delete fix for brautpaar, RLS for all new tables.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. Add onboarding_completed_at to event_members ──────────────────────────
-- Tracks per-member welcome screen: brautpaar sees it once, veranstalter unaffected.
ALTER TABLE event_members
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;


-- ── 2. Fix members_update policy ─────────────────────────────────────────────
-- Old policy only allowed veranstalter + brautpaar managing trauzeugen.
-- Brautpaar must be able to set their own onboarding_completed_at.
DROP POLICY IF EXISTS "members_update" ON event_members;

CREATE POLICY "members_update" ON event_members
  FOR UPDATE
  USING (
    can_manage_member(event_members.event_id, event_members.role)
    OR (
      user_id = auth.uid()
      AND is_event_member(event_members.event_id, ARRAY['brautpaar']::user_role[])
    )
  )
  WITH CHECK (
    can_manage_member(event_members.event_id, event_members.role)
    OR (
      user_id = auth.uid()
      AND is_event_member(event_members.event_id, ARRAY['brautpaar']::user_role[])
    )
  );


-- ── 3. Fix invite_delete: brautpaar can delete their own invite codes ─────────
DROP POLICY IF EXISTS "invite_delete" ON invite_codes;

CREATE POLICY "invite_delete" ON invite_codes
  FOR DELETE USING (
    is_event_member(event_id, ARRAY['veranstalter']::user_role[])
    OR (
      created_by = auth.uid()
      AND is_event_member(event_id, ARRAY['brautpaar']::user_role[])
    )
  );


-- ── 4. RSVP Settings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rsvp_settings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID        NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  invitation_text  TEXT        NOT NULL DEFAULT 'Liebe/r {{Name}},

wir laden Sie herzlich zu unserer Hochzeit ein. Bitte bestätigen Sie Ihre Teilnahme über den folgenden Link.',
  rsvp_deadline    DATE,
  show_meal_choice BOOLEAN     NOT NULL DEFAULT true,
  show_plus_one    BOOLEAN     NOT NULL DEFAULT true,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by       UUID        REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE rsvp_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rsvp_settings_select" ON rsvp_settings;
CREATE POLICY "rsvp_settings_select" ON rsvp_settings
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  );

DROP POLICY IF EXISTS "rsvp_settings_insert" ON rsvp_settings;
CREATE POLICY "rsvp_settings_insert" ON rsvp_settings
  FOR INSERT WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  );

DROP POLICY IF EXISTS "rsvp_settings_update" ON rsvp_settings;
CREATE POLICY "rsvp_settings_update" ON rsvp_settings
  FOR UPDATE
  USING     (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]))
  WITH CHECK (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));

DROP POLICY IF EXISTS "rsvp_settings_delete" ON rsvp_settings;
CREATE POLICY "rsvp_settings_delete" ON rsvp_settings
  FOR DELETE USING (
    is_event_member(event_id, ARRAY['veranstalter']::user_role[])
  );


-- ── 5. Brautpaar Tasks ───────────────────────────────────────────────────────
-- Separate task system from organizer_todos. Phases auto-calculated in frontend
-- from wedding date. Starts empty per event.
CREATE TABLE IF NOT EXISTS brautpaar_tasks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  done        BOOLEAN     NOT NULL DEFAULT false,
  phase       TEXT,  -- e.g. '12m', '6m', '3m', '1m', '1w', 'day', 'after'
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  done_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_brautpaar_tasks_event ON brautpaar_tasks(event_id, sort_order);

ALTER TABLE brautpaar_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bp_tasks_select" ON brautpaar_tasks;
CREATE POLICY "bp_tasks_select" ON brautpaar_tasks
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  );

DROP POLICY IF EXISTS "bp_tasks_insert" ON brautpaar_tasks;
CREATE POLICY "bp_tasks_insert" ON brautpaar_tasks
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  );

DROP POLICY IF EXISTS "bp_tasks_update" ON brautpaar_tasks;
CREATE POLICY "bp_tasks_update" ON brautpaar_tasks
  FOR UPDATE
  USING     (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]))
  WITH CHECK (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));

DROP POLICY IF EXISTS "bp_tasks_delete" ON brautpaar_tasks;
CREATE POLICY "bp_tasks_delete" ON brautpaar_tasks
  FOR DELETE USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  );


-- ── 6. Grants for new tables ─────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON rsvp_settings   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON brautpaar_tasks TO authenticated;
