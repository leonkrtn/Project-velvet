-- ─────────────────────────────────────────────────────────────────────────────
-- 0093: Getränke-Alkohol pro Artikel, Menüstruktur je Menüart, Namens-Korrektur
--
-- 1. getraenke_artikel.is_alcoholic — Alkohol-Kennzeichen pro Getränk.
--    NULL = erbt den Kategorie-Default (getraenke_kategorien.is_alcoholic);
--    true/false = explizit pro Getränk gesetzt.
-- 2. catering_plans.menu_structure — JSONB für die menüart-spezifischen
--    Eingabemasken (Buffet-Stationen, À-la-carte-Speisekarte, einfache
--    Speisenliste für Fingerfood/BBQ):
--      { "buffet_stations": [{ "id", "name", "items": ["…"] }],
--        "carte_courses":   [{ "id", "name", "dishes": ["…"] }],
--        "simple_items":    ["…"] }
-- 3. Einmalige Korrektur komplett kleingeschriebener Namen (nur Datensätze,
--    die vollständig kleingeschrieben sind — Mixed-Case wie "McDonald" bleibt
--    unangetastet). Neue Eingaben werden ab jetzt in der App korrigiert.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE getraenke_artikel
  ADD COLUMN IF NOT EXISTS is_alcoholic BOOLEAN;

ALTER TABLE catering_plans
  ADD COLUMN IF NOT EXISTS menu_structure JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE guests
  SET name = initcap(name)
  WHERE name <> '' AND name = lower(name);

UPDATE begleitpersonen
  SET name = initcap(name)
  WHERE name IS NOT NULL AND name <> '' AND name = lower(name);
