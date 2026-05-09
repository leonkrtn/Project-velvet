-- Remove all existing allgemein permissions for dienstleister
DELETE FROM dienstleister_permissions
WHERE tab_key = 'allgemein';

-- Prevent allgemein from ever being assigned again via constraint
ALTER TABLE dienstleister_permissions
  ADD CONSTRAINT no_allgemein_tab
  CHECK (tab_key <> 'allgemein');
