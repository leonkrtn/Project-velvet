-- Migration 0118 — Brautpaar extended profile + CRM partner linking

-- 1. Extend profiles with structured contact details
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_name    TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name     TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS street        TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS postal_code   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS city          TEXT NOT NULL DEFAULT '';
-- phone already added by migration 0023

-- 2. Unregistered partner contact info captured at brautpaar signup
CREATE TABLE IF NOT EXISTS event_partner_profiles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  first_name   TEXT NOT NULL DEFAULT '',
  last_name    TEXT NOT NULL DEFAULT '',
  email        TEXT NOT NULL DEFAULT '',
  phone        TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id)
);

ALTER TABLE event_partner_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_partner_profiles_read"
  ON event_partner_profiles FOR SELECT
  USING (is_event_member(event_id, ARRAY['brautpaar','brautpaar_solo','veranstalter']::user_role[]));

CREATE POLICY "event_partner_profiles_write"
  ON event_partner_profiles FOR ALL
  USING (is_event_member(event_id, ARRAY['brautpaar','brautpaar_solo']::user_role[]));

-- 3. CRM contact extensions
ALTER TABLE crm_contacts
  ADD COLUMN IF NOT EXISTS partner_contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS home_street         TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS home_postal_code    TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS home_city           TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pending_offer_value NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS couple_budget       NUMERIC(12,2);

COMMENT ON COLUMN crm_contacts.partner_contact_id IS 'Cross-link to the partner person CRM contact';
COMMENT ON COLUMN crm_contacts.home_city          IS 'Wohnort des Kontakts (aus Profil)';
COMMENT ON COLUMN crm_contacts.pending_offer_value IS 'Vendor offer total before acceptance — shown as Angebot in UI';
COMMENT ON COLUMN crm_contacts.couple_budget       IS 'Couple budget from marketplace_requests — shown in detail view only, never in list';

CREATE INDEX IF NOT EXISTS idx_crm_contacts_home_city ON crm_contacts(home_city);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_partner   ON crm_contacts(partner_contact_id);
