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
// GEFÜHRTES ANLEGEN
// -----------------
//  • interactive: true → die Seite bleibt während des Schritts bedienbar
//    (Klick/Eingabe geht durch die Abdunklung hindurch) und das Zielelement wird
//    nur dezent umrandet. So führen wir Schritt für Schritt durch ein Formular:
//    Add-Button → einzelne Felder → „Hinzufügen".
//  • advanceOnAppear: '<target>'    → Auto-Weiter, sobald dieses Element auftaucht
//    (z. B. das Formular nach Klick auf „Hinzufügen" → wir markieren dann die Felder).
//  • advanceOnDisappear: '<target>' → Auto-Weiter, sobald dieses Element verschwindet
//    (z. B. das Eingabefeld nach dem Speichern).
//  • action: { area } → Auto-Weiter, sobald der erste Datensatz in `area` angelegt
//    wurde (DB-Erkennung) — wird auf dem „Speichern"-Schritt genutzt, damit das Paar
//    die Bestätigung „Eintrag erstellt!" sieht.
//
// Schritte, die sich „selbst weiterschalten" (action / advanceOn*), zeigen bewusst
// KEINEN „Weiter"-Button — der Fortschritt hängt an der echten Aktion, sonst bleibt
// nur „Überspringen". Es wird niemand gezwungen.
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
  /** Seite bleibt bedienbar; Zielelement wird nur umrandet (Feld-Begleitung). */
  interactive?: boolean
  /** Auto-Weiter, sobald dieses data-tour-Element im DOM auftaucht. */
  advanceOnAppear?: string
  /** Auto-Weiter, sobald dieses data-tour-Element aus dem DOM verschwindet. */
  advanceOnDisappear?: string
  /**
   * Begleiteter Anlege-Abschluss: Auto-Weiter, sobald der erste Eintrag in `area`
   * existiert (DB-Erkennung). Macht die Seite zusätzlich bedienbar.
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
    body: 'Von diesen Kacheln springt ihr direkt in jeden Planungsbereich. Wir legen jetzt die ersten Einträge gemeinsam an.' },

  // ── Gäste: ersten Gast begleitet anlegen (Add → Name → E-Mail → Hinzufügen) ──
  { module: 'gaeste', target: 'bp-add-guest', interactive: true, advanceOnAppear: 'bp-guest-name',
    title: 'Euren ersten Gast anlegen',
    body: 'Tippt auf „Gast hinzufügen", um das Formular zu öffnen.' },
  { module: 'gaeste', target: 'bp-guest-name', interactive: true,
    title: 'Name',
    body: 'Tragt hier den Namen eures Gastes ein und tippt dann auf „Weiter".' },
  { module: 'gaeste', target: 'bp-guest-email', interactive: true,
    title: 'E-Mail (optional)',
    body: 'Mit einer E-Mail-Adresse könnt ihr später eine persönliche Einladung verschicken.' },
  { module: 'gaeste', target: 'bp-guest-submit', interactive: true, action: { area: 'guests' },
    title: 'Speichern',
    body: 'Tippt auf „Hinzufügen" — geschafft, euer erster Gast ist eingetragen!' },

  // ── Gäste: weitere Bereiche nur erklären (kein Anlegen erzwungen) ────────────
  { module: 'gaeste', target: 'bp-gtab-geschenke',
    title: 'Geschenkliste',
    body: 'Unter „Geschenkliste" sammelt ihr Geschenkwünsche, die eure Gäste reservieren können.' },
  { module: 'gaeste', target: 'bp-gtab-hotel',
    title: 'Hotel',
    body: 'Hinterlegt Hotels und Zimmerkontingente, damit Gäste beim RSVP direkt ein Zimmer anfragen können.' },
  { module: 'gaeste', target: 'bp-gtab-rsvp',
    title: 'Gäste einladen',
    body: 'Über „Einladungen" verschickt ihr persönliche RSVP-Links und verfolgt Zu- und Absagen.' },

  // ── Sitzplan ───────────────────────────────────────────────────────────────
  { module: 'sitzplan', target: 'bp-content',
    title: 'Sitzplan',
    body: 'Als Solo-Paar konfiguriert ihr Raumgröße und Tische selbst und platziert die Gäste per Drag-and-drop.' },

  // ── Ablaufplan: ersten Programmpunkt begleitet anlegen ──────────────────────
  { module: 'ablaufplan', target: 'bp-add-entry', interactive: true, action: { area: 'timeline_entries' },
    title: 'Euren ersten Programmpunkt anlegen',
    body: 'Tippt auf „Hinzufügen" oder zieht direkt auf die Zeitachse — tragt z. B. die Trauung mit Uhrzeit ein. Sobald der erste Punkt steht, geht es weiter.' },

  // ── Budget: ZUERST Maximalbudget, dann ersten Posten ────────────────────────
  { module: 'budget', target: 'bp-budget-max', interactive: true, advanceOnAppear: 'bp-budget-max-input',
    title: 'Zuerst: Gesamtbudget',
    body: 'Legt als Erstes euer maximales Budget fest — daran richtet sich die gesamte Kostenplanung aus. Tippt auf „Gesamtbudget festlegen".' },
  { module: 'budget', target: 'bp-budget-max-input', interactive: true, advanceOnDisappear: 'bp-budget-max-input',
    title: 'Maximalbudget eintragen',
    body: 'Tragt euer Gesamtbudget in Euro ein und speichert.' },
  { module: 'budget', target: 'bp-add-budget', interactive: true, advanceOnAppear: 'bp-budget-desc',
    title: 'Ersten Budget-Posten hinzufügen',
    body: 'Jetzt legt ihr einzelne Kostenpunkte an. Tippt auf „Position hinzufügen".' },
  { module: 'budget', target: 'bp-budget-desc', interactive: true,
    title: 'Beschreibung',
    body: 'Wofür ist der Posten? Zum Beispiel „Location". Dann auf „Weiter".' },
  { module: 'budget', target: 'bp-budget-planned', interactive: true,
    title: 'Geplante Kosten',
    body: 'Tragt den geplanten Betrag in Euro ein.' },
  { module: 'budget', target: 'bp-budget-submit', interactive: true, action: { area: 'budget_items' },
    title: 'Speichern',
    body: 'Mit „Hinzufügen" ist euer erster Budget-Posten angelegt.' },

  // ── Catering & Getränke ─────────────────────────────────────────────────────
  { module: 'catering-getraenke', target: 'bp-content',
    title: 'Catering & Getränke',
    body: 'Hier haltet ihr Menügänge, Service und Essenswünsche fest — und plant über den Reiter „Getränke" Mengen, Budget und Cocktails.' },

  // ── Musik ──────────────────────────────────────────────────────────────────
  { module: 'musik', target: 'bp-content',
    title: 'Musik',
    body: 'Sammelt Wunschlieder und bindet Playlists von Spotify, YouTube oder Apple Music direkt ein.' },

  // ── Bilder ───────────────────────────────────────────────────────────────────
  { module: 'medien', target: 'bp-content',
    title: 'Bilder',
    body: 'Haltet gewünschte Aufnahmen fest und sammelt nach der Feier die Fotos eurer Gäste.' },

  // ── Aufgaben: erste Aufgabe begleitet anlegen ───────────────────────────────
  { module: 'aufgaben-notizen', target: 'bp-add-task', interactive: true, advanceOnAppear: 'bp-task-title',
    title: 'Erste Aufgabe anlegen',
    body: 'Eure Checkliste nach Planungsphasen. Tippt auf „Aufgabe hinzufügen".' },
  { module: 'aufgaben-notizen', target: 'bp-task-title', interactive: true,
    title: 'Aufgabe beschreiben',
    body: 'Was ist zu tun? Zum Beispiel „Location besichtigen". Dann auf „Weiter".' },
  { module: 'aufgaben-notizen', target: 'bp-task-submit', interactive: true, action: { area: 'brautpaar_tasks' },
    title: 'Speichern',
    body: 'Mit „OK" landet die Aufgabe in eurer Checkliste.' },

  // ── Notizen ────────────────────────────────────────────────────────────────
  { module: 'aufgaben-notizen', target: 'bp-content',
    title: 'Notizen',
    body: 'Im Reiter „Notizen" haltet ihr schnelle Notizen und Checklisten fest — sie werden automatisch gespeichert.' },

  // ── Dienstleister ──────────────────────────────────────────────────────────
  { module: 'dienstleister', target: 'bp-content',
    title: 'Dienstleister',
    body: 'Ladet Dienstleister ein und steuert genau, welche Bereiche sie sehen und bearbeiten dürfen.' },

  // ── Dateien ────────────────────────────────────────────────────────────────
  { module: 'dateien', target: 'bp-content',
    title: 'Dateien',
    body: 'Verträge, Angebote und Dokumente sicher an einem zentralen Ort.' },

  // ── Allgemein + Anzeigeeinstellungen (Abschluss) ────────────────────────────
  { module: 'allgemein', target: 'bp-content',
    title: 'Allgemein',
    body: 'Hier bearbeitet ihr eure Eckdaten: Titel, Datum, Location und weitere Einstellungen.' },
  { module: 'allgemein', target: 'bp-display-settings',
    title: 'Anzeigeeinstellungen',
    body: 'Personalisiert Farbe, Schrift und Monogramm eures Portals und der Gast-Seiten — ganz nach eurem Stil.' },
  { module: 'allgemein',
    title: 'Geschafft!',
    body: 'Ihr kennt jetzt alle Bereiche von Forevr. Über das Hilfe-Symbol in der Seitenleiste könnt ihr diese Tour jederzeit erneut starten.' },
]
