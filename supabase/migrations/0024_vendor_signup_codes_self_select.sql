-- ============================================================
-- Velvet Migration 0024 — Vendor Signup Codes: Self-Select Policy
-- Allows vendors to read their own used_by record directly,
-- removing the need for the admin-client proxy endpoint.
-- Idempotent — safe to re-run.
-- ============================================================

DROP POLICY IF EXISTS "vsc_select_own" ON vendor_signup_codes;
CREATE POLICY "vsc_select_own" ON vendor_signup_codes
  FOR SELECT USING (used_by = auth.uid());
