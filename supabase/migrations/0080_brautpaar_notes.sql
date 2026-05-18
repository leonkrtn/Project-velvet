-- Migration 0080: Brautpaar notes system

CREATE TABLE IF NOT EXISTS brautpaar_notes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category        TEXT        NOT NULL DEFAULT 'Allgemein',
  title           TEXT        NOT NULL DEFAULT '',
  content         TEXT        NOT NULL DEFAULT '',
  note_type       TEXT        NOT NULL DEFAULT 'text' CHECK (note_type IN ('text', 'checklist')),
  checklist_items JSONB       NOT NULL DEFAULT '[]'::jsonb,
  sort_order      INT         NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brautpaar_notes_event ON brautpaar_notes(event_id);

ALTER TABLE brautpaar_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_brautpaar_access" ON brautpaar_notes
  FOR ALL USING (
    is_event_member(event_id, ARRAY['brautpaar', 'veranstalter']::user_role[])
  );
