-- Brautpaar darf Catering-Kosten (source='catering') lesen
-- damit event_organizer_costs im Budget sichtbar sind
CREATE POLICY "brautpaar_select_catering_costs" ON event_organizer_costs
  FOR SELECT USING (
    source = 'catering'
    AND is_event_member(event_id, ARRAY['brautpaar']::user_role[])
  );
