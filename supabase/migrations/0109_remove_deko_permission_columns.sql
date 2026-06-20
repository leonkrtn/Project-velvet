-- 0109_remove_deko_permission_columns.sql
-- ════════════════════════════════════════════════════════════════════════════
-- Letzte Reste des entfernten Dekorations-Systems aus den Permission-Tabellen.
-- ════════════════════════════════════════════════════════════════════════════
-- Migration 0064 hat deko_wishes/decor_setup_items entfernt, 0108 das gesamte
-- Deko-Canvas-System. Übrig blieben zwei deko-spezifische Permission-Spalten,
-- die im Code nicht mehr referenziert werden:
--   • brautpaar_permissions.dekorationen   (aus 0003)
--   • trauzeuge_permissions.can_manage_deko (aus setup.sql)
-- Diese werden hier entfernt, damit keine Deko-Spuren mehr im Schema verbleiben.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE brautpaar_permissions DROP COLUMN IF EXISTS dekorationen;
ALTER TABLE trauzeuge_permissions DROP COLUMN IF EXISTS can_manage_deko;
