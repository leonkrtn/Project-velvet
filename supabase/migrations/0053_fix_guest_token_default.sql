-- ════════════════════════════════════════════════════════════════════════════
-- 0053_fix_guest_token_default.sql
-- Fixes guests.token DEFAULT: base64url is not supported in PostgreSQL < 17.
-- Replaces with hex encoding which is universally supported.
-- The token is URL-safe either way; only the character set changes.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE guests
  ALTER COLUMN token SET DEFAULT encode(gen_random_bytes(24), 'hex');
