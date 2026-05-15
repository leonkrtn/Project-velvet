-- 0072_concept_placed_tables.sql
-- Adds placed_tables JSONB to organizer_seating_concepts so table positions
-- can be saved directly in a concept preset and applied to events.

ALTER TABLE organizer_seating_concepts
  ADD COLUMN IF NOT EXISTS placed_tables JSONB NOT NULL DEFAULT '[]';
