// Schritt-Konfiguration der interaktiven Produkt-Tour für Solo-Brautpaare.
//
// Die Tour ist mehrseitig: jeder Schritt gehört zu einem Modul (= Route-Segment
// unter /brautpaar/[eventId]/<module>). Die Engine (components/tour/ProductTour)
// navigiert automatisch zur passenden Seite, hebt das per `target` referenzierte
// Element hervor (data-tour="<target>") und zeigt Titel + Text.
//
//  • target gesetzt → Spotlight auf das echte Bedienelement.
//  • target leer    → zentrierte Erklär-Karte (Seite bleibt sichtbar im Hintergrund).
//
// Gesperrte / zahlungspflichtige Bereiche (z. B. Abo, Nachrichten) sind hier
// bewusst NICHT enthalten — die Engine blendet zusätzlich Module aus, die für
// das Event nicht freigeschaltet sind.

/** Tabellen, deren erster Eintrag während der Tour begleitet angelegt wird. */
export type GuidedArea = 'guests' | 'timeline_entries' | 'brautpaar_tasks' | 'budget_items'

export interface TourStep {
  /** Modul-Schlüssel = Route-Segment unter /brautpaar/[eventId]/ */
  module: string
  /** data-tour-Anker zum Hervorheben; weglassen für eine zentrierte Karte */
  target?: string
  title: string
  body: string
  /**
   * Markiert einen begleiteten Anlege-Schritt: Die Engine macht die Seite
   * bedienbar, hebt das echte „Hinzufügen"-Element hervor und geht erst weiter,
   * sobald das Paar einen ersten Eintrag in `area` angelegt hat.
   */
  action?: { area: GuidedArea }
}

