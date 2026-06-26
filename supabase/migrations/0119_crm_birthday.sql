-- Add birthday field to crm_contacts for birthday reminders
ALTER TABLE crm_contacts
  ADD COLUMN IF NOT EXISTS birthday DATE;
