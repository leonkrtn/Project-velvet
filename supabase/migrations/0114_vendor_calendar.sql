-- ============================================================
-- Forevr Migration 0114 — Vendor Calendar Entries
--
-- Private calendar for vendors: custom appointments,
-- reminders, and payment deadlines. Auto-generated entries
-- (wedding dates, offer deadlines) are computed at read time
-- from event_members and vendor_offers — not stored here.
-- ============================================================

CREATE TABLE IF NOT EXISTS vendor_calendar_entries (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  start_at    TIMESTAMPTZ NOT NULL,
  end_at      TIMESTAMPTZ,
  all_day     BOOLEAN     NOT NULL DEFAULT TRUE,
  color       TEXT        NOT NULL DEFAULT '#2352C8',
  entry_type  TEXT        NOT NULL DEFAULT 'custom',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE vendor_calendar_entries
    ADD CONSTRAINT vce_entry_type_chk
    CHECK (entry_type IN ('event','reminder','payment','custom'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_vce_user_start ON vendor_calendar_entries(user_id, start_at);

ALTER TABLE vendor_calendar_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vce_own" ON vendor_calendar_entries;
CREATE POLICY "vce_own" ON vendor_calendar_entries
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
