-- ══════════════════════════════════════════════════════════════════════════════
-- 0031_proposals_v2.sql
-- Proposals V2: Echtzeit-Verhandlungs- und Merge-System
--
-- Ersetzt das alte Proposal-System (0028-0030) vollständig.
-- Neue Architektur:
--   proposals              → Master-Datensatz pro Verhandlung
--   proposal_recipients    → Empfänger mit individuellem Status
--   proposal_snapshots     → Unveränderlicher Snapshot bei Proposal-Erstellung
--   proposal_fields        → Granulare Feld-Deltas (Alt vs. Neu)
--   cases                  → Verhandlungsraum bei Gegenvorschlag
--   case_messages          → Chat innerhalb eines Case
--   field_locks            → Serverseitiges Field Locking (30s TTL)
--   history_log            → Vollständiger Audit-Trail
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 0. Altes System entfernen ─────────────────────────────────────────────────
-- ALTER PUBLICATION unterstützt kein IF EXISTS → DO-Block mit Existenzprüfung

DO $$
DECLARE
  v_tables TEXT[] := ARRAY['proposal_conflicts','proposal_responses','proposal_submissions','proposals'];
  v_tbl    TEXT;
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

DROP TABLE IF EXISTS proposal_conflicts   CASCADE;
DROP TABLE IF EXISTS proposal_responses   CASCADE;
DROP TABLE IF EXISTS proposal_submissions CASCADE;
DROP TABLE IF EXISTS proposals            CASCADE;


-- ── 1. proposals ─────────────────────────────────────────────────────────────
-- Master-Datensatz für jeden Verhandlungs-Thread.
-- status-Übergänge: draft → pending → in_case ↔ pending → accepted | rejected

