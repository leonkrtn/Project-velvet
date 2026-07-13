// Schritt-Konfiguration der Vendor-Portal-Erklärung (ausführliche Hilfe).
//
// Start ausschließlich über das Hilfe-Menü (VendorHelpMenu → VENDOR_TOUR_START_EVENT
// als CustomEvent). Ohne `area` im Event-Detail läuft der komplette Rundgang;
// mit `area` werden nur die Schritte dieses Bereichs gezeigt.
//
// `module` bestimmt die Zielseite (ROUTE_MAP in VendorTour.tsx). `area` gruppiert
// die Schritte für die Bereichsauswahl und die Hilfe-Seite (mehrere Areas können
// auf demselben module liegen, z. B. Kalender lebt auf der Übersicht).
//
// `target` hebt ein Element hervor (data-tour="<target>"); ohne target: zentrierte
// Karte. interactive / advanceOnAppear wie bisher.

export const VENDOR_TOUR_START_EVENT = 'fv-vendor-tour-start'

export type VendorArea =
  | 'ubersicht' | 'kalender' | 'anfragen' | 'angebote' | 'events'
  | 'berichte' | 'crm' | 'automatik' | 'listing' | 'anfrage-formular'

export interface VendorAreaMeta { key: VendorArea; label: string }

// Reihenfolge = Reihenfolge im kompletten Rundgang, im Hilfe-Menü und auf der Hilfe-Seite.
export const VENDOR_AREAS: VendorAreaMeta[] = [
  { key: 'ubersicht',        label: 'Übersicht' },
  { key: 'kalender',         label: 'Kalender & Termine' },
  { key: 'anfragen',         label: 'Anfragen' },
  { key: 'angebote',         label: 'Angebote' },
  { key: 'events',           label: 'Events & Kommunikation' },
  { key: 'berichte',         label: 'Berichte' },
  { key: 'crm',              label: 'CRM' },
  { key: 'automatik',        label: 'Automatik' },
  { key: 'listing',          label: 'Marktplatz-Auftritt' },
  { key: 'anfrage-formular', label: 'Anfrageformular' },
]

export interface VendorTourStep {
  /** Route-Segment; bestimmt die Zielseite via ROUTE_MAP in VendorTour.tsx. */
  module: string
  /** Bereich für Auswahl/Hilfe-Seite. */
  area: VendorArea
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

  // ── Übersicht ────────────────────────────────────────────────────────────────
  { module: 'ubersicht', area: 'ubersicht',
    title: 'Willkommen in deinem Portal',
    body: 'Die Übersicht zeigt auf einen Blick, wie dein Geschäft läuft — offene Anfragen, versendete Angebote, anstehende Events und der Wert deiner Pipeline.' },
  { module: 'ubersicht', area: 'ubersicht', target: 'vdr-stats',
    title: 'Deine Kennzahlen',
    body: 'Vier Kacheln: offene Anfragen, versendete Angebote (mit €-Wert), anstehende Events (inkl. „nächstes in X Tagen") und Pipeline-Wert. Ein Klick auf eine Kachel führt direkt in den Bereich.' },
  { module: 'ubersicht', area: 'ubersicht', target: 'vdr-attention',
    title: 'Handlungsbedarf',
    body: 'Neue Anfragen, auf die du noch nicht reagiert hast, sammeln sich hier. Klicke einen Eintrag an, um ihn direkt zu öffnen und zu beantworten.' },
  { module: 'ubersicht', area: 'ubersicht', target: 'vdr-pipeline',
    title: 'Pipeline',
    body: 'Zeigt, wie viel Umsatz in offenen Anfragen und versendeten Angeboten steckt — aufgeteilt nach Phase, damit du siehst, wo Potenzial liegt.' },

