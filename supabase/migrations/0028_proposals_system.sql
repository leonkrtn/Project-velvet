-- ── Proposals System ─────────────────────────────────────────────────────────
-- Generisches Vorschlagsystem für Verhandlungen zwischen Dienstleister,
-- Veranstalter und Brautpaar. Unterstützt Gegenvorschläge, Konfliktlösung
-- und Echtzeit-Updates.

-- Master-Datensatz für jeden Vorschlags-Thread
CREATE TABLE IF NOT EXISTS proposals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  proposer_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  proposer_role TEXT NOT NULL CHECK (proposer_role IN ('dienstleister', 'veranstalter', 'brautpaar')),
  module        TEXT NOT NULL CHECK (module IN ('catering', 'ablaufplan', 'sitzplan', 'deko', 'musik', 'patisserie')),
  title         TEXT,
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'conflict', 'resolved')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Jede gesendete Version im Verhandlungsprozess (Original + Gegenvorschläge)
-- parent_submission_id bildet die Kette: Gegenvorschlag → Original-Submission
CREATE TABLE IF NOT EXISTS proposal_submissions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id          UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  submitted_by         UUID NOT NULL REFERENCES profiles(id),
  submitted_by_role    TEXT NOT NULL CHECK (submitted_by_role IN ('dienstleister', 'veranstalter', 'brautpaar')),
  data                 JSONB NOT NULL DEFAULT '{}',
  sections_enabled     TEXT[] NOT NULL DEFAULT '{}',
  parent_submission_id UUID REFERENCES proposal_submissions(id),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Antworten der Empfänger auf eine Submission
CREATE TABLE IF NOT EXISTS proposal_responses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  UUID NOT NULL REFERENCES proposal_submissions(id) ON DELETE CASCADE,
  recipient_id   UUID NOT NULL REFERENCES profiles(id),
  recipient_role TEXT NOT NULL CHECK (recipient_role IN ('dienstleister', 'veranstalter', 'brautpaar')),
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'accepted', 'rejected', 'countered')),
  responded_at   TIMESTAMPTZ,
  UNIQUE (submission_id, recipient_id)
);

-- Konflikte: wenn Multi-Empfänger-Antworten divergieren
-- joint_draft = gemeinsam bearbeitete Einigungsversion
-- Beide Parteien müssen joint_draft approven bevor er an den ursprünglichen Proposer geht
CREATE TABLE IF NOT EXISTS proposal_conflicts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id            UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  submission_id          UUID NOT NULL REFERENCES proposal_submissions(id),
  conversation_id        UUID REFERENCES conversations(id),
  joint_draft            JSONB DEFAULT '{}',
  joint_sections_enabled TEXT[] DEFAULT '{}',
  veranstalter_approved  BOOLEAN NOT NULL DEFAULT FALSE,
  brautpaar_approved     BOOLEAN NOT NULL DEFAULT FALSE,
  status                 TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE proposals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_responses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_conflicts   ENABLE ROW LEVEL SECURITY;

-- proposals: alle Event-Mitglieder können lesen; schreiben nur eigene
DO $$ BEGIN CREATE POLICY "proposals_select" ON proposals
  FOR SELECT USING (is_event_member(event_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "proposals_insert" ON proposals
  FOR INSERT WITH CHECK (is_event_member(event_id) AND proposer_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "proposals_update" ON proposals
  FOR UPDATE USING (is_event_member(event_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- proposal_submissions: alle Event-Mitglieder können lesen; schreiben wenn Event-Mitglied
DO $$ BEGIN CREATE POLICY "proposal_submissions_select" ON proposal_submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM proposals p WHERE p.id = proposal_id AND is_event_member(p.event_id))
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "proposal_submissions_insert" ON proposal_submissions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM proposals p WHERE p.id = proposal_id AND is_event_member(p.event_id))
    AND submitted_by = auth.uid()
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- proposal_responses: alle Event-Mitglieder können lesen; schreiben nur eigene Antwort
DO $$ BEGIN CREATE POLICY "proposal_responses_select" ON proposal_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM proposal_submissions ps
      JOIN proposals p ON p.id = ps.proposal_id
      WHERE ps.id = submission_id AND is_event_member(p.event_id)
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "proposal_responses_insert" ON proposal_responses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM proposal_submissions ps
      JOIN proposals p ON p.id = ps.proposal_id
      WHERE ps.id = submission_id AND is_event_member(p.event_id)
    )
    AND recipient_id = auth.uid()
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "proposal_responses_update" ON proposal_responses
  FOR UPDATE USING (recipient_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- proposal_conflicts: Veranstalter + Brautpaar können lesen und bearbeiten
DO $$ BEGIN CREATE POLICY "proposal_conflicts_select" ON proposal_conflicts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM proposals p WHERE p.id = proposal_id AND is_event_member(p.event_id))
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "proposal_conflicts_insert" ON proposal_conflicts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM proposals p WHERE p.id = proposal_id AND is_event_member(p.event_id))
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "proposal_conflicts_update" ON proposal_conflicts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.id = proposal_id
        AND is_event_member(p.event_id, ARRAY['veranstalter', 'brautpaar']::user_role[])
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Realtime aktivieren ───────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE proposals;
ALTER PUBLICATION supabase_realtime ADD TABLE proposal_submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE proposal_responses;
ALTER PUBLICATION supabase_realtime ADD TABLE proposal_conflicts;
