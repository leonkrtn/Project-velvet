-- 0050_room_config_rls_brautpaar.sql
--
-- Problem: Brautpaar (und Trauzeuge) können event_room_configs und
-- organizer_room_configs nicht lesen, weil 0038 nur dem Veranstalter
-- Zugriff gewährt hat. Dadurch startet der SitzplanEditor ohne Raumkontur
-- und ohne Tischpool — die Seite sieht leer aus.
--
-- Fix: zusätzliche SELECT-Policies für brautpaar + trauzeuge.

-- ── event_room_configs ────────────────────────────────────────────────────────

CREATE POLICY "event_room_configs_member_read"
  ON event_room_configs FOR SELECT
  USING (
    is_event_member(event_id, ARRAY['brautpaar','trauzeuge']::user_role[])
  );

-- ── organizer_room_configs ────────────────────────────────────────────────────
-- Kein direktes event_id — Zugriff über events.created_by prüfen.

CREATE POLICY "organizer_room_configs_member_read"
  ON organizer_room_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM events e
      JOIN event_members em ON em.event_id = e.id
      WHERE e.created_by = organizer_room_configs.user_id
        AND em.user_id   = auth.uid()
        AND em.role      IN ('brautpaar', 'trauzeuge')
    )
  );
