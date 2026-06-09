-- 0088_brautpaar_solo_onboarding.sql
-- ════════════════════════════════════════════════════════════════════════════
-- Solo-Brautpaar Onboarding: genau ein Event pro Paar + optionales Datum
-- ════════════════════════════════════════════════════════════════════════════
-- Baut auf 0086 (ENUM brautpaar_solo) und 0087 (is_event_member-Mapping,
-- create_event_as_brautpaar_solo) auf.
--
-- Änderungen gegenüber 0087:
--   1. IDEMPOTENT: Hat der User bereits eine brautpaar_solo-Mitgliedschaft,
--      wird deren Event-ID zurückgegeben statt ein zweites Event anzulegen.
--      Schützt vor Doppel-Klick im Signup und vor dem Retry-Pfad nach
--      E-Mail-Bestätigung (Login-Fallback ruft die Funktion erneut auf).
--   2. p_date DEFAULT NULL: Paare ohne festes Hochzeitsdatum können starten
--      (events.date ist nullable, Datum wird später unter "Allgemein" gepflegt).
--   3. p_couple_name: wird direkt in events.couple_name geschrieben
--      (Anzeigename im Brautpaar-Portal).
--
-- ACHTUNG: Signatur ändert sich (neuer Parameter) → alte Funktion muss
-- gedroppt werden, sonst entsteht ein mehrdeutiger Overload für PostgREST-RPC.
-- ════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.create_event_as_brautpaar_solo(
  TEXT, DATE, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT[], INT, TIMESTAMPTZ
);

CREATE FUNCTION public.create_event_as_brautpaar_solo(
  p_title               TEXT,
  p_date                DATE        DEFAULT NULL,
  p_couple_name         TEXT        DEFAULT NULL,
  p_venue               TEXT        DEFAULT NULL,
  p_venue_address       TEXT        DEFAULT NULL,
  p_dresscode           TEXT        DEFAULT NULL,
  p_children_allowed    BOOLEAN     DEFAULT true,
  p_children_note       TEXT        DEFAULT NULL,
  p_meal_options        TEXT[]      DEFAULT NULL,
  p_max_begleitpersonen INT         DEFAULT 1,
  p_ceremony_start      TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID;
  v_event_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: not authenticated' USING ERRCODE = 'P0001';
  END IF;

  -- Genau ein Event pro Solo-Brautpaar: existierendes Event zurückgeben
  SELECT event_id INTO v_event_id
  FROM   event_members
  WHERE  user_id = v_user_id
    AND  role    = 'brautpaar_solo'
  ORDER BY joined_at DESC
  LIMIT 1;

  IF v_event_id IS NOT NULL THEN
    RETURN v_event_id;
  END IF;

  INSERT INTO events (
    title, couple_name, date, venue, venue_address, dresscode,
    children_allowed, children_note, meal_options,
    max_begleitpersonen, ceremony_start, created_by
  ) VALUES (
    p_title, p_couple_name, p_date, p_venue, p_venue_address, p_dresscode,
    p_children_allowed, p_children_note, p_meal_options,
    p_max_begleitpersonen, p_ceremony_start, v_user_id
  )
  RETURNING id INTO v_event_id;

  INSERT INTO event_members (event_id, user_id, role, invite_status, joined_at)
  VALUES (v_event_id, v_user_id, 'brautpaar_solo', 'confirmed', NOW());

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_event_as_brautpaar_solo(
  TEXT, DATE, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT[], INT, TIMESTAMPTZ
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_event_as_brautpaar_solo(
  TEXT, DATE, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT[], INT, TIMESTAMPTZ
) TO authenticated;
