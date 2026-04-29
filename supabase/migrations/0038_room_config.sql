-- ══════════════════════════════════════════════════════════════════════════════
-- 0038_room_config.sql
--
-- Room configuration tables:
--   organizer_room_configs  – global room shape per organizer (all events)
--   event_room_configs      – event-specific room override
--
-- Each table stores:
--   points   JSONB  – polygon corner coordinates [{x, y}, …] in metres
--   elements JSONB  – placed architectural elements [{id, type, x, y}, …]
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Global (per-organizer) room config ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS organizer_room_configs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  elements   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE organizer_room_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizer_room_configs_own"
  ON organizer_room_configs FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ── Event-specific room config (override / per-event refinement) ─────────────

CREATE TABLE IF NOT EXISTS event_room_configs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  elements   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id)
);

ALTER TABLE event_room_configs ENABLE ROW LEVEL SECURITY;

-- Only the event veranstalter may read/write the event room config
CREATE POLICY "event_room_configs_veranstalter"
  ON event_room_configs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM event_members em
      WHERE em.event_id = event_room_configs.event_id
        AND em.user_id  = auth.uid()
        AND em.role     = 'veranstalter'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_members em
      WHERE em.event_id = event_room_configs.event_id
        AND em.user_id  = auth.uid()
        AND em.role     = 'veranstalter'
    )
  );