CREATE TABLE proposals (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID        NOT NULL REFERENCES events(id)    ON DELETE CASCADE,
  created_by      UUID        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  created_by_role TEXT        NOT NULL CHECK (created_by_role IN ('veranstalter','brautpaar','dienstleister')),
  module          TEXT        NOT NULL CHECK (module IN (
                                'catering','ablaufplan','sitzplan','deko','musik','patisserie','vendor','hotel'
                              )),
  title           TEXT        NOT NULL DEFAULT '',
  status          TEXT        NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','pending','in_case','accepted','rejected')),
  -- Zeitstempel-basierter Versions-Hash des Master-Zustands bei Proposal-Erstellung.
  -- Wird beim Merge gegen den aktuellen Stand geprüft (Konflikt-Detektion).
  base_version    TEXT        NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_proposals_event  ON proposals(event_id);
CREATE INDEX idx_proposals_status ON proposals(status);


-- ── 2. proposal_recipients ────────────────────────────────────────────────────
-- Empfänger eines Proposals mit individuellem Abstimmungsstatus.
-- All-Party-Consensus: proposal wird nur accepted wenn ALLE status = 'accepted'.

CREATE TABLE proposal_recipients (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id  UUID        NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  role         TEXT        NOT NULL CHECK (role IN ('veranstalter','brautpaar','dienstleister')),
  status       TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','accepted','rejected','countered')),
  responded_at TIMESTAMPTZ,
  UNIQUE (proposal_id, user_id)
);

CREATE INDEX idx_proposal_recipients_proposal ON proposal_recipients(proposal_id);
CREATE INDEX idx_proposal_recipients_user     ON proposal_recipients(user_id);


-- ── 3. proposal_snapshots ─────────────────────────────────────────────────────
-- Unveränderlicher Full-State-Snapshot des Moduls zum Zeitpunkt der Erstellung.
-- Dient als Quelle für Delta-Berechnungen und Konflikt-Detektion.

CREATE TABLE proposal_snapshots (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id   UUID        NOT NULL REFERENCES proposals(id) ON DELETE CASCADE UNIQUE,
  snapshot_json JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── 4. proposal_fields ────────────────────────────────────────────────────────
-- Granulare Feld-Deltas: ein Eintrag pro geändertem Attribut.
-- value_old = NULL → neues Entity (hinzugefügt)
-- value_new = NULL → gelöschtes Entity
-- field_path = segment + '.' + entity_id + '.' + field_key (für Lock-Matching)

CREATE TABLE proposal_fields (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID        NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  segment     TEXT        NOT NULL,  -- z.B. 'catering', 'ablaufplan'
  entity_id   TEXT        NOT NULL,  -- stabile ID des Objekts (slot_id, row_id, …)
  field_key   TEXT        NOT NULL,  -- Attribut-Name (z.B. 'price', 'time', 'name')
  value_old   JSONB,                 -- Wert im Master / Snapshot
  value_new   JSONB,                 -- Vorgeschlagener neuer Wert
  is_changed  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (proposal_id, segment, entity_id, field_key)
);

CREATE INDEX idx_proposal_fields_proposal ON proposal_fields(proposal_id);


-- ── 5. cases ──────────────────────────────────────────────────────────────────
-- Verhandlungsraum, der beim Gegenvorschlag entsteht.
-- Ein Proposal hat maximal einen Case (UNIQUE auf proposal_id).
-- Beim Case-Öffnen werden alle recipient-Statuses auf 'pending' zurückgesetzt.

CREATE TABLE cases (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID        NOT NULL REFERENCES proposals(id) ON DELETE CASCADE UNIQUE,
  created_by  UUID        NOT NULL REFERENCES profiles(id),
  status      TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cases_proposal ON cases(proposal_id);
CREATE INDEX idx_cases_status   ON cases(status);


-- ── 6. case_messages ──────────────────────────────────────────────────────────
-- Chat-Nachrichten innerhalb eines Verhandlungs-Case.

CREATE TABLE case_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id    UUID        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id),
  content    TEXT        NOT NULL CHECK (length(content) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_case_messages_case ON case_messages(case_id);


-- ── 7. field_locks ────────────────────────────────────────────────────────────
-- Serverseitiges Field Locking. Nur der Lock-Inhaber darf das Feld schreiben.
-- TTL: 30 Sekunden. Heartbeat verlängert den Lock bei Aktivität.
-- field_path = segment || '.' || entity_id || '.' || field_key

CREATE TABLE field_locks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID        NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  field_path  TEXT        NOT NULL,
  locked_by   UUID        NOT NULL REFERENCES profiles(id),
  locked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 seconds',
  UNIQUE (proposal_id, field_path)
);

CREATE INDEX idx_field_locks_proposal   ON field_locks(proposal_id);
CREATE INDEX idx_field_locks_expires_at ON field_locks(expires_at);


-- ── 8. history_log ────────────────────────────────────────────────────────────
-- Vollständiger Audit-Trail aller Proposal-relevanten Aktionen.
-- Ermöglicht Undo, Audit-Analyse und Konfliktdiagnose.

CREATE TABLE history_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     TEXT        NOT NULL CHECK (entity_type IN ('proposal','case','field','merge')),
  entity_id       UUID        NOT NULL,
  action          TEXT        NOT NULL,
  -- Aktions-Werte: created | updated | sent | accepted | rejected | countered
  --               case_opened | case_resolved | field_changed | merged
  old_state       JSONB,
  new_state       JSONB,
  changed_by      UUID        NOT NULL REFERENCES profiles(id),
  changed_by_role TEXT        NOT NULL,
  proposal_id     UUID        REFERENCES proposals(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_history_log_proposal    ON history_log(proposal_id);
CREATE INDEX idx_history_log_entity      ON history_log(entity_type, entity_id);
CREATE INDEX idx_history_log_changed_by  ON history_log(changed_by);


-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE proposals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_fields     ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases               ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_locks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE history_log         ENABLE ROW LEVEL SECURITY;


-- ── proposals ─────────────────────────────────────────────────────────────────

CREATE POLICY "proposals_select"
  ON proposals FOR SELECT
  USING (is_event_member(event_id));

CREATE POLICY "proposals_insert"
  ON proposals FOR INSERT
  WITH CHECK (is_event_member(event_id) AND created_by = auth.uid());

CREATE POLICY "proposals_update"
  ON proposals FOR UPDATE
  USING (is_event_member(event_id));

CREATE POLICY "proposals_delete"
  ON proposals FOR DELETE
  USING (created_by = auth.uid() AND status = 'draft');


-- ── proposal_recipients ───────────────────────────────────────────────────────

CREATE POLICY "proposal_recipients_select"
  ON proposal_recipients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.id = proposal_id AND is_event_member(p.event_id)
    )
  );

CREATE POLICY "proposal_recipients_insert"
  ON proposal_recipients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.id = proposal_id
        AND is_event_member(p.event_id)
        AND p.created_by = auth.uid()
    )
  );

