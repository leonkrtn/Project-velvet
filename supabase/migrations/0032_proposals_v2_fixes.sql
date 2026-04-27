-- ══════════════════════════════════════════════════════════════════════════════
-- 0032_proposals_v2_fixes.sql
-- Proposals V2 – Fixes & fehlende Kern-Features
--
-- 1. proposal_module_states   → Master-Zustand pro Event+Modul (Write-back-Ziel)
-- 2. trg_auto_consensus       → Auto-Accept/Reject via Empfänger-Trigger
-- 3. finalize_merge()         → schreibt merged_state in proposal_module_states
-- 4. validate_merge_proposal() → prüft base_version-Konflikt
-- 5. get_module_master_state() → RPC für Frontend-Pre-Population
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 1. proposal_module_states ─────────────────────────────────────────────────
-- Speichert den aktuellen Modul-Zustand als JSONB.
-- PK (event_id, module) → 1 Eintrag pro Event+Modul.
-- updated_at dient als base_version-Vergleichswert bei Merge-Konflikt-Prüfung.

CREATE TABLE IF NOT EXISTS proposal_module_states (
  event_id   UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  module     TEXT        NOT NULL CHECK (module IN (
               'catering','ablaufplan','sitzplan','deko','musik','patisserie','vendor','hotel'
             )),
  state_json JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (event_id, module)
);

CREATE INDEX IF NOT EXISTS idx_proposal_module_states_event
  ON proposal_module_states(event_id);

ALTER TABLE proposal_module_states ENABLE ROW LEVEL SECURITY;

-- Alle Event-Mitglieder dürfen lesen
DROP POLICY IF EXISTS "pms_select" ON proposal_module_states;
CREATE POLICY "pms_select"
  ON proposal_module_states FOR SELECT
  USING (is_event_member(event_id));

-- Nur Veranstalter dürfen schreiben (direkt; normale Updates kommen via finalize_merge)
DROP POLICY IF EXISTS "pms_insert" ON proposal_module_states;
CREATE POLICY "pms_insert"
  ON proposal_module_states FOR INSERT
  WITH CHECK (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

DROP POLICY IF EXISTS "pms_update" ON proposal_module_states;
CREATE POLICY "pms_update"
  ON proposal_module_states FOR UPDATE
  USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));


-- ── 2. Auto-Consensus-Trigger ─────────────────────────────────────────────────
-- Wird nach jedem UPDATE auf proposal_recipients ausgeführt.
-- Logik:
--   • Irgendein Empfänger → rejected  ⟹  proposals.status = 'rejected'
--   • Alle Empfänger      → accepted  ⟹  proposals.status = 'accepted'
--   • Sonst               → kein Eingriff

CREATE OR REPLACE FUNCTION fn_auto_proposal_consensus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total    INT;
  v_accepted INT;
  v_rejected INT;
  v_cur_status TEXT;
