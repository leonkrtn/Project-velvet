-- adjust_hotel_booking war SECURITY DEFINER ohne REVOKE, also als anon aufrufbar.
-- Maßnahme 1: Zugriff für anon und public entziehen.
REVOKE EXECUTE ON FUNCTION adjust_hotel_booking(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION adjust_hotel_booking(UUID, UUID) FROM public;

-- Maßnahme 2: Funktion neu definieren mit Auth-Guard als Defense-in-Depth.
-- session_user ist 'service_role' wenn der Server-Admin-Client die Funktion aufruft —
-- in diesem Fall wird der Check übersprungen, damit der RSVP-Flow nicht bricht.
CREATE OR REPLACE FUNCTION adjust_hotel_booking(p_prev_room UUID, p_next_room UUID)
RETURNS JSONB AS $$
DECLARE
  v_room RECORD;
BEGIN
  IF session_user <> 'service_role' AND auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Nicht authentifiziert');
  END IF;

  IF p_next_room IS NOT NULL THEN
    SELECT * INTO v_room
    FROM hotel_rooms
    WHERE id = p_next_room
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Zimmer nicht gefunden');
    END IF;
    IF v_room.booked_rooms >= v_room.total_rooms THEN
      RETURN jsonb_build_object('error', 'Zimmer ausgebucht');
    END IF;
  END IF;

  IF p_prev_room IS NOT NULL AND p_prev_room IS DISTINCT FROM p_next_room THEN
    UPDATE hotel_rooms
    SET booked_rooms = GREATEST(0, booked_rooms - 1)
    WHERE id = p_prev_room;
  END IF;

  IF p_next_room IS NOT NULL THEN
    UPDATE hotel_rooms
    SET booked_rooms = booked_rooms + 1
    WHERE id = p_next_room;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
