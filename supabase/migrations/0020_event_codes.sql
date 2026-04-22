-- Generate a unique 5-character alphanumeric event code (A-Z + 0-9)
CREATE OR REPLACE FUNCTION generate_event_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  code  TEXT;
  taken BOOLEAN;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..5 LOOP
      code := code || substr(chars, floor(random() * 36 + 1)::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM events WHERE event_code = code) INTO taken;
    EXIT WHEN NOT taken;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Add event_code column
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_code TEXT UNIQUE;

-- Backfill existing events
UPDATE events SET event_code = generate_event_code() WHERE event_code IS NULL;

-- Trigger: auto-assign code on new event insert
CREATE OR REPLACE FUNCTION auto_generate_event_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.event_code IS NULL THEN
    NEW.event_code := generate_event_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_event_code ON events;
CREATE TRIGGER trg_auto_event_code
  BEFORE INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_event_code();
