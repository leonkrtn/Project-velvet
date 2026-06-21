-- ============================================================
-- Forevr Migration 0112 — Angebots-Workspace fuer Dienstleister
--
-- Macht aus dem bisherigen 1:1-Auto-Angebot (genau ein vendor_offers pro
-- Marktplatz-Anfrage) einen vollwertigen, eigenstaendigen Angebots-/Vertrags-
-- Workspace im Event-Bereich des Dienstleisters:
--
--   * vendor_offers.request_id wird OPTIONAL (Angebote auch ohne Marktplatz-
--     Anfrage, z. B. fuer direkt eingeladene Dienstleister) und ist nicht mehr
--     UNIQUE (mehrere Angebote/Varianten/Nachtraege pro Event moeglich).
--   * Neue Felder: title, version + parent_offer_id (Versionierung),
--     conversation_id (Chat-Anbindung unabhaengig von der Anfrage),
--     deposit_* + payment_terms (Anzahlung/Zahlungsplan),
--     agb_text/agb_required + accepted_by_name/agb_accepted_at
--     (verbindliche Zusage mit AGB-Bestaetigung), created_by.
--   * line_items JSONB tragen jetzt zusaetzlich `type`
--     (qty|flat|discount|optional) + `selected` (fuer optionale Positionen) —
--     rein anwendungsseitig, kein Schema-Zwang.
--   * Neue Tabelle vendor_offer_blocks: eigene wiederverwendbare Bausteine
--     des Dienstleisters fuer den Angebots-Editor.
--   * Status um 'superseded' (durch neue Version ersetzt) erweitert.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ── 1. vendor_offers: request_id optional + nicht mehr UNIQUE ─────────────────
DO $$ BEGIN
  ALTER TABLE vendor_offers ALTER COLUMN request_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;

-- UNIQUE-Constraint auf request_id entfernen (Name kann variieren) +
-- evtl. automatisch erzeugten Unique-Index loeschen.
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'vendor_offers'::regclass AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE vendor_offers DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
DROP INDEX IF EXISTS vendor_offers_request_id_key;

-- Mehrere Angebote pro Anfrage erlaubt; Index fuer Lookups behalten.
CREATE INDEX IF NOT EXISTS idx_vendor_offers_request ON vendor_offers(request_id);

-- ── 2. Neue Spalten ───────────────────────────────────────────────────────────
ALTER TABLE vendor_offers
  ADD COLUMN IF NOT EXISTS title             TEXT        NOT NULL DEFAULT 'Angebot',
  ADD COLUMN IF NOT EXISTS version           INT         NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_offer_id   UUID        REFERENCES vendor_offers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conversation_id   UUID        REFERENCES conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by        UUID,
  -- Anzahlung / Zahlungsplan
  ADD COLUMN IF NOT EXISTS deposit_type      TEXT        NOT NULL DEFAULT 'none',  -- none | percent | fixed
  ADD COLUMN IF NOT EXISTS deposit_value     NUMERIC     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_due_days  INT,                                   -- faellig X Tage nach Annahme
  ADD COLUMN IF NOT EXISTS balance_due_note  TEXT        NOT NULL DEFAULT '',       -- z. B. "Restbetrag bis 14 Tage vor dem Event"
  ADD COLUMN IF NOT EXISTS payment_terms     TEXT        NOT NULL DEFAULT '',
  -- Verbindliche Zusage + AGB
  ADD COLUMN IF NOT EXISTS agb_text          TEXT        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS agb_required      BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accepted_by_name  TEXT,
  ADD COLUMN IF NOT EXISTS agb_accepted_at   TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE vendor_offers
    ADD CONSTRAINT vo_deposit_type_chk CHECK (deposit_type IN ('none','percent','fixed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Status um 'superseded' erweitern.
DO $$ BEGIN
  ALTER TABLE vendor_offers DROP CONSTRAINT IF EXISTS vo_status_chk;
EXCEPTION WHEN others THEN NULL; END $$;
ALTER TABLE vendor_offers
  ADD CONSTRAINT vo_status_chk CHECK (status IN ('draft','released','accepted','declined','superseded'));

-- ── 3. Eigene Bausteinbibliothek des Dienstleisters ──────────────────────────
-- type: qty (Menge x Einzelpreis) | flat (Pauschale) | discount (Nachlass,
--       negativ) | optional (zu-/abwaehlbar durch das Brautpaar)
CREATE TABLE IF NOT EXISTS vendor_offer_blocks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dienstleister_id UUID        NOT NULL REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,
  label            TEXT        NOT NULL DEFAULT '',
  item_type        TEXT        NOT NULL DEFAULT 'qty',
  default_qty      NUMERIC     NOT NULL DEFAULT 1,
  unit_price       NUMERIC     NOT NULL DEFAULT 0,
  sort_order       INT         NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vendor_offer_blocks_dl ON vendor_offer_blocks(dienstleister_id);

DO $$ BEGIN
  ALTER TABLE vendor_offer_blocks
    ADD CONSTRAINT vob_type_chk CHECK (item_type IN ('qty','flat','discount','optional'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE vendor_offer_blocks ENABLE ROW LEVEL SECURITY;

-- Nur der Eigentuemer liest; Schreiben laeuft ueber die Service-Role-API.
DROP POLICY IF EXISTS "vob_owner_select" ON vendor_offer_blocks;
CREATE POLICY "vob_owner_select" ON vendor_offer_blocks FOR SELECT USING (
  is_marketplace_vendor_user(dienstleister_id)
);
DROP POLICY IF EXISTS "vob_no_write" ON vendor_offer_blocks;
CREATE POLICY "vob_no_write" ON vendor_offer_blocks FOR INSERT WITH CHECK (false);

-- ── 4. RLS vendor_offers: Couple-Sicht auch ohne Anfrage ─────────────────────
-- (Policy aus 0110 nutzt event_id + is_event_member — funktioniert bereits fuer
--  Angebote ohne request_id; hier nur sicherheitshalber neu gesetzt.)
DROP POLICY IF EXISTS "vo_select" ON vendor_offers;
CREATE POLICY "vo_select" ON vendor_offers FOR SELECT USING (
  is_marketplace_vendor_user(dienstleister_id)
  OR (status IN ('released','accepted','declined')
      AND is_event_member(event_id, ARRAY['veranstalter','brautpaar','brautpaar_solo']::user_role[]))
);
