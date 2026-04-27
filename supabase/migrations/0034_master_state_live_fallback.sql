-- 0034_master_state_live_fallback.sql
-- Erweitert get_module_master_state um einen Fallback auf die Live-Tabellen,
-- wenn proposal_module_states noch keinen Eintrag für das Modul hat.
-- Wird als initialData in ProposalLightbox verwendet.

CREATE OR REPLACE FUNCTION get_module_master_state(
  p_event_id UUID,
  p_module   TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state JSONB;
BEGIN
  -- Zugriffsprüfung
  IF NOT is_event_member(p_event_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- 1. Versuch: gespeicherter Master-State aus finalize_merge
  SELECT state_json INTO v_state
  FROM proposal_module_states
  WHERE event_id = p_event_id AND module = p_module;

  IF v_state IS NOT NULL THEN
    RETURN v_state;
  END IF;

  -- 2. Fallback: Live-Daten je nach Modul
  CASE p_module

    -- ── CATERING ─────────────────────────────────────────────────────────────
    WHEN 'catering' THEN
      SELECT jsonb_build_object(
        'service_style',              cp.service_style,
        'location_has_kitchen',       cp.location_has_kitchen,
        'midnight_snack',             cp.midnight_snack,
        'midnight_snack_note',        cp.midnight_snack_note,
        'drinks_billing',             cp.drinks_billing,
        'drinks_selection',           to_jsonb(cp.drinks_selection),
        'champagne_finger_food',      cp.champagne_finger_food,
        'champagne_finger_food_note', cp.champagne_finger_food_note,
        'service_staff',              cp.service_staff,
        'equipment_needed',           to_jsonb(cp.equipment_needed),
        'budget_per_person',          cp.budget_per_person,
        'budget_includes_drinks',     cp.budget_includes_drinks,
        'catering_notes',             cp.catering_notes,
        'menu_courses', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id',           sub.course,
              'name',         sub.course,
              'descriptions', sub.descriptions
            ) ORDER BY sub.min_sort
          )
          FROM (
            SELECT
              course,
              MIN(sort_order)                                      AS min_sort,
              jsonb_object_agg(name, COALESCE(description, ''))   AS descriptions
            FROM catering_menu_items
            WHERE event_id = p_event_id
            GROUP BY course
          ) sub
        ), '[]'::jsonb)
      ) INTO v_state
      FROM catering_plans cp
      WHERE cp.event_id = p_event_id;

    -- ── ABLAUFPLAN ────────────────────────────────────────────────────────────
    WHEN 'ablaufplan' THEN
      SELECT jsonb_build_object(
        'entries', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id',               id,
              'start_minutes',    COALESCE(start_minutes, 0),
              'title',            COALESCE(title, ''),
              'location',         location,
              'sort_order',       sort_order,
              'assigned_staff',   COALESCE(assigned_staff,   '[]'::jsonb),
              'assigned_vendors', COALESCE(assigned_vendors, '[]'::jsonb)
            ) ORDER BY sort_order
          )
          FROM timeline_entries
          WHERE event_id = p_event_id
        ), '[]'::jsonb)
      ) INTO v_state;

    -- ── MUSIK ─────────────────────────────────────────────────────────────────
    WHEN 'musik' THEN
      SELECT jsonb_build_object(
        'songs', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id',     id,
              'title',  COALESCE(song_title, ''),
              'artist', COALESCE(artist, ''),
              'type',   'wunsch',
              'moment', slot_name
            ) ORDER BY sort_order
          )
          FROM band_set_list
          WHERE event_id = p_event_id
        ), '[]'::jsonb),
        'requirements', COALESCE((
          SELECT jsonb_build_object(
            'soundcheck_date', to_char(soundcheck_starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
            'soundcheck_time', to_char(soundcheck_starts_at AT TIME ZONE 'UTC', 'HH24:MI'),
            'pa_notes',        notes,
            'power_required',  CASE WHEN power_needs_w IS NOT NULL
                                 THEN power_needs_w::text || ' W'
                                 ELSE NULL END,
            'stage_dimensions', CASE WHEN stage_area_m2 IS NOT NULL
                                   THEN stage_area_m2::text || ' m²'
                                   ELSE NULL END
          )
          FROM band_tech_requirements
          WHERE event_id = p_event_id
          ORDER BY created_at DESC
          LIMIT 1
        ), '{}'::jsonb)
      ) INTO v_state;

    -- ── PATISSERIE ────────────────────────────────────────────────────────────
    WHEN 'patisserie' THEN
      SELECT jsonb_build_object(
        'cake_description',    pc.cake_description,
        'layers',              pc.layers,
        'flavors',             to_jsonb(pc.flavors),
        'dietary_notes',       pc.dietary_notes,
        'delivery_date',       pc.delivery_date,
        'delivery_time',       pc.delivery_time,
        'cooling_required',    pc.cooling_required,
        'cooling_notes',       pc.cooling_notes,
        'setup_location',      pc.setup_location,
        'cake_table_provided', pc.cake_table_provided,
        'dessert_buffet',      pc.dessert_buffet,
        'dessert_items',       to_jsonb(pc.dessert_items),
        'price',               pc.price,
        'vendor_notes',        pc.vendor_notes
      ) INTO v_state
      FROM patisserie_config pc
      WHERE pc.event_id = p_event_id;

    -- ── DEKO ─────────────────────────────────────────────────────────────────
    WHEN 'deko' THEN
      SELECT jsonb_build_object(
        'wishes', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id',        id,
              'title',     COALESCE(title, ''),
              'notes',     notes,
              'image_url', image_url
            ) ORDER BY created_at
          )
          FROM deko_wishes
          WHERE event_id = p_event_id
        ), '[]'::jsonb)
      ) INTO v_state;

    -- ── VENDOR ────────────────────────────────────────────────────────────────
    WHEN 'vendor' THEN
      SELECT jsonb_build_object(
        'name',           v.name,
        'category',       v.category,
        'description',    v.notes,
        'price_estimate', v.price,
        'contact_email',  v.email,
        'contact_phone',  v.phone,
        'notes',          v.notes
      ) INTO v_state
      FROM vendors v
      WHERE v.event_id = p_event_id
      ORDER BY v.created_at DESC
      LIMIT 1;

    -- ── HOTEL ─────────────────────────────────────────────────────────────────
    WHEN 'hotel' THEN
      SELECT jsonb_build_object(
        'name',            h.name,
        'address',         h.address,
        'total_rooms',     COALESCE((
          SELECT SUM(hr.total_rooms)
          FROM hotel_rooms hr WHERE hr.hotel_id = h.id
        ), 0),
        'price_per_night', COALESCE((
          SELECT MIN(hr.price_per_night)
          FROM hotel_rooms hr WHERE hr.hotel_id = h.id
        ), 0)
      ) INTO v_state
      FROM hotels h
      WHERE h.event_id = p_event_id
      ORDER BY h.created_at DESC
      LIMIT 1;

    -- ── SITZPLAN ─────────────────────────────────────────────────────────────
    WHEN 'sitzplan' THEN
      SELECT jsonb_build_object(
        'tables', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id',        st.id,
              'name',      COALESCE(st.name, ''),
              'shape',     st.shape,
              'capacity',  COALESCE(st.capacity, 0),
              'x',         st.pos_x,
              'y',         st.pos_y,
              'guest_ids', COALESCE((
                SELECT jsonb_agg(sa.guest_id)
                FROM seating_assignments sa
                WHERE sa.table_id = st.id
              ), '[]'::jsonb)
            )
          )
          FROM seating_tables st
          WHERE st.event_id = p_event_id
        ), '[]'::jsonb),
        'notes', ''
      ) INTO v_state;

    ELSE
      v_state := NULL;

  END CASE;

  RETURN v_state; -- NULL wenn keine Live-Daten vorhanden
END;
$$;
