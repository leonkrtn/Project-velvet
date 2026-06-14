-- 0096_event_cover_image.sql
-- Adds an optional cover/title image (R2 object key) to events, used as the
-- hero background on the Brautpaar overview ("Hochzeitsjournal"). The display
-- URL is generated on-demand via the file Worker (presigned GET), never public.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS cover_image_r2_key TEXT;

COMMENT ON COLUMN public.events.cover_image_r2_key IS
  'R2 object key for the event cover/title image (events/{eventId}/cover). Display URL via Worker presigned GET. NULL = no cover.';
