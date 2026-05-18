-- Migration 0082: Getränkeplanung (drinks module)

-- Drink categories (Bier, Wein, Sekt, Softdrinks, etc.)
CREATE TABLE IF NOT EXISTS getraenke_kategorien (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  color      TEXT        NOT NULL DEFAULT '#B8943E',
  sort_order INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_getraenke_kategorien_event ON getraenke_kategorien(event_id);

-- Drink items (individual articles per category)
CREATE TABLE IF NOT EXISTS getraenke_artikel (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID         NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  kategorie_id    UUID         REFERENCES getraenke_kategorien(id) ON DELETE SET NULL,
  name            TEXT         NOT NULL,
  unit            TEXT         NOT NULL DEFAULT 'Flasche',
  amount_per_person NUMERIC(6,2) NOT NULL DEFAULT 0,
  total_planned   INT          NOT NULL DEFAULT 0,
  price_per_unit  NUMERIC(8,2) NOT NULL DEFAULT 0,
  notes           TEXT         NOT NULL DEFAULT '',
  sort_order      INT          NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_getraenke_artikel_event    ON getraenke_artikel(event_id);
CREATE INDEX IF NOT EXISTS idx_getraenke_artikel_kategorie ON getraenke_artikel(kategorie_id);

-- Cocktails
CREATE TABLE IF NOT EXISTS getraenke_cocktails (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  description   TEXT        NOT NULL DEFAULT '',
  is_alcoholic  BOOLEAN     NOT NULL DEFAULT true,
  planned_count INT         NOT NULL DEFAULT 0,
  -- ingredients: [{name: text, amount: text, unit: text}]
  ingredients   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  sort_order    INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_getraenke_cocktails_event ON getraenke_cocktails(event_id);

-- RLS
ALTER TABLE getraenke_kategorien ENABLE ROW LEVEL SECURITY;
ALTER TABLE getraenke_artikel    ENABLE ROW LEVEL SECURITY;
ALTER TABLE getraenke_cocktails  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "getraenke_kategorien_member" ON getraenke_kategorien
  FOR ALL USING (
    is_event_member(event_id, ARRAY['veranstalter', 'brautpaar']::user_role[])
    OR dl_has_tab_access(event_id, 'getraenke', 'read')
  );

CREATE POLICY "getraenke_artikel_member" ON getraenke_artikel
  FOR ALL USING (
    is_event_member(event_id, ARRAY['veranstalter', 'brautpaar']::user_role[])
    OR dl_has_tab_access(event_id, 'getraenke', 'read')
  );

CREATE POLICY "getraenke_cocktails_member" ON getraenke_cocktails
  FOR ALL USING (
    is_event_member(event_id, ARRAY['veranstalter', 'brautpaar']::user_role[])
    OR dl_has_tab_access(event_id, 'getraenke', 'read')
  );
