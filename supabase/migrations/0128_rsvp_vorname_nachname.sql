-- ════════════════════════════════════════════════════════════════════════════
-- 0128_rsvp_vorname_nachname.sql
-- RSVP: Vorname/Nachname als getrennte Pflichtfelder (UI + API), zusätzlich zur
-- bestehenden `name`-Spalte (bleibt unverändert bestehen — wird weiterhin aus
-- vorname + ' ' + nachname zusammengesetzt, damit alle bestehenden Stellen im
-- Code, die guests.name / begleitpersonen.name lesen, unverändert weiter
-- funktionieren). Beide neuen Spalten sind nullable (Bestandsgäste haben sie
-- nicht befüllt; Neuanlagen über die RSVP-Flows setzen sie ab sofort).
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS vorname TEXT,
  ADD COLUMN IF NOT EXISTS nachname TEXT;

ALTER TABLE begleitpersonen
  ADD COLUMN IF NOT EXISTS vorname TEXT,
  ADD COLUMN IF NOT EXISTS nachname TEXT;

-- ── replace_begleitpersonen(): vorname/nachname mit übernehmen ──────────────
-- Die RSVP-API (app/api/rsvp/[token]/route.ts) ruft diese RPC auf, um
-- Begleitpersonen atomar zu ersetzen. Bisher wurden nur `name` + die übrigen
-- Felder geschrieben — ab jetzt zusätzlich `vorname`/`nachname`, falls im
-- JSONB-Payload vorhanden (Rückwärtskompatibel: fehlen sie, bleiben sie NULL).
CREATE OR REPLACE FUNCTION replace_begleitpersonen(
  p_guest_id UUID,
  p_rows     JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM begleitpersonen WHERE guest_id = p_guest_id;

  IF p_rows IS NOT NULL AND jsonb_array_length(p_rows) > 0 THEN
    INSERT INTO begleitpersonen (
      id, guest_id, name, vorname, nachname, age_category,
      trink_alkohol, meal_choice, allergy_tags, allergy_custom
    )
    SELECT
      COALESCE((r->>'id')::UUID, gen_random_uuid()),
      p_guest_id,
      r->>'name',
      NULLIF(r->>'vorname', ''),
      NULLIF(r->>'nachname', ''),
      COALESCE(r->>'age_category', 'erwachsen'),
      CASE
        WHEN r->>'trink_alkohol' IS NULL THEN NULL
        ELSE (r->>'trink_alkohol')::BOOLEAN
      END,
      NULLIF(r->>'meal_choice', ''),
      COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(r->'allergy_tags')),
        '{}'::TEXT[]
      ),
      NULLIF(r->>'allergy_custom', '')
    FROM jsonb_array_elements(p_rows) r;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION replace_begleitpersonen(UUID, JSONB) TO service_role;
