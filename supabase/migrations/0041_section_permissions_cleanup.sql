-- Remove old item-level rows that reference individual DB rows (not section keys).
-- Section permissions are now stored as item_id = '<section_key>' (e.g. 'wunschliste').
-- Old rows with item_id pointing to song/decor/media row UUIDs can be cleared.
-- New tab-keys (veranstaltungsort, gaesteliste, dokumente) need no schema change
-- because tab_key has no CHECK constraint.
DELETE FROM dienstleister_permissions
WHERE item_id IS NOT NULL
  AND item_id NOT IN (
    'kpis','budget','kontakte','margin','todos',
    'eventdetails','location','gaeste','essen','kosten','notizen',
    'konzept','getraenke','menuplan','zusatz','statistik',
    'lesen','erstellen','teilnehmer',
    'dienstleister','hotel','deko',
    'anzeigen','bearbeiten','zuweisungen',
    'anforderungen','wunschliste','nogos','playlist',
    'lieferung','torte','dessert','kuehlung','preis',
    'aufbau','wunschboard',
    'foto','video','einschraenkungen','shotliste',
    'plan',
    'adresse','kontakt','zugang','logistik','grundriss',
    'namen','tische','status',
    'vertraege','versicherungen','genehmigungen','rider','sonstige'
  );
