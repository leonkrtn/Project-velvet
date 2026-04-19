-- ============================================================
-- Velvet Migration 0004 — Fix missing columns
-- Adds joined_at to event_members and ensures conversations
-- has the name + updated_at columns (in case the table was
-- created from the old schema.ts which used 'title' instead).
-- Idempotent — safe to re-run.
-- ============================================================

-- ════════════════════════════════════════════════════════════════════════════
-- EVENT_MEMBERS: joined_at timestamp
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE event_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT now();


-- ════════════════════════════════════════════════════════════════════════════
-- CONVERSATIONS: ensure name + updated_at exist
-- (old schema.ts created this table with 'title' and no updated_at)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();


-- updated_at auto-update trigger (idempotent)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS conversations_updated_at ON conversations;
CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
