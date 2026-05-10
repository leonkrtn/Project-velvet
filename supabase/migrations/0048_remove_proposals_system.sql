-- ══════════════════════════════════════════════════════════════════════════════
-- 0048_remove_proposals_system.sql
-- Entfernt das gesamte Proposals-V2-System sowie die Legacy-Vorschlagstabellen.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Realtime-Publikationen entfernen ────────────────────────────────────────
DO $$
DECLARE
  v_tables TEXT[] := ARRAY[
    'proposals','proposal_recipients','proposal_fields',
    'cases','case_messages','field_locks'
  ];
  v_tbl TEXT;
BEGIN
  FOREACH v_tbl IN ARRAY v_tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = v_tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE %I', v_tbl);
    END IF;
  END LOOP;
END $$;

-- ── Proposal-V2-Tabellen ─────────────────────────────────────────────────────
DROP TABLE IF EXISTS field_locks          CASCADE;
DROP TABLE IF EXISTS case_messages        CASCADE;
DROP TABLE IF EXISTS cases                CASCADE;
DROP TABLE IF EXISTS proposal_fields      CASCADE;
DROP TABLE IF EXISTS proposal_snapshots   CASCADE;
DROP TABLE IF EXISTS proposal_recipients  CASCADE;
DROP TABLE IF EXISTS proposals            CASCADE;
DROP TABLE IF EXISTS history_log          CASCADE;
DROP TABLE IF EXISTS proposal_module_states CASCADE;

-- ── Legacy-Vorschlagstabellen ────────────────────────────────────────────────
DROP TABLE IF EXISTS organizer_vendor_suggestions   CASCADE;
DROP TABLE IF EXISTS organizer_hotel_suggestions    CASCADE;
DROP TABLE IF EXISTS organizer_catering_suggestions CASCADE;
DROP TABLE IF EXISTS deko_suggestions               CASCADE;

-- ── Proposal-Funktionen ──────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS acquire_field_lock(UUID, TEXT);
DROP FUNCTION IF EXISTS release_field_lock(UUID, TEXT);
DROP FUNCTION IF EXISTS heartbeat_field_lock(UUID, TEXT);
DROP FUNCTION IF EXISTS check_proposal_consensus(UUID);
DROP FUNCTION IF EXISTS open_case_for_proposal(UUID);
DROP FUNCTION IF EXISTS validate_merge_proposal(UUID);
DROP FUNCTION IF EXISTS finalize_merge(UUID, JSONB);
DROP FUNCTION IF EXISTS write_proposal_history(TEXT, UUID, TEXT, JSONB, JSONB, UUID);
DROP FUNCTION IF EXISTS cleanup_expired_locks();
DROP FUNCTION IF EXISTS get_module_master_state(UUID, TEXT);
DROP FUNCTION IF EXISTS send_proposal_with_creator(UUID);
