-- 0103_drop_seed_brautpaar_solo_basics.sql
-- ════════════════════════════════════════════════════════════════════════════
-- Rollback von Migration 0102 (seed_brautpaar_solo_basics)
-- ════════════════════════════════════════════════════════════════════════════
-- Das automatische/optionale Vorbefüllen beim Onboarding wurde verworfen und
-- durch eine begleitete Produkt-Tour ersetzt. Die in 0102 angelegte Funktion
-- wird hiermit wieder entfernt.
--
-- 0102 hat ausschließlich diese Funktion erstellt (keine Tabellen, keine Daten),
-- daher reicht ein DROP FUNCTION zur vollständigen Rücknahme.
-- ════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.seed_brautpaar_solo_basics(UUID, TEXT[]);
