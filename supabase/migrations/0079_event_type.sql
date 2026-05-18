-- Migration 0079: Add event_type to events table
-- Event types: hochzeit (default, selectable), firmenevent/intern (future, UI-only disabled)

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'hochzeit'
    CHECK (event_type IN ('hochzeit', 'firmenevent', 'intern'));
