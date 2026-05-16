-- ════════════════════════════════════════════════════════════════════════════
-- Migration 0076 — Conversation archive + staff-chat flag
--
-- 1. is_archived  BOOLEAN: participants can hide a conversation from the main list
-- 2. is_staff_chat BOOLEAN: marks 1:1 conversations created by /api/staff/chat
--                           so Veranstalter can filter out empty ones
-- 3. Adds an UPDATE policy so event members can archive/unarchive conversations
--    (organizer_staff/mitarbeiter are intentionally excluded — they SELECT/INSERT only)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS is_archived   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_staff_chat BOOLEAN NOT NULL DEFAULT FALSE;

-- ── UPDATE policy ──────────────────────────────────────────────────────────
-- Allow event members (veranstalter / brautpaar / trauzeuge / dienstleister)
-- who are a participant of the conversation to update it (e.g. archive flag).
-- Mitarbeiter (organizer_staff) can still SELECT and INSERT via existing
-- policies but may not UPDATE.
DROP POLICY IF EXISTS "conversations_update" ON conversations;
CREATE POLICY "conversations_update" ON conversations
  FOR UPDATE
  USING (
    is_event_member(event_id)
    AND auth_user_in_conversation(id)
  )
  WITH CHECK (
    is_event_member(event_id)
    AND auth_user_in_conversation(id)
  );
