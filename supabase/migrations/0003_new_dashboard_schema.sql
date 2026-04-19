-- ============================================================
-- Velvet Migration 0003 — New Dashboard Schema
-- Adds columns for Allgemein, Mitglieder, Ablaufplan, Vendors,
-- and creates brautpaar_permissions table.
-- Idempotent — safe to re-run.
-- ============================================================


-- ════════════════════════════════════════════════════════════════════════════
-- EVENTS: new columns for Allgemein page
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE events ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_name VARCHAR(255);
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_street VARCHAR(255);
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_zip VARCHAR(20);
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_city VARCHAR(100);
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_website VARCHAR(500);
ALTER TABLE events ADD COLUMN IF NOT EXISTS menu_type VARCHAR(50) DEFAULT 'Mehrgängiges Menü';
ALTER TABLE events ADD COLUMN IF NOT EXISTS collect_allergies BOOLEAN DEFAULT true;
ALTER TABLE events ADD COLUMN IF NOT EXISTS organizer_fee DECIMAL(10,2);
ALTER TABLE events ADD COLUMN IF NOT EXISTS organizer_fee_type VARCHAR(50) DEFAULT 'Pauschal';
ALTER TABLE events ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS budget_total DECIMAL(10,2);


-- ════════════════════════════════════════════════════════════════════════════
-- VENDORS: new columns for Mitglieder / Vorschläge pages
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS cost_label VARCHAR(100) DEFAULT 'Pauschal';
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS website VARCHAR(500);


-- ════════════════════════════════════════════════════════════════════════════
-- HOTELS: website column for Vorschläge page
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE hotels ADD COLUMN IF NOT EXISTS website VARCHAR(500);


-- ════════════════════════════════════════════════════════════════════════════
-- EVENT_MEMBERS: invite_status + display_name
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE event_members ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
ALTER TABLE event_members ADD COLUMN IF NOT EXISTS invite_status VARCHAR(50) DEFAULT 'invited';
-- invite_status values: invited | confirmed | pending | declined


-- ════════════════════════════════════════════════════════════════════════════
-- TIMELINE_ENTRIES: extend for Ablaufplan page
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE timeline_entries ADD COLUMN IF NOT EXISTS start_minutes INT;
-- start_minutes: minutes since midnight (e.g. 870 = 14:30)
ALTER TABLE timeline_entries ADD COLUMN IF NOT EXISTS duration_minutes INT DEFAULT 60;
ALTER TABLE timeline_entries ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'Feier';
-- category values: Zeremonie | Empfang | Feier | Logistik
ALTER TABLE timeline_entries ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]'::jsonb;
-- checklist: [{text: string, done: boolean}]
ALTER TABLE timeline_entries ADD COLUMN IF NOT EXISTS responsibilities JSONB DEFAULT '[]'::jsonb;
-- responsibilities: [{member_id: string, initials: string, task: string, status: "done"|"pending"}]


-- ════════════════════════════════════════════════════════════════════════════
-- BRAUTPAAR_PERMISSIONS: granular feature access for Brautpaar
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS brautpaar_permissions (
  id              UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID      NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  ablaufplan      BOOLEAN   NOT NULL DEFAULT true,
  sub_events      BOOLEAN   NOT NULL DEFAULT false,
  erinnerungen    BOOLEAN   NOT NULL DEFAULT true,
  sitzplan        BOOLEAN   NOT NULL DEFAULT true,
  dekorationen    BOOLEAN   NOT NULL DEFAULT true,
  dienstleister   BOOLEAN   NOT NULL DEFAULT true,
  hotel           BOOLEAN   NOT NULL DEFAULT true,
  catering        BOOLEAN   NOT NULL DEFAULT false,
  anzeigeeinstellungen BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id)
);

CREATE INDEX IF NOT EXISTS idx_brautpaar_permissions_event_id ON brautpaar_permissions(event_id);

ALTER TABLE brautpaar_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brautpaar_permissions_select" ON brautpaar_permissions;
CREATE POLICY "brautpaar_permissions_select" ON brautpaar_permissions
  FOR SELECT USING (is_event_member(event_id));

DROP POLICY IF EXISTS "brautpaar_permissions_all" ON brautpaar_permissions;
CREATE POLICY "brautpaar_permissions_all" ON brautpaar_permissions
  FOR ALL USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));


-- ════════════════════════════════════════════════════════════════════════════
-- CONVERSATIONS + MESSAGES: Chat tables
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS conversations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name        TEXT,
  created_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_event_id ON conversations(event_id);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_select" ON conversations;
CREATE POLICY "conversations_select" ON conversations
  FOR SELECT USING (is_event_member(event_id));

DROP POLICY IF EXISTS "conversations_insert" ON conversations;
CREATE POLICY "conversations_insert" ON conversations
  FOR INSERT WITH CHECK (is_event_member(event_id));

DROP POLICY IF EXISTS "conversations_delete" ON conversations;
CREATE POLICY "conversations_delete" ON conversations
  FOR DELETE USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));


-- Conversation participants (members in a conversation)
CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conv_participants_select" ON conversation_participants;
CREATE POLICY "conv_participants_select" ON conversation_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id AND is_event_member(c.event_id)
    )
  );

DROP POLICY IF EXISTS "conv_participants_insert" ON conversation_participants;
CREATE POLICY "conv_participants_insert" ON conversation_participants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id AND is_event_member(c.event_id)
    )
  );


CREATE TABLE IF NOT EXISTS messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  content         TEXT        NOT NULL,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id AND is_event_member(c.event_id)
    )
  );

DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id AND is_event_member(c.event_id)
    )
  );

DROP POLICY IF EXISTS "messages_delete" ON messages;
CREATE POLICY "messages_delete" ON messages
  FOR DELETE USING (sender_id = auth.uid());


-- ════════════════════════════════════════════════════════════════════════════
-- updated_at trigger for brautpaar_permissions and conversations
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS brautpaar_permissions_updated_at ON brautpaar_permissions;
CREATE TRIGGER brautpaar_permissions_updated_at
  BEFORE UPDATE ON brautpaar_permissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS conversations_updated_at ON conversations;
CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
