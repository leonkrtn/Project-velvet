-- ============================================================
-- Forevr Migration 0116 — Vendor CRM
--
-- Customer relationship management for vendors:
--   crm_contacts      — one record per customer/lead
--   crm_contact_persons — additional persons per contact (partner etc.)
--   crm_activities    — activity timeline (notes, calls, meetings, auto-events)
--   crm_tasks         — tasks with due dates per contact
-- ============================================================

-- ── crm_contacts ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_contacts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dienstleister_id  UUID        NOT NULL REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,

  -- Core identity
  name              TEXT        NOT NULL DEFAULT '',
  email             TEXT        NOT NULL DEFAULT '',
  phone             TEXT        NOT NULL DEFAULT '',
  address_line1     TEXT        NOT NULL DEFAULT '',
  address_line2     TEXT        NOT NULL DEFAULT '',

  -- Deal context
  lifecycle_stage   TEXT        NOT NULL DEFAULT 'lead',
  source            TEXT        NOT NULL DEFAULT 'sonstige',
  event_type        TEXT        NOT NULL DEFAULT 'hochzeit',
  wedding_date      DATE,
  deal_value        NUMERIC(12,2),
  notes             TEXT        NOT NULL DEFAULT '',

  -- Classification
  priority          TEXT        NOT NULL DEFAULT 'standard',
  custom_tags       JSONB       NOT NULL DEFAULT '[]',

  -- Links to other tables (optional)
  offer_id          UUID        REFERENCES vendor_offers(id) ON DELETE SET NULL,
  event_id          UUID        REFERENCES events(id)        ON DELETE SET NULL,

  -- Anniversary reminder
  anniversary_remind BOOLEAN    NOT NULL DEFAULT FALSE,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE crm_contacts ADD CONSTRAINT crm_contacts_stage_chk
    CHECK (lifecycle_stage IN ('lead','anfrage','gebucht','ehemalig'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE crm_contacts ADD CONSTRAINT crm_contacts_source_chk
    CHECK (source IN ('empfehlung','marktplatz','website','messe','sonstige','custom'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE crm_contacts ADD CONSTRAINT crm_contacts_priority_chk
    CHECK (priority IN ('vip','standard','grosskunde'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE crm_contacts ADD CONSTRAINT crm_contacts_event_type_chk
    CHECK (event_type IN ('hochzeit','firmenevent','privat','sonstige'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_crm_contacts_dl     ON crm_contacts(dienstleister_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_stage  ON crm_contacts(dienstleister_id, lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_offer  ON crm_contacts(offer_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_event  ON crm_contacts(event_id);

ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_contacts_own" ON crm_contacts;
CREATE POLICY "crm_contacts_own" ON crm_contacts
  FOR ALL TO authenticated
  USING (
    dienstleister_id IN (
      SELECT dienstleister_id FROM user_dienstleister WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    dienstleister_id IN (
      SELECT dienstleister_id FROM user_dienstleister WHERE user_id = auth.uid()
    )
  );

-- ── crm_contact_persons ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_contact_persons (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID  NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  name        TEXT  NOT NULL DEFAULT '',
  email       TEXT  NOT NULL DEFAULT '',
  phone       TEXT  NOT NULL DEFAULT '',
  role        TEXT  NOT NULL DEFAULT 'additional',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE crm_contact_persons ADD CONSTRAINT crm_persons_role_chk
    CHECK (role IN ('primary','partner','additional'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_crm_persons_contact ON crm_contact_persons(contact_id);

ALTER TABLE crm_contact_persons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_persons_own" ON crm_contact_persons;
CREATE POLICY "crm_persons_own" ON crm_contact_persons
  FOR ALL TO authenticated
  USING (
    contact_id IN (
      SELECT id FROM crm_contacts WHERE dienstleister_id IN (
        SELECT dienstleister_id FROM user_dienstleister WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    contact_id IN (
      SELECT id FROM crm_contacts WHERE dienstleister_id IN (
        SELECT dienstleister_id FROM user_dienstleister WHERE user_id = auth.uid()
      )
    )
  );

-- ── crm_activities ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_activities (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id        UUID        NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  dienstleister_id  UUID        NOT NULL REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,
  activity_type     TEXT        NOT NULL DEFAULT 'note',
  title             TEXT        NOT NULL DEFAULT '',
  body              TEXT        NOT NULL DEFAULT '',
  activity_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  auto_generated    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE crm_activities ADD CONSTRAINT crm_activities_type_chk
    CHECK (activity_type IN ('note','call','meeting','offer_sent','offer_accepted','offer_declined','stage_change','imported'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_crm_activities_contact ON crm_activities(contact_id, activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_dl      ON crm_activities(dienstleister_id);

ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_activities_own" ON crm_activities;
CREATE POLICY "crm_activities_own" ON crm_activities
  FOR ALL TO authenticated
  USING (
    dienstleister_id IN (
      SELECT dienstleister_id FROM user_dienstleister WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    dienstleister_id IN (
      SELECT dienstleister_id FROM user_dienstleister WHERE user_id = auth.uid()
    )
  );

-- ── crm_tasks ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_tasks (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id        UUID        REFERENCES crm_contacts(id) ON DELETE CASCADE,
  dienstleister_id  UUID        NOT NULL REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,
  title             TEXT        NOT NULL DEFAULT '',
  due_at            TIMESTAMPTZ,
  done              BOOLEAN     NOT NULL DEFAULT FALSE,
  done_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_contact ON crm_tasks(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_dl      ON crm_tasks(dienstleister_id, done, due_at);

ALTER TABLE crm_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_tasks_own" ON crm_tasks;
CREATE POLICY "crm_tasks_own" ON crm_tasks
  FOR ALL TO authenticated
  USING (
    dienstleister_id IN (
      SELECT dienstleister_id FROM user_dienstleister WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    dienstleister_id IN (
      SELECT dienstleister_id FROM user_dienstleister WHERE user_id = auth.uid()
    )
  );
