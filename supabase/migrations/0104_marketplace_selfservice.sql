-- ============================================================
-- Forevr Migration 0104 — Marktplatz Self-Service & Moderation
--
-- Dienstleister registrieren sich selbst (Hybrid: Self-Signup + Admin-
-- Freigabe), pflegen ihr eigenes Listing und reichhaltige Profilinhalte
-- (Pakete, FAQ, Einsatzgebiet, Verfügbarkeit) und schalten es nach der
-- Erstfreigabe selbst online/offline. Änderungen an sensiblen Feldern
-- (Name, Kategorie, Adresse, Logo) gehen über pending_changes erneut in
-- die Prüfung, ohne das Live-Listing zu verändern. Admin verifiziert,
-- sperrt und gibt frei. Brautpaare bewerten nach nachgewiesener
-- Zusammenarbeit.
-- Idempotent — safe to re-run.
-- ============================================================

-- ── 1. Moderations- & Reichhaltigkeits-Felder auf dienstleister_profiles ─────
ALTER TABLE dienstleister_profiles ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE dienstleister_profiles ADD COLUMN IF NOT EXISTS pending_changes   JSONB;
ALTER TABLE dienstleister_profiles ADD COLUMN IF NOT EXISTS verified          BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE dienstleister_profiles ADD COLUMN IF NOT EXISTS verified_at       TIMESTAMPTZ;
ALTER TABLE dienstleister_profiles ADD COLUMN IF NOT EXISTS rejected_reason   TEXT;
ALTER TABLE dienstleister_profiles ADD COLUMN IF NOT EXISTS submitted_at      TIMESTAMPTZ;
ALTER TABLE dienstleister_profiles ADD COLUMN IF NOT EXISTS tier              TEXT NOT NULL DEFAULT 'free';
ALTER TABLE dienstleister_profiles ADD COLUMN IF NOT EXISTS social_links      JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE dienstleister_profiles ADD COLUMN IF NOT EXISTS service_cities    TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE dienstleister_profiles ADD COLUMN IF NOT EXISTS service_radius_km INT;