BEGIN
  -- Nur bei Status-Änderungen relevant
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT status INTO v_cur_status
  FROM proposals
  WHERE id = NEW.proposal_id;

  -- Abgeschlossene Proposals nicht anfassen
  IF v_cur_status IN ('accepted','rejected','draft') THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'accepted'),
    COUNT(*) FILTER (WHERE status = 'rejected')
  INTO v_total, v_accepted, v_rejected
  FROM proposal_recipients
  WHERE proposal_id = NEW.proposal_id;

  IF v_rejected > 0 THEN
    -- Mindestens einer lehnt ab → gesamtes Proposal ablehnen
    UPDATE proposals
      SET status = 'rejected', updated_at = NOW()
    WHERE id = NEW.proposal_id;

    -- Offenen Case schließen
    UPDATE cases
      SET status = 'resolved', resolved_at = NOW()
    WHERE proposal_id = NEW.proposal_id AND status = 'open';

    INSERT INTO history_log (
      entity_type, entity_id, action,
      changed_by, changed_by_role, proposal_id
    )
    VALUES (
      'proposal', NEW.proposal_id, 'rejected',
      NEW.user_id,
      COALESCE((
        SELECT em.role::TEXT FROM event_members em
        JOIN proposals p ON p.event_id = em.event_id
        WHERE p.id = NEW.proposal_id AND em.user_id = NEW.user_id
        LIMIT 1
      ), 'unknown'),
      NEW.proposal_id
    );

  ELSIF v_total > 0 AND v_total = v_accepted THEN
    -- Alle haben akzeptiert → Proposal akzeptiert (Merge noch ausstehend)
    UPDATE proposals
      SET status = 'accepted', updated_at = NOW()
    WHERE id = NEW.proposal_id;

    INSERT INTO history_log (
      entity_type, entity_id, action,
      changed_by, changed_by_role, proposal_id
    )
    VALUES (
      'proposal', NEW.proposal_id, 'accepted',
      NEW.user_id,
      COALESCE((
        SELECT em.role::TEXT FROM event_members em
        JOIN proposals p ON p.event_id = em.event_id
        WHERE p.id = NEW.proposal_id AND em.user_id = NEW.user_id
        LIMIT 1
      ), 'unknown'),
      NEW.proposal_id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_proposal_consensus ON proposal_recipients;
CREATE TRIGGER trg_auto_proposal_consensus
  AFTER UPDATE OF status ON proposal_recipients
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_proposal_consensus();


-- ── 3. finalize_merge() – ersetzt alte Version ────────────────────────────────
-- Neu: schreibt p_merged_state in proposal_module_states.
-- base_version in proposals wird auf NOW() gesetzt → nächste Proposals starten
-- mit aktuellem Stand.

CREATE OR REPLACE FUNCTION finalize_merge(
  p_proposal_id  UUID,
  p_merged_state JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_role     TEXT;
  v_event_id UUID;
  v_module   TEXT;
  v_snap     JSONB;
BEGIN
  SELECT event_id, module INTO v_event_id, v_module
  FROM proposals
  WHERE id = p_proposal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'proposal_not_found';
  END IF;

  SELECT role::TEXT INTO v_role
  FROM event_members
  WHERE event_id = v_event_id AND user_id = v_user_id
  LIMIT 1;

  -- Nur Veranstalter darf finalisieren
  IF v_role IS DISTINCT FROM 'veranstalter' THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Proposal als accepted markieren (idempotent – kann bereits accepted sein)
  UPDATE proposals
    SET status = 'accepted', updated_at = NOW()
  WHERE id = p_proposal_id;

  -- Case schließen (falls vorhanden)
  UPDATE cases
    SET status = 'resolved', resolved_at = NOW()
  WHERE proposal_id = p_proposal_id AND status = 'open';

  -- Alle Locks freigeben
  DELETE FROM field_locks WHERE proposal_id = p_proposal_id;

  -- Merged State in proposal_module_states schreiben (Upsert)
  IF p_merged_state IS NOT NULL THEN
    INSERT INTO proposal_module_states (event_id, module, state_json, updated_at, updated_by)
    VALUES (v_event_id, v_module, p_merged_state, NOW(), v_user_id)
    ON CONFLICT (event_id, module) DO UPDATE
      SET state_json = EXCLUDED.state_json,
          updated_at = EXCLUDED.updated_at,
          updated_by = EXCLUDED.updated_by;
  END IF;

  -- Snapshot für History
  SELECT snapshot_json INTO v_snap
  FROM proposal_snapshots
  WHERE proposal_id = p_proposal_id;

  -- History-Eintrag
  INSERT INTO history_log (
    entity_type, entity_id, action,
    old_state, new_state,
    changed_by, changed_by_role, proposal_id
  )
  VALUES (
    'merge', p_proposal_id, 'merged',
    v_snap,
    p_merged_state,
    v_user_id, COALESCE(v_role, 'unknown'), p_proposal_id
  );
END;
$$;


-- ── 4. validate_merge_proposal() – ersetzt alte Version ──────────────────────
-- Neu: Prüft base_version-Konflikt gegen proposal_module_states.updated_at.
-- proposals.base_version enthält den ISO-Timestamp des Modul-Zustands
-- zum Zeitpunkt der Proposal-Erstellung.

CREATE OR REPLACE FUNCTION validate_merge_proposal(p_proposal_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal   proposals%ROWTYPE;
  v_master_at  TIMESTAMPTZ;
  v_base_ts    TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_proposal FROM proposals WHERE id = p_proposal_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'proposal_not_found');
  END IF;

  -- Proposal muss im Zustand accepted, pending oder in_case sein
  IF v_proposal.status NOT IN ('pending','in_case','accepted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_proposal.status);
  END IF;

  -- All-Party-Consensus prüfen (übersprungen wenn bereits accepted)
  IF v_proposal.status != 'accepted' AND NOT check_proposal_consensus(p_proposal_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'consensus_not_reached');
  END IF;

  -- Keine aktiven Fremd-Locks
  IF EXISTS (
    SELECT 1 FROM field_locks
    WHERE proposal_id = p_proposal_id
      AND expires_at  > NOW()
      AND locked_by  != auth.uid()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'active_locks_exist');
  END IF;

  -- base_version-Konflikt-Prüfung
  -- base_version = '' oder NULL → erstes Proposal, kein Konflikt möglich
  IF v_proposal.base_version IS NOT NULL AND v_proposal.base_version != '' THEN
    -- base_version als Timestamp parsen (robust – fängt ungültige Werte ab)
    BEGIN
      v_base_ts := v_proposal.base_version::TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN
      v_base_ts := NULL;
    END;

    IF v_base_ts IS NOT NULL THEN
      SELECT updated_at INTO v_master_at
      FROM proposal_module_states
      WHERE event_id = v_proposal.event_id AND module = v_proposal.module;

      -- Wenn Master neuer als base_version → Konflikt
      IF FOUND AND v_master_at > v_base_ts THEN
        RETURN jsonb_build_object(
          'ok',           false,
          'reason',       'base_version_conflict',
          'base_version', v_proposal.base_version,
          'master_at',    v_master_at
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;


-- ── 5. get_module_master_state() ─────────────────────────────────────────────
-- RPC: gibt den aktuellen Modul-Zustand zurück.
-- Gibt NULL zurück wenn noch kein Eintrag existiert (noch kein Merge).
-- Frontend benutzt den Rückgabewert als initialData für ProposalLightbox.

CREATE OR REPLACE FUNCTION get_module_master_state(
  p_event_id UUID,
  p_module   TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state JSONB;
BEGIN
  -- Zugriffsprüfung
  IF NOT is_event_member(p_event_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT state_json INTO v_state
  FROM proposal_module_states
  WHERE event_id = p_event_id AND module = p_module;

  RETURN v_state; -- NULL wenn noch kein Eintrag
END;
$$;


-- ── 6. Realtime ───────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'proposal_module_states'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE proposal_module_states;
  END IF;
END $$;
