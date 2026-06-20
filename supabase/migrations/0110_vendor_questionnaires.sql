-- ============================================================
-- Forevr Migration 0110 — Dienstleister-Frageb gen & Auto-Angebote
--
-- Marktplatz-Dienstleister definieren pro Firma EINEN strukturierten
-- Fragebogen (Abschnitte + Fragen, optional aus Kategorie-Vorlage) inkl.
-- Preislogik. Stellt ein Brautpaar eine Anfrage, beantwortet es den
-- Fragebogen; daraus wird serverseitig ein Bedarfs-Snapshot + ein
-- automatisch berechnetes Angebot (vendor_offers) erzeugt. Der
-- Dienstleister pr ft/justiert das Angebot und gibt es frei (= Annahme,
-- Chat  ffnet). Das Brautpaar erh lt es digital, kann es als PDF
-- exportieren und annehmen.
--
-- WICHTIG (Preis-Leak): Frageb gen werden dem Brautpaar ausschlie lich
-- ber eine Service-Role-API ohne Preisfelder ausgeliefert. Daher ist die
-- RLS auf den Fragebogen-Tabellen bewusst NUR f r den Eigent mer offen.
-- Idempotent — safe to re-run.
-- ============================================================

-- ── 1. Fragebogen (1 pro Dienstleister-Firma) ────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_questionnaires (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dienstleister_id     UUID        NOT NULL UNIQUE REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,
  title                TEXT        NOT NULL DEFAULT 'Angebotsanfrage',
  intro_text           TEXT        NOT NULL DEFAULT '',
  is_active            BOOLEAN     NOT NULL DEFAULT false,
  -- Preislogik (siehe lib/vendor/pricing.ts)
  base_price           NUMERIC     NOT NULL DEFAULT 0,
  per_guest_price      NUMERIC     NOT NULL DEFAULT 0,
  min_total            NUMERIC     NOT NULL DEFAULT 0,
  weekend_surcharge_pct NUMERIC    NOT NULL DEFAULT 0,
  tax_mode             TEXT        NOT NULL DEFAULT 'regular',
  tax_rate             NUMERIC     NOT NULL DEFAULT 19,
  currency             TEXT        NOT NULL DEFAULT 'EUR',
  valid_days           INT         NOT NULL DEFAULT 14,
  footer_note          TEXT        NOT NULL DEFAULT 'Dieses Angebot ist freibleibend und unverbindlich.',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE vendor_questionnaires
    ADD CONSTRAINT vq_tax_mode_chk CHECK (tax_mode IN ('regular','kleinunternehmer','none'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. Abschnitte ("Fragerunden") ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_questionnaire_sections (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id UUID        NOT NULL REFERENCES vendor_questionnaires(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL DEFAULT '',
  description      TEXT        NOT NULL DEFAULT '',
  sort_order       INT         NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_vq_section_q ON vendor_questionnaire_sections(questionnaire_id);

-- ── 3. Fragen ─────────────────────────────────────────────────────────────────
-- type:   text | single | multi | number | boolean | date
-- options JSONB (single/multi): [{ id, label, price }]
-- pricing JSONB (number/boolean): { mode: 'none'|'per_unit'|'fixed', unitPrice?, price? }
CREATE TABLE IF NOT EXISTS vendor_questionnaire_questions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id UUID        NOT NULL REFERENCES vendor_questionnaires(id) ON DELETE CASCADE,
  section_id       UUID        NOT NULL REFERENCES vendor_questionnaire_sections(id) ON DELETE CASCADE,
  type             TEXT        NOT NULL DEFAULT 'text',
  label            TEXT        NOT NULL DEFAULT '',
  help_text        TEXT        NOT NULL DEFAULT '',
  required         BOOLEAN     NOT NULL DEFAULT false,
  options          JSONB       NOT NULL DEFAULT '[]'::jsonb,
  pricing          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  sort_order       INT         NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_vq_question_q ON vendor_questionnaire_questions(questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_vq_question_s ON vendor_questionnaire_questions(section_id);

DO $$ BEGIN
  ALTER TABLE vendor_questionnaire_questions
    ADD CONSTRAINT vqq_type_chk CHECK (type IN ('text','single','multi','number','boolean','date'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4. Angebote (1:1 zur Anfrage) ─────────────────────────────────────────────
-- status: draft (auto-erzeugt, nur Dienstleister) | released (freigegeben,
--         Brautpaar sichtbar) | accepted (vom Brautpaar angenommen) | declined
CREATE TABLE IF NOT EXISTS vendor_offers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       UUID        NOT NULL UNIQUE REFERENCES marketplace_requests(id) ON DELETE CASCADE,
  event_id         UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  dienstleister_id UUID        NOT NULL REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,
  status           TEXT        NOT NULL DEFAULT 'draft',
  answers          JSONB       NOT NULL DEFAULT '[]'::jsonb,
  standard_info    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  line_items       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  subtotal         NUMERIC     NOT NULL DEFAULT 0,
  tax_mode         TEXT        NOT NULL DEFAULT 'regular',
  tax_rate         NUMERIC     NOT NULL DEFAULT 0,
  tax_amount       NUMERIC     NOT NULL DEFAULT 0,
  total            NUMERIC     NOT NULL DEFAULT 0,
  currency         TEXT        NOT NULL DEFAULT 'EUR',
  valid_until      DATE,
  footer_note      TEXT        NOT NULL DEFAULT '',
  vendor_notes     TEXT        NOT NULL DEFAULT '',
  released_at      TIMESTAMPTZ,
  accepted_at      TIMESTAMPTZ,
  declined_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vendor_offers_dl    ON vendor_offers(dienstleister_id);
CREATE INDEX IF NOT EXISTS idx_vendor_offers_event ON vendor_offers(event_id);

DO $$ BEGIN
  ALTER TABLE vendor_offers
    ADD CONSTRAINT vo_status_chk CHECK (status IN ('draft','released','accepted','declined'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE vendor_offers
    ADD CONSTRAINT vo_tax_mode_chk CHECK (tax_mode IN ('regular','kleinunternehmer','none'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 5. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE vendor_questionnaires          ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_questionnaire_sections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_questionnaire_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_offers                  ENABLE ROW LEVEL SECURITY;

-- Fragebogen: NUR der verkn pfte Dienstleister-Eigent mer liest. Das Brautpaar
-- bekommt den Fragebogen ohne Preisfelder ber eine Service-Role-API. Schreiben
-- l uft ausschlie lich ber Service-Role-APIs (WITH CHECK false).
DROP POLICY IF EXISTS "vq_owner_select" ON vendor_questionnaires;
CREATE POLICY "vq_owner_select" ON vendor_questionnaires FOR SELECT USING (
  is_marketplace_vendor_user(dienstleister_id)
);
DROP POLICY IF EXISTS "vq_no_write" ON vendor_questionnaires;
CREATE POLICY "vq_no_write" ON vendor_questionnaires FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "vqs_owner_select" ON vendor_questionnaire_sections;
CREATE POLICY "vqs_owner_select" ON vendor_questionnaire_sections FOR SELECT USING (
  EXISTS (SELECT 1 FROM vendor_questionnaires vq
          WHERE vq.id = questionnaire_id AND is_marketplace_vendor_user(vq.dienstleister_id))
);
DROP POLICY IF EXISTS "vqs_no_write" ON vendor_questionnaire_sections;
CREATE POLICY "vqs_no_write" ON vendor_questionnaire_sections FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "vqq_owner_select" ON vendor_questionnaire_questions;
CREATE POLICY "vqq_owner_select" ON vendor_questionnaire_questions FOR SELECT USING (
  EXISTS (SELECT 1 FROM vendor_questionnaires vq
          WHERE vq.id = questionnaire_id AND is_marketplace_vendor_user(vq.dienstleister_id))
);
DROP POLICY IF EXISTS "vqq_no_write" ON vendor_questionnaire_questions;
CREATE POLICY "vqq_no_write" ON vendor_questionnaire_questions FOR INSERT WITH CHECK (false);

-- Angebote: der Dienstleister-Eigent mer sieht ALLE eigenen (inkl. Entwurf);
-- die Brautpaar-Seite erst ab Freigabe (status <> 'draft'). Schreiben
-- ausschlie lich ber Service-Role-APIs.
DROP POLICY IF EXISTS "vo_select" ON vendor_offers;
CREATE POLICY "vo_select" ON vendor_offers FOR SELECT USING (
  is_marketplace_vendor_user(dienstleister_id)
  OR (status <> 'draft'
      AND is_event_member(event_id, ARRAY['veranstalter','brautpaar','brautpaar_solo']::user_role[]))
);
DROP POLICY IF EXISTS "vo_no_write" ON vendor_offers;
CREATE POLICY "vo_no_write" ON vendor_offers FOR INSERT WITH CHECK (false);