-- Empfänger darf nur seinen eigenen Status ändern
CREATE POLICY "proposal_recipients_update"
  ON proposal_recipients FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "proposal_recipients_delete"
  ON proposal_recipients FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.id = proposal_id
        AND p.created_by = auth.uid()
        AND p.status = 'draft'
    )
  );


-- ── proposal_snapshots ────────────────────────────────────────────────────────

CREATE POLICY "proposal_snapshots_select"
  ON proposal_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.id = proposal_id AND is_event_member(p.event_id)
    )
  );

CREATE POLICY "proposal_snapshots_insert"
  ON proposal_snapshots FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.id = proposal_id
        AND p.created_by = auth.uid()
    )
  );

-- Snapshots sind unveränderlich (kein UPDATE/DELETE)


-- ── proposal_fields ───────────────────────────────────────────────────────────

CREATE POLICY "proposal_fields_select"
  ON proposal_fields FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.id = proposal_id AND is_event_member(p.event_id)
    )
  );

-- INSERT: Event-Mitglied UND (Proposal im Draft-Status ODER Lock-Inhaber)
CREATE POLICY "proposal_fields_insert"
  ON proposal_fields FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.id = proposal_id AND is_event_member(p.event_id)
    )
    AND (
      -- Draft: Ersteller darf direkt einfügen
      EXISTS (
        SELECT 1 FROM proposals p
        WHERE p.id = proposal_id AND p.created_by = auth.uid() AND p.status = 'draft'
      )
      OR
      -- In Case / Pending: Lock-Inhaber darf schreiben
      EXISTS (
        SELECT 1 FROM field_locks fl
        WHERE fl.proposal_id = proposal_fields.proposal_id
          AND fl.field_path = proposal_fields.segment || '.' || proposal_fields.entity_id || '.' || proposal_fields.field_key
          AND fl.locked_by = auth.uid()
          AND fl.expires_at > NOW()
      )
    )
  );

-- UPDATE: Nur Lock-Inhaber für das jeweilige Feld
CREATE POLICY "proposal_fields_update"
  ON proposal_fields FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM field_locks fl
      WHERE fl.proposal_id = proposal_fields.proposal_id
        AND fl.field_path = proposal_fields.segment || '.' || proposal_fields.entity_id || '.' || proposal_fields.field_key
        AND fl.locked_by = auth.uid()
        AND fl.expires_at > NOW()
    )
  );

-- DELETE: Proposal-Ersteller im Draft-Status
CREATE POLICY "proposal_fields_delete"
  ON proposal_fields FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.id = proposal_id AND p.created_by = auth.uid() AND p.status = 'draft'
    )
  );


-- ── cases ─────────────────────────────────────────────────────────────────────

CREATE POLICY "cases_select"
  ON cases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.id = proposal_id AND is_event_member(p.event_id)
    )
  );

-- Cases werden ausschließlich über die open_case_for_proposal()-Funktion erstellt
CREATE POLICY "cases_insert"
  ON cases FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.id = proposal_id AND is_event_member(p.event_id)
    )
  );

CREATE POLICY "cases_update"
  ON cases FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.id = proposal_id AND is_event_member(p.event_id)
    )
  );


-- ── case_messages ─────────────────────────────────────────────────────────────

CREATE POLICY "case_messages_select"
  ON case_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cases c
      JOIN proposals p ON p.id = c.proposal_id
      WHERE c.id = case_id AND is_event_member(p.event_id)
    )
  );

