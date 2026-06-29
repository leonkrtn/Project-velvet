-- ─────────────────────────────────────────────────────────────────────────────
-- 0126 — Beratungs-Modus entfernen
--
-- Der Beratungs-Modus (vendor_questionnaires.consult_mode, eingefuehrt in 0120)
-- entfaellt: Ein Auto-Angebot ist ohnehin nur ein Entwurf als Input fuer den
-- Dienstleister — er entscheidet selbst, ob und wann er es freigibt. Anfragen
-- koennen jederzeit auch ohne Angebot angenommen werden (Chat oeffnet sich).
-- Ein separater Modus, der das Auto-Angebot unterdrueckt, ist damit redundant.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE vendor_questionnaires
  DROP COLUMN IF EXISTS consult_mode;
