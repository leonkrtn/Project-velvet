-- 0107_wedding_sites.sql
-- Öffentliche Hochzeitswebsite pro Event ("/wedding/[slug]").
--   • wedding_sites: 1 Zeile pro Event — Template, Slug, Status, Entwurf + veröffentlichter Inhalt (JSONB), SEO/OG.
--   • guests.short_code: 4-stelliger Gast-Code (Buchstaben/Ziffern) für offenes RSVP („schon angemeldet?" → Code).
--   • file_metadata.module: 'wedding' als erlaubtes Modul ergänzt (Bilder der Hochzeitswebsite über die R2-Pipeline).
--
-- Zugriff:
--   - Bearbeitung: Brautpaar / Brautpaar-Solo / Veranstalter (is_event_member) — RLS unten.
--   - Öffentliche Anzeige: läuft serverseitig über den Service-Role-Client (kein anon-RLS nötig).

-- ── wedding_sites ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wedding_sites (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID        NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  slug              TEXT        UNIQUE,
  template_id       TEXT        NOT NULL DEFAULT 'classic-elegance',
  status            TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  -- Globaler An/Aus-Schalter unabhängig vom Veröffentlichungsstand
  is_online         BOOLEAN     NOT NULL DEFAULT TRUE,
  -- Mehrsprachig vorbereitet: Inhalt ist als { version, lang, landing, story, rsvp, seo } strukturiert.
  draft_content     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  published_content JSONB,
  -- SEO / Social-Preview (manuell pflegbar)
  og_title          TEXT,
  og_description    TEXT,
  og_image_r2_key   TEXT,
  published_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wedding_sites_slug ON wedding_sites(slug) WHERE slug IS NOT NULL;

-- Slug-Format: 3–60 Zeichen, klein, a–z 0–9 und Bindestriche, kein führender/abschließender Bindestrich.
ALTER TABLE wedding_sites DROP CONSTRAINT IF EXISTS chk_wedding_slug_format;
ALTER TABLE wedding_sites ADD CONSTRAINT chk_wedding_slug_format
  CHECK (slug IS NULL OR slug ~ '^[a-z0-9]([a-z0-9-]{1,58}[a-z0-9])$');

-- updated_at automatisch pflegen
CREATE OR REPLACE FUNCTION set_wedding_sites_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_wedding_sites_updated_at ON wedding_sites;
CREATE TRIGGER trg_wedding_sites_updated_at
  BEFORE UPDATE ON wedding_sites
  FOR EACH ROW EXECUTE FUNCTION set_wedding_sites_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE wedding_sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wedding_sites_select ON wedding_sites;
CREATE POLICY wedding_sites_select ON wedding_sites
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','brautpaar_solo']::user_role[])
  );

DROP POLICY IF EXISTS wedding_sites_insert ON wedding_sites;
CREATE POLICY wedding_sites_insert ON wedding_sites
  FOR INSERT WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','brautpaar_solo']::user_role[])
  );

DROP POLICY IF EXISTS wedding_sites_update ON wedding_sites;
CREATE POLICY wedding_sites_update ON wedding_sites
  FOR UPDATE USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','brautpaar_solo']::user_role[])
  );

-- ── guests.short_code ─────────────────────────────────────────────────────────
-- 4-stelliger, gut lesbarer Code (ohne mehrdeutige Zeichen) für das offene RSVP.
ALTER TABLE guests ADD COLUMN IF NOT EXISTS short_code TEXT;

CREATE OR REPLACE FUNCTION gen_guest_short_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  alphabet CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- ohne I,O,0,1
  result   TEXT := '';
  i        INT;
BEGIN
  FOR i IN 1..4 LOOP
    result := result || substr(alphabet, (floor(random() * length(alphabet)) + 1)::int, 1);
  END LOOP;
  RETURN result;
END; $$;

-- Eindeutigen Code erzeugen (kollisionssicher per Schleife).
CREATE OR REPLACE FUNCTION assign_guest_short_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  candidate TEXT;
BEGIN
  IF NEW.short_code IS NOT NULL THEN RETURN NEW; END IF;
  LOOP
    candidate := gen_guest_short_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM guests WHERE short_code = candidate);
  END LOOP;
  NEW.short_code := candidate;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guests_short_code ON guests;
CREATE TRIGGER trg_guests_short_code
  BEFORE INSERT ON guests
  FOR EACH ROW EXECUTE FUNCTION assign_guest_short_code();

-- Backfill bestehender Gäste
DO $$
DECLARE
  g RECORD;
  candidate TEXT;
BEGIN
  FOR g IN SELECT id FROM guests WHERE short_code IS NULL LOOP
    LOOP
      candidate := gen_guest_short_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM guests WHERE short_code = candidate);
    END LOOP;
    UPDATE guests SET short_code = candidate WHERE id = g.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_guests_short_code ON guests(short_code) WHERE short_code IS NOT NULL;

-- ── file_metadata: 'wedding'-Modul erlauben ───────────────────────────────────
ALTER TABLE file_metadata DROP CONSTRAINT IF EXISTS file_metadata_module_check;
ALTER TABLE file_metadata ADD CONSTRAINT file_metadata_module_check
  CHECK (module IN (
    'files','catering','musik','ablaufplan','dekoration',
    'medien','patisserie','sitzplan','gaesteliste','chats','allgemein','wedding'
  ));
