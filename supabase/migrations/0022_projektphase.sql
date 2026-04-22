-- Projektphase pro Event (Planung → Finalisierung → Durchführung → Nachbereitung)

CREATE TYPE projektphase_enum AS ENUM (
  'Planung',
  'Finalisierung',
  'Durchführung',
  'Nachbereitung'
);

ALTER TABLE events
  ADD COLUMN projektphase projektphase_enum NOT NULL DEFAULT 'Planung';
