-- ============================================================
-- Velvet Migration 0009 — Vendor Signup Codes
-- Organizer-generated one-time codes for vendor account creation.
-- Separate from event_invitations (which add a user to an event).
-- Idempotent — safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS vendor_signup_codes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT        UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_by UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  used_by    UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  used_at    TIMESTAMPTZ,
  status     TEXT        NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'verwendet', 'abgelaufen')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_signup_codes_created_by ON vendor_signup_codes(created_by);
CREATE INDEX IF NOT EXISTS idx_vendor_signup_codes_code       ON vendor_signup_codes(code) WHERE status = 'offen';

ALTER TABLE vendor_signup_codes ENABLE ROW LEVEL SECURITY;

-- Veranstalter sieht eigene Codes
DROP POLICY IF EXISTS "vsc_select" ON vendor_signup_codes;
CREATE POLICY "vsc_select" ON vendor_signup_codes
  FOR SELECT USING (created_by = auth.uid());

-- Veranstalter kann Codes erstellen (nur wenn approved organizer)
DROP POLICY IF EXISTS "vsc_insert" ON vendor_signup_codes;
CREATE POLICY "vsc_insert" ON vendor_signup_codes
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_approved_organizer = true
    )
  );

-- RPC: Vendor signup code einlösen (anon + authenticated)
CREATE OR REPLACE FUNCTION public.preview_vendor_signup_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row vendor_signup_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM vendor_signup_codes WHERE code = p_code;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Code nicht gefunden.');
  END IF;

  IF v_row.status = 'verwendet' THEN
    RETURN jsonb_build_object('error', 'Code wurde bereits verwendet.');
  END IF;

  IF v_row.status = 'abgelaufen' OR v_row.expires_at < NOW() THEN
    UPDATE vendor_signup_codes SET status = 'abgelaufen' WHERE id = v_row.id;
    RETURN jsonb_build_object('error', 'Code ist abgelaufen.');
  END IF;

  RETURN jsonb_build_object('valid', true, 'expires_at', v_row.expires_at);
END;
$$;

-- RPC: Code als verwendet markieren (service_role via API)
CREATE OR REPLACE FUNCTION public.redeem_vendor_signup_code(p_code TEXT, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row vendor_signup_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM vendor_signup_codes WHERE code = p_code FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Code nicht gefunden.');
  END IF;

  IF v_row.status <> 'offen' OR v_row.expires_at < NOW() THEN
    RETURN jsonb_build_object('error', 'Code ungültig oder abgelaufen.');
  END IF;

  UPDATE vendor_signup_codes
  SET status = 'verwendet', used_by = p_user_id, used_at = NOW()
  WHERE id = v_row.id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_vendor_signup_code(TEXT)        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_vendor_signup_code(TEXT, UUID)   TO service_role;