  // ── Kalender & Termine (lebt auf der Übersicht) ──────────────────────────────
  { module: 'ubersicht', area: 'kalender',
    title: 'Dein Kalender',
    body: 'Unten auf der Übersicht findest du deinen Kalender. Er bündelt eigene Termine und automatisch eingetragene Ereignisse aus deinen Buchungen — mit Ansichten für Monat, Woche und Agenda.' },
  { module: 'ubersicht', area: 'kalender',
    title: 'Termin anlegen & bearbeiten',
    body: 'Über „+ Termin" legst du einen Eintrag an: Titel, Datum/Enddatum, Kategorie (Erinnerung, Zahlung, Termin), Farbe und Notiz. Eigene Einträge lassen sich jederzeit per Klick bearbeiten oder löschen.' },
  { module: 'ubersicht', area: 'kalender',
    title: 'Automatische Einträge',
    body: 'Hochzeitsdaten deiner Events, Ablauf-Fristen deiner Angebote und fällige Anzahlungen erscheinen automatisch (nicht editierbar). Ein Klick darauf führt zum passenden Event oder Angebot.' },
  { module: 'ubersicht', area: 'kalender',
    title: 'Als .ics herunterladen',
    body: 'Mit „iCal" lädst du deinen Kalender als .ics-Datei herunter und importierst ihn in Apple Kalender, Outlook & Co. (Der Button ist am Desktop oben im Kalender.)' },
  { module: 'ubersicht', area: 'kalender',
    title: 'Mit Google Calendar abonnieren',
    body: 'Über „Google Calendar" abonnierst du deinen Forevr-Kalender als Live-Feed — neue Termine erscheinen automatisch in Google. Der Feed-Link funktioniert auch als iCal-Abo in anderen Apps. Hinweis: Es ist ein Export/Abo, keine Zwei-Wege-Synchronisation.' },

  // ── Anfragen ─────────────────────────────────────────────────────────────────
  { module: 'anfragen', area: 'anfragen',
    title: 'Marktplatz-Anfragen',
    body: 'Hier landen alle Anfragen von Brautpaaren aus dem Forevr-Marktplatz — mit Event-Details, Gästezahl, Budget und Kontakt zum Brautpaar.' },
  { module: 'anfragen', area: 'anfragen', target: 'vdr-anfragen-filters',
    title: 'Status-Filter',
    body: 'Wechsle zwischen Offen, Angenommen und Erledigt. Jeder Tab zeigt die Anzahl — so siehst du sofort, was noch aussteht. Über die Suche findest du Anfragen nach Name, Datum oder ID.' },
  { module: 'anfragen', area: 'anfragen', target: 'vdr-anfragen-list',
    title: 'Anfrage öffnen',
    body: 'Klicke jetzt auf eine Anfrage, um sie zu öffnen. Forevr hat aus deinem Anfrageformular automatisch einen Angebotsentwurf vorbereitet — schau ihn dir an.',
    interactive: true, advanceOnAppear: 'vdr-offer-editor' },
  { module: 'anfragen', area: 'anfragen', target: 'vdr-offer-answers',
    title: 'Antworten & Angebot',
    body: 'Oben siehst du direkt, was das Brautpaar im Anfrageformular ausgefüllt hat. Darunter den automatisch erstellten Angebotsentwurf — Positionen, Preise, Gesamtbetrag.',
    interactive: true },
  { module: 'anfragen', area: 'anfragen', target: 'vdr-offer-actions',
    title: 'Bearbeiten, freigeben, ablehnen',
    body: 'Speichere den Entwurf zum späteren Vervollständigen, oder gib das Angebot frei — das Brautpaar erhält es sofort und der Chat öffnet sich. Du kannst die Anfrage auch „ohne Angebot annehmen" (öffnet nur den Chat) oder ablehnen.',
    interactive: true },