export const SOLO_TOUR_STEPS: TourStep[] = [
  // ── Übersicht ──────────────────────────────────────────────────────────────
  { module: 'uebersicht', target: 'ov-hero',
    title: 'Eure Übersicht',
    body: 'Willkommen! Hier seht ihr Countdown, Datum und Location eurer Hochzeit auf einen Blick.' },
  { module: 'uebersicht', target: 'ov-faden',
    title: 'Erste Schritte',
    body: 'Dieser geführte Faden zeigt euch immer, was als Nächstes dran ist. Hakt ihn Schritt für Schritt ab.' },
  { module: 'uebersicht', target: 'ov-stats',
    title: 'Eure Kennzahlen',
    body: 'Zusagen, Budget, Sitzplan und Aufgaben aktualisieren sich automatisch, sobald ihr plant.' },
  { module: 'uebersicht', target: 'ov-modules',
    title: 'Schnellzugriff',
    body: 'Von diesen Kacheln springt ihr direkt in jeden Planungsbereich. Wir gehen sie jetzt gemeinsam durch.' },

  // ── Gäste ──────────────────────────────────────────────────────────────────
  { module: 'gaeste', target: 'bp-content',
    title: 'Gästeliste',
    body: 'Hier verwaltet ihr alle Gäste, deren Begleitpersonen sowie Zu- und Absagen.' },
  { module: 'gaeste', target: 'bp-add-guest', action: { area: 'guests' },
    title: 'Legt euren ersten Gast an',
    body: 'Klickt auf „Gast hinzufügen", tragt einen Namen ein und speichert. Sobald euer erster Gast steht, geht es automatisch weiter.' },

  // ── Sitzplan ───────────────────────────────────────────────────────────────
  { module: 'sitzplan', target: 'bp-content',
    title: 'Sitzplan',
    body: 'Plant eure Tische und platziert die Gäste per Drag-and-drop im Raum.' },
  { module: 'sitzplan',
    title: 'Raum & Tische',
    body: 'Als Solo-Paar konfiguriert ihr Raumgröße und Tische selbst und weist jedem Platz einen Gast zu.' },

  // ── Ablaufplan ─────────────────────────────────────────────────────────────
  { module: 'ablaufplan', target: 'bp-content',
    title: 'Ablaufplan',
    body: 'Euer Tagesplan im Kalender-Stil — von der Trauung bis zur Party.' },
  { module: 'ablaufplan', target: 'bp-add-entry', action: { area: 'timeline_entries' },
    title: 'Legt euren ersten Programmpunkt an',
    body: 'Klickt auf „Punkt hinzufügen" und tragt z. B. die Trauung mit Uhrzeit ein. Sobald euer erster Programmpunkt steht, geht es weiter.' },

  // ── Catering & Menü ────────────────────────────────────────────────────────
  { module: 'catering', target: 'bp-content',
    title: 'Catering & Menü',
    body: 'Hier haltet ihr Menügänge, Service und die Essenswünsche eurer Gäste fest.' },

  // ── Getränke ───────────────────────────────────────────────────────────────
  { module: 'getraenke', target: 'bp-content',
    title: 'Getränke',
    body: 'Plant Mengen pro Person, das Getränke-Budget und sogar Cocktails samt Zutaten.' },

  // ── Dekoration ─────────────────────────────────────────────────────────────
  { module: 'dekoration', target: 'bp-content',
    title: 'Dekoration',
    body: 'Euer freies Moodboard: Bilder, Farben, Stoffe und Artikel frei auf einer Leinwand anordnen.' },
  { module: 'dekoration',
    title: 'Planung abschließen',
    body: 'Wenn die Deko steht, schließt ihr die Planung ab — die Positionen wandern dann automatisch ins Budget.' },

  // ── Musik ──────────────────────────────────────────────────────────────────
  { module: 'musik', target: 'bp-content',
    title: 'Musik',
    body: 'Sammelt Wunschlieder und bindet Playlists von Spotify, YouTube oder Apple Music direkt ein.' },

  // ── Foto & Videograf ───────────────────────────────────────────────────────
  { module: 'medien', target: 'bp-content',
    title: 'Foto & Videograf',
    body: 'Haltet gewünschte Aufnahmen fest und sammelt nach der Feier die Fotos eurer Gäste.' },

  // ── Budget ─────────────────────────────────────────────────────────────────
  { module: 'budget', target: 'bp-content',
    title: 'Budget',
    body: 'Behaltet geplante und tatsächliche Kosten jederzeit im Blick.' },
  { module: 'budget', target: 'bp-add-budget', action: { area: 'budget_items' },
    title: 'Legt euren ersten Budget-Posten an',
    body: 'Klickt auf „Position hinzufügen", z. B. „Location", und tragt den geplanten Betrag ein. Sobald euer erster Posten steht, geht es weiter.' },

  // ── Aufgaben ───────────────────────────────────────────────────────────────
  { module: 'aufgaben', target: 'bp-content',
    title: 'Aufgaben',
    body: 'Eure Checkliste nach Planungsphasen — so geht garantiert nichts unter.' },
  { module: 'aufgaben', target: 'bp-add-task', action: { area: 'brautpaar_tasks' },
    title: 'Hakt eure erste Aufgabe ab',
    body: 'Klickt auf „Aufgabe hinzufügen" und tragt eine erste To-do ein, z. B. „Location buchen". Sobald die erste Aufgabe steht, geht es weiter.' },

  // ── Notizen ────────────────────────────────────────────────────────────────
  { module: 'notizen', target: 'bp-content',
    title: 'Notizen',
    body: 'Schnelle Notizen und Checklisten, die automatisch gespeichert werden.' },

  // ── Dienstleister ──────────────────────────────────────────────────────────
  { module: 'dienstleister', target: 'bp-content',
    title: 'Dienstleister',
    body: 'Ladet Dienstleister ein und steuert genau, welche Bereiche sie sehen und bearbeiten dürfen.' },

  // ── Dateien ────────────────────────────────────────────────────────────────
  { module: 'dateien', target: 'bp-content',
    title: 'Dateien',
    body: 'Verträge, Angebote und Dokumente sicher an einem zentralen Ort.' },

  // ── Allgemein (Abschluss) ──────────────────────────────────────────────────
  { module: 'allgemein', target: 'bp-content',
    title: 'Allgemein',
    body: 'Hier bearbeitet ihr eure Eckdaten: Titel, Datum, Location und weitere Einstellungen.' },
  { module: 'allgemein',
    title: 'Geschafft!',
    body: 'Ihr kennt jetzt alle Bereiche von Forevr. Über das Hilfe-Symbol in der Seitenleiste könnt ihr diese Tour jederzeit erneut starten.' },
]
