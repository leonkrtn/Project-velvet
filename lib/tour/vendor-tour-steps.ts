// Schritt-Konfiguration der Vendor-Portal-Erklärung.
//
// Kein Auto-Start — die Tour startet ausschließlich über den Hilfe-Button
// in der Seitenleiste (VENDOR_TOUR_START_EVENT wird von VendorSidebarShell
// dispatcht; VendorTour hört darauf).
//
// Jeder Schritt gehört zu einem Modul (= Route-Segment unter /vendor/<module>).
// Die Engine navigiert automatisch zur passenden Seite und hebt das per `target`
// referenzierte Element hervor (data-tour="<target>"). Ohne target: zentrierte Karte.
//
// interactive: true  → kein dunkler Overlay, Karte unten mittig, Nutzer kann
//                       weiterhin mit der Seite interagieren.
// advanceOnAppear    → auto-advance wenn ein Element mit data-tour="<value>" im DOM
//                       erscheint (z. B. nach einer Nutzerinteraktion).

export const VENDOR_TOUR_START_EVENT = 'fv-vendor-tour-start'

export interface VendorTourStep {
  /** Route-Segment; bestimmt die Zielseite via ROUTE_MAP in VendorTour.tsx. */
  module: string
  /** data-tour-Anker zum Hervorheben; weglassen für eine zentrierte Karte. */
  target?: string
  title: string
  body: string
  /** Kein dunkler Overlay — Nutzer kann mit der Seite interagieren. Karte unten mittig. */
  interactive?: boolean
  /** Auto-advance, wenn ein Element mit diesem data-tour-Wert im DOM erscheint. */
  advanceOnAppear?: string
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
    title: 'Anfrage öffnen',
    body: 'Klicke jetzt auf eine Anfrage, um sie zu öffnen. Forevr hat automatisch einen Angebotsentwurf vorbereitet — schau ihn dir an.',
    interactive: true,
    advanceOnAppear: 'vdr-offer-editor',
  },

  // ── Im Angebots-Editor ────────────────────────────────────────────────────
  {
    module: 'anfragen',
    target: 'vdr-offer-tabs',
    title: 'Antworten & Angebot',
    body: 'Unter „Antworten" siehst du, was das Brautpaar in deinem Formular ausgefüllt hat. Unter „Angebot" findest du den automatisch erstellten Entwurf — Positionen, Preise und Gesamtbetrag.',
    interactive: true,
  },
  {
    module: 'anfragen',
    target: 'vdr-offer-actions',
    title: 'Angebot bearbeiten & freigeben',
    body: 'Speichere den Entwurf, um ihn später zu vervollständigen. Wenn alles stimmt, gib das Angebot frei — das Brautpaar erhält es sofort und der Chat mit ihnen wird geöffnet. Mit „Anfrage ablehnen" kannst du sie auch zurückweisen.',
    interactive: true,
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

  // ── Anfrageformular ────────────────────────────────────────────────────────
  {
    module: 'anfrage-formular',
    title: 'Das Anfrageformular',
    body: 'Dieses Formular ist dein wichtigstes Werkzeug im Marktplatz. Brautpaare füllen es aus, bevor sie eine Anfrage stellen — ihre Antworten bilden die Grundlage für das automatische Angebot, das Forevr für dich erstellt.',
  },
  {
    module: 'anfrage-formular',
    target: 'vdr-fragebogen-actions',
    title: 'Aktivieren & Speichern',
    body: 'Aktiviere das Formular mit dem Schalter, damit Brautpaare es sehen können. Lade eine passende Vorlage für deine Kategorie, passe sie an und speichere — fertig.',
  },
  {
    module: 'anfrage-formular',
    target: 'vdr-fragebogen-allgemein',
    title: 'Titel & Einleitung',
    body: 'Gib dem Formular einen einladenden Titel und einen kurzen Einleitungstext. So weiß das Brautpaar sofort, was es erwartet — und du machst direkt einen professionellen ersten Eindruck.',
  },
  {
    module: 'anfrage-formular',
    target: 'vdr-fragebogen-sections',
    title: 'Abschnitte & Fragen',
    body: 'Strukturiere dein Formular in Abschnitte — z. B. „Über euch", „Event-Details", „Wünsche & Extras". Jeder Abschnitt kann beliebig viele Fragen enthalten: Freitext, Auswahl, Zahl oder Datum. Ordne sie mit den Pfeil-Buttons um.',
  },
  {
    module: 'anfrage-formular',
    target: 'vdr-fragebogen-pricing',
    title: 'Preislogik',
    body: 'Lege deinen Grundpreis, einen Preis pro Gast, einen Mindestbetrag und einen Wochenend-Aufschlag fest. Forevr rechnet daraus automatisch den ersten Angebotsentwurf — du prüfst und passt ihn vor dem Freigeben an.',
  },
  {
    module: 'anfrage-formular',
    target: 'vdr-fragebogen-tax',
    title: 'Steuer & Konditionen',
    body: 'Wähle deine Umsatzsteuerregelung (regulär, Kleinunternehmer oder netto), stelle Währung und Angebots-Gültigkeit ein und hinterlege eine Fußnote — z. B. Zahlungsbedingungen oder AGBs.',
  },

  // ── Abschluss ──────────────────────────────────────────────────────────────
  {
    module: 'anfrage-formular',
    title: 'Alles eingerichtet!',
    body: 'Dein Vendor-Portal ist vollständig eingerichtet. Über den Hilfe-Button in der Seitenleiste kannst du diese Erklärung jederzeit erneut starten.',
  },
]
