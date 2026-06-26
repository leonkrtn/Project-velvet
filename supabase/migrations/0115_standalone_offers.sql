-- Make event_id nullable on vendor_offers to support standalone offers.
-- Standalone offers are created directly by vendors without an event association
-- and can be linked to an event later.

ALTER TABLE vendor_offers ALTER COLUMN event_id DROP NOT NULL;

-- Backfill: existing rows are unaffected (all have event_id)

-- Expose standalone offers in the global offers view:
-- offers with event_id IS NULL should still be selectable by the vendor.
-- RLS already uses dienstleister_id check so no RLS changes needed.

COMMENT ON COLUMN vendor_offers.event_id IS 'NULL = standalone offer not yet linked to an event';
