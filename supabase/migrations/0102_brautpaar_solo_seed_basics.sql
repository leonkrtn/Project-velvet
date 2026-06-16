-- 0102_brautpaar_solo_seed_basics.sql
-- ════════════════════════════════════════════════════════════════════════════
-- Onboarding-Seeding für Solo-Brautpaare
-- ════════════════════════════════════════════════════════════════════════════
-- Beim Onboarding ("Jetzt starten") kann das Solo-Paar einzelne Bereiche schon
-- mit einem minimalen Gerüst vorbefüllen lassen. Die Auswahl pro Bereich kommt
-- aus dem Welcome-Screen (p_areas). Bereiche, die bereits Daten enthalten,
-- werden NIE überschrieben (Leerheits-Check) — die Funktion ist damit idempotent
-- und gegen Doppelaufrufe robust.
--
-- Bereiche (p_areas): 'ablaufplan', 'aufgaben', 'sitzplan', 'getraenke',
--                     'catering', 'budget'
--
-- SECURITY DEFINER: umgeht die je nach Tabelle unterschiedlichen RLS-Policies,
-- prüft die Berechtigung aber selbst (Event-Admin: brautpaar_solo / brautpaar /
-- veranstalter).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.seed_brautpaar_solo_basics(
  p_event_id UUID,
  p_areas    TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_cat_soft   UUID;
  v_cat_bier   UUID;
  v_cat_wein   UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: not authenticated' USING ERRCODE = 'P0001';
  END IF;

  -- Berechtigung: Aufrufer muss Event-Admin sein.
  IF NOT EXISTS (
    SELECT 1 FROM event_members
    WHERE event_id = p_event_id
      AND user_id  = v_user_id
      AND role IN ('brautpaar_solo', 'brautpaar', 'veranstalter')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: not an event admin' USING ERRCODE = 'P0001';
  END IF;

  -- ── Ablaufplan ─────────────────────────────────────────────────────────────
  IF 'ablaufplan' = ANY(p_areas) THEN
    INSERT INTO ablaufplan_days (event_id, day_index, name, start_hour, end_hour)
    VALUES (p_event_id, 0, 'Hochzeitstag', 12, 25)
    ON CONFLICT (event_id, day_index) DO NOTHING;

    IF NOT EXISTS (SELECT 1 FROM timeline_entries WHERE event_id = p_event_id) THEN
      INSERT INTO timeline_entries
        (event_id, day_index, title, start_minutes, duration_minutes, category, sort_order)
      VALUES
        (p_event_id, 0, 'Freie Trauung',     840,  60, 'Feier', 0),  -- 14:00
        (p_event_id, 0, 'Sektempfang',       900,  60, 'Feier', 1),  -- 15:00
        (p_event_id, 0, 'Kaffee & Kuchen',   960,  90, 'Feier', 2),  -- 16:00
        (p_event_id, 0, 'Abendessen',       1110,  90, 'Feier', 3),  -- 18:30
        (p_event_id, 0, 'Eröffnungstanz',   1230,  30, 'Feier', 4),  -- 20:30
        (p_event_id, 0, 'Party',            1260, 240, 'Feier', 5);  -- 21:00
    END IF;
  END IF;

  -- ── Aufgaben-Checkliste ────────────────────────────────────────────────────
  IF 'aufgaben' = ANY(p_areas) THEN
    IF NOT EXISTS (SELECT 1 FROM brautpaar_tasks WHERE event_id = p_event_id) THEN
      INSERT INTO brautpaar_tasks (event_id, title, phase, sort_order, created_by)
      VALUES
        (p_event_id, 'Location besichtigen & buchen',      '12m', 0, v_user_id),
        (p_event_id, 'Gesamtbudget festlegen',             '12m', 1, v_user_id),
        (p_event_id, 'Fotograf:in & Videograf:in buchen',  '6m',  0, v_user_id),
        (p_event_id, 'Save-the-Dates verschicken',         '6m',  1, v_user_id),
        (p_event_id, 'Einladungen versenden',              '3m',  0, v_user_id),
        (p_event_id, 'Menü & Catering festlegen',          '3m',  1, v_user_id),
        (p_event_id, 'Sitzplan erstellen',                 '1m',  0, v_user_id),
        (p_event_id, 'Trauringe kaufen',                   '1m',  1, v_user_id),
        (p_event_id, 'Ablaufplan finalisieren',            '1w',  0, v_user_id),
        (p_event_id, 'Dokumente & Ringe bereitlegen',      'day', 0, v_user_id),
        (p_event_id, 'Dankeskarten verschicken',           'after', 0, v_user_id);
    END IF;
  END IF;

  -- ── Sitzplan (Raum + Tische) ───────────────────────────────────────────────
  IF 'sitzplan' = ANY(p_areas) THEN
    -- Standard-Raum 16 × 12 m (Rechteck), nur wenn noch keiner existiert.
    INSERT INTO event_room_configs (event_id, user_id, points, elements)
    VALUES (
      p_event_id, v_user_id,
      '[{"x":-8,"y":-6},{"x":8,"y":-6},{"x":8,"y":6},{"x":-8,"y":6}]'::jsonb,
      '[]'::jsonb
    )
    ON CONFLICT (event_id) DO NOTHING;

    IF NOT EXISTS (SELECT 1 FROM seating_tables WHERE event_id = p_event_id) THEN
      INSERT INTO seating_tables
        (event_id, name, shape, capacity, pos_x, pos_y, rotation, table_length, table_width)
      VALUES
        (p_event_id, 'Brauttisch', 'rectangular', 4, 0,  -4, 0, 2.4, 0.9),
        (p_event_id, 'Tisch 1',    'round',       8, -4,  1, 0, 1.6, 1.6),
        (p_event_id, 'Tisch 2',    'round',       8,  0,  1, 0, 1.6, 1.6),
        (p_event_id, 'Tisch 3',    'round',       8,  4,  1, 0, 1.6, 1.6),
        (p_event_id, 'Tisch 4',    'round',       8, -2,  4, 0, 1.6, 1.6),
        (p_event_id, 'Tisch 5',    'round',       8,  2,  4, 0, 1.6, 1.6);
    END IF;
  END IF;

  -- ── Getränke ───────────────────────────────────────────────────────────────
  IF 'getraenke' = ANY(p_areas) THEN
    IF NOT EXISTS (SELECT 1 FROM getraenke_kategorien WHERE event_id = p_event_id) THEN
      INSERT INTO getraenke_kategorien (event_id, name, color, sort_order)
      VALUES (p_event_id, 'Softdrinks', '#3BA0C4', 0) RETURNING id INTO v_cat_soft;
      INSERT INTO getraenke_kategorien (event_id, name, color, sort_order)
      VALUES (p_event_id, 'Bier', '#C99A3E', 1) RETURNING id INTO v_cat_bier;
      INSERT INTO getraenke_kategorien (event_id, name, color, sort_order)
      VALUES (p_event_id, 'Wein & Sekt', '#8E4B5C', 2) RETURNING id INTO v_cat_wein;

      INSERT INTO getraenke_artikel
        (event_id, kategorie_id, name, unit, amount_per_person, sort_order)
      VALUES
        (p_event_id, v_cat_soft, 'Wasser still',   'Flasche', 0.50, 0),
        (p_event_id, v_cat_soft, 'Saft & Limonade','Flasche', 0.30, 1),
        (p_event_id, v_cat_bier, 'Bier',           'Flasche', 0.40, 0),
        (p_event_id, v_cat_wein, 'Sekt',           'Flasche', 0.20, 0),
        (p_event_id, v_cat_wein, 'Weißwein',       'Flasche', 0.30, 1),
        (p_event_id, v_cat_wein, 'Rotwein',        'Flasche', 0.20, 2);

      INSERT INTO getraenke_cocktails (event_id, name, is_alcoholic, ingredients, sort_order)
      VALUES (
        p_event_id, 'Aperol Spritz', true,
        '[{"name":"Aperol","amount":"6","unit":"cl"},{"name":"Prosecco","amount":"9","unit":"cl"},{"name":"Soda","amount":"3","unit":"cl"}]'::jsonb,
        0
      );
    END IF;
  END IF;

  -- ── Catering / Menü ────────────────────────────────────────────────────────
  IF 'catering' = ANY(p_areas) THEN
    UPDATE events
    SET menu_type = 'Mehrgängiges Menü'
    WHERE id = p_event_id
      AND (menu_type IS NULL OR menu_type = '');

    INSERT INTO catering_plans (event_id, service_style, menu_courses)
    VALUES (
      p_event_id, 'klassisch',
      '[{"id":"1","name":"Vorspeise","descriptions":{}},{"id":"2","name":"Hauptgang","descriptions":{}},{"id":"3","name":"Dessert","descriptions":{}}]'::jsonb
    )
    ON CONFLICT (event_id) DO NOTHING;
  END IF;

  -- ── Budget ─────────────────────────────────────────────────────────────────
  IF 'budget' = ANY(p_areas) THEN
    IF NOT EXISTS (SELECT 1 FROM budget_items WHERE event_id = p_event_id) THEN
      INSERT INTO budget_items (event_id, category, description, planned, payment_status)
      VALUES
        (p_event_id, 'Location',              '', 0, 'offen'),
        (p_event_id, 'Catering',              '', 0, 'offen'),
        (p_event_id, 'Foto & Video',          '', 0, 'offen'),
        (p_event_id, 'Musik & DJ',            '', 0, 'offen'),
        (p_event_id, 'Dekoration & Blumen',   '', 0, 'offen'),
        (p_event_id, 'Outfits',               '', 0, 'offen'),
        (p_event_id, 'Trauringe',             '', 0, 'offen'),
        (p_event_id, 'Papeterie',             '', 0, 'offen');
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'areas', to_jsonb(p_areas));
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_brautpaar_solo_basics(UUID, TEXT[]) TO authenticated;
