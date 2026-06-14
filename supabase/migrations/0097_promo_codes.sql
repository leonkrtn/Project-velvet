-- 0097_promo_codes.sql
-- Influencer-/Promo-Code-System für Solo-Brautpaar-Abos.
--
-- Zwei Code-Typen:
--   percent      → X % Rabatt auf den Tarifpreis; Wirkung 'first_month' ODER 'forever'
--   free_months  → schaltet X Monate Pro-Zugang OHNE Zahlung frei
--
-- Codes gelten für beide Tarife (applies_to='all') oder gezielt für einen Tarif.
-- Limits: max_redemptions (NULL = unbegrenzt), valid_until (NULL = unbefristet),
-- active (manueller An/Aus-Schalter). Verwaltung/Statistik nur über Admin (/admin).
-- Zugriff ausschließlich per Service-Role (RLS an, keine Policies).

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL,
  code_norm       TEXT NOT NULL UNIQUE,                 -- upper(trim(code)) für Lookup/Eindeutigkeit
  label           TEXT,                                 -- Influencer/Kampagne, z. B. "Instagram @anna"
  type            TEXT NOT NULL CHECK (type IN ('percent', 'free_months')),
  percent_off     INT  CHECK (percent_off BETWEEN 1 AND 100),
  duration        TEXT CHECK (duration IN ('first_month', 'forever')),
  free_months     INT  CHECK (free_months BETWEEN 1 AND 36),
  applies_to      TEXT NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all', 'basis', 'pro')),
  max_redemptions INT  CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  valid_until     TIMESTAMPTZ,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Typ-Konsistenz: percent braucht percent_off + duration; free_months braucht free_months
  CONSTRAINT promo_type_fields CHECK (
    (type = 'percent'     AND percent_off IS NOT NULL AND duration IS NOT NULL) OR
    (type = 'free_months' AND free_months IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id      UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  event_id     UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  redeemed_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type         TEXT NOT NULL,
  plan         TEXT,                                    -- bezahlter Tarif (percent) bzw. 'pro' (free_months)
  percent_off  INT,
  free_months  INT,
  -- € Wert des gewährten Vorteils (für Statistik): bei free_months sofort,
  -- bei percent erst beim Checkout gesetzt (monatlicher Rabatt in €).
  discount_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (code_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_promo_redemptions_code  ON public.promo_redemptions(code_id);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_event ON public.promo_redemptions(event_id);

-- Angehängter Promo am Abo (für Preis-Anzeige + simulierten Checkout)
ALTER TABLE public.event_subscriptions
  ADD COLUMN IF NOT EXISTS promo_code_id    UUID REFERENCES public.promo_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promo_percent    INT,
  ADD COLUMN IF NOT EXISTS promo_duration   TEXT,
  ADD COLUMN IF NOT EXISTS promo_applies_to TEXT;

-- RLS: gesperrt — Zugriff nur über Service-Role (Admin-API + Redeem-API).
ALTER TABLE public.promo_codes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
