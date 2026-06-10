-- 0089_redeem_invite_hardening.sql
-- ════════════════════════════════════════════════════════════════════════════
-- Härtung von redeem_invite_code() für den Solo-Brautpaar-Flow
-- ════════════════════════════════════════════════════════════════════════════
-- Baut auf 0086 (ENUM brautpaar_solo), 0087/0088 (Solo-Funktionen) auf.
--
-- Zwei Probleme der bisherigen Version (setup.sql):
--
-- 1. VERANSTALTER-CODES OHNE FREISCHALTUNGS-CHECK
--    Solo-Brautpaare können Veranstalter-Invite-Codes erzeugen
--    (/api/invite/create, brautpaar_solo → veranstalter). Bisher konnte
--    JEDER eingeloggte User so einen Code einlösen und wurde veranstalter-
--    Mitglied — ohne is_approved_organizer. Ergebnis: Mitgliedschaft mit
--    Rolle veranstalter, aber kein Zugriff aufs Portal (Middleware blockt).
--    NEU: Veranstalter-Codes erfordern profiles.is_approved_organizer = true,
--    sonst Fehler 'NOT_APPROVED_ORGANIZER' (Code bleibt offen und kann vom
--    richtigen Veranstalter weiterhin eingelöst werden).
--
-- 2. VERSEHENTLICHE ROLLEN-DEGRADIERUNG
--    Bisher überschrieb das Einlösen eines Codes die Rolle eines bereits
--    existierenden Mitglieds. Gefahr im Solo-Flow: Partner A (brautpaar_solo)
--    erstellt einen Veranstalter-Code, Partner B (ebenfalls brautpaar_solo)
--    klickt versehentlich auf den Link → B würde zum veranstalter und
--    verlöre das Brautpaar-Portal.
--    NEU: Admin-Rollen (veranstalter, brautpaar_solo) werden nie durch
--    Code-Einlösung verändert. Der Code wird dabei NICHT konsumiert und
--    bleibt für die richtige Person gültig; der Aufruf gibt idempotent
--    Erfolg mit der bestehenden Rolle zurück.
--    Upgrades für Nicht-Admin-Rollen (z. B. trauzeuge → brautpaar)
--    funktionieren weiterhin wie bisher.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.redeem_invite_code(p_code TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID;
  v_invite   invite_codes%ROWTYPE;
  v_existing event_members%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT * INTO v_invite
  FROM   invite_codes
  WHERE  code = p_code
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'CODE_NOT_FOUND_OR_LOCKED');
  END IF;

  IF v_invite.status = 'verwendet' THEN
    IF v_invite.used_by = v_user_id THEN
      RETURN jsonb_build_object(
        'success', true, 'event_id', v_invite.event_id,
        'role', v_invite.role, 'idempotent', true
      );
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'CODE_ALREADY_USED');
  END IF;

  IF v_invite.status = 'abgelaufen' OR v_invite.expires_at < NOW() THEN
    UPDATE invite_codes SET status = 'abgelaufen' WHERE id = v_invite.id;
    RETURN jsonb_build_object('success', false, 'error', 'CODE_EXPIRED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM events WHERE id = v_invite.event_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'EVENT_NOT_FOUND');
  END IF;

  -- NEU (1): Veranstalter-Codes nur für freigeschaltete Veranstalter-Konten.
  -- Code wird nicht konsumiert — der vorgesehene Veranstalter kann ihn
  -- weiterhin einlösen.
  IF v_invite.role = 'veranstalter' AND NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE  id = v_user_id AND is_approved_organizer = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_APPROVED_ORGANIZER');
  END IF;

  SELECT * INTO v_existing
  FROM   event_members
  WHERE  event_id = v_invite.event_id AND user_id = v_user_id;

  IF FOUND THEN
    -- NEU (2): Admin-Rollen nicht degradieren. Idempotenter Erfolg mit der
    -- bestehenden Rolle; Code bleibt offen für die richtige Person.
    IF v_existing.role IN ('veranstalter', 'brautpaar_solo')
       AND v_existing.role <> v_invite.role THEN
      RETURN jsonb_build_object(
        'success', true, 'event_id', v_invite.event_id,
        'role', v_existing.role, 'already_member', true
      );
    END IF;

    IF v_existing.role <> v_invite.role THEN
      UPDATE event_members
      SET    role = v_invite.role
      WHERE  event_id = v_invite.event_id AND user_id = v_user_id;
    END IF;
    UPDATE invite_codes
    SET    status = 'verwendet', used_by = v_user_id, used_at = NOW()
    WHERE  id = v_invite.id;
    RETURN jsonb_build_object(
      'success', true, 'event_id', v_invite.event_id,
      'role', v_invite.role, 'updated', true
    );
  END IF;

  UPDATE invite_codes
  SET    status = 'verwendet', used_by = v_user_id, used_at = NOW()
  WHERE  id = v_invite.id;

  INSERT INTO event_members (event_id, user_id, role, invited_by)
  VALUES (v_invite.event_id, v_user_id, v_invite.role, v_invite.created_by)
  ON CONFLICT (event_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  RETURN jsonb_build_object(
    'success', true, 'event_id', v_invite.event_id, 'role', v_invite.role
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'INTERNAL_ERROR', 'detail', SQLERRM);
END;
$$;

-- Grants unverändert: authenticated darf einlösen (wie in setup.sql)
REVOKE ALL    ON FUNCTION public.redeem_invite_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_invite_code(TEXT) TO authenticated;