  // ── Angebote ─────────────────────────────────────────────────────────────────
  { module: 'angebote', area: 'angebote',
    title: 'Deine Angebote',
    body: 'Alle Angebote über sämtliche Events hinweg, gruppiert nach Status: Entwurf, Versendet, Angenommen, Abgelehnt. Über „Filter & Sortierung" grenzt du nach Status, Preis oder Datum ein.' },
  { module: 'angebote', area: 'angebote', target: 'vdr-angebote-search',
    title: 'Suche',
    body: 'Finde Angebote schnell nach Brautpaar, Datum oder Angebots-ID — praktisch, wenn du viele Events parallel betreust.' },
  { module: 'angebote', area: 'angebote', target: 'vdr-angebote-list',
    title: 'Angebots-Kacheln',
    body: 'Jede Kachel zeigt Brautpaar, Datum, Status und Betrag. Ein Klick öffnet das vollständige Angebot zum Bearbeiten, Freigeben oder als PDF herunterladen.' },
  { module: 'angebote', area: 'angebote',
    title: 'Neues Angebot erstellen',
    body: 'Über „Neues Angebot" wählst du: mit Event verknüpft oder eigenständig, und als Quelle „Aus Preislogik" (vorbefüllt aus deinem Anfrageformular) oder „Leeres Angebot".' },
  { module: 'angebote', area: 'angebote',
    title: 'Positionen & Bausteine',
    body: 'Im Editor baust du Positionen zusammen. Häufig genutzte Leistungen speicherst du als „Baustein" und fügst sie per Klick wieder ein — inklusive Branchen-Vorlagen.' },
  { module: 'angebote', area: 'angebote',
    title: 'Varianten (Gut / Besser / Premium)',
    body: 'Lege pro Angebot mehrere Varianten an. Das Brautpaar wählt genau eine aus; jede Variante hat ihr eigenes PDF. Ideal, um Auswahlmöglichkeiten anzubieten, ohne mehrere Angebote zu pflegen.' },
  { module: 'angebote', area: 'angebote',
    title: 'Anzahlung, AGB & neue Version',
    body: 'Hinterlege Anzahlung (%/fix), Fälligkeit, Zahlungsbedingungen und AGB (optional pflichtig). Für ein bereits versendetes Angebot erstellst du mit „Neue Version" eine überarbeitete Fassung; die alte wird als ersetzt markiert.' },
  { module: 'angebote', area: 'angebote',
    title: 'PDF herunterladen',
    body: 'Jedes Angebot gibt es als PDF mit deinem Branding (Markenfarbe & Logo) — Live-Vorschau im Editor, Download per Button.' },

  // ── Events & Kommunikation ───────────────────────────────────────────────────
  { module: 'events', area: 'events',
    title: 'Deine Events',
    body: 'Alle Hochzeiten und Events, bei denen du dabei bist — über den Marktplatz oder per direkter Einladung. Events beitreten geht über den Einladungslink; hier verwaltest du bestehende.' },
  { module: 'events', area: 'events', target: 'vdr-events-controls',
    title: 'Suche & Archiv',
    body: 'Suche nach Event-Name oder Code. Mit „Archiv" blendest du vergangene Events aus der Hauptliste aus und bei Bedarf wieder ein (nur für deine Ansicht).' },
  { module: 'events', area: 'events', target: 'vdr-events-list',
    title: 'Ins Event-Portal',
    body: 'Ein Klick öffnet das Event-Portal mit Kommunikation, Informationen und deinen Angeboten für dieses Event.' },
  { module: 'events', area: 'events',
    title: 'Kommunikation & Dateien',
    body: 'Im Event chattest du unter „Kommunikation" direkt mit Brautpaar/Veranstalter — inklusive Dateianhängen. Alle geteilten Dateien findest du gebündelt in der Seitenleiste.' },
  { module: 'events', area: 'events',
    title: 'Daten anfordern',
    body: 'Mit „Daten anfordern" holst du gezielt Infos ein (z. B. finale Gästezahl, Anfahrtsadresse, Aufbauzeit, Strom/Technik). Das Brautpaar bekommt ein kleines Formular; die Antwort landet strukturiert im Chat.' },
  { module: 'events', area: 'events',
    title: 'Geteilte Daten & interne Notizen',
    body: 'Das Brautpaar kann dir Modul-Daten teilen (Snapshot oder live), die du im Chat als „Geteilte Daten" siehst. Unter „Informationen" gibt es zudem eine private Notizfläche — nur für dich.' },

