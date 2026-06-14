-- ============================================================
-- Forevr Migration 0099 — Marktplatz für Dienstleister
--
-- Erweitert dienstleister_profiles um Marktplatz-Felder, fügt
-- Galerie-Fotos, Kategorien und Anfragen (marketplace_requests)
-- hinzu. Vendor-Profile + Login werden im Admin angelegt; das
-- Brautpaar durchsucht veröffentlichte Profile und stellt Anfragen,
-- der Dienstleister nimmt sie an (→ event_dienstleister + Chat).
-- Idempotent — safe to re-run.
-- ============================================================

-- ── 1. dienstleister_profiles um Marktplatz-Felder erweitern ─────────────────
ALTER TABLE dienstleister_profiles ADD COLUMN IF NOT EXISTS is_marketplace BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE dienstleister_profiles ADD COLUMN IF NOT EXISTS published      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE dienstleister_profiles ADD COLUMN IF NOT EXISTS street         TEXT;
ALTER TABLE dienstleister_profiles ADD COLUMN IF NOT EXISTS zip            TEXT;
ALTER TABLE dienstleister_profiles ADD COLUMN IF NOT EXISTS city           TEXT;
ALTER TABLE dienstleister_profiles ADD COLUMN IF NOT EXISTS price_range    TEXT;   -- '€' | '€€' | '€€€'
ALTER TABLE dienstleister_profiles ADD COLUMN IF NOT EXISTS logo_r2_key    TEXT;

CREATE INDEX IF NOT EXISTS idx_dl_marketplace ON dienstleister_profiles(is_marketplace, published) WHERE is_marketplace;
CREATE INDEX IF NOT EXISTS idx_dl_city ON dienstleister_profiles(city) WHERE is_marketplace;

-- Veröffentlichte Marktplatz-Profile sind für alle eingeloggten Nutzer sichtbar
-- (zusätzliche permissive Policy neben dl_profile_select).
DROP POLICY IF EXISTS "dl_profile_marketplace_select" ON dienstleister_profiles;
CREATE POLICY "dl_profile_marketplace_select" ON dienstleister_profiles
  FOR SELECT USING (is_marketplace = true AND published = true AND auth.uid() IS NOT NULL);

-- ── 2. Galerie-Fotos pro Vendor ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_vendor_photos (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dienstleister_id UUID        NOT NULL REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,
  r2_key           TEXT        NOT NULL,
  sort_order       INT         NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mp_photos_dl ON marketplace_vendor_photos(dienstleister_id);

ALTER TABLE marketplace_vendor_photos ENABLE ROW LEVEL SECURITY;

-- SELECT: sichtbar wenn das Vendor-Profil veröffentlicht ist ODER man es besitzt.
DROP POLICY IF EXISTS "mp_photos_select" ON marketplace_vendor_photos;
CREATE POLICY "mp_photos_select" ON marketplace_vendor_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dienstleister_profiles dp
      WHERE dp.id = marketplace_vendor_photos.dienstleister_id
        AND dp.is_marketplace = true AND dp.published = true
    )
    OR EXISTS (
      SELECT 1 FROM user_dienstleister ud
      WHERE ud.dienstleister_id = marketplace_vendor_photos.dienstleister_id
        AND ud.user_id = auth.uid()
    )
  );
-- Schreiben ausschließlich über service-role (Admin/Vendor-API).
DROP POLICY IF EXISTS "mp_photos_write" ON marketplace_vendor_photos;
CREATE POLICY "mp_photos_write" ON marketplace_vendor_photos
  FOR INSERT WITH CHECK (false);

-- ── 3. Kategorien (admin-erweiterbar) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_categories (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT        NOT NULL UNIQUE,
  label      TEXT        NOT NULL,
  sort_order INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE marketplace_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mp_cat_select" ON marketplace_categories;
CREATE POLICY "mp_cat_select" ON marketplace_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

INSERT INTO marketplace_categories (key, label, sort_order) VALUES
  ('fotograf',    'Fotograf',          10),
  ('videograf',   'Videograf',         20),
  ('catering',    'Catering',          30),
  ('dj_musik',    'DJ / Musik',        40),
  ('band',        'Band',              50),
  ('floristik',   'Floristik',         60),
  ('location',    'Location',          70),
  ('konditorei',  'Konditorei / Torte',80),
  ('deko',        'Dekoration',        90),
  ('hair_makeup', 'Hair & Make-up',    100),
  ('planer',      'Hochzeitsplaner',   110),
  ('sonstiges',   'Sonstiges',         120)
ON CONFLICT (key) DO NOTHING;

-- ── 4. Helper: gehört das aktuelle Login zu diesem Vendor-Profil? ────────────
CREATE OR REPLACE FUNCTION is_marketplace_vendor_user(p_dl_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_dienstleister ud
    WHERE ud.dienstleister_id = p_dl_id AND ud.user_id = auth.uid()
  );
$$;

-- ── 5. Anfragen Brautpaar → Dienstleister ────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_requests (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID        NOT NULL REFERENCES events(id)                ON DELETE CASCADE,
  dienstleister_id UUID        NOT NULL REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,
  requested_by     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  message          TEXT        NOT NULL DEFAULT '',
  budget           NUMERIC,
  status           TEXT        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','accepted','declined','cancelled')),
  conversation_id  UUID        REFERENCES conversations(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_mp_req_event  ON marketplace_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_mp_req_dl     ON marketplace_requests(dienstleister_id);
CREATE INDEX IF NOT EXISTS idx_mp_req_status ON marketplace_requests(status);

ALTER TABLE marketplace_requests ENABLE ROW LEVEL SECURITY;

-- SELECT: Event-Mitglieder (Brautpaar/Veranstalter) ODER der Vendor selbst.
DROP POLICY IF EXISTS "mp_req_select" ON marketplace_requests;
CREATE POLICY "mp_req_select" ON marketplace_requests
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','brautpaar_solo']::user_role[])
    OR is_marketplace_vendor_user(dienstleister_id)
  );

-- Schreiben (INSERT/UPDATE) ausschließlich über service-role API mit eigener Prüfung.
DROP POLICY IF EXISTS "mp_req_insert" ON marketplace_requests;
CREATE POLICY "mp_req_insert" ON marketplace_requests
  FOR INSERT WITH CHECK (false);
DROP POLICY IF EXISTS "mp_req_update" ON marketplace_requests;
CREATE POLICY "mp_req_update" ON marketplace_requests
  FOR UPDATE USING (false);
