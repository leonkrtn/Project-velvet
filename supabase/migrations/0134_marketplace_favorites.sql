-- 0134_marketplace_favorites.sql
-- Merkliste (Shortlist) für den Marktplatz: Brautpaar/Veranstalter merken sich
-- Anbieter pro Event vor, bevor sie eine Anfrage stellen.

CREATE TABLE IF NOT EXISTS marketplace_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  dienstleister_id UUID NOT NULL REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, dienstleister_id)
);

CREATE INDEX IF NOT EXISTS idx_mp_fav_event ON marketplace_favorites(event_id);
CREATE INDEX IF NOT EXISTS idx_mp_fav_dl ON marketplace_favorites(dienstleister_id);

ALTER TABLE marketplace_favorites ENABLE ROW LEVEL SECURITY;

-- Lesen: alle Event-Mitglieder mit Planungsrolle (brautpaar_solo wird von
-- is_event_member auf veranstalter/brautpaar gemappt).
DROP POLICY IF EXISTS "mp_fav_select" ON marketplace_favorites;
CREATE POLICY "mp_fav_select" ON marketplace_favorites FOR SELECT USING (
  is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
);

-- Schreiben ausschließlich über Service-Role-APIs (Membership-Check dort).
DROP POLICY IF EXISTS "mp_fav_write" ON marketplace_favorites;
CREATE POLICY "mp_fav_write" ON marketplace_favorites FOR INSERT WITH CHECK (false);