  // ── Berichte ─────────────────────────────────────────────────────────────────
  { module: 'report', area: 'berichte',
    title: 'Berichte',
    body: 'Deine Auswertung: Umsatz, Auftragswerte, Pipeline, Anfrage-/Angebotszahlen und Conversion-Rate — pro Zeitraum. Kundennamen sind anonymisiert.' },
  { module: 'report', area: 'berichte',
    title: 'Zeitraum & Vergleich',
    body: 'Wähle Monat oder Quartal und vergleiche gegen die Vorperiode oder das Vorjahr — die Veränderung erscheint als Prozent-Badge an jeder Kennzahl.' },
  { module: 'report', area: 'berichte',
    title: 'Als Excel oder PDF exportieren',
    body: 'Oben rechts exportierst du den Bericht als Excel (zum Weiterrechnen) oder als PDF (zum Ablegen/Weitergeben) — mit einem Klick.' },

  // ── CRM ──────────────────────────────────────────────────────────────────────
  { module: 'crm', area: 'crm',
    title: 'CRM — deine Kontakte',
    body: 'Alle Brautpaare und Leads an einem Ort — als Liste oder Kanban-Board. Ziehe Karten zwischen den Phasen Lead → Anfrage → Gebucht → Ehemalig.' },
  { module: 'crm', area: 'crm',
    title: 'Aktivitäten & Aufgaben',
    body: 'Pro Kontakt hältst du Notizen, Anrufe und Termine fest und legst Aufgaben mit Fälligkeit an. Der „Aufgaben"-Bereich bündelt alle offenen To-dos nach Überfällig/Heute/Diese Woche.' },
  { module: 'crm', area: 'crm',
    title: 'Import, Export & Auto-Import',
    body: '„Auto-Import" zieht Kontakte automatisch aus Anfragen/Angeboten/Events. Zusätzlich gibt es CSV-Import (mit Vorlage) und CSV-Export deiner Kontakte. Erinnerungen für Geburtstage und Jahrestage warnen dich rechtzeitig.' },

  // ── Automatik ────────────────────────────────────────────────────────────────
  { module: 'automatik', area: 'automatik',
    title: 'Automatik',
    body: 'Wiederkehrende Schritte laufen automatisch. Jede Regel hat einen Schalter, einen Zeitversatz (Tage) und einen Event-Typ-Bezug — und speichert sich selbst.' },
  { module: 'automatik', area: 'automatik',
    title: 'Die vier Regeln',
    body: 'Erinnerung vor dem Event · Bewertung anfragen (Mail nach dem Event) · Offenes Angebot nachfassen · Inaktiven Lead wiedervorlegen (CRM-Aufgabe). Pro Kind kannst du mehrere Regeln anlegen.' },
  { module: 'automatik', area: 'automatik',
    title: 'E-Mail bei neuer Anfrage & manuelle Bewertung',
    body: 'Unter „Benachrichtigungen" aktivierst du eine E-Mail (mit Excel-Anhang) bei jeder neuen Anfrage — für neue Konten schon voreingestellt. Unter „Manuelle Aktionen" fragst du pro Event eine Bewertung direkt an.' },