CREATE POLICY "case_messages_insert"
  ON case_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM cases c
      JOIN proposals p ON p.id = c.proposal_id
      WHERE c.id = case_id
        AND is_event_member(p.event_id)
        AND c.status = 'open'
    )
  );


-- ── field_locks ───────────────────────────────────────────────────────────────

CREATE POLICY "field_locks_select"
  ON field_locks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.id = proposal_id AND is_event_member(p.event_id)
    )
  );

-- Locks werden ausschließlich über acquire_field_lock() gesetzt
CREATE POLICY "field_locks_insert"
  ON field_locks FOR INSERT
  WITH CHECK (
    locked_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.id = proposal_id AND is_event_member(p.event_id)
    )
  );

-- Nur Lock-Inhaber darf verlängern
CREATE POLICY "field_locks_update"
  ON field_locks FOR UPDATE
  USING (locked_by = auth.uid());

-- Lock-Inhaber oder abgelaufene Locks können gelöscht werden
CREATE POLICY "field_locks_delete"
  ON field_locks FOR DELETE
  USING (locked_by = auth.uid() OR expires_at <= NOW());


-- ── history_log ───────────────────────────────────────────────────────────────

CREATE POLICY "history_log_select"
  ON history_log FOR SELECT
  USING (
    changed_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.id = proposal_id AND is_event_member(p.event_id)
    )
  );

CREATE POLICY "history_log_insert"
  ON history_log FOR INSERT
  WITH CHECK (changed_by = auth.uid());

-- Audit-Log ist unveränderlich (kein UPDATE/DELETE)


-- ══════════════════════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════


-- ── acquire_field_lock ────────────────────────────────────────────────────────
-- Versucht einen Field-Lock zu setzen. Bereinigt abgelaufene Locks vorher.
-- Gibt {success, acquired, extended, locked_by, expires_at, reason} zurück.

