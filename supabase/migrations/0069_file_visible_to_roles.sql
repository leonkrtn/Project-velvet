-- 0069_file_visible_to_roles.sql
-- Adds per-role visibility control to file_metadata.
-- NULL = visible to all roles; array = only listed roles can see the file (Veranstalter always sees all).

ALTER TABLE file_metadata
  ADD COLUMN IF NOT EXISTS visible_to_roles TEXT[] DEFAULT NULL;