  // ── Anbieter-Profil ──────────────────────────────────────────────────────────
  { module: 'listing', area: 'listing',
    title: 'Dein Anbieter-Profil',
    body: 'Hier pflegst du deinen Marktplatz-Auftritt: Angaben, Logo, Fotos, Markenfarbe, Pakete, FAQs — mit Live-Vorschau rechts, exakt so, wie das Brautpaar dich sieht.' },
  { module: 'listing', area: 'listing', target: 'vdr-listing-tabs',
    title: 'Anzeige & Anfrageformular',
    body: 'Unter „Anzeige" bearbeitest du dein öffentliches Profil. Im „Anfrageformular" gestaltest du die Fragen samt Preislogik für automatische Angebote.' },
  { module: 'listing', area: 'listing', target: 'vdr-listing-gallery',
    title: 'Galerie & Markenfarbe',
    body: 'Lade Fotos hoch, die deinen Stil zeigen (erstes Bild = Titelbild). Deine Markenfarbe färbt Angebots-PDFs, Mails ans Brautpaar und Akzente auf deiner öffentlichen Anbieterseite. Pflichtfelder sind mit * markiert.' },
  { module: 'listing', area: 'listing',
    title: 'Zur Prüfung einreichen',
    body: 'Ist alles ausgefüllt (Firma, Beschreibung, Stadt, Logo, mind. 1 Foto, Kontakt), reichst du dein Profil zur Freigabe ein. Die einmalige Prüfung stellt sicher, dass nur seriöse Anbieter gelistet sind — meist in unter 24 Stunden.' },

  // ── Anfrageformular ──────────────────────────────────────────────────────────
  { module: 'anfrage-formular', area: 'anfrage-formular',
    title: 'Das Anfrageformular',
    body: 'Dein wichtigstes Werkzeug im Marktplatz: Brautpaare füllen es aus, bevor sie anfragen — ihre Antworten bilden die Grundlage für das automatische Angebot.' },
  { module: 'anfrage-formular', area: 'anfrage-formular', target: 'vdr-fragebogen-actions',
    title: 'Aktivieren, Vorschau & Speichern',
    body: 'Aktiviere das Formular mit dem Schalter, damit Brautpaare es sehen. Über „Vorschau" siehst du die Brautpaar-Sicht. Lade eine Vorlage für deine Kategorie, passe sie an und speichere.' },
  { module: 'anfrage-formular', area: 'anfrage-formular', target: 'vdr-fragebogen-allgemein',
    title: 'Titel & Einleitung',
    body: 'Gib dem Formular einen einladenden Titel und einen kurzen Einleitungstext — so machst du direkt einen professionellen Eindruck.' },
  { module: 'anfrage-formular', area: 'anfrage-formular', target: 'vdr-fragebogen-sections',
    title: 'Abschnitte & Fragen',
    body: 'Strukturiere in Abschnitte (z. B. „Über euch", „Event-Details", „Extras"). Jeder Abschnitt hat beliebig viele Fragen: Freitext, Auswahl, Zahl, Datum. Umsortieren per Pfeil-Buttons.' },
  { module: 'anfrage-formular', area: 'anfrage-formular', target: 'vdr-fragebogen-pricing',
    title: 'Reiter „Preise"',
    body: 'Grundpreis, Preis pro Gast, Mengenstaffeln, Saison-Aufschläge und Anfahrtskosten — daraus rechnet Forevr automatisch den ersten Angebotsentwurf, den du vor dem Freigeben anpasst.' },
  { module: 'anfrage-formular', area: 'anfrage-formular', target: 'vdr-fragebogen-tax',
    title: 'Reiter „Konditionen"',
    body: 'Umsatzsteuerregelung (regulär, Kleinunternehmer, netto), Währung, Angebots-Gültigkeit und eine Fußnote (z. B. Zahlungsbedingungen).' },
  { module: 'anfrage-formular', area: 'anfrage-formular',
    title: 'Alles eingerichtet!',
    body: 'Dein Portal ist startklar. Über den Hilfe-Button in der Seitenleiste kannst du diese Erklärung jederzeit erneut starten — komplett oder für einen einzelnen Bereich.' },
]
