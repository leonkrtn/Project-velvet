// Schritt-Konfiguration der Vendor-Portal-Erklärung.
//
// Kein Auto-Start — die Tour startet ausschließlich über den Hilfe-Button
// in der Seitenleiste (VENDOR_TOUR_START_EVENT wird von VendorSidebarShell
// dispatcht; VendorTour hört darauf).
//
// Jeder Schritt gehört zu einem Modul (= Route-Segment unter /vendor/<module>).
// Die Engine navigiert automatisch zur passenden Seite und hebt das per `target`
// referenzierte Element hervor (data-tour="<target>"). Ohne target: zentrierte Karte.

export const VENDOR_TOUR_START_EVENT = 'fv-vendor-tour-start'

export interface VendorTourStep {
  /** Route-Segment unter /vendor/<module>; bestimmt die Zielseite. */
  module: string
  /** data-tour-Anker zum Hervorheben; weglassen für eine zentrierte Karte. */
  target?: string
  title: string
  body: string
}

export const VENDOR_TOUR_STEPS: VendorTourStep[] = [

  // ── Übersicht ──────────────────────────────────────────────────────────────
  {
    module: 'ubersicht',
    title: 'Willkommen in deinem Portal',
    body: 'Hier siehst du auf einen Blick, wie dein Geschäft läuft — Anfragen, Angebote, Events und der Gesamtwert deiner Pipeline.',
  },
  {
    module: 'ubersicht',
    target: 'vdr-stats',
    title: 'Deine Kennzahlen',
    body: 'Offene Anfragen, versendete Angebote, bevorstehende Events und der Pipeline-Wert — alles aktuell auf einen Blick. Ein Klick auf eine Kachel führt direkt zum jeweiligen Bereich.',
  },
  {
    module: 'ubersicht',
    target: 'vdr-attention',
    title: 'Handlungsbedarf',
    body: 'Hier erscheinen neue Anfragen, auf die du noch nicht reagiert hast. Klicke auf einen Eintrag, um ihn direkt zu öffnen und zu beantworten.',
  },
  {
    module: 'ubersicht',
    target: 'vdr-pipeline',
    title: 'Pipeline',
    body: 'Die Pipeline zeigt, wie viel Umsatz in offenen Anfragen und versendeten Angeboten steckt — aufgeteilt nach Phase, damit du siehst, wo Potenzial schlummert.',
  },

  // ── Anfragen ───────────────────────────────────────────────────────────────
  {
    module: 'anfragen',
    title: 'Marktplatz-Anfragen',
    body: 'Hier landen alle Anfragen von Brautpaaren, die dich über den Forevr-Marktplatz kontaktiert haben. Jede Anfrage enthält Event-Details, Gästezahl, Budget und den Kontakt zum Brautpaar.',
  },
  {
    module: 'anfragen',
    target: 'vdr-anfragen-filters',
    title: 'Status-Filter',
    body: 'Wechsle zwischen offenen, angenommenen und erledigten Anfragen. Jeder Tab zeigt die Anzahl — so siehst du sofort, was noch aussteht.',
  },
  {
    module: 'anfragen',
    target: 'vdr-anfragen-list',
    title: 'Anfrage öffnen & Angebot erstellen',
    body: 'Klicke auf eine Anfrage, um alle Details zu sehen. Von dort aus kannst du direkt ein automatisch vorbereitetes Angebot prüfen, anpassen und versenden — oder die Anfrage löschen.',
  },

  // ── Angebote ───────────────────────────────────────────────────────────────
  {
    module: 'angebote',
    title: 'Deine Angebote',
    body: 'Alle Angebote über sämtliche Events hinweg, gruppiert nach Status: Entwurf, Versendet, Angenommen oder Abgelehnt. So verlierst du nie den Überblick.',
  },
  {
    module: 'angebote',
    target: 'vdr-angebote-search',
    title: 'Suche',
    body: 'Finde Angebote schnell nach Brautpaar-Name, Datum oder der Angebots-ID — hilfreich, wenn du viele Events parallel betreust.',
  },
  {
    module: 'angebote',
    target: 'vdr-angebote-list',
    title: 'Angebots-Kacheln',
    body: 'Jede Kachel zeigt Brautpaar, Datum, Status und Gesamtbetrag. Ein Klick öffnet das vollständige Angebot, wo du es bearbeiten, freigeben oder als PDF herunterladen kannst.',
  },

  // ── Events ────────────────────────────────────────────────────────────────
  {
    module: 'events',
    title: 'Deine Events',
    body: 'Alle Hochzeiten und Events, bei denen du als Dienstleister dabei bist — ob über den Marktplatz oder per direkter Einladung vom Veranstalter.',
  },
  {
    module: 'events',
    target: 'vdr-events-controls',
    title: 'Suche & Archiv',
    body: 'Suche nach Event-Name oder Code. Mit dem Archiv-Button blendet du vergangene Events aus der Hauptliste aus — und kannst sie jederzeit wieder einblenden.',
  },
  {
    module: 'events',
    target: 'vdr-events-list',
    title: 'Ins Event-Portal',
    body: 'Ein Klick öffnet das Event-Portal mit Kommunikation, Informationen und deinen Angeboten für diese Veranstaltung.',
  },

  // ── Im Event: Kommunikation & Informationen (zentrierte Erklärung) ─────────
  {
    module: 'events',
    title: 'Im Event: Kommunikation',
    body: 'Innerhalb eines Events findest du unter „Kommunikation" den Chat mit dem Brautpaar — inklusive Dateianhängen. Das Brautpaar kann dort Daten teilen, z. B. Gästezahl oder Ablaufplan.',
  },
  {
    module: 'events',
    title: 'Im Event: Informationen & Notizen',
    body: 'Unter „Informationen" siehst du alle Eckdaten: Datum, Location, Kontaktpersonen und eine private Notizfläche — nur für dich sichtbar, ideal für interne Vermerke.',
  },

  // ── Listing ────────────────────────────────────────────────────────────────
  {
    module: 'listing',
    title: 'Dein Anbieter-Profil',
    body: 'Hier pflegst du deinen Auftritt im Forevr-Marktplatz: Angaben, Fotos, Pakete, FAQs und dein individuelles Anfrageformular.',
  },
  {
    module: 'listing',
    target: 'vdr-listing-tabs',
    title: 'Anzeige & Anfrageformular',
    body: 'Unter „Anzeige" bearbeitest du dein öffentliches Profil. Im „Anfrageformular" gestaltest du die Fragen, die Brautpaare beim Anfragen ausfüllen — inklusive deiner Preislogik für automatische Angebote.',
  },
  {
    module: 'listing',
    target: 'vdr-listing-gallery',
    title: 'Galerie',
    body: 'Lade Fotos hoch, die deinen Stil und deine Arbeit zeigen. Das erste Bild dient als Titelbild im Marktplatz. Du kannst die Reihenfolge per Pfeil-Buttons anpassen.',
  },

  // ── Abschluss ──────────────────────────────────────────────────────────────
  {
    module: 'listing',
    title: 'Geschafft!',
    body: 'Du kennst jetzt alle Funktionen deines Vendor-Portals. Über den Hilfe-Button in der Seitenleiste kannst du diese Erklärung jederzeit erneut starten.',
  },
]
