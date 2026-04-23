-- 0025_timeline_assignments.sql
-- Mitarbeiter & Dienstleister Zuweisung für Ablaufplan-Punkte

ALTER TABLE timeline_entries ADD COLUMN IF NOT EXISTS assigned_staff    JSONB DEFAULT '[]';
ALTER TABLE timeline_entries ADD COLUMN IF NOT EXISTS assigned_vendors  JSONB DEFAULT '[]';
ALTER TABLE timeline_entries ADD COLUMN IF NOT EXISTS assigned_members  JSONB DEFAULT '[]';
