-- ── Organizer To-Do Liste (event-spezifisch) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS organizer_todos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID REFERENCES events(id) ON DELETE CASCADE,
  organizer_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  done          BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE organizer_todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizer sieht eigene Todos" ON organizer_todos
  FOR ALL USING (organizer_id = auth.uid());
