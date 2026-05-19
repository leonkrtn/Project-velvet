-- 0086_brautpaar_solo_role.sql
-- ENUM-Erweiterung muss in einer eigenen Transaktion committed werden,
-- bevor der neue Wert in Funktionen (0087) referenziert werden kann.
-- PostgreSQL-Einschränkung: "unsafe use of new enum value in same transaction"

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'brautpaar_solo';