CREATE OR REPLACE FUNCTION acquire_field_lock(
  p_proposal_id UUID,
  p_field_path  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID        := auth.uid();
  v_existing   field_locks%ROWTYPE;
  v_expires_at TIMESTAMPTZ := NOW() + INTERVAL '30 seconds';
BEGIN
  -- Autorisierung prüfen
  IF NOT EXISTS (
    SELECT 1 FROM proposals p
    JOIN event_members em ON em.event_id = p.event_id AND em.user_id = v_user_id
    WHERE p.id = p_proposal_id
      AND p.status IN ('draft','pending','in_case')
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authorized');
  END IF;

  -- Abgelaufene Locks für dieses Feld bereinigen
  DELETE FROM field_locks
  WHERE proposal_id = p_proposal_id
    AND field_path  = p_field_path
    AND expires_at <= NOW();

  -- Prüfen ob aktiver Lock vorhanden
  SELECT * INTO v_existing
  FROM field_locks
  WHERE proposal_id = p_proposal_id
    AND field_path  = p_field_path;

  IF FOUND THEN
    IF v_existing.locked_by = v_user_id THEN
      -- Eigenen Lock verlängern
      UPDATE field_locks
        SET expires_at = v_expires_at
      WHERE proposal_id = p_proposal_id
        AND field_path  = p_field_path;

      RETURN jsonb_build_object(
        'success',    true,
        'acquired',   false,
        'extended',   true,
        'expires_at', v_expires_at
      );
    ELSE
      -- Fremdlock aktiv
      RETURN jsonb_build_object(
        'success',    false,
        'reason',     'locked_by_other',
        'locked_by',  v_existing.locked_by,
        'expires_at', v_existing.expires_at
      );
    END IF;
  END IF;

  -- Neuen Lock setzen
  INSERT INTO field_locks (proposal_id, field_path, locked_by, locked_at, expires_at)
  VALUES (p_proposal_id, p_field_path, v_user_id, NOW(), v_expires_at);

  RETURN jsonb_build_object(
    'success',    true,
    'acquired',   true,
    'extended',   false,
    'expires_at', v_expires_at
  );
END;
$$;


-- ── release_field_lock ────────────────────────────────────────────────────────
-- Gibt einen eigenen Lock frei. Gibt true zurück wenn Lock gefunden und gelöscht.

CREATE OR REPLACE FUNCTION release_field_lock(
  p_proposal_id UUID,
  p_field_path  TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM field_locks
  WHERE proposal_id = p_proposal_id
    AND field_path  = p_field_path
    AND locked_by   = auth.uid();

  RETURN FOUND;
END;
$$;


-- ── heartbeat_field_lock ──────────────────────────────────────────────────────
-- Verlängert den eigenen aktiven Lock um weitere 30 Sekunden.

CREATE OR REPLACE FUNCTION heartbeat_field_lock(
  p_proposal_id UUID,
  p_field_path  TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE field_locks
    SET expires_at = NOW() + INTERVAL '30 seconds'
  WHERE proposal_id = p_proposal_id
    AND field_path  = p_field_path
    AND locked_by   = auth.uid()
    AND expires_at  > NOW();

  RETURN FOUND;
END;
$$;


-- ── check_proposal_consensus ──────────────────────────────────────────────────
-- Gibt TRUE zurück wenn alle Empfänger accepted haben (All-Party-Consensus).

CREATE OR REPLACE FUNCTION check_proposal_consensus(p_proposal_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total    INT;
  v_accepted INT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'accepted')
  INTO v_total, v_accepted
  FROM proposal_recipients
  WHERE proposal_id = p_proposal_id;

  RETURN v_total > 0 AND v_total = v_accepted;
END;
$$;


-- ── open_case_for_proposal ────────────────────────────────────────────────────
-- Wird aufgerufen wenn ein Empfänger einen Gegenvorschlag erstellt:
--  1. Proposal-Status → 'in_case'
--  2. Alle Empfänger-Statuses → 'pending' (Reset-Modell)
--  3. Case erstellen (oder bestehenden zurückgeben)
-- Gibt die Case-ID zurück.

CREATE OR REPLACE FUNCTION open_case_for_proposal(p_proposal_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_case_id UUID;
BEGIN
  -- Nur Empfänger dürfen Cases öffnen
  IF NOT EXISTS (
    SELECT 1 FROM proposal_recipients
    WHERE proposal_id = p_proposal_id
      AND user_id     = v_user_id
  ) THEN
    RAISE EXCEPTION 'not_a_recipient';
  END IF;

  -- Alle Empfänger-Statuses zurücksetzen
  UPDATE proposal_recipients
    SET status = 'pending', responded_at = NULL
  WHERE proposal_id = p_proposal_id;

  -- Proposal-Status auf 'in_case' setzen
  UPDATE proposals
    SET status = 'in_case', updated_at = NOW()
  WHERE id = p_proposal_id;

  -- Case anlegen oder bestehenden wiederverwenden
  INSERT INTO cases (proposal_id, created_by)
  VALUES (p_proposal_id, v_user_id)
  ON CONFLICT (proposal_id) DO UPDATE SET status = 'open', resolved_at = NULL
  RETURNING id INTO v_case_id;

  -- History schreiben
  INSERT INTO history_log (entity_type, entity_id, action, changed_by, changed_by_role, proposal_id)
  SELECT 'case', v_case_id, 'case_opened', v_user_id,
    COALESCE((
      SELECT role FROM event_members em
      JOIN proposals p ON p.event_id = em.event_id
      WHERE p.id = p_proposal_id AND em.user_id = v_user_id
      LIMIT 1
    ), 'unknown'),
    p_proposal_id;

  RETURN v_case_id;
END;
$$;


-- ── validate_merge_proposal ───────────────────────────────────────────────────
-- Prüft alle Vorbedingungen für einen Merge.
-- Gibt {ok, reason} zurück. Kein Seiteneffekt.

CREATE OR REPLACE FUNCTION validate_merge_proposal(p_proposal_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal proposals%ROWTYPE;
BEGIN
  SELECT * INTO v_proposal FROM proposals WHERE id = p_proposal_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'proposal_not_found');
  END IF;

  -- Proposal muss im Zustand pending oder in_case sein
  IF v_proposal.status NOT IN ('pending','in_case') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_proposal.status);
  END IF;

  -- All-Party-Consensus prüfen
  IF NOT check_proposal_consensus(p_proposal_id) THEN
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

  RETURN jsonb_build_object('ok', true);
END;
$$;


-- ── finalize_merge ────────────────────────────────────────────────────────────
-- Wird nach erfolgreichem App-seitigem Merge aufgerufen:
--  1. Proposal-Status → 'accepted'
--  2. Case schließen (falls vorhanden)
--  3. History-Eintrag schreiben
--  4. Alle Locks für dieses Proposal freigeben

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
  v_user_id UUID := auth.uid();
  v_role    TEXT;
  v_event_id UUID;
BEGIN
  SELECT event_id INTO v_event_id FROM proposals WHERE id = p_proposal_id;

  SELECT role INTO v_role
  FROM event_members
  WHERE event_id = v_event_id AND user_id = v_user_id
  LIMIT 1;

  -- Proposal als accepted markieren
  UPDATE proposals
    SET status = 'accepted', updated_at = NOW()
  WHERE id = p_proposal_id;

  -- Case schließen (falls vorhanden)
  UPDATE cases
    SET status = 'resolved', resolved_at = NOW()
  WHERE proposal_id = p_proposal_id AND status = 'open';

  -- Alle Locks freigeben
  DELETE FROM field_locks WHERE proposal_id = p_proposal_id;

  -- History-Eintrag
  INSERT INTO history_log (
    entity_type, entity_id, action,
    old_state,
    new_state,
    changed_by, changed_by_role, proposal_id
  )
  VALUES (
    'merge', p_proposal_id, 'merged',
    (SELECT snapshot_json FROM proposal_snapshots WHERE proposal_id = p_proposal_id),
    p_merged_state,
    v_user_id, COALESCE(v_role, 'unknown'), p_proposal_id
  );
END;
$$;


-- ── write_history ─────────────────────────────────────────────────────────────
-- Convenience-Funktion für history_log Einträge aus dem App-Layer.

CREATE OR REPLACE FUNCTION write_proposal_history(
  p_entity_type TEXT,
  p_entity_id   UUID,
  p_action      TEXT,
  p_old_state   JSONB DEFAULT NULL,
  p_new_state   JSONB DEFAULT NULL,
  p_proposal_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_role     TEXT;
  v_event_id UUID;
  v_log_id   UUID;
BEGIN
  -- Rolle ermitteln
  IF p_proposal_id IS NOT NULL THEN
    SELECT event_id INTO v_event_id FROM proposals WHERE id = p_proposal_id;
    SELECT role INTO v_role FROM event_members
    WHERE event_id = v_event_id AND user_id = v_user_id LIMIT 1;
  END IF;

  INSERT INTO history_log (
    entity_type, entity_id, action,
    old_state, new_state,
    changed_by, changed_by_role, proposal_id
  )
  VALUES (
    p_entity_type, p_entity_id, p_action,
    p_old_state, p_new_state,
    v_user_id, COALESCE(v_role, 'unknown'), p_proposal_id
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;


-- ── cleanup_expired_locks ─────────────────────────────────────────────────────
-- Kann periodisch aufgerufen werden (oder via pg_cron). Bereinigt alle
-- abgelaufenen Locks global.

CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  DELETE FROM field_locks WHERE expires_at <= NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ══════════════════════════════════════════════════════════════════════════════
-- REALTIME AKTIVIEREN
-- ══════════════════════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE proposals;
ALTER PUBLICATION supabase_realtime ADD TABLE proposal_recipients;
ALTER PUBLICATION supabase_realtime ADD TABLE proposal_fields;
ALTER PUBLICATION supabase_realtime ADD TABLE cases;
ALTER PUBLICATION supabase_realtime ADD TABLE case_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE field_locks;
-- proposal_snapshots + history_log ohne Realtime (nur lesend, keine Live-Updates nötig)
