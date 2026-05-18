-- Migration 0081: Musik playlists with embedded player links

CREATE TABLE IF NOT EXISTS musik_playlisten (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL DEFAULT '',
  url        TEXT        NOT NULL DEFAULT '',
  platform   TEXT        NOT NULL DEFAULT 'other'
               CHECK (platform IN ('spotify', 'youtube', 'apple_music', 'other')),
  sort_order INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_musik_playlisten_event ON musik_playlisten(event_id);

ALTER TABLE musik_playlisten ENABLE ROW LEVEL SECURITY;

CREATE POLICY "musik_playlisten_event_member" ON musik_playlisten
  FOR ALL USING (
    is_event_member(event_id, ARRAY['brautpaar', 'veranstalter', 'dienstleister']::user_role[])
  );
