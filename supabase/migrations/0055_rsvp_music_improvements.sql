-- ════════════════════════════════════════════════════════════════════════════
-- 0055_rsvp_music_improvements.sql
-- 1. rsvp_settings: add phone_contact
-- 2. guests: drop attending column (merge back into status)
-- 3. music_songs: add source + suggested_by_guest_name
-- 4. Create rsvp_music_suggestions table (pending guest song suggestions)
-- 5. Create replace_begleitpersonen() atomic RPC
-- 6. Fix music_songs RLS: add brautpaar write access
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. rsvp_settings: phone_contact ──────────────────────────────────────────
ALTER TABLE rsvp_settings ADD COLUMN IF NOT EXISTS phone_contact TEXT;

-- ── 2. guests: drop attending (was added in 0052, status is the single source) ──
-- BrautpaarGaeste.tsx now reads status and maps internally.
ALTER TABLE guests DROP COLUMN IF EXISTS attending;
ALTER TABLE guests DROP COLUMN IF EXISTS plus_one_allowed;

-- ── 3. music_songs: source + suggested_by_guest_name ─────────────────────────
ALTER TABLE music_songs
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'intern'
    CHECK (source IN ('intern', 'gast')),
  ADD COLUMN IF NOT EXISTS suggested_by_guest_name TEXT;

-- ── 4. rsvp_music_suggestions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rsvp_music_suggestions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_token  TEXT        NOT NULL,
  guest_name   TEXT        NOT NULL,
  song_title   TEXT        NOT NULL,
  artist       TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rsvp_music_sugg_event
  ON rsvp_music_suggestions(event_id);

ALTER TABLE rsvp_music_suggestions ENABLE ROW LEVEL SECURITY;

-- Brautpaar + Veranstalter: full read + delete (accept/reject)
DROP POLICY IF EXISTS "rsvp_music_sugg_members" ON rsvp_music_suggestions;
CREATE POLICY "rsvp_music_sugg_members" ON rsvp_music_suggestions
  FOR ALL USING (
    is_event_member(event_id, ARRAY['brautpaar','veranstalter']::user_role[])
  );

-- Dienstleister with musik read access: SELECT only
DROP POLICY IF EXISTS "rsvp_music_sugg_dl_read" ON rsvp_music_suggestions;
CREATE POLICY "rsvp_music_sugg_dl_read" ON rsvp_music_suggestions
  FOR SELECT USING (
    dl_has_tab_access(event_id, 'musik', 'read')
  );

-- ── 5. Atomic replace_begleitpersonen RPC ────────────────────────────────────
-- Called by RSVP API (service role) to delete+insert begleitpersonen atomically.
CREATE OR REPLACE FUNCTION replace_begleitpersonen(
  p_guest_id UUID,
  p_rows     JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM begleitpersonen WHERE guest_id = p_guest_id;

  IF p_rows IS NOT NULL AND jsonb_array_length(p_rows) > 0 THEN
    INSERT INTO begleitpersonen (
      id, guest_id, name, age_category,
      trink_alkohol, meal_choice, allergy_tags, allergy_custom
    )
    SELECT
      COALESCE((r->>'id')::UUID, gen_random_uuid()),
      p_guest_id,
      r->>'name',
      COALESCE(r->>'age_category', 'erwachsen'),
      CASE
        WHEN r->>'trink_alkohol' IS NULL THEN NULL
        ELSE (r->>'trink_alkohol')::BOOLEAN
      END,
      NULLIF(r->>'meal_choice', ''),
      COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(r->'allergy_tags')),
        '{}'::TEXT[]
      ),
      NULLIF(r->>'allergy_custom', '')
    FROM jsonb_array_elements(p_rows) r;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION replace_begleitpersonen(UUID, JSONB) TO service_role;

-- ── 6. Fix music_songs RLS: brautpaar write access ───────────────────────────
-- Old policy only covered veranstalter for write; brautpaar can only SELECT.
-- BrautpaarMusikView inserts/updates/deletes directly → needs write policy.
DROP POLICY IF EXISTS "music_songs_brautpaar_write" ON music_songs;
CREATE POLICY "music_songs_brautpaar_write" ON music_songs
  FOR ALL USING (
    is_event_member(event_id, ARRAY['brautpaar']::user_role[])
  );
