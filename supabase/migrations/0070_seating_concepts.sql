-- 0070_seating_concepts.sql
-- Global seating plan concepts per organizer.
-- Stores room polygon + element layout + table pool as a reusable template.
-- Applied per-event via the Sitzplan editor (replace or merge modes).

CREATE TABLE organizer_seating_concepts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  points       jsonb NOT NULL DEFAULT '[]'::jsonb,
  elements     jsonb NOT NULL DEFAULT '[]'::jsonb,
  table_pool   jsonb NOT NULL DEFAULT '{"types":[]}'::jsonb,
  sort_order   int  NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE organizer_seating_concepts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_concepts" ON organizer_seating_concepts
  USING  (organizer_id = auth.uid())
  WITH CHECK (organizer_id = auth.uid());
