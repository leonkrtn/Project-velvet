-- Migration 0117 — CRM: add request_id link to marketplace_requests
ALTER TABLE crm_contacts
  ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES marketplace_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_contacts_request ON crm_contacts(request_id);

-- Also store guest count and location from linked sources
ALTER TABLE crm_contacts
  ADD COLUMN IF NOT EXISTS guest_count   INTEGER,
  ADD COLUMN IF NOT EXISTS location      TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS event_title   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS request_message TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN crm_contacts.request_id IS 'Linked marketplace_request — NULL for manually created or offer-imported contacts';
COMMENT ON COLUMN crm_contacts.guest_count IS 'Confirmed guest count snapshotted at import time';
COMMENT ON COLUMN crm_contacts.location IS 'Venue / location text from event or offer';
COMMENT ON COLUMN crm_contacts.event_title IS 'Event title for display';
COMMENT ON COLUMN crm_contacts.request_message IS 'Original request message from the couple';
