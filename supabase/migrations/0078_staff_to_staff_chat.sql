-- ════════════════════════════════════════════════════════════════════════════
-- Migration 0078 — Staff-to-Staff Chat
--
-- Adds a per-organizer opt-in toggle (staff_chat_enabled) that allows
-- staff members of the same organizer to send direct messages to each other.
-- The toggle is controlled by the organizer in Konfiguration → Mitarbeiter.
--
-- What this migration does:
--   1. Creates organizer_settings table (general-purpose per-organizer config)
--   2. Adds staff_chat_enabled boolean (default OFF)
--   3. RLS: organizer = full access; staff = read-only (to check if enabled)
--
-- No RLS changes to conversations/messages are required — the existing
-- policies from migration 0075 already allow organizer_staff users to
-- SELECT and INSERT in conversations they participate in. New conversations
-- are created server-side via the admin client (bypasses RLS), matching
-- the pattern already used by /api/staff/chat.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS organizer_settings (
  organizer_id       UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_chat_enabled BOOLEAN     NOT NULL DEFAULT FALSE,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE organizer_settings ENABLE ROW LEVEL SECURITY;

-- Organizer: full access to their own settings row
CREATE POLICY "organizer_settings_organizer_all" ON organizer_settings
  FOR ALL
  USING (auth.uid() = organizer_id)
  WITH CHECK (auth.uid() = organizer_id);

-- Staff: read-only — so the Mitarbeiter portal can check whether
-- staff-to-staff chat is enabled before showing the contacts list
CREATE POLICY "organizer_settings_staff_read" ON organizer_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM organizer_staff os
      WHERE os.organizer_id = organizer_settings.organizer_id
        AND os.auth_user_id = auth.uid()
    )
  );
