-- Vendor kann Catering-Kosten lesen und bearbeiten
-- basierend auf dl_has_tab_access('catering', 'read'/'write')

CREATE POLICY "vendor_select_catering_costs" ON event_organizer_costs
  FOR SELECT USING (
    source = 'catering'
    AND dl_has_tab_access(event_id, 'catering', 'read')
  );

CREATE POLICY "vendor_insert_catering_costs" ON event_organizer_costs
  FOR INSERT WITH CHECK (
    source = 'catering'
    AND dl_has_tab_access(event_id, 'catering', 'write')
  );

CREATE POLICY "vendor_update_catering_costs" ON event_organizer_costs
  FOR UPDATE USING (
    source = 'catering'
    AND dl_has_tab_access(event_id, 'catering', 'write')
  );

CREATE POLICY "vendor_delete_catering_costs" ON event_organizer_costs
  FOR DELETE USING (
    source = 'catering'
    AND dl_has_tab_access(event_id, 'catering', 'write')
  );