-- moderation_status: draft | pending | approved | rejected | suspended
DO $$ BEGIN
  ALTER TABLE dienstleister_profiles
    ADD CONSTRAINT dl_moderation_status_chk
    CHECK (moderation_status IN ('draft','pending','approved','rejected','suspended'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- tier: free | featured | premium (Architektur für spätere Monetarisierung)
DO $$ BEGIN
  ALTER TABLE dienstleister_profiles
    ADD CONSTRAINT dl_tier_chk CHECK (tier IN ('free','featured','premium'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_dl_moderation ON dienstleister_profiles(moderation_status) WHERE is_marketplace;
CREATE INDEX IF NOT EXISTS idx_dl_pending_changes ON dienstleister_profiles((pending_changes IS NOT NULL)) WHERE is_marketplace;

-- Bestehende veröffentlichte Profile (vor dieser Migration vom Admin angelegt)
-- gelten als freigegeben, damit sie sichtbar bleiben.
UPDATE dienstleister_profiles
   SET moderation_status = 'approved'
 WHERE is_marketplace = true AND published = true AND moderation_status = 'draft';

-- Öffentliche Sichtbarkeit: nur freigegebene UND veröffentlichte Profile.
DROP POLICY IF EXISTS "dl_profile_marketplace_select" ON dienstleister_profiles;
CREATE POLICY "dl_profile_marketplace_select" ON dienstleister_profiles
  FOR SELECT USING (
    is_marketplace = true AND published = true
    AND moderation_status = 'approved' AND auth.uid() IS NOT NULL
  );

-- Eigentümer (verknüpftes Login) darf sein eigenes Profil immer sehen.
DROP POLICY IF EXISTS "dl_profile_owner_select" ON dienstleister_profiles;
CREATE POLICY "dl_profile_owner_select" ON dienstleister_profiles
  FOR SELECT USING (is_marketplace_vendor_user(id));

-- ── 2. Pakete / Leistungen ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_packages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dienstleister_id UUID        NOT NULL REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL,
  description      TEXT        NOT NULL DEFAULT '',
  price_from       NUMERIC,
  price_unit       TEXT        NOT NULL DEFAULT 'ab',  -- 'ab' | 'fix' | 'pro_person' | 'pro_stunde'
  sort_order       INT         NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mp_pkg_dl ON marketplace_packages(dienstleister_id);

-- ── 3. FAQ ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_faqs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dienstleister_id UUID        NOT NULL REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,
  question         TEXT        NOT NULL,
  answer           TEXT        NOT NULL DEFAULT '',
  sort_order       INT         NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mp_faq_dl ON marketplace_faqs(dienstleister_id);

-- ── 4. Verfügbarkeit (blockierte Tage) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_availability (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dienstleister_id UUID        NOT NULL REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,
  day              DATE        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'blocked',  -- 'blocked' | 'booked'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dienstleister_id, day)
);
CREATE INDEX IF NOT EXISTS idx_mp_avail_dl ON marketplace_availability(dienstleister_id);

-- ── 5. Bewertungen (nach nachgewiesener Zusammenarbeit) ──────────────────────
CREATE TABLE IF NOT EXISTS marketplace_reviews (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dienstleister_id UUID        NOT NULL REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,
  event_id         UUID        REFERENCES events(id) ON DELETE SET NULL,
  author_user_id   UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  author_name      TEXT        NOT NULL DEFAULT '',
  rating           INT         NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title            TEXT        NOT NULL DEFAULT '',
  body             TEXT        NOT NULL DEFAULT '',
  status           TEXT        NOT NULL DEFAULT 'published',  -- 'published' | 'hidden'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dienstleister_id, author_user_id)
);
CREATE INDEX IF NOT EXISTS idx_mp_rev_dl ON marketplace_reviews(dienstleister_id);

-- ── 6. RLS ───────────────────────────────────────────────────────────────────
-- Lese-Helper: ist das Vendor-Profil dieser Zeile öffentlich sichtbar?
CREATE OR REPLACE FUNCTION mp_vendor_public(p_dl_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM dienstleister_profiles dp
    WHERE dp.id = p_dl_id AND dp.is_marketplace = true
      AND dp.published = true AND dp.moderation_status = 'approved'
  );
$$;

ALTER TABLE marketplace_packages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_faqs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_reviews      ENABLE ROW LEVEL SECURITY;

-- Pakete: öffentlich lesbar wenn Profil sichtbar, sonst nur Eigentümer.
DROP POLICY IF EXISTS "mp_pkg_select" ON marketplace_packages;
CREATE POLICY "mp_pkg_select" ON marketplace_packages FOR SELECT USING (
  mp_vendor_public(dienstleister_id) OR is_marketplace_vendor_user(dienstleister_id)
);
DROP POLICY IF EXISTS "mp_pkg_write" ON marketplace_packages;
CREATE POLICY "mp_pkg_write" ON marketplace_packages FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "mp_faq_select" ON marketplace_faqs;
CREATE POLICY "mp_faq_select" ON marketplace_faqs FOR SELECT USING (
  mp_vendor_public(dienstleister_id) OR is_marketplace_vendor_user(dienstleister_id)
);
DROP POLICY IF EXISTS "mp_faq_write" ON marketplace_faqs;
CREATE POLICY "mp_faq_write" ON marketplace_faqs FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "mp_avail_select" ON marketplace_availability;
CREATE POLICY "mp_avail_select" ON marketplace_availability FOR SELECT USING (
  mp_vendor_public(dienstleister_id) OR is_marketplace_vendor_user(dienstleister_id)
);
DROP POLICY IF EXISTS "mp_avail_write" ON marketplace_availability;
CREATE POLICY "mp_avail_write" ON marketplace_availability FOR INSERT WITH CHECK (false);

-- Bewertungen: veröffentlichte sind öffentlich; Eigentümer sieht alle eigenen.
DROP POLICY IF EXISTS "mp_rev_select" ON marketplace_reviews;
CREATE POLICY "mp_rev_select" ON marketplace_reviews FOR SELECT USING (
  (status = 'published' AND mp_vendor_public(dienstleister_id))
  OR is_marketplace_vendor_user(dienstleister_id)
  OR author_user_id = auth.uid()
);
DROP POLICY IF EXISTS "mp_rev_write" ON marketplace_reviews;
CREATE POLICY "mp_rev_write" ON marketplace_reviews FOR INSERT WITH CHECK (false);

-- ── 7. Bewertungs-Berechtigung: nachgewiesene Zusammenarbeit ─────────────────
-- Hat der aktuelle Nutzer eine angenommene Anfrage ODER eine akzeptierte
-- event_dienstleister-Verknüpfung zu diesem Vendor (über eines seiner Events)?
CREATE OR REPLACE FUNCTION mp_can_review(p_dl_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM marketplace_requests mr
    JOIN event_members em ON em.event_id = mr.event_id AND em.user_id = auth.uid()
    WHERE mr.dienstleister_id = p_dl_id AND mr.status = 'accepted'
  ) OR EXISTS (
    SELECT 1 FROM event_dienstleister ed
    JOIN event_members em ON em.event_id = ed.event_id AND em.user_id = auth.uid()
    WHERE ed.dienstleister_id = p_dl_id AND ed.status = 'akzeptiert'
  );
$$;
