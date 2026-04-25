ALTER TABLE event_members
  ADD COLUMN IF NOT EXISTS show_in_contacts BOOLEAN NOT NULL DEFAULT false;
