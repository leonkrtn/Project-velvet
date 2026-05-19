-- 0087_brautpaar_solo_functions.sql
-- ════════════════════════════════════════════════════════════════════════════
-- Funktionen + RLS-Kaskade für brautpaar_solo
-- ════════════════════════════════════════════════════════════════════════════
-- Muss in einer separaten Transaktion nach 0086 laufen, da ALTER TYPE ADD VALUE
-- erst committed sein muss bevor 'brautpaar_solo' in Funktionen verwendet werden kann.
--
-- DESIGN-ENTSCHEIDUNG
-- ───────────────────
-- Statt Dutzende existierender Policies anzufassen, wird nur is_event_member()
-- erweitert. Die Funktion ist SECURITY DEFINER und wird von ALLEN Policies
-- aufgerufen — eine Änderung hier kaskadiert automatisch durch das gesamte System.
--
-- Mapping: brautpaar_solo zählt als veranstalter ODER brautpaar, je nachdem
-- was eine Policy prüft. Damit sind alle drei Policy-Typen abgedeckt:
--   ARRAY['veranstalter']              → brautpaar_solo passes ✓
--   ARRAY['brautpaar']                 → brautpaar_solo passes ✓
--   ARRAY['veranstalter','brautpaar']  → brautpaar_solo passes ✓
--   ARRAY['trauzeuge']                 → brautpaar_solo fails  ✗ (korrekt)
--   ARRAY['dienstleister']             → brautpaar_solo fails  ✗ (korrekt)
--
-- Betroffene brautpaar-only Policies (würden ohne brautpaar-Mapping scheitern):
--   0051_brautpaar_portal.sql:25,32,45  — Brautpaar darf Trauzeuge löschen/einladen
--   0055_rsvp_music_improvements.sql:102 — RSVP Musikwünsche
--   0059_brautpaar_read_catering_costs.sql:6 — Catering-Kosten lesen
--   0075_ablaufplan_multiday.sql:38,43,44 — Brautpaar darf Ablaufplan-Tage anlegen
--
-- Bestehende Flows bleiben vollständig unberührt:
--   • veranstalter-Accounts: keine Änderung in ihrem Verhalten
--   • brautpaar in Veranstalter-Events: keine Änderung
--   • Dienstleister: keine Änderung
-- ════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- 1. is_event_member() — Kernfunktion, Herzstück der RLS-Kaskade
-- ════════════════════════════════════════════════════════════════════════════
-- Einzige semantische Änderung: die letzte OR-Zeile.
-- Alle anderen Felder (STABLE, SECURITY DEFINER, search_path) bleiben identisch
-- zur Original-Definition in setup.sql — das ist zwingend, da alle Policies
-- diese Funktion als trusted aufrufen.

CREATE OR REPLACE FUNCTION public.is_event_member(
  eid            UUID,
  required_roles user_role[] DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   event_members
    WHERE  event_id = eid
      AND  user_id  = auth.uid()
      AND  (
        required_roles IS NULL
        OR role = ANY(required_roles)
        -- brautpaar_solo hat dieselben Rechte wie veranstalter + brautpaar kombiniert
        OR (
          role = 'brautpaar_solo'
          AND (
            'veranstalter' = ANY(required_roles)
            OR 'brautpaar'  = ANY(required_roles)
          )
        )
      )
  );
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- 2. can_manage_member() — Mitgliederverwaltung
-- ════════════════════════════════════════════════════════════════════════════
-- Original erlaubt nur veranstalter alle Rollen zu verwalten, brautpaar nur
-- Trauzeuge. brautpaar_solo verwaltet alles (ist der einzige Admin im Event).

CREATE OR REPLACE FUNCTION public.can_manage_member(
  p_event_id    UUID,
  p_target_role user_role
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   event_members em
    WHERE  em.event_id = p_event_id
      AND  em.user_id  = auth.uid()
      AND  (
        em.role IN ('veranstalter', 'brautpaar_solo')
        OR (em.role = 'brautpaar' AND p_target_role = 'trauzeuge')
      )
  );
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- 3. create_event_as_brautpaar_solo() — Event-Erstellung ohne Organizer-Approval
-- ════════════════════════════════════════════════════════════════════════════
-- Analog zu create_event_with_organizer() aus setup.sql, aber:
--   • kein is_approved_organizer-Check (brautpaar_solo braucht keine Admin-Freischaltung)
--   • trägt den User als 'brautpaar_solo' in event_members ein
-- SECURITY DEFINER → bypassed RLS für INSERT in events + event_members (identisch
-- zum Verhalten von create_event_with_organizer).

CREATE OR REPLACE FUNCTION public.create_event_as_brautpaar_solo(
  p_title               TEXT,
  p_date                DATE,
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

  INSERT INTO events (
    title, date, venue, venue_address, dresscode,
    children_allowed, children_note, meal_options,
    max_begleitpersonen, ceremony_start, created_by
  ) VALUES (
    p_title, p_date, p_venue, p_venue_address, p_dresscode,
    p_children_allowed, p_children_note, p_meal_options,
    p_max_begleitpersonen, p_ceremony_start, v_user_id
  )
  RETURNING id INTO v_event_id;

  -- Als brautpaar_solo eingetragen — get_event_role() gibt 'brautpaar_solo' zurück,
  -- Frontend nutzt das für Portal-Routing.
  INSERT INTO event_members (event_id, user_id, role)
  VALUES (v_event_id, v_user_id, 'brautpaar_solo');

  RETURN v_event_id;
END;
$$;

-- Zugriff: jeder eingeloggte User (kein Organizer-Approval nötig)
REVOKE ALL ON FUNCTION public.create_event_as_brautpaar_solo(
  TEXT, DATE, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT[], INT, TIMESTAMPTZ
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_event_as_brautpaar_solo(
  TEXT, DATE, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT[], INT, TIMESTAMPTZ
) TO authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- HINWEIS: create_invite_code() braucht keine Änderung
-- ════════════════════════════════════════════════════════════════════════════
-- Original blockiert brautpaar beim Einladen als veranstalter:
--   IF get_event_role(p_event_id) = 'brautpaar' AND p_role = 'veranstalter' THEN FORBIDDEN
-- Da get_event_role() 'brautpaar_solo' zurückgibt (≠ 'brautpaar'), greift diese
-- Sperre für brautpaar_solo bereits jetzt NICHT — kein Eingriff nötig.


-- ════════════════════════════════════════════════════════════════════════════
-- NICHT ENTHALTEN IN DIESER MIGRATION (Frontend-seitig)
-- ════════════════════════════════════════════════════════════════════════════
--
-- 1. TypeScript-Typ erweitern:
--      export type UserRole = '...' | 'brautpaar_solo'
--
-- 2. Portal-Route anlegen:
--    app/brautpaar-solo/[eventId]/ — kann Veranstalter-Komponenten direkt wiederverwenden,
--    da DB-Zugriff identisch ist.
--
-- 3. Signup + Event-Erstellungsflow:
--    Seite die create_event_as_brautpaar_solo() aufruft, kein is_approved_organizer nötig.
--
-- 4. Routing-Weiche nach Login:
--    get_event_role() gibt 'brautpaar_solo' zurück → redirect to brautpaar-solo portal.
--
-- 5. Stripe-Billing (separat):
--    Feature-Gate via feature_toggles (key: 'brautpaar_solo_active', enabled: true/false).
--    brautpaar_solo hat bereits RLS-Zugriff auf feature_toggles (veranstalter-mapping).
-- ════════════════════════════════════════════════════════════════════════════
