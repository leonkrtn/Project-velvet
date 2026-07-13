-- Ein Angebot darf nur vom Empfänger (Brautpaar/Veranstalter) über die
-- normalen Annahme-Endpunkte (/api/marketplace/offers/[requestId],
-- /api/couple/offers/[offerId]) als 'accepted' markiert werden. Für den
-- Ausnahmefall, dass ein Dienstleister eine Zusage außerhalb des Systems
-- erhalten hat (z. B. mündlich) und das Angebot selbst als angenommen
-- vermerken will, hält accepted_by_vendor fest, dass dies eine
-- Eigenmarkierung des Dienstleisters war und keine echte Kundenbestätigung.
alter table vendor_offers
  add column if not exists accepted_by_vendor boolean not null default false;
