-- ─────────────────────────────────────────────────────────────────────────────
-- 0094: Abo-System für Solo-Brautpaare (event_subscriptions)
--
-- Pricing: 3 Tage Trial (voller Pro-Umfang, ohne Zahlungsdaten) → danach
-- "basis" 25 €/Monat (Paar plant zu zweit) oder "pro" 55 €/Monat
-- (zusätzlich Veranstalter + Dienstleister im Event). Zahlung wird aktuell
-- nur SIMULIERT (kein Zahlungsdienstleister angebunden) — Status-Übergänge
-- laufen über /api/subscription/* mit Service-Role.
--
-- Gilt nur für Events mit brautpaar_solo-Mitglied; veranstalter-verwaltete
-- Events haben keine Subscription-Zeile und werden nicht gegated.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_subscriptions (
  event_id            UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  plan                TEXT NOT NULL DEFAULT 'trial'    CHECK (plan IN ('trial', 'basis', 'pro')),
  status              TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'canceled')),
  trial_ends_at       TIMESTAMPTZ,
  current_period_end  TIMESTAMPTZ,
  canceled_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE event_subscriptions ENABLE ROW LEVEL SECURITY;

-- Mitglieder dürfen den Abo-Status ihres Events lesen; Schreibzugriff nur
-- über Service-Role (API-Routen) — keine INSERT/UPDATE/DELETE-Policies.
DROP POLICY IF EXISTS event_subscriptions_select ON event_subscriptions;
CREATE POLICY event_subscriptions_select ON event_subscriptions
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge','dienstleister']::user_role[])
  );

-- Bestandsschutz: existierende Solo-Events werden als Pro/aktiv übernommen,
-- damit niemand durch die Einführung des Abos ausgesperrt wird.
INSERT INTO event_subscriptions (event_id, plan, status, current_period_end)
SELECT DISTINCT em.event_id, 'pro', 'active', now() + interval '100 years'
FROM event_members em
WHERE em.role = 'brautpaar_solo'
ON CONFLICT (event_id) DO NOTHING;
