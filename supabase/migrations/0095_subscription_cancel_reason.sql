-- 0095: Kündigungsgrund am Abo speichern (aus der Kündigungs-Lightbox)
ALTER TABLE event_subscriptions
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
